const mongoose = require('mongoose');
const MandiRate = require('../models/MandiRate');
const {
  fetchAgmarknetMandiRates,
  fetchDistrictWeather,
  toTitleCase
} = require('../services/externalApiService');

const CROP_ALIASES = [
  { test: /(onion|pyaz|pyaaz|kanda)/i, commodity: 'Onion' },
  { test: /(potato|aloo|alu)/i, commodity: 'Potato' },
  { test: /(tomato|tamatar)/i, commodity: 'Tomato' },
  { test: /(wheat|gehu|gehun|kanak)/i, commodity: 'Wheat' },
  { test: /(rice|paddy|chawal|dhan)/i, commodity: 'Rice' },
  { test: /(garlic|lehsun|lahsun)/i, commodity: 'Garlic' },
  { test: /(ginger|adrak)/i, commodity: 'Ginger' },
  { test: /(turmeric|haldi)/i, commodity: 'Turmeric' },
  { test: /(pineapple|pine apple|ananas)/i, commodity: 'Pine Apple' },
  { test: /(apple|seb)/i, commodity: 'Apple' },
  { test: /(mango|aam)/i, commodity: 'Mango' },
  { test: /(banana|kela)/i, commodity: 'Banana' },
  { test: /(chilli|chili|mirch|mirchi)/i, commodity: 'Green Chilli' },
  { test: /(cotton|kapas)/i, commodity: 'Cotton' },
  { test: /(soyabean|soybean|soya)/i, commodity: 'Soyabean' },
  { test: /(maize|corn|makka)/i, commodity: 'Maize' },
  { test: /(bengal gram|chana)/i, commodity: 'Bengal Gram(Gram)(Whole)' },
  { test: /(green gram|moong|mung)/i, commodity: 'Green Gram(Moong)(Whole)' },
  { test: /(cumin|cummin|jeera)/i, commodity: 'Cummin Seed(Jeera)' },
  { test: /(mustard|sarson)/i, commodity: 'Mustard' },
  { test: /(groundnut|peanut|moongfali)/i, commodity: 'Groundnut' },
  { test: /(carrot|gajar)/i, commodity: 'Carrot' },
  { test: /(cabbage|patta gobhi)/i, commodity: 'Cabbage' },
  { test: /(cauliflower|phool gobhi|gobhi)/i, commodity: 'Cauliflower' },
  { test: /(brinjal|baingan|eggplant)/i, commodity: 'Brinjal' }
];

const KNOWN_DISTRICTS = [
  'Dharwad',
  'Hubballi',
  'Pune',
  'Nashik',
  'Nagpur',
  'Bengaluru',
  'Belagavi',
  'Indore',
  'Ludhiana',
  'Agra',
  'Jaipur',
  'Surat',
  'Rajkot',
  'Haveri',
  'Gadag',
  'Kolkata',
  'Patna',
  'Coimbatore',
  'Hyderabad',
  'Guntur'
];

function extractCropName(text = '') {
  const matched = CROP_ALIASES.find((a) => a.test.test(text));
  if (matched) return matched.commodity;

  // Try extracting word before "rate", "price", or "bhav"
  const rateMatch = text.match(/([a-zA-Z]{3,})\s+(?:ka\s+|ki\s+|ke\s+)?(?:rate|price|bhav|mandi)/i);
  if (rateMatch && !['today', 'live', 'mandi', 'crop', 'current', 'kya', 'aaj'].includes(rateMatch[1].toLowerCase())) {
    return toTitleCase(rateMatch[1]);
  }
  return null;
}

function extractDistrict(text = '', fallback = 'Dharwad') {
  const matched = KNOWN_DISTRICTS.find((d) => new RegExp(`\\b${d}\\b`, 'i').test(text));
  return matched || fallback;
}

