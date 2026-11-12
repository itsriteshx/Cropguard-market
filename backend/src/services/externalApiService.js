const DEFAULT_DATA_GOV_PUBLIC_KEY = '579b464db66ec23bdd000001cdd3946e44ce4aad7209ff7b23ac571b';
const DEFAULT_DATA_GOV_RESOURCE_ID = '9ef84268-d588-465a-a308-a864a43d0070';

const getApiConfig = () => {
  const resourceId = process.env.DATA_GOV_RESOURCE_ID || DEFAULT_DATA_GOV_RESOURCE_ID;
  const dataGovBaseRoot = (process.env.DATA_GOV_BASE_URL || 'https://api.data.gov.in/resource').replace(/\/+$/, '');
  return {
    dataGovApiKey: process.env.DATA_GOV_API_KEY || DEFAULT_DATA_GOV_PUBLIC_KEY,
    dataGovEndpoint: `${dataGovBaseRoot}/${resourceId}`,
    openMeteoForecastUrl: process.env.OPEN_METEO_FORECAST_URL || 'https://api.open-meteo.com/v1/forecast',
    openMeteoGeocodeUrl: process.env.OPEN_METEO_GEOCODE_URL || 'https://geocoding-api.open-meteo.com/v1/search',
    indiaPostPincodeUrl: (process.env.INDIA_POST_PINCODE_URL || 'https://api.postalpincode.in/pincode').replace(/\/+$/, ''),
    wikipediaSummaryUrl: (process.env.WIKIPEDIA_SUMMARY_URL || 'https://en.wikipedia.org/api/rest_v1/page/summary').replace(/\/+$/, ''),
  };
};

const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes
const MEDIA_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

const apiCache = new Map();
const mediaCache = new Map();
const geoCache = new Map();
const inFlightRequests = new Map();
const lastDbSyncByState = new Map();
let rateLimitedUntil = 0;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function getCached(map, key, ttlMs) {
  const entry = map.get(key);
  if (!entry) return undefined;
  if (Date.now() - entry.timestamp > ttlMs) {
    map.delete(key);
    return undefined;
  }
  return entry.value;
}

function setCached(map, key, value) {
  map.set(key, { value, timestamp: Date.now() });
}

/**
 * Haversine distance in kilometers between two [longitude, latitude] coordinate pairs.
 */
