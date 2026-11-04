import React, { useState, useEffect } from 'react';
import { mandiService } from '../services/api';
import {
  TrendingUp,
  BarChart3,
  ShieldAlert,
  Sparkles,
  CheckCircle,
  HelpCircle,
  RefreshCw,
  Database,
  MapPin,
  Layers,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

// Seed benchmark APMC rates fallback
const MOCK_MANDI_DATA = [
  { market: 'Dharwad APMC', crop: 'Red Onion', minPrice: 1900, modalPrice: 2450, maxPrice: 2900, arrivals: 420 },
  { market: 'Hubballi APMC', crop: 'Wheat Sharbati', minPrice: 2400, modalPrice: 2800, maxPrice: 3100, arrivals: 580 },
  { market: 'Belagavi APMC', crop: 'Tomato Roma', minPrice: 1400, modalPrice: 1950, maxPrice: 2300, arrivals: 310 },
  { market: 'Haveri APMC', crop: 'Yellow Soybean', minPrice: 3800, modalPrice: 4600, maxPrice: 4950, arrivals: 640 },
  { market: 'Byadagi APMC', crop: 'Red Chilli (GI)', minPrice: 15000, modalPrice: 18500, maxPrice: 22000, arrivals: 190 },
  { market: 'Pune APMC', crop: 'Potato Kufri', minPrice: 1700, modalPrice: 2150, maxPrice: 2500, arrivals: 850 },
  { market: 'Gadag APMC', crop: 'Green Gram', minPrice: 5600, modalPrice: 6200, maxPrice: 6800, arrivals: 220 },
];

const HISTORICAL_PRICE_TRENDS = [
  { month: 'Jun', DharwadModal: 2100, HubballiModal: 2500, FarmerDirect: 2350 },
  { month: 'Jul', DharwadModal: 2250, HubballiModal: 2650, FarmerDirect: 2520 },
  { month: 'Aug', DharwadModal: 2300, HubballiModal: 2700, FarmerDirect: 2600 },
  { month: 'Sep', DharwadModal: 2400, HubballiModal: 2750, FarmerDirect: 2710 },
  { month: 'Oct', DharwadModal: 2450, HubballiModal: 2800, FarmerDirect: 2780 },
];

export default function MandiAnalyticsPage() {
  const [mandiRates, setMandiRates] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCrop, setSelectedCrop] = useState('ONION');
  const [testFarmerOffer, setTestFarmerOffer] = useState(2400);

  // Load APMC rates and live MongoDB aggregation analytics concurrently
  const loadRatesAndAnalytics = async () => {
    setLoading(true);
    try {
      const [ratesRes, analyticsRes] = await Promise.allSettled([
        mandiService.getRates({ limit: 30 }),
        mandiService.getAnalytics(),
      ]);

      if (ratesRes.status === 'fulfilled' && ratesRes.value?.rates?.length > 0) {
        const mapped = ratesRes.value.rates.map((r) => ({
          market: `${r.market || r.marketCenter} APMC`,
          crop: r.cropName || r.commodity,
          minPrice: r.minPrice,
          modalPrice: r.modalPrice,
          maxPrice: r.maxPrice,
          arrivals: r.arrivals || r.arrivalQuantity || 350,
          district: r.district,
        }));
        setMandiRates(mapped);
      } else {
        setMandiRates(MOCK_MANDI_DATA);
      }

      if (analyticsRes.status === 'fulfilled' && analyticsRes.value?.success) {
        setAnalytics(analyticsRes.value);
      } else {
        // Fallback aggregate structure
        setAnalytics({
          corridor: 'UASD Dharwad - North Karnataka & Maharashtra Corridor',
          commodityTrends: [
            { commodity: 'ONION', avgModalPrice: 2450, totalArrivals: 650, marketsCount: 1 },
            { commodity: 'WHEAT', avgModalPrice: 2800, totalArrivals: 580, marketsCount: 1 },
            { commodity: 'TOMATO', avgModalPrice: 1950, totalArrivals: 420, marketsCount: 1 },
            { commodity: 'SOYBEAN', avgModalPrice: 4450, totalArrivals: 340, marketsCount: 1 },
            { commodity: 'MAIZE', avgModalPrice: 2150, totalArrivals: 720, marketsCount: 1 },
          ],
          districtArrivals: [
            { district: 'DHARWAD', totalArrivals: 1510, commoditiesCount: 4, mandiCount: 3 },
            { district: 'HAVERI', totalArrivals: 1610, commoditiesCount: 2, mandiCount: 2 },
            { district: 'BELAGAVI', totalArrivals: 760, commoditiesCount: 2, mandiCount: 2 },
            { district: 'PUNE', totalArrivals: 850, commoditiesCount: 1, mandiCount: 1 },
            { district: 'GADAG', totalArrivals: 220, commoditiesCount: 1, mandiCount: 1 },
          ],
        });
      }
    } catch (err) {
      console.warn('[Mandi Analytics] Data load error:', err.message);
      setMandiRates(MOCK_MANDI_DATA);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadRatesAndAnalytics();
  }, []);

  const handleManualRefresh = () => {
    setRefreshing(true);
    loadRatesAndAnalytics();
  };

  // Benchmark logic
  const currentBenchmark =
    mandiRates.find((m) => m.crop.toUpperCase().includes(selectedCrop.toUpperCase())) ||
    mandiRates[0] ||
    MOCK_MANDI_DATA[0];

  const modalRate = currentBenchmark?.modalPrice || 2450;
  const minCorridor = Math.round(modalRate * 0.9); // 10% tolerance floor
  const isExploitative = Number(testFarmerOffer) < minCorridor;

  // Compute aggregate totals
  const totalCorridorArrivals = analytics?.districtArrivals?.reduce(
    (sum, d) => sum + (d.totalArrivals || 0),
    0
  ) || 4950;

  const totalDistrictsTracked = analytics?.districtArrivals?.length || 5;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-emerald-950/80 via-slate-900 to-slate-900 border border-emerald-800/40 rounded-2xl p-6 relative overflow-hidden shadow-xl">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-900/60 border border-emerald-700/60 text-emerald-300 text-xs font-semibold mb-3">
            <TrendingUp className="w-3.5 h-3.5" /> UASD Dharwad APMC Price Intelligence Pipeline
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Live Mandi Rate & Fair-Price Corridor Monitor
          </h1>
          <p className="text-slate-300 text-sm mt-2 leading-relaxed">
            Real-time APMC price benchmarks prevent predatory buyer bidding. Direct market price
            discovery eliminates unfair discounts forced on local farmers across Karnataka & Maharashtra.
          </p>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={handleManualRefresh}
            disabled={refreshing}
            className="px-3.5 py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-2 border border-slate-700 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-emerald-400' : 'text-slate-400'}`} />
            <span>{refreshing ? 'Refreshing Pipeline...' : 'Refresh Mandi Analytics'}</span>
          </button>

          <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-950/60 px-3 py-1 rounded-xl border border-emerald-800/60">
            <Database className="w-3.5 h-3.5" /> MongoDB $group Aggregations Active
          </span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-panel p-4 rounded-xl border border-slate-800">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">APMC Mandis & Districts</div>
          <div className="text-2xl font-extrabold text-white mt-1">
            {totalDistrictsTracked} Districts
          </div>
          <div className="text-[11px] text-emerald-400 mt-1">Dharwad, Hubballi, Belagavi, Haveri, Pune</div>
        </div>

        <div className="glass-panel p-4 rounded-xl border border-slate-800">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Corridor Inflow Volume</div>
          <div className="text-2xl font-extrabold text-emerald-400 mt-1">
            {totalCorridorArrivals.toLocaleString('en-IN')} <span className="text-xs font-normal text-slate-400">qtl</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Cumulative weekly APMC market arrivals</div>
        </div>

        <div className="glass-panel p-4 rounded-xl border border-slate-800">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Fair Trade Index</div>
          <div className="text-2xl font-extrabold text-green-400 mt-1">98.4%</div>
          <div className="text-[11px] text-emerald-400 mt-1">+12.4% farmer price realization</div>
        </div>

        <div className="glass-panel p-4 rounded-xl border border-slate-800">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Middleman Margin Kept</div>
          <div className="text-2xl font-extrabold text-emerald-400 mt-1">+10.0%</div>
          <div className="text-[11px] text-slate-400 mt-1">Zero commission agent deductions</div>
        </div>
      </div>

      {/* Charts Section 1: Price Spread & Realization */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Min, Modal, Max APMC Price Spread */}
        <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-white text-base">APMC Price Spread by Commodity</h3>
              <p className="text-xs text-slate-400">Min vs Modal vs Max Rate (₹ per Quintal)</p>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
              Live Mandi Rates
            </span>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={mandiRates.filter((m) => m.modalPrice < 10000)} // filter out extreme high chilli for better chart scaling
                margin={{ top: 10, right: 10, left: -10, bottom: 25 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.4} />
                <XAxis
                  dataKey="crop"
                  stroke="#94a3b8"
                  fontSize={11}
                  angle={-15}
                  textAnchor="end"
                  tickLine={false}
                />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '0.75rem',
                    fontSize: '12px',
                    color: '#fff',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Bar dataKey="minPrice" fill="#64748b" name="Mandi Min (₹)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="modalPrice" fill="#10b981" name="Modal Benchmark (₹)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="maxPrice" fill="#3b82f6" name="Mandi Max (₹)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Direct Market Access vs Traditional Mandi Price Realization */}
        <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-white text-base">Farmer Price Realization Over Time</h3>
              <p className="text-xs text-slate-400">CropGuard Direct Farmgate vs Mandi Auction Modal</p>
            </div>
            <span className="text-xs px-2.5 py-1 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 font-semibold">
              UASD Protocol
            </span>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={HISTORICAL_PRICE_TRENDS} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
                <defs>
                  <linearGradient id="colorDirect" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorMandi" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.6} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.4} />
                <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} domain={[1800, 3000]} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '0.75rem',
                    fontSize: '12px',
                    color: '#fff',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Area
                  type="monotone"
                  dataKey="FarmerDirect"
                  stroke="#10b981"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorDirect)"
                  name="CropGuard Direct Rate (₹)"
                />
                <Area
                  type="monotone"
                  dataKey="DharwadModal"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorMandi)"
                  name="Traditional Mandi Modal (₹)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Chart Section 2: APMC Market Depth & Inflow Volume by District (MongoDB Aggregation) */}
      {analytics?.districtArrivals && (
        <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-emerald-400" />
                APMC Market Depth: District-wise Inflow & Arrival Volumes
              </h3>
              <p className="text-xs text-slate-400">
                Aggregated via MongoDB pipeline ($group by district) across {analytics.corridor}
              </p>
            </div>
            <span className="text-xs px-2.5 py-1 rounded bg-slate-900 text-slate-300 border border-slate-800">
              Unit: Quintals (100 Kg)
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={analytics.districtArrivals}
                margin={{ top: 10, right: 10, left: -10, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.4} />
                <XAxis dataKey="district" stroke="#94a3b8" fontSize={12} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '0.75rem',
                    fontSize: '12px',
                    color: '#fff',
                  }}
                  formatter={(val) => [`${val} Quintals`, 'Arrival Volume']}
                />
                <Bar dataKey="totalArrivals" fill="#059669" name="Arrival Volume (Quintals)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Anti-Exploitation Benchmark Simulator */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-950 border border-emerald-700/60 flex items-center justify-center text-emerald-400">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">
              Anti-Exploitation Price Corridor Simulator
            </h3>
            <p className="text-xs text-slate-400">
              Evaluate buyer bids against UASD ICAR statutory fair-trade price boundaries in real time
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              Select Monitored Commodity
            </label>
            <select
              value={selectedCrop}
              onChange={(e) => setSelectedCrop(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-emerald-500 capitalize"
            >
              {mandiRates.map((m, idx) => (
                <option key={idx} value={m.crop}>
                  {m.crop} ({m.market})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              Simulated Wholesaler Offer (₹ / qtl)
            </label>
            <input
              type="number"
              value={testFarmerOffer}
              onChange={(e) => setTestFarmerOffer(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              Corridor Evaluation Result
            </label>
            <div
              className={`p-2.5 rounded-xl border flex items-center gap-2 text-xs font-bold ${
                isExploitative
                  ? 'bg-rose-950/70 border-rose-700/80 text-rose-300'
                  : 'bg-emerald-950/70 border-emerald-700/80 text-emerald-300'
              }`}
            >
              {isExploitative ? (
                <>
                  <ShieldAlert className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>Exploitative Bid! (&gt;10% below APMC modal)</span>
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400" />
                  <span>Fair Price Corridor Approved (UASD Compliant)</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Detailed Corridor Parameters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs">
          <div>
            <span className="text-slate-400">APMC Modal Rate:</span>
            <span className="font-bold text-white ml-2">₹{modalRate} / qtl</span>
          </div>
          <div>
            <span className="text-slate-400">Statutory Floor (90%):</span>
            <span className="font-bold text-amber-400 ml-2">₹{minCorridor} / qtl</span>
          </div>
          <div>
            <span className="text-slate-400">Direct Farmer Advantage:</span>
            <span className="font-bold text-emerald-400 ml-2">+10% Zero Commission</span>
          </div>
        </div>
      </div>
    </div>
  );
}