function detectNavigationTarget(text = '') {
  if (/(sell\s*produce|list\s*crop|fasal\s*bech|new\s*listing|sell\s*page)/i.test(text)) {
    return { tab: 'sell', label: 'Sell Produce' };
  }
  if (/(negotiation|bargain|chat\s*room|mol\s*bhav|offer\s*page)/i.test(text)) {
    return { tab: 'negotiations', label: 'Price Negotiations' };
  }
  if (/(order|escrow|receipt|dispatch|delivery)/i.test(text)) {
    return { tab: 'orders', label: 'Bulk Orders & Escrow' };
  }
  if (/(audit|ledger|fair\s*trade|hisab|khata)/i.test(text)) {
    return { tab: 'compliance', label: 'Audit & Fair-Trade' };
  }
  if (/(marketplace|buy\s*crop|farm\s*lot|kharid|browse\s*crop)/i.test(text)) {
    return { tab: 'marketplace', label: 'Wholesale Marketplace' };
  }
  if (/(open\s*mandi|go\s*to\s*mandi|mandi\s*analytics|mandi\s*intelligence|mandi\s*page)/i.test(text)) {
    return { tab: 'mandi', label: 'APMC Mandi Intelligence' };
  }
  return null;
}

async function lookupLiveCommodityRates(commodity) {
  let rates = [];
  if (mongoose.connection.readyState === 1) {
    try {
      const cleanToken = commodity.split('(')[0].trim();
      rates = await MandiRate.find({
        commodity: { $regex: cleanToken, $options: 'i' }
      })
        .sort('-priceDate')
        .limit(5)
        .lean();
    } catch {
      rates = [];
    }
  }

  if (rates.length === 0) {
    try {
      const live = await fetchAgmarknetMandiRates({ commodity, maxRecords: 5 });
      if (Array.isArray(live.records)) {
        rates = live.records.slice(0, 5);
      }
    } catch {
      // Gracefully return empty if network throttled
    }
  }
  return rates;
}

/**
 * @desc    Natural-language voice/text assistant backed by live CropGuard APIs (zero fabricated rates)
 * @route   POST /api/assistant/query
 * @access  Private
 */
