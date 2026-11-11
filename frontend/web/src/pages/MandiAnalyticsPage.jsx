import React, { useEffect, useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import {
  TrendingUp,
  RefreshCw,
  Download,
  Search,
  MapPin,
  CloudSun,
  Wind,
  Droplets,
  BarChart3,
  Building2,
  Database,
  ArrowUpDown,
  AlertCircle,
  Filter,
  Sparkles,
  ShieldAlert,
  CheckCircle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { mandiService } from '../services/api';

const STATE_OPTIONS = [
  { label: 'All India (Pan-India Live)', value: 'ALL' },
  { label: 'Karnataka', value: 'Karnataka' },
  { label: 'Maharashtra', value: 'Maharashtra' },
  { label: 'Punjab', value: 'Punjab' },
  { label: 'Gujarat', value: 'Gujarat' },
  { label: 'Madhya Pradesh', value: 'Madhya Pradesh' },
  { label: 'Uttar Pradesh', value: 'Uttar Pradesh' },
  { label: 'Rajasthan', value: 'Rajasthan' },
  { label: 'Tamil Nadu', value: 'Tamil Nadu' },
  { label: 'Telangana', value: 'Telangana' },
  { label: 'Andhra Pradesh', value: 'Andhra Pradesh' },
  { label: 'West Bengal', value: 'West Bengal' },
];

const WEATHER_DISTRICTS = [
  'Dharwad',
  'Hubballi',
  'Belagavi',
  'Haveri',
  'Gadag',
  'Bengaluru',
  'Pune',
  'Nashik',
  'Indore',
  'Ludhiana',
];

const CATEGORIES = ['ALL', 'GRAINS', 'PULSES', 'VEGETABLES', 'FRUITS', 'SPICES', 'OILSEEDS', 'FIBRES'];

const formatArrivalDate = (record) => {
  if (record.arrivalDateRaw) return record.arrivalDateRaw;
  if (!record.priceDate) return '—';
  const parsed = new Date(record.priceDate);
  if (Number.isNaN(parsed.getTime())) return String(record.priceDate);
  return parsed.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
};

const getCategoryEmoji = (cat = '') => {
  const map = {
    GRAINS: '🌾',
    PULSES: '🫘',
    VEGETABLES: '🥬',
    FRUITS: '🍎',
    SPICES: '🌶️',
    OILSEEDS: '🌻',
    FIBRES: '🧶',
  };
  return map[String(cat).toUpperCase()] || '🌿';
};

const normalizeRecord = (r, idx) => ({
  id: r._id || `${r.state || 'IN'}-${r.district || 'NA'}-${r.marketCenter || r.market || idx}-${r.commodity || 'CROP'}-${r.variety || 'STD'}-${idx}`,
  state: String(r.state || '—').trim(),
  district: String(r.district || '—').trim(),
  marketCenter: String(r.marketCenter || r.market || 'APMC Market').trim(),
  commodity: String(r.commodity || r.cropName || '—').trim().toUpperCase(),
  variety: String(r.variety || '').trim(),
  grade: String(r.grade || '').trim(),
  category: String(r.category || 'OTHER').trim().toUpperCase(),
  minPrice: Number(r.minPrice) || 0,
  modalPrice: Number(r.modalPrice) || 0,
  maxPrice: Number(r.maxPrice) || 0,
  unit: r.unit || 'QUINTAL',
  arrivalQuantity: Number(r.arrivalQuantity) || 0,
  arrivalDateRaw: r.arrivalDateRaw || '',
  priceDate: r.priceDate || null,
  arrivalDisplay: formatArrivalDate(r),
  imageUrl: r.imageUrl || null,
  source: r.source || 'APMC Agmarknet',
});

const mergeLiveAndDbRecords = (liveList = [], dbList = []) => {
  const byKey = new Map();

  const buildKey = (item) =>
    [
      item.state.toUpperCase(),
      item.district.toUpperCase(),
      item.marketCenter.toUpperCase(),
      item.commodity.toUpperCase(),
      item.variety.toUpperCase(),
      item.arrivalDisplay,
    ].join('|');

  dbList.forEach((raw, idx) => {
    const item = normalizeRecord(raw, idx);
    const prev = byKey.get(buildKey(item));
    byKey.set(buildKey(item), {
      ...item,
      imageUrl: item.imageUrl || prev?.imageUrl || null,
    });
  });

  // Live API records take priority so variety, grade, and latest arrivalDateRaw are never lost
  liveList.forEach((raw, idx) => {
    const item = normalizeRecord(raw, idx);
    const prev = byKey.get(buildKey(item));
    byKey.set(buildKey(item), {
      ...item,
      imageUrl: item.imageUrl || prev?.imageUrl || null,
    });
  });

  return Array.from(byKey.values());
};

const CustomChartTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;

  return (
    <div className="bg-slate-950/95 border border-slate-700 rounded-xl p-3 text-xs shadow-xl space-y-1">
      <div className="font-bold text-white">{row.commodity}</div>
      {(row.variety || row.grade) && (
        <div className="text-emerald-300">
          {row.variety || 'Standard'} {row.grade ? `• Grade: ${row.grade}` : ''}
        </div>
      )}
      <div className="text-slate-300">
        {row.marketCenter}, {row.district} ({row.state})
      </div>
      <div className="text-slate-400">Arrival: {row.arrivalDisplay}</div>
      <div className="pt-1 border-t border-slate-800 grid grid-cols-3 gap-2 text-[11px]">
        <span className="text-amber-300">Min: ₹{row.minPrice.toLocaleString('en-IN')}</span>
        <span className="text-emerald-400 font-bold">Modal: ₹{row.modalPrice.toLocaleString('en-IN')}</span>
        <span className="text-sky-300">Max: ₹{row.maxPrice.toLocaleString('en-IN')}</span>
      </div>
    </div>
  );
};

const QUICK_COMMODITIES = [
  'ALL',
  'Wheat',
  'Rice',
  'Onion',
  'Potato',
  'Tomato',
  'Apple',
  'Mango',
  'Garlic',
  'Turmeric',
  'Cotton',
  'Soyabean',
  'Maize',
  'Green Chilli',
  'Banana',
];

export default function MandiAnalyticsPage() {
  const { t } = useAuth();
  const m = t?.mandi || {};

  const [selectedState, setSelectedState] = useState('ALL');
  const [selectedDistrict, setSelectedDistrict] = useState('Dharwad');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeLiveCrop, setActiveLiveCrop] = useState('ALL');
  const [selectedCommodity, setSelectedCommodity] = useState('');
  const [testFarmerOffer, setTestFarmerOffer] = useState(2400);

  const [records, setRecords] = useState([]);
  const [feedMeta, setFeedMeta] = useState({
    source: 'data.gov.in (Agmarknet Live API)',
    totalAvailable: null,
    updatedDate: null,
    liveCount: 0,
    dbCount: 0,
    nextOffset: 100,
    hasMore: false,
  });
  const [analytics, setAnalytics] = useState({ commodityTrends: [], districtArrivals: [] });
  const [marketComparison, setMarketComparison] = useState([]);
  const [priceTrends, setPriceTrends] = useState([]);
  const [weather, setWeather] = useState(null);

  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [deepDiveLoading, setDeepDiveLoading] = useState(false);
  const [error, setError] = useState('');

  const [chartLimit, setChartLimit] = useState(15);
  const [sortConfig, setSortConfig] = useState({ key: 'modalPrice', direction: 'desc' });

  const loadAllMandiData = async ({
    forceSync = false,
    stateOverride = selectedState,
    districtOverride = selectedDistrict,
    commodityOverride = activeLiveCrop,
  } = {}) => {
    if (forceSync) setSyncing(true);
    else setLoading(true);
    setError('');

    const apiStateParam = stateOverride === 'ALL' ? 'ALL' : stateOverride;
    const commodityParam =
      commodityOverride && commodityOverride !== 'ALL' ? commodityOverride.trim() : undefined;
    const analyticsParams = {
      ...(stateOverride !== 'ALL' ? { state: stateOverride.toUpperCase() } : {}),
    };

    try {
      const [liveRes, dbRes, analyticsRes, weatherRes] = await Promise.allSettled([
        mandiService.getLiveRates({
          state: apiStateParam,
          commodity: commodityParam,
          limit: 100,
          offset: 0,
        }),
        mandiService.getRates({
          state: apiStateParam,
          commodity: commodityParam,
          limit: 500,
          sync: forceSync ? 'true' : undefined,
        }),
        mandiService.getAnalytics(analyticsParams),
        mandiService.getWeather({ district: districtOverride }),
      ]);

      const liveRates =
        liveRes.status === 'fulfilled' && Array.isArray(liveRes.value?.rates)
          ? liveRes.value.rates
          : [];
      const dbRates =
        dbRes.status === 'fulfilled' && Array.isArray(dbRes.value?.rates)
          ? dbRes.value.rates
          : [];

      const merged = mergeLiveAndDbRecords(liveRates, dbRates);
      setRecords(merged);

      const liveMeta = liveRes.status === 'fulfilled' ? liveRes.value : null;
      const dbMeta = dbRes.status === 'fulfilled' ? dbRes.value : null;

      setFeedMeta({
        source: liveMeta?.source || dbMeta?.source || 'APMC Agmarknet',
        totalAvailable: liveMeta?.totalAvailable ?? dbMeta?.totalAvailable ?? null,
        updatedDate: liveMeta?.updatedDate || dbMeta?.updatedDate || null,
        liveCount: liveRates.length,
        dbCount: dbRates.length,
        nextOffset: liveMeta?.nextOffset ?? liveRates.length,
        hasMore: Boolean(liveMeta?.hasMore),
      });

      if (analyticsRes.status === 'fulfilled' && analyticsRes.value?.success) {
        setAnalytics({
          commodityTrends: analyticsRes.value.commodityTrends || [],
          districtArrivals: analyticsRes.value.districtArrivals || [],
        });
      }

      if (weatherRes.status === 'fulfilled' && weatherRes.value?.weather) {
        setWeather(weatherRes.value.weather);
      }

      if (merged.length > 0 && (!selectedCommodity || !merged.some((r) => r.commodity === selectedCommodity))) {
        setSelectedCommodity(merged[0].commodity);
      } else if (analyticsRes.status === 'fulfilled' && analyticsRes.value?.commodityTrends?.length > 0 && !selectedCommodity) {
        setSelectedCommodity(analyticsRes.value.commodityTrends[0].commodity);
      }

      if (merged.length === 0 && liveRes.status === 'rejected' && dbRes.status === 'rejected') {
        setError('Could not load live Agmarknet rates or database cache. Check backend connection.');
      }
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Failed to load mandi intelligence');
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  };

  useEffect(() => {
    loadAllMandiData({
      stateOverride: selectedState,
      districtOverride: selectedDistrict,
      commodityOverride: activeLiveCrop,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedState]);

  const handleLiveCropFetch = async (cropQuery) => {
    const clean = (cropQuery || '').trim();
    const nextCrop = clean || 'ALL';
    setActiveLiveCrop(nextCrop);
    setSearchTerm(nextCrop === 'ALL' ? '' : clean);
    setSelectedCategory('ALL');
    await loadAllMandiData({
      forceSync: false,
      stateOverride: selectedState,
      districtOverride: selectedDistrict,
      commodityOverride: nextCrop,
    });
  };

  const handleLoadMoreLive = async () => {
    if (loadingMore || !feedMeta.hasMore) return;
    setLoadingMore(true);
    setError('');
    try {
      const res = await mandiService.getLiveRates({
        state: selectedState === 'ALL' ? 'ALL' : selectedState,
        commodity: activeLiveCrop !== 'ALL' ? activeLiveCrop : undefined,
        limit: 100,
        offset: feedMeta.nextOffset || records.length,
      });
      const moreRates = Array.isArray(res?.rates) ? res.rates : [];
      if (moreRates.length > 0) {
        setRecords((prev) => mergeLiveAndDbRecords(moreRates, prev));
      }
      setFeedMeta((prev) => ({
        ...prev,
        liveCount: prev.liveCount + moreRates.length,
        nextOffset: res?.nextOffset ?? prev.nextOffset + moreRates.length,
        hasMore: Boolean(res?.hasMore) && moreRates.length > 0,
      }));
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Could not load next Agmarknet page');
    } finally {
      setLoadingMore(false);
    }
  };

  const handleDistrictChange = async (district) => {
    setSelectedDistrict(district);
    try {
      const wRes = await mandiService.getWeather({ district });
      if (wRes?.weather) setWeather(wRes.weather);
    } catch {
      // Weather stays gracefully optional
    }
  };

  // Fetch /analytics/markets and /analytics/trends whenever selectedCommodity changes
  useEffect(() => {
    if (!selectedCommodity) {
      setMarketComparison([]);
      setPriceTrends([]);
      return;
    }

    let active = true;
    setDeepDiveLoading(true);
    const params = {
      commodity: selectedCommodity,
      ...(selectedState !== 'ALL' ? { state: selectedState.toUpperCase() } : {}),
    };

    Promise.allSettled([
      mandiService.getMarketComparison(params),
      mandiService.getPriceTrends(params),
    ])
      .then(([marketsRes, trendsRes]) => {
        if (!active) return;
        if (marketsRes.status === 'fulfilled' && Array.isArray(marketsRes.value?.markets)) {
          setMarketComparison(marketsRes.value.markets);
        } else {
          setMarketComparison([]);
        }
        if (trendsRes.status === 'fulfilled' && Array.isArray(trendsRes.value?.trends)) {
          setPriceTrends(
            trendsRes.value.trends.map((t) => ({
              ...t,
              dateLabel: t.date
                ? new Date(t.date).toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    timeZone: 'UTC',
                  })
                : 'Today',
            }))
          );
        } else {
          setPriceTrends([]);
        }
      })
      .finally(() => {
        if (active) setDeepDiveLoading(false);
      });

    return () => {
      active = false;
    };
  }, [selectedCommodity, selectedState]);

  const distinctCommodities = useMemo(() => {
    const list = Array.from(new Set(records.map((r) => r.commodity))).filter(Boolean);
    if (analytics.commodityTrends?.length > 0) {
      analytics.commodityTrends.forEach((t) => {
        if (t.commodity && !list.includes(t.commodity)) {
          list.push(t.commodity);
        }
      });
    }
    return list.sort();
  }, [records, analytics.commodityTrends]);

  const filteredRecords = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return records.filter((r) => {
      if (selectedCategory !== 'ALL' && r.category !== selectedCategory) return false;
      if (!q) return true;
      return (
        r.commodity.toLowerCase().includes(q) ||
        r.variety.toLowerCase().includes(q) ||
        r.grade.toLowerCase().includes(q) ||
        r.marketCenter.toLowerCase().includes(q) ||
        r.district.toLowerCase().includes(q) ||
        r.state.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q)
      );
    });
  }, [records, selectedCategory, searchTerm]);

  const sortedRecords = useMemo(() => {
    const list = [...filteredRecords];
    const { key, direction } = sortConfig;
    const factor = direction === 'asc' ? 1 : -1;

    list.sort((a, b) => {
      const av = a[key];
      const bv = b[key];
      if (typeof av === 'number' && typeof bv === 'number') {
        return (av - bv) * factor;
      }
      return String(av || '').localeCompare(String(bv || '')) * factor;
    });

    return list;
  }, [filteredRecords, sortConfig]);

  const handleSort = (key) => {
    setSortConfig((prev) =>
      prev.key === key
        ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: typeof filteredRecords[0]?.[key] === 'number' ? 'desc' : 'asc' }
    );
  };

  const kpis = useMemo(() => {
    const markets = new Set(filteredRecords.map((r) => `${r.marketCenter}-${r.district}`));
    const districts = new Set(filteredRecords.map((r) => r.district).filter((d) => d !== '—'));
    const states = new Set(filteredRecords.map((r) => r.state).filter((s) => s !== '—'));
    const varieties = new Set(filteredRecords.map((r) => `${r.commodity}:${r.variety || 'STD'}`));

    const minVal =
      filteredRecords.length > 0
        ? Math.min(...filteredRecords.map((r) => r.minPrice || r.modalPrice).filter((p) => p > 0))
        : 0;
    const maxVal =
      filteredRecords.length > 0
        ? Math.max(...filteredRecords.map((r) => r.maxPrice || r.modalPrice))
        : 0;

    return {
      marketsCount: markets.size,
      districtsCount: districts.size,
      statesCount: states.size,
      varietiesCount: varieties.size,
      minPrice: Number.isFinite(minVal) ? minVal : 0,
      maxPrice: Number.isFinite(maxVal) ? maxVal : 0,
    };
  }, [filteredRecords]);

  const chartData = useMemo(() => {
    const sourceList = chartLimit === 'ALL' ? sortedRecords : sortedRecords.slice(0, chartLimit);
    return sourceList.map((r) => ({
      ...r,
      shortLabel: `${r.commodity.slice(0, 10)} (${r.marketCenter.slice(0, 8)})`,
    }));
  }, [sortedRecords, chartLimit]);

  // Actual modal rate benchmark calculation for the selected commodity (No fabricated data)
  const currentBenchmark = useMemo(() => {
    if (!selectedCommodity) return null;
    const target = selectedCommodity.toUpperCase();
    const fromTrends = analytics?.commodityTrends?.find(
      (item) => String(item.commodity || '').toUpperCase() === target
    );
    if (fromTrends && fromTrends.avgModalPrice) {
      return {
        commodity: fromTrends.commodity,
        avgModalPrice: Number(fromTrends.avgModalPrice) || 0,
        source: 'MongoDB Analytics Aggregate',
      };
    }
    const matchingRecords = records.filter(
      (r) => String(r.commodity || '').toUpperCase() === target && r.modalPrice > 0
    );
    if (matchingRecords.length > 0) {
      const avg = Math.round(
        matchingRecords.reduce((sum, r) => sum + r.modalPrice, 0) / matchingRecords.length
      );
      return {
        commodity: matchingRecords[0].commodity,
        avgModalPrice: avg,
        source: 'Live APMC Feed Average',
      };
    }
    return null;
  }, [selectedCommodity, analytics?.commodityTrends, records]);

  const modalRate = currentBenchmark ? Number(currentBenchmark.avgModalPrice) : null;
  const benchmarkAvailable =
    modalRate !== null && Number.isFinite(modalRate) && modalRate > 0;
  const minCorridor = benchmarkAvailable ? Math.round(modalRate * 0.9) : null;

  const farmerOffer = Number(testFarmerOffer);
  const validFarmerOffer =
    String(testFarmerOffer).trim() !== '' &&
    Number.isFinite(farmerOffer) &&
    farmerOffer >= 0;
  const isExploitative =
    benchmarkAvailable && validFarmerOffer && farmerOffer < minCorridor;

  const exportCsv = () => {
    if (sortedRecords.length === 0) return;
    const headers = [
      'State',
      'District',
      'Market (APMC)',
      'Commodity',
      'Variety',
      'Grade',
      'Category',
      'Arrival Date',
      'Min Price (INR)',
      'Modal Price (INR)',
      'Max Price (INR)',
      'Unit',
      'Source',
    ];
    const escapeCell = (val) => `"${String(val ?? '').replace(/"/g, '""')}"`;
    const rows = sortedRecords.map((r) =>
      [
        r.state,
        r.district,
        r.marketCenter,
        r.commodity,
        r.variety || '-',
        r.grade || '-',
        r.category,
        r.arrivalDisplay,
        r.minPrice,
        r.modalPrice,
        r.maxPrice,
        r.unit,
        r.source,
      ]
        .map(escapeCell)
        .join(',')
    );
    const csv = [headers.map(escapeCell).join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `agmarknet-mandi-rates-${selectedState.toLowerCase().replace(/\s+/g, '-')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-extrabold text-white flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-emerald-400" />
                {m.title || 'Live APMC Mandi Intelligence & Agmarknet Explorer'}
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                {feedMeta.source}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {m.subtitle || 'Complete live records with State, District, APMC Market, Commodity, Variety, Grade, Arrival Date, and Min / Modal / Max price spreads.'}
              {feedMeta.updatedDate ? ` • Feed updated: ${feedMeta.updatedDate}` : ''}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedState}
              onChange={(e) => setSelectedState(e.target.value)}
              className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs font-semibold text-white focus:outline-none focus:border-emerald-500"
              aria-label="Filter State"
            >
              {STATE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => loadAllMandiData({ forceSync: true })}
              disabled={syncing || loading}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-xs font-bold text-white transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
              <span>{syncing ? 'Syncing Agmarknet...' : 'Sync Live API'}</span>
            </button>

            {feedMeta.hasMore && (
              <button
                type="button"
                onClick={handleLoadMoreLive}
                disabled={loadingMore || loading}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-60 text-xs font-bold text-white transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingMore ? 'animate-spin' : ''}`} />
                <span>{loadingMore ? 'Fetching...' : 'Load More (+100 Mandis)'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={exportCsv}
              disabled={sortedRecords.length === 0}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 border border-slate-700 text-xs font-bold text-slate-200 transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>Export CSV ({sortedRecords.length})</span>
            </button>
          </div>
        </div>

        {/* Live Crop Server Search + Category Filters */}
        <div className="space-y-3 pt-2 border-t border-slate-800/80">
          <div className="flex flex-col md:flex-row gap-3">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleLiveCropFetch(searchTerm);
              }}
              className="flex-1 flex gap-2"
            >
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Type ANY crop (Wheat, Apple, Garlic, Mango, Onion) & press Search Govt Live..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>
              <button
                type="submit"
                disabled={loading || syncing}
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-xs font-bold text-white shrink-0 transition-colors"
              >
                Search Govt Live
              </button>
            </form>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
              <Filter className="w-3.5 h-3.5 text-slate-500 shrink-0 mr-1" />
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold shrink-0 transition-colors ${
                    selectedCategory === cat
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Quick-Fetch Popular Crops directly from Agmarknet Govt Server */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            <span className="text-[11px] font-bold text-slate-400 shrink-0 mr-1">
              Live Crop Lookup:
            </span>
            {QUICK_COMMODITIES.map((crop) => {
              const isActive = activeLiveCrop.toLowerCase() === crop.toLowerCase();
              return (
                <button
                  key={crop}
                  type="button"
                  onClick={() => handleLiveCropFetch(crop)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-semibold shrink-0 transition-colors ${
                    isActive
                      ? 'bg-sky-600 text-white'
                      : 'bg-slate-950 text-slate-300 hover:bg-slate-800 border border-slate-800'
                  }`}
                >
                  {crop === 'ALL' ? 'All Crops (Pan-India)' : crop}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3.5 rounded-xl bg-red-950/50 border border-red-800 text-red-200 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
          <span>{error}</span>
        </div>
      )}

      {/* KPI Strip + District Weather */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4">
          <div className="text-[11px] font-semibold text-slate-400 flex items-center justify-between">
            <span>Agmarknet Records Shown</span>
            <Database className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-white mt-1">
            {filteredRecords.length}{' '}
            <span className="text-xs font-normal text-slate-400">/ {records.length} loaded</span>
          </div>
          <div className="text-[11px] text-emerald-400 mt-1">
            {feedMeta.totalAvailable
              ? `${Number(feedMeta.totalAvailable).toLocaleString('en-IN')} total live on data.gov.in`
              : `Live: ${feedMeta.liveCount} • DB Cache: ${feedMeta.dbCount}`}
          </div>
        </div>

        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4">
          <div className="text-[11px] font-semibold text-slate-400 flex items-center justify-between">
            <span>APMC Markets & Coverage</span>
            <Building2 className="w-3.5 h-3.5 text-sky-400" />
          </div>
          <div className="text-2xl font-black text-white mt-1">{kpis.marketsCount} Mandis</div>
          <div className="text-[11px] text-slate-400 mt-1">
            {kpis.districtsCount} Districts across {kpis.statesCount} State{kpis.statesCount === 1 ? '' : 's'}
          </div>
        </div>

        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4">
          <div className="text-[11px] font-semibold text-slate-400 flex items-center justify-between">
            <span>Crops & Varieties</span>
            <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-white mt-1">{distinctCommodities.length} Crops</div>
          <div className="text-[11px] text-slate-400 mt-1">
            {kpis.varietiesCount} Commodity + Variety pairs
          </div>
        </div>

        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4">
          <div className="text-[11px] font-semibold text-slate-400">Full Modal / Max Spread</div>
          <div className="text-lg font-black text-emerald-400 mt-1">
            ₹{kpis.minPrice.toLocaleString('en-IN')} – ₹{kpis.maxPrice.toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Per Quintal (incl. high-value crops)</div>
        </div>

        <div className="bg-gradient-to-br from-slate-900 to-emerald-950/30 border border-emerald-800/40 rounded-2xl p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-emerald-300 flex items-center gap-1">
              <CloudSun className="w-3.5 h-3.5" /> Mandi Weather
            </span>
            <select
              value={selectedDistrict}
              onChange={(e) => handleDistrictChange(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-0.5 text-[11px] text-white"
              aria-label="Weather District"
            >
              {WEATHER_DISTRICTS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          {weather ? (
            <>
              <div className="text-xl font-black text-white mt-1">
                {weather.temperatureC ?? '--'}°C{' '}
                <span className="text-xs font-medium text-emerald-300">{weather.condition}</span>
              </div>
              <div className="text-[11px] text-slate-300 mt-1 flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <Droplets className="w-3 h-3 text-sky-400" /> {weather.humidityPct ?? '--'}%
                </span>
                <span className="flex items-center gap-1">
                  <Wind className="w-3 h-3 text-slate-400" /> {weather.windKmh ?? '--'} km/h
                </span>
              </div>
            </>
          ) : (
            <div className="text-xs text-slate-400 mt-2">Open-Meteo ready</div>
          )}
        </div>
      </div>

      {/* Crop Photo & Price Visual Gallery */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h2 className="text-sm font-extrabold text-white">
              Live Crops Photo &amp; Rate Cards ({sortedRecords.length} Markets Shown)
            </h2>
            <p className="text-[11px] text-slate-400">
              Real crop photos + Min / Modal / Max price + APMC Mandi and Variety. Click any card to compare mandis.
            </p>
          </div>
          {weather?.advisory && (
            <div className="text-[11px] px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-amber-300 max-w-md">
              <span className="font-bold">Transit Advisory ({selectedDistrict}):</span> {weather.advisory}
            </div>
          )}
        </div>

        {loading ? (
          <div className="py-10 text-center text-xs text-slate-400">
            Loading live crops, prices, and photos...
          </div>
        ) : sortedRecords.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">
            No crops match current filters. Click &quot;All Crops (Pan-India)&quot; above to see live crops.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 max-h-[560px] overflow-y-auto pr-1">
            {sortedRecords.slice(0, 48).map((row) => (
              <div
                key={`card-${row.id}`}
                onClick={() => setSelectedCommodity(row.commodity)}
                className={`cursor-pointer rounded-2xl overflow-hidden border transition-all bg-slate-950/90 flex flex-col ${
                  selectedCommodity === row.commodity
                    ? 'border-emerald-500 ring-1 ring-emerald-500/40'
                    : 'border-slate-800 hover:border-slate-600'
                }`}
              >
                <div className="relative h-32 bg-gradient-to-br from-emerald-950 to-slate-900 flex items-center justify-center overflow-hidden">
                  {row.imageUrl ? (
                    <img
                      src={row.imageUrl}
                      alt={row.commodity}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <span className="text-4xl">{getCategoryEmoji(row.category)}</span>
                  )}
                  <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-slate-950/85 border border-slate-700 text-[10px] font-bold text-emerald-300">
                    {row.category}
                  </span>
                  {row.grade && (
                    <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-slate-950/85 border border-slate-700 text-[10px] font-semibold text-slate-200">
                      {row.grade}
                    </span>
                  )}
                </div>

                <div className="p-3 space-y-2 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="font-extrabold text-xs text-white truncate" title={row.commodity}>
                      {row.commodity}
                    </div>
                    <div className="text-[11px] text-emerald-400 truncate">
                      {row.variety ? `Var: ${row.variety}` : 'Standard Variety'}
                    </div>
                    <div className="text-[11px] text-slate-400 truncate mt-0.5">
                      {row.marketCenter}, {row.district}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      Arrival: {row.arrivalDisplay}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px]">
                    <span className="font-mono text-amber-300">₹{row.minPrice.toLocaleString('en-IN')}</span>
                    <span className="font-mono font-black text-emerald-400 text-xs">
                      ₹{row.modalPrice.toLocaleString('en-IN')}/qtl
                    </span>
                    <span className="font-mono text-sky-300">₹{row.maxPrice.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Full Searchable Live APMC Table */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h2 className="text-sm font-extrabold text-white">
              Complete Live APMC Agmarknet Table ({sortedRecords.length} Records)
            </h2>
            <p className="text-[11px] text-slate-400">
              Full sortable dataset with Photo, State, District, Market (APMC), Commodity, Variety, Grade, Arrival Date, Min, Modal &amp; Max Price.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto max-h-[540px]">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-slate-950/95 sticky top-0 z-10 text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-800">
              <tr>
                {[
                  { key: 'commodity', label: 'Commodity' },
                  { key: 'variety', label: 'Variety' },
                  { key: 'grade', label: 'Grade' },
                  { key: 'marketCenter', label: 'Market (APMC)' },
                  { key: 'district', label: 'District' },
                  { key: 'state', label: 'State' },
                  { key: 'arrivalDisplay', label: 'Arrival Date' },
                  { key: 'minPrice', label: 'Min ₹/qtl', right: true },
                  { key: 'modalPrice', label: 'Modal ₹/qtl', right: true },
                  { key: 'maxPrice', label: 'Max ₹/qtl', right: true },
                ].map((col) => (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                    className={`px-3 py-3 font-bold cursor-pointer hover:text-white select-none whitespace-nowrap ${
                      col.right ? 'text-right' : 'text-left'
                    }`}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.label}
                      <ArrowUpDown className="w-3 h-3 opacity-60" />
                    </span>
                  </th>
                ))}
                <th className="px-3 py-3 font-bold text-right whitespace-nowrap">Spread</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {loading ? (
                <tr>
                  <td colSpan={11} className="px-4 py-10 text-center text-slate-400">
                    Fetching complete Agmarknet live dataset...
                  </td>
                </tr>
              ) : sortedRecords.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-10 text-center text-slate-400">
                    No Agmarknet records match your active filter. Try selecting &quot;All India&quot; or clearing search.
                  </td>
                </tr>
              ) : (
                sortedRecords.map((row) => {
                  const spread = Math.max(0, row.maxPrice - row.minPrice);
                  const isSelected = selectedCommodity === row.commodity;
                  return (
                    <tr
                      key={row.id}
                      onClick={() => setSelectedCommodity(row.commodity)}
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-emerald-950/35 hover:bg-emerald-950/50'
                          : 'hover:bg-slate-800/50'
                      }`}
                    >
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-lg overflow-hidden bg-slate-950 border border-slate-800 flex items-center justify-center shrink-0">
                            {row.imageUrl ? (
                              <img
                                src={row.imageUrl}
                                alt={row.commodity}
                                className="w-full h-full object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <span className="text-base">{getCategoryEmoji(row.category)}</span>
                            )}
                          </div>
                          <div>
                            <div className="font-bold text-white">{row.commodity}</div>
                            <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded bg-slate-800 text-[10px] font-semibold text-slate-300">
                              {row.category}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-emerald-300 font-medium whitespace-nowrap">
                        {row.variety || '—'}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-300 font-semibold">
                          {row.grade || '—'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 font-semibold text-slate-200 whitespace-nowrap">
                        {row.marketCenter}
                      </td>
                      <td className="px-3 py-2.5 text-slate-300 whitespace-nowrap">{row.district}</td>
                      <td className="px-3 py-2.5 text-slate-400 whitespace-nowrap">{row.state}</td>
                      <td className="px-3 py-2.5 text-slate-300 whitespace-nowrap">{row.arrivalDisplay}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-amber-300 whitespace-nowrap">
                        ₹{row.minPrice.toLocaleString('en-IN')}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono font-extrabold text-emerald-400 whitespace-nowrap">
                        ₹{row.modalPrice.toLocaleString('en-IN')}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-sky-300 whitespace-nowrap">
                        ₹{row.maxPrice.toLocaleString('en-IN')}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-slate-400 whitespace-nowrap">
                        ₹{spread.toLocaleString('en-IN')}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-3 bg-slate-950/80 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs">
          <div className="text-slate-400">
            Showing <strong className="text-white">{sortedRecords.length}</strong> of{' '}
            <strong className="text-white">{records.length}</strong> loaded rows
            {feedMeta.totalAvailable
              ? ` • Govt Agmarknet total available: ${Number(feedMeta.totalAvailable).toLocaleString('en-IN')}`
              : ''}
          </div>
          {feedMeta.hasMore && (
            <button
              type="button"
              onClick={handleLoadMoreLive}
              disabled={loadingMore || loading}
              className="px-3.5 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-60 text-xs font-bold text-white transition-colors self-start sm:self-auto"
            >
              {loadingMore ? 'Loading Next Page...' : 'Load More (+100 Live Rows)'}
            </button>
          )}
        </div>
      </div>

      {/* Price Bar Chart Across Loaded Commodities */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
          <div>
            <h2 className="text-sm font-extrabold text-white">
              Min / Modal / Max Price Comparison Across APMC Markets (₹ / Quintal)
            </h2>
            <p className="text-[11px] text-slate-400">
              All price tiers plotted without artificial filtering — switch between Top 15, Top 30, or All loaded records.
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            {[15, 30, 'ALL'].map((lim) => (
              <button
                key={String(lim)}
                type="button"
                onClick={() => setChartLimit(lim)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                  chartLimit === lim
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white'
                }`}
              >
                {lim === 'ALL' ? `All (${sortedRecords.length})` : `Top ${lim}`}
              </button>
            ))}
          </div>
        </div>

        <div className="h-80 w-full">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 12, left: 0, bottom: 32 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis
                  dataKey="shortLabel"
                  stroke="#94a3b8"
                  fontSize={10}
                  angle={-25}
                  textAnchor="end"
                  interval={0}
                  height={65}
                />
                <YAxis stroke="#94a3b8" fontSize={11} />
                <Tooltip content={<CustomChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="minPrice" name="Min ₹/qtl" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                <Bar dataKey="modalPrice" name="Modal ₹/qtl" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="maxPrice" name="Max ₹/qtl" fill="#38bdf8" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-slate-500">
              No chart records available for current filters.
            </div>
          )}
        </div>
      </div>

      {/* Commodity Deep-Dive: Market Comparison & Multi-Day Trends (Analytics Pipelines) */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-sm font-extrabold text-white flex items-center gap-2">
                <MapPin className="w-4 h-4 text-emerald-400" />
                Best Mandi Comparison by Commodity
              </h2>
              <p className="text-[11px] text-slate-400">
                Sorted cheapest-to-highest average modal price using `/api/mandi-rates/analytics/markets`.
              </p>
            </div>
            <select
              value={selectedCommodity}
              onChange={(e) => setSelectedCommodity(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-xs font-bold text-white"
              aria-label="Select Commodity for Market Comparison"
            >
              {distinctCommodities.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {deepDiveLoading ? (
            <div className="py-8 text-center text-xs text-slate-400">Running mandi comparison pipeline...</div>
          ) : marketComparison.length > 0 ? (
            <div className="overflow-x-auto max-h-64">
              <table className="w-full text-xs text-left">
                <thead className="text-[11px] text-slate-400 border-b border-slate-800 uppercase">
                  <tr>
                    <th className="py-2 pr-3">APMC Market</th>
                    <th className="py-2 pr-3">District / State</th>
                    <th className="py-2 pr-3 text-right">Avg Modal</th>
                    <th className="py-2 pr-3 text-right">Range</th>
                    <th className="py-2 text-right">Obs</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {marketComparison.map((m, idx) => (
                    <tr key={`${m.marketCenter}-${m.district}-${idx}`} className="hover:bg-slate-800/40">
                      <td className="py-2 pr-3 font-bold text-white">{m.marketCenter}</td>
                      <td className="py-2 pr-3 text-slate-400">
                        {m.district}, {m.state}
                      </td>
                      <td className="py-2 pr-3 text-right font-mono font-bold text-emerald-400">
                        ₹{Number(m.avgModalPrice).toLocaleString('en-IN')}
                      </td>
                      <td className="py-2 pr-3 text-right font-mono text-slate-300">
                        ₹{Number(m.minModalPrice).toLocaleString('en-IN')}–₹{Number(m.maxModalPrice).toLocaleString('en-IN')}
                      </td>
                      <td className="py-2 text-right text-slate-400">{m.observations}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-slate-500">
              Select a synced commodity above to compare all recorded APMC mandis.
            </div>
          )}
        </div>

        {/* Multi-day Trend Line Chart + District Activity */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div>
            <h2 className="text-sm font-extrabold text-white">
              Historical Price Trend {selectedCommodity ? `— ${selectedCommodity}` : ''}
            </h2>
            <p className="text-[11px] text-slate-400">
              Powered by `/api/mandi-rates/analytics/trends` across synced arrival dates &amp; district coverage.
            </p>
          </div>

          <div className="h-52 w-full">
            {priceTrends.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={priceTrends} margin={{ top: 5, right: 12, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="dateLabel" stroke="#94a3b8" fontSize={11} />
                  <YAxis stroke="#94a3b8" fontSize={11} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#020617',
                      borderColor: '#334155',
                      borderRadius: '0.75rem',
                      fontSize: '12px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Line type="monotone" dataKey="avgModalPrice" name="Avg Modal ₹" stroke="#10b981" strokeWidth={2.5} dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="maxModalPrice" name="High ₹" stroke="#38bdf8" strokeWidth={1.5} />
                  <Line type="monotone" dataKey="minModalPrice" name="Low ₹" stroke="#f59e0b" strokeWidth={1.5} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-500">
                Single-day snapshot loaded; historical trend curve grows as daily Agmarknet syncs accumulate.
              </div>
            )}
          </div>

          {analytics.districtArrivals?.length > 0 && (
            <div className="pt-3 border-t border-slate-800">
              <div className="text-[11px] font-bold text-slate-400 uppercase mb-2">
                Active Districts in Analytics Corridor
              </div>
              <div className="flex flex-wrap gap-2">
                {analytics.districtArrivals.slice(0, 12).map((d) => (
                  <span
                    key={d.district}
                    className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-[11px] text-slate-300"
                  >
                    <strong className="text-white">{d.district}</strong> • {d.mandiCount} Mandis • {d.commoditiesCount} Crops
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Anti-Exploitation Benchmark Simulator (Data Engineering Track) */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-950 border border-emerald-700/60 flex items-center justify-center text-emerald-400">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">
              {m.simTitle || 'Anti-Exploitation Price Corridor Simulator'}
            </h3>
            <p className="text-xs text-slate-400">
              {m.simSubtitle || 'Compare simulated buyer offers against an illustrative threshold derived from recorded mandi modal prices'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              {m.selectCrop || 'Select Monitored Commodity'}
            </label>
            <select
              value={selectedCommodity}
              onChange={(e) => setSelectedCommodity(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-emerald-500 capitalize"
            >
              {distinctCommodities.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              {m.simOffer || 'Simulated Wholesaler Offer (₹ / qtl)'}
            </label>
            <input
              type="number"
              value={testFarmerOffer}
              onChange={(e) => setTestFarmerOffer(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              {m.simResult || 'Corridor Evaluation Result'}
            </label>
            <div
              className={`p-2.5 rounded-xl border flex items-center gap-2 text-xs font-bold ${
                !benchmarkAvailable || !validFarmerOffer
                  ? 'bg-amber-950/70 border-amber-700/80 text-amber-300'
                  : isExploitative
                    ? 'bg-rose-950/70 border-rose-700/80 text-rose-300'
                    : 'bg-emerald-950/70 border-emerald-700/80 text-emerald-300'
              }`}
            >
              {!benchmarkAvailable ? (
                <>
                  <ShieldAlert className="w-4 h-4 shrink-0 text-amber-400" />
                  <span>Benchmark unavailable — cannot evaluate offer.</span>
                </>
              ) : !validFarmerOffer ? (
                <>
                  <ShieldAlert className="w-4 h-4 shrink-0 text-amber-400" />
                  <span>Enter a valid non-negative farmer offer.</span>
                </>
              ) : isExploitative ? (
                <>
                  <ShieldAlert className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>
                    {m.exploitativeBid || 'Offer Below Illustrative Threshold!'}
                  </span>
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400" />
                  <span>
                    {m.approvedBid || 'Offer Meets Illustrative Threshold'}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Detailed Corridor Parameters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs">
          <div>
            <span className="text-slate-400">APMC Modal Rate:</span>
            <span className="font-bold text-white ml-2">
              {benchmarkAvailable ? `₹${modalRate.toLocaleString('en-IN')}` : 'Unavailable'}
              {benchmarkAvailable ? ' / qtl' : ''}
            </span>
          </div>
          <div>
            <span className="text-slate-400">Illustrative Price Threshold (90%):</span>
            <span className="font-bold text-amber-400 ml-2">
              {benchmarkAvailable ? `₹${minCorridor.toLocaleString('en-IN')}` : 'Unavailable'}
              {benchmarkAvailable ? ' / qtl' : ''}
            </span>
          </div>
          <div>
            <span className="text-slate-400">Direct Farmer Advantage:</span>
            <span className="font-bold text-emerald-400 ml-2">
              Illustrative 10% threshold difference
            </span>
          </div>
        </div>

        <p className="text-[11px] text-slate-500 leading-relaxed border-t border-slate-800/80 pt-2">
          This simulator uses an illustrative 90% benchmark threshold for demonstration only. It does not represent an official MSP, statutory price floor, or regulatory compliance assessment.
        </p>
      </div>
    </div>
  );
}