function calculateDistanceKm(coordsA, coordsB) {
  if (!Array.isArray(coordsA) || !Array.isArray(coordsB) || coordsA.length < 2 || coordsB.length < 2) {
    return null;
  }
  const [lon1, lat1] = coordsA.map(Number);
  const [lon2, lat2] = coordsB.map(Number);
  if (
    !Number.isFinite(lon1) || !Number.isFinite(lat1) ||
    !Number.isFinite(lon2) || !Number.isFinite(lat2) ||
    (lon1 === 0 && lat1 === 0) || (lon2 === 0 && lat2 === 0)
  ) {
    return null;
  }

  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371; // Earth radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

/**
 * Maps Agmarknet commodity strings to CropGuard MandiRate schema categories.
 */
function mapCommodityToCategory(commodity = '') {
  const name = commodity.toUpperCase();
  if (/(GRAM|DAL|PULSE|ARHAR|TUR|MOONG|URAD|LENTIL|MASOOR|PEAS|COWPEA)/.test(name)) return 'PULSES';
  if (/(WHEAT|RICE|PADDY|MAIZE|JOWAR|BAJRA|RAGI|BARLEY|MILLET)/.test(name)) return 'GRAINS';
  if (/(SOYBEAN|SOYABEAN|GROUNDNUT|MUSTARD|SUNFLOWER|SESAME|CASTOR|SAFFLOWER|LINSEED|OIL)/.test(name)) return 'OILSEEDS';
  if (/(TURMERIC|CHILLI|CHILI|PEPPER|CORIANDER|CORRIANDER|CUMIN|JEERA|CARDAMOM|GINGER|CLOVE|GARLIC|SPICE)/.test(name)) return 'SPICES';
  if (/(COTTON|JUTE|HEMP|FIBRE)/.test(name)) return 'FIBRES';
  if (/(MANGO|BANANA|LEMON|LIME|APPLE|ORANGE|GRAPE|POMEGRANATE|PAPAYA|GUAVA|WATERMELON|SAPOTA|PINEAPPLE|FRUIT)/.test(name)) return 'FRUITS';
  return 'VEGETABLES';
}

function parseArrivalDate(dateStr) {
  if (!dateStr) return new Date();
  const parts = String(dateStr).split('/');
  if (parts.length === 3) {
    const [dd, mm, yyyy] = parts.map(Number);
    if (dd && mm && yyyy) {
      return new Date(Date.UTC(yyyy, mm - 1, dd));
    }
  }
  const parsed = new Date(dateStr);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function toTitleCase(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\b([a-z])/g, (ch) => ch.toUpperCase());
}

function normalizeAgmarknetRecord(raw) {
  const commodityName = raw.commodity ?? raw.Commodity ?? '';
  const arrivalDate = raw.arrival_date ?? raw.Arrival_Date ?? null;
  const minVal = raw.min_price ?? raw.Min_Price ?? raw.Min_x0020_Price ?? 0;
  const maxVal = raw.max_price ?? raw.Max_Price ?? raw.Max_x0020_Price ?? 0;
  const modalVal = raw.modal_price ?? raw.Modal_Price ?? raw.Modal_x0020_Price ?? 0;

  return {
    state: String(raw.state ?? raw.State ?? '').trim().toUpperCase(),
    district: String(raw.district ?? raw.District ?? '').trim().toUpperCase(),
    marketCenter: String(raw.market ?? raw.Market ?? '').trim(),
    commodity: String(commodityName).trim().toUpperCase(),
    variety: String(raw.variety ?? raw.Variety ?? '').trim(),
    grade: String(raw.grade ?? raw.Grade ?? '').trim(),
    category: mapCommodityToCategory(commodityName),
    minPrice: Number(minVal) || 0,
    maxPrice: Number(maxVal) || 0,
    modalPrice: Number(modalVal) || 0,
    unit: 'QUINTAL',
    arrivalDateRaw: arrivalDate,
    priceDate: parseArrivalDate(arrivalDate),
    source: 'data.gov.in (Agmarknet Live)'
  };
}

/**
 * Fetches live daily APMC rates from data.gov.in Agmarknet API using offset pagination,
 * request deduplication, capitalized/lowercase schema resilience, and rate-limit backoff.
 */
async function fetchAgmarknetMandiRates({
  state,
  district,
  commodity,
  maxRecords = 100,
  startOffset = 0
} = {}) {
  const { dataGovApiKey: apiKey, dataGovEndpoint } = getApiConfig();
  const normalizedState =
    state && String(state).trim().toUpperCase() !== 'ALL' ? String(state).trim() : undefined;
  const normalizedDistrict = district ? String(district).trim() : undefined;
  const normalizedCommodity = commodity ? String(commodity).trim() : undefined;
  const safeOffset = Math.max(0, Number(startOffset) || 0);
  const safeMax = Math.max(10, Math.min(200, Number(maxRecords) || 100));

  const cacheKey = `agmarknet:${normalizedState || 'ALL'}:${normalizedDistrict || 'ALL'}:${normalizedCommodity || 'ALL'}:${safeOffset}:${safeMax}`;
  const cached = getCached(apiCache, cacheKey, CACHE_TTL_MS);
  if (cached) return cached;

  if (Date.now() < rateLimitedUntil) {
    throw new Error('Agmarknet public API temporarily rate-limited (HTTP 429)');
  }

  if (inFlightRequests.has(cacheKey)) {
    return inFlightRequests.get(cacheKey);
  }

  const runFetch = async () => {
    const buildUrl = (offset, limit, { titleCaseKeys = false } = {}) => {
      const params = new URLSearchParams({
        'api-key': apiKey,
        format: 'json',
        limit: String(limit),
        offset: String(offset)
      });
      if (normalizedState) {
        const sVal = titleCaseKeys ? toTitleCase(normalizedState) : normalizedState;
        params.set(titleCaseKeys ? 'filters[State]' : 'filters[state.keyword]', sVal);
      }
      if (normalizedDistrict) {
        const dVal = titleCaseKeys ? toTitleCase(normalizedDistrict) : normalizedDistrict;
        params.set(titleCaseKeys ? 'filters[District]' : 'filters[district]', dVal);
      }
      if (normalizedCommodity) {
        const cVal = toTitleCase(normalizedCommodity);
        params.set(titleCaseKeys ? 'filters[Commodity]' : 'filters[commodity]', cVal);
      }
      return `${dataGovEndpoint}?${params.toString()}`;
    };

    const isSamplePublicKey = apiKey === DEFAULT_DATA_GOV_PUBLIC_KEY;
    const pageSize = isSamplePublicKey ? 10 : Math.min(safeMax, 100);
    let useTitleCaseKeys = false;

    const firstRes = await fetch(buildUrl(safeOffset, pageSize, { titleCaseKeys: false }), {
      signal: AbortSignal.timeout(7000)
    });

    if (firstRes.status === 429) {
      rateLimitedUntil = Date.now() + 2 * 60 * 1000;
      throw new Error('Agmarknet API responded with HTTP 429');
    }
    if (!firstRes.ok) {
      throw new Error(`Agmarknet API responded with HTTP ${firstRes.status}`);
    }

    let firstJson = await firstRes.json();
    let totalAvailable = Number(firstJson.total) || 0;
    let rawRecords = Array.isArray(firstJson.records) ? [...firstJson.records] : [];

    // Some OGD dataset schema mirrors match capitalized filters (filters[Commodity]) only
    if (rawRecords.length === 0 && (normalizedCommodity || normalizedDistrict || normalizedState)) {
      const retryRes = await fetch(buildUrl(safeOffset, pageSize, { titleCaseKeys: true }), {
        signal: AbortSignal.timeout(7000)
      });
      if (retryRes.ok) {
        const retryJson = await retryRes.json();
        if (Array.isArray(retryJson.records) && retryJson.records.length > 0) {
          useTitleCaseKeys = true;
          firstJson = retryJson;
          totalAvailable = Number(retryJson.total) || 0;
          rawRecords = [...retryJson.records];
        }
      }
    }

    const endOffset = Math.min(totalAvailable, safeOffset + safeMax);
    for (let off = safeOffset + pageSize; off < endOffset; off += pageSize) {
      await delay(200);
      try {
        const res = await fetch(buildUrl(off, pageSize, { titleCaseKeys: useTitleCaseKeys }), {
          signal: AbortSignal.timeout(7000)
        });
        if (res.status === 429) {
          rateLimitedUntil = Date.now() + 2 * 60 * 1000;
          break;
        }
        if (!res.ok) break;
        const json = await res.json();
        if (Array.isArray(json.records) && json.records.length > 0) {
          rawRecords = rawRecords.concat(json.records);
        } else {
          break;
        }
      } catch {
        break;
      }
    }

    const records = rawRecords
      .map(normalizeAgmarknetRecord)
      .filter((r) => r.commodity && r.modalPrice > 0);

    const nextOffset = safeOffset + rawRecords.length;
    const payload = {
      records,
      totalAvailable,
      offset: safeOffset,
      nextOffset,
      hasMore: nextOffset < totalAvailable,
      fetchedAt: new Date().toISOString(),
      updatedDate: firstJson.updated_date || null,
      source: 'data.gov.in (Agmarknet Live API)'
    };
    setCached(apiCache, cacheKey, payload);
    return payload;
  };

  const promise = runFetch().finally(() => inFlightRequests.delete(cacheKey));
  inFlightRequests.set(cacheKey, promise);
  return promise;
}

/**
 * Upserts normalized Agmarknet records into MongoDB MandiRate collection without duplicating bulkWrite ops.
 */
async function upsertRecordsToDb(MandiRateModel, records = [], source = 'data.gov.in (Agmarknet Live)') {
  if (!Array.isArray(records) || records.length === 0) return 0;

  const bulkOps = records.map((r) => ({
    updateOne: {
      filter: {
        commodity: r.commodity,
        state: r.state,
        district: r.district,
        marketCenter: r.marketCenter,
        unit: r.unit,
        priceDate: r.priceDate
      },
      update: {
        $set: {
          category: r.category,
          variety: r.variety || '',
          grade: r.grade || '',
          minPrice: r.minPrice,
          maxPrice: r.maxPrice,
          modalPrice: r.modalPrice,
          unit: r.unit,
          source: r.source || source
        }
      },
      upsert: true
    }
  }));

  await MandiRateModel.bulkWrite(bulkOps, { ordered: false });
  return records.length;
}

/**
 * Syncs fresh Agmarknet records into MongoDB MandiRate collection at most once per 15 minutes per state.
 */
async function syncAgmarknetRatesToDb(MandiRateModel, { state = 'ALL', force = false } = {}) {
  const syncKey = String(state || 'ALL').trim().toUpperCase();
  const normalizedState = syncKey !== 'ALL' ? String(state).trim() : undefined;
  const now = Date.now();
  const lastSyncForState = lastDbSyncByState.get(syncKey) || 0;
  if (!force && now - lastSyncForState < CACHE_TTL_MS) {
    return { synced: false, reason: 'recent_sync' };
  }

  const { dataGovApiKey } = getApiConfig();
  const hasPersonalKey = dataGovApiKey !== DEFAULT_DATA_GOV_PUBLIC_KEY;

  const { records, totalAvailable, updatedDate, source, hasMore, nextOffset } =
    await fetchAgmarknetMandiRates({
      state: normalizedState,
      maxRecords: hasPersonalKey ? 200 : 100
    });

  if (records.length === 0) {
    return { synced: false, count: 0, source };
  }

  await upsertRecordsToDb(MandiRateModel, records, source);
  lastDbSyncByState.set(syncKey, now);
  return { synced: true, count: records.length, totalAvailable, updatedDate, source, hasMore, nextOffset };
}

function interpretWeatherCode(code) {
  if (code === 0) return { label: 'Clear Sky', advisory: 'Ideal dry conditions for grain harvesting and open-air drying.' };
  if (code <= 3) return { label: 'Partly Cloudy', advisory: 'Favorable transit and farm-gate grading weather.' };
  if (code <= 48) return { label: 'Foggy / Misty', advisory: 'Check moisture content before bagging dry pulses and grains.' };
  if (code <= 67) return { label: 'Rain Showers', advisory: 'Use covered tarpaulin logistics; shield onion and chilli lots.' };
  if (code <= 77) return { label: 'Precipitation', advisory: 'Store harvested produce in dry godowns before dispatch.' };
  if (code <= 99) return { label: 'Thunderstorm Risk', advisory: 'Delay open-truck dispatch until storm clears.' };
  return { label: 'Moderate Weather', advisory: 'Standard APMC handling recommended.' };
}

/**
 * Fetches live weather and geocoding from Open-Meteo (zero API key required).
 */
async function fetchDistrictWeather({ district = 'Dharwad', latitude, longitude } = {}) {
  const { openMeteoForecastUrl, openMeteoGeocodeUrl } = getApiConfig();
  let lat = Number(latitude);
  let lon = Number(longitude);
  let resolvedName = district;
  let adminState = 'Karnataka';

  if (!Number.isFinite(lat) || !Number.isFinite(lon) || (lat === 0 && lon === 0)) {
    const geoKey = `geo:${String(district).toLowerCase()}`;
    let geo = getCached(geoCache, geoKey, MEDIA_CACHE_TTL_MS);
    if (!geo) {
      const geoUrl = `${openMeteoGeocodeUrl}?name=${encodeURIComponent(district)}&count=1&country_code=IN`;
      const geoRes = await fetch(geoUrl, { signal: AbortSignal.timeout(5000) });
      if (!geoRes.ok) throw new Error(`Geocoding failed with HTTP ${geoRes.status}`);
      const geoJson = await geoRes.json();
      const hit = geoJson.results?.[0];
      if (!hit) throw new Error(`Could not geocode district "${district}"`);
      geo = {
        latitude: hit.latitude,
        longitude: hit.longitude,
        name: hit.name,
        state: hit.admin1 || ''
      };
      setCached(geoCache, geoKey, geo);
    }
    lat = geo.latitude;
    lon = geo.longitude;
    resolvedName = geo.name;
    adminState = geo.state || adminState;
  }

  const weatherKey = `weather:${lat.toFixed(2)},${lon.toFixed(2)}`;
  const cachedWeather = getCached(apiCache, weatherKey, CACHE_TTL_MS);
  if (cachedWeather) return cachedWeather;

  const url = `${openMeteoForecastUrl}?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,weather_code&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code&timezone=auto&forecast_days=4`;
  const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error(`Weather API responded with HTTP ${res.status}`);
  const data = await res.json();
  const current = data.current || {};
  const daily = data.daily || {};
  const interpreted = interpretWeatherCode(current.weather_code);

  const forecast = Array.isArray(daily.time)
    ? daily.time.map((dateStr, i) => ({
        date: dateStr,
        maxC: daily.temperature_2m_max?.[i] ?? null,
        minC: daily.temperature_2m_min?.[i] ?? null,
        rainChancePct: daily.precipitation_probability_max?.[i] ?? null,
        condition: interpretWeatherCode(daily.weather_code?.[i]).label
      }))
    : [];

  const payload = {
    district: resolvedName,
    state: adminState,
    coordinates: { latitude: lat, longitude: lon },
    temperatureC: current.temperature_2m ?? null,
    todayMaxC: forecast[0]?.maxC ?? null,
    todayMinC: forecast[0]?.minC ?? null,
    rainChancePct: forecast[0]?.rainChancePct ?? null,
    humidityPercent: current.relative_humidity_2m ?? null,
    precipitationMm: current.precipitation ?? 0,
    windSpeedKmh: current.wind_speed_10m ?? null,
    condition: interpreted.label,
    advisory: interpreted.advisory,
    forecast,
    observedAt: current.time || new Date().toISOString(),
    source: 'Open-Meteo Live Weather API'
  };

  setCached(apiCache, weatherKey, payload);
  return payload;
}

/**
 * Looks up Indian postal code metadata from India Post Pincode API.
 */
async function fetchPincodeInfo(pincode) {
  const cleanPin = String(pincode || '').replace(/\D/g, '');
  if (!/^\d{6}$/.test(cleanPin)) {
    throw new Error('Please provide a valid 6-digit Indian pincode');
  }

  const cacheKey = `pin:${cleanPin}`;
  const cached = getCached(geoCache, cacheKey, MEDIA_CACHE_TTL_MS);
  if (cached) return cached;

  const { indiaPostPincodeUrl } = getApiConfig();
  const res = await fetch(`${indiaPostPincodeUrl}/${cleanPin}`, {
    signal: AbortSignal.timeout(6000)
  });
  if (!res.ok) throw new Error(`India Post API responded with HTTP ${res.status}`);
  const json = await res.json();
  const entry = Array.isArray(json) ? json[0] : null;
  if (!entry || entry.Status !== 'Success' || !Array.isArray(entry.PostOffice) || entry.PostOffice.length === 0) {
    throw new Error(`No location found for pincode ${cleanPin}`);
  }

  const primary = entry.PostOffice[0];
  const payload = {
    pincode: cleanPin,
    district: primary.District,
    taluk: primary.Block || primary.Division,
    state: primary.State,
    region: primary.Region,
    postOffices: entry.PostOffice.map((po) => po.Name),
    source: 'India Post Pincode API'
  };
  setCached(geoCache, cacheKey, payload);
  return payload;
}

const CROP_WIKIPEDIA_TOPICS = [
  { test: /(pineapple|pine apple)/i, topic: 'Pineapple' },
  { test: /(apple)/i, topic: 'Apple' },
  { test: /(onion|pyaz|kanda)/i, topic: 'Onion' },
  { test: /(wheat|gehu|godhi|sharbati)/i, topic: 'Wheat' },
  { test: /(tomato|tamatar)/i, topic: 'Tomato' },
  { test: /(soybean|soyabean|soya)/i, topic: 'Soybean' },
  { test: /(green gram|moong|mung)/i, topic: 'Mung_bean' },
  { test: /(chickpea|bengal gram|chana)/i, topic: 'Chickpea' },
  { test: /(black gram|urad|urd)/i, topic: 'Vigna_mungo' },
  { test: /(pigeon pea|tur|arhar|toor)/i, topic: 'Pigeon_pea' },
  { test: /(turmeric|haldi)/i, topic: 'Turmeric' },
  { test: /(capsicum|bell pepper|shimla)/i, topic: 'Bell_pepper' },
  { test: /(chilli|chili|mirchi|byadagi)/i, topic: 'Chili_pepper' },
  { test: /(lemon|lime|citrus|kagzi|mousambi|sweet lime)/i, topic: 'Lemon' },
  { test: /(orange|kinnow|santre)/i, topic: 'Orange_(fruit)' },
  { test: /(maize|corn|makka)/i, topic: 'Maize' },
  { test: /(rice|paddy|dhan|chawal)/i, topic: 'Rice' },
  { test: /(potato|aloo)/i, topic: 'Potato' },
  { test: /(groundnut|peanut|moongfali)/i, topic: 'Peanut' },
  { test: /(cotton)/i, topic: 'Cotton' },
  { test: /(garlic|lehsun)/i, topic: 'Garlic' },
  { test: /(banana)/i, topic: 'Banana' },
  { test: /(mango)/i, topic: 'Mango' },
  { test: /(coriander|corriander|dhania)/i, topic: 'Coriander' },
  { test: /(cumin|cummin|jeera)/i, topic: 'Cumin' },
  { test: /(ginger|adrak)/i, topic: 'Ginger' },
  { test: /(cardamom|elaichi)/i, topic: 'Cardamom' },
  { test: /(pepper|kali mirch)/i, topic: 'Black_pepper' },
  { test: /(carrot|gajar)/i, topic: 'Carrot' },
  { test: /(cabbage|patta gobhi)/i, topic: 'Cabbage' },
  { test: /(cauliflower|phool gobhi)/i, topic: 'Cauliflower' },
  { test: /(brinjal|eggplant|baingan)/i, topic: 'Eggplant' },
  { test: /(bhindi|ladies finger|okra)/i, topic: 'Okra' },
  { test: /(pomegranate|anar)/i, topic: 'Pomegranate' },
  { test: /(grape|angoor)/i, topic: 'Grape' },
  { test: /(papaya|papita)/i, topic: 'Papaya' },
  { test: /(guava|amrud|amrood)/i, topic: 'Guava' },
  { test: /(watermelon|tarbooj)/i, topic: 'Watermelon' },
  { test: /(coconut|nariyal)/i, topic: 'Coconut' },
  { test: /(arecanut|areca|supari|betelnut)/i, topic: 'Areca_nut' },
  { test: /(mustard|sarson|rai)/i, topic: 'Mustard_seed' },
  { test: /(sesamum|sesame|til)/i, topic: 'Sesame' },
  { test: /(sunflower)/i, topic: 'Common_sunflower' },
  { test: /(sugarcane|ganna)/i, topic: 'Sugarcane' },
  { test: /(peas|matar)/i, topic: 'Pea' },
  { test: /(radish|raddish|mooli)/i, topic: 'Radish' },
  { test: /(cucumber|kheera)/i, topic: 'Cucumber' },
  { test: /(bitter gourd|karela)/i, topic: 'Momordica_charantia' },
  { test: /(bottle gourd|lauki)/i, topic: 'Calabash' },
  { test: /(pumpkin|kaddu)/i, topic: 'Pumpkin' },
  { test: /(drumstick|moringa)/i, topic: 'Moringa_oleifera' },
  { test: /(beetroot)/i, topic: 'Beetroot' },
  { test: /(spinach|palak)/i, topic: 'Spinach' }
];

function resolveWikipediaTopic(cropName = '') {
  const matched = CROP_WIKIPEDIA_TOPICS.find((entry) => entry.test.test(cropName));
  if (matched) return matched.topic;
  const fallbackWord = String(cropName).split(/[(\s,/]+/).find((w) => w.length > 2);
  return fallbackWord ? toTitleCase(fallbackWord) : null;
}

/**
 * Fetches verified botanical crop photo dynamically from Wikipedia REST API (no hardcoded URLs).
 */
async function fetchCropImageUrl(cropName) {
  const topic = resolveWikipediaTopic(cropName);
  if (!topic) return null;

  const cacheKey = `wiki_img:${topic}`;
  const cached = getCached(mediaCache, cacheKey, MEDIA_CACHE_TTL_MS);
  if (cached !== undefined) return cached;

  try {
    const { wikipediaSummaryUrl } = getApiConfig();
    const res = await fetch(`${wikipediaSummaryUrl}/${encodeURIComponent(topic)}`, {
      headers: { 'User-Agent': 'CropGuardMarket/1.0 (https://cropguard.local)' },
      signal: AbortSignal.timeout(4000)
    });
    if (!res.ok) {
      setCached(mediaCache, cacheKey, null);
      return null;
    }
    const json = await res.json();
    const imageUrl = json.thumbnail?.source || json.originalimage?.source || null;
    setCached(mediaCache, cacheKey, imageUrl);
    return imageUrl;
  } catch {
    return null;
  }
}

/**
 * Enriches an array of Agmarknet / MandiRate objects with deduplicated Wikipedia REST crop photos.
 */
async function attachCropImagesToRates(rates = [], maxUniqueCommodities = 45) {
  if (!Array.isArray(rates) || rates.length === 0) return rates;

  const uniqueCommodities = [];
  const seen = new Set();
  for (const r of rates) {
    const key = String(r.commodity || r.cropName || '').trim().toUpperCase();
    if (key && !seen.has(key)) {
      seen.add(key);
      uniqueCommodities.push(key);
      if (uniqueCommodities.length >= maxUniqueCommodities) break;
    }
  }

  const imageMap = new Map();
  await Promise.allSettled(
    uniqueCommodities.map(async (commodity) => {
      const url = await fetchCropImageUrl(commodity);
      if (url) imageMap.set(commodity, url);
    })
  );

  return rates.map((raw) => {
    const plain = typeof raw.toObject === 'function' ? raw.toObject() : { ...raw };
    const key = String(plain.commodity || plain.cropName || '').trim().toUpperCase();
    return {
      ...plain,
      imageUrl: plain.imageUrl || imageMap.get(key) || null
    };
  });
}

module.exports = {
  DEFAULT_DATA_GOV_PUBLIC_KEY,
  calculateDistanceKm,
  mapCommodityToCategory,
  parseArrivalDate,
  toTitleCase,
  normalizeAgmarknetRecord,
  fetchAgmarknetMandiRates,
  syncAgmarknetRatesToDb,
  upsertRecordsToDb,
  fetchDistrictWeather,
  fetchPincodeInfo,
  fetchCropImageUrl,
  attachCropImagesToRates
};