const processAssistantQuery = async (req, res, next) => {
  try {
    const queryText = String(req.body?.query || '').trim();
    const lang = req.body?.lang === 'hi' ? 'hi' : 'en';
    const context = req.body?.context || {};

    if (!queryText) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a question or voice command'
      });
    }

    // 1. Bargaining / Counter-offer advice inside active negotiation
    if (/(counter|negotiate|bargain|kitna\s*bol|fair\s*price|suggest|madad)/i.test(queryText) && (context.currentOffer || context.askingPrice)) {
      const ask = Number(context.askingPrice) || 0;
      const current = Number(context.currentOffer) || 0;
      const crop = context.cropName || 'this lot';
      const midpoint = ask > 0 && current > 0 ? Math.round((ask + current) / 2) : null;

      let benchmarkMsg = '';
      let matchedRates = [];
      if (context.cropName) {
        matchedRates = await lookupLiveCommodityRates(extractCropName(context.cropName) || context.cropName);
        if (matchedRates[0]) {
          benchmarkMsg =
            lang === 'hi'
              ? ` Live APMC modal rate (${matchedRates[0].marketCenter}) ₹${matchedRates[0].modalPrice} per quintal hai.`
              : ` Live APMC modal rate at ${matchedRates[0].marketCenter} is ₹${matchedRates[0].modalPrice} per quintal.`;
        }
      }

      const reply =
        midpoint !== null
          ? lang === 'hi'
            ? `${crop} ke liye asking rate ₹${ask} aur current offer ₹${current} hai. Dono ke beech ka fair midpoint ₹${midpoint} suggest kar sakte ho.${benchmarkMsg}`
            : `For ${crop}, asking price is ₹${ask} and current offer is ₹${current}. A balanced split midpoint counter-offer would be ₹${midpoint}.${benchmarkMsg}`
          : lang === 'hi'
          ? `${crop} ka current offer ₹${current || ask} hai.${benchmarkMsg} Chhote 2–5% step se counter bhejna best rehta hai.`
          : `Current price on ${crop} is ₹${current || ask}.${benchmarkMsg} Adjusting in 2–5% steps helps close faster.`;

      return res.status(200).json({
        success: true,
        intent: 'NEGOTIATION_ADVICE',
        reply,
        suggestedPrice: midpoint,
        rates: matchedRates.slice(0, 3)
      });
    }

    // 2. Weather intent
    if (/(weather|mausam|barish|rain|temp|climate|hawa)/i.test(queryText)) {
      const district = extractDistrict(queryText, req.user?.location?.district || 'Dharwad');
      try {
        const w = await fetchDistrictWeather(district);
        const reply =
          lang === 'hi'
            ? `${w.district} ka mausam abhi ${w.temperatureC} degree Celsius aur ${w.condition} hai (Humidity ${w.humidityPct}%). Advisory: ${w.advisory}`
            : `Current weather in ${w.district} is ${w.temperatureC}°C with ${w.condition} and ${w.humidityPct}% humidity. Advisory: ${w.advisory}`;
        return res.status(200).json({
          success: true,
          intent: 'WEATHER',
          reply,
          weather: w,
          action: { navigateTo: 'mandi', label: 'View Weather & Mandis' }
        });
      } catch {
        return res.status(200).json({
          success: true,
          intent: 'WEATHER',
          reply:
            lang === 'hi'
              ? `${district} ka live weather abhi fetch nahi ho paya — thodi der baad dobara try karein.`
              : `Could not fetch live weather for ${district} right now. Please try again shortly.`
        });
      }
    }

    // 3. Explicit screen navigation commands
    const navTarget = detectNavigationTarget(queryText);
    if (navTarget && !/(price|rate|bhav|kya hai|kitna)/i.test(queryText)) {
      const reply =
        lang === 'hi'
          ? `${navTarget.label} khol raha hoon.`
          : `Opening ${navTarget.label} for you.`;
      return res.status(200).json({
        success: true,
        intent: 'NAVIGATE',
        reply,
        action: { navigateTo: navTarget.tab, label: `Open ${navTarget.label}` }
      });
    }

    // 4. Live Mandi crop price query
    const requestedCrop = extractCropName(queryText);
    if (requestedCrop || /(rate|price|bhav|mandi)/i.test(queryText)) {
      const targetCrop = requestedCrop || 'Onion';
      const rates = await lookupLiveCommodityRates(targetCrop);
      if (rates.length > 0) {
        const top = rates[0];
        const reply =
          lang === 'hi'
            ? `${top.commodity} ka live Agmarknet modal bhav ${top.marketCenter} (${top.district}, ${top.state}) me ₹${Number(top.modalPrice).toLocaleString('en-IN')} per quintal hai — Min ₹${Number(top.minPrice).toLocaleString('en-IN')} aur Max ₹${Number(top.maxPrice).toLocaleString('en-IN')}.`
            : `${top.commodity} is trading at a live APMC modal rate of ₹${Number(top.modalPrice).toLocaleString('en-IN')} per quintal in ${top.marketCenter} (${top.district}, ${top.state}), with min ₹${Number(top.minPrice).toLocaleString('en-IN')} and max ₹${Number(top.maxPrice).toLocaleString('en-IN')}.`;
        return res.status(200).json({
          success: true,
          intent: 'MANDI_PRICE',
          reply,
          rates: rates.slice(0, 3),
          action: { navigateTo: 'mandi', label: `Compare ${top.commodity} Mandis` }
        });
      }

      return res.status(200).json({
        success: true,
        intent: 'MANDI_PRICE',
        reply:
          lang === 'hi'
            ? `${targetCrop} ka aaj ka live APMC data abhi nahi mila. Aap APMC Mandi Intelligence page par Live Crop Search se check kar sakte hain.`
            : `No live Agmarknet rows returned for ${targetCrop} right now. You can search directly inside APMC Mandi Intelligence.`,
        action: { navigateTo: 'mandi', label: 'Open APMC Mandi Explorer' }
      });
    }

    // 5. Helpful greeting / capability guide
    const helpReply =
      lang === 'hi'
        ? 'Namaste! Main CropGuard Voice Assistant hoon. Aap puch sakte hain: "Onion ka rate kya hai", "Pune ka mausam batao", "Open Sell Produce", ya negotiation me "Fair price suggest karo".'
        : 'Hello! I am your CropGuard Voice Assistant. Ask me things like: "What is Potato price?", "Check Dharwad weather", "Open Sell Produce", or ask for counter-offer advice in negotiations.';

    return res.status(200).json({
      success: true,
      intent: 'HELP',
      reply: helpReply
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  processAssistantQuery,
  extractCropName,
  extractDistrict,
  detectNavigationTarget
};

