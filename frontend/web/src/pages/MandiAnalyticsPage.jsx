import React, { useState, useEffect } from 'react';
import { mandiService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  TrendingUp,
  BarChart3,
  ShieldAlert,
  Sparkles,
  CheckCircle,
  RefreshCw,
  Database,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';


export default function MandiAnalyticsPage() {
  const { t } = useAuth();
  const m = t.mandi || {};
  const [mandiRates, setMandiRates] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [priceTrends, setPriceTrends] = useState([]);
  const [marketComparison, setMarketComparison] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [apiError, setApiError] = useState('');
  const [selectedCrop, setSelectedCrop] = useState('ONION');
  const [testFarmerOffer, setTestFarmerOffer] = useState(2400);

  const loadRatesAndAnalytics = async () => {
  setApiError('');

  try {
    const results = await Promise.allSettled([
      mandiService.getRates({ limit: 30 }),
      mandiService.getAnalytics(),
      mandiService.getPriceTrends(),
      mandiService.getMarketComparison({ commodity: selectedCrop }),
    ]);

    const [ratesResult, analyticsResult, trendsResult, marketsResult] = results;

    // 1. Mandi rates
    if (ratesResult.status === 'fulfilled') {
      const rates = ratesResult.value?.rates || [];

      setMandiRates(
        rates.map((r) => ({
          ...r,
          market: r.market || r.marketCenter,
          crop: r.cropName || r.commodity,
          arrivals: r.arrivals ?? r.arrivalQuantity ?? 0,
        }))
      );
    } else {
      setMandiRates([]);
      console.error('Failed to load mandi rates:', ratesResult.reason);
    }

    // 2. Overall analytics
    if (analyticsResult.status === 'fulfilled') {
      setAnalytics(analyticsResult.value);
    } else {
      setAnalytics(null);
      console.error('Failed to load mandi analytics:', analyticsResult.reason);
    }

    // 3. Historical price observations
    if (trendsResult.status === 'fulfilled') {
      setPriceTrends(trendsResult.value?.trends || []);
    } else {
      setPriceTrends([]);
      console.error('Failed to load price trends:', trendsResult.reason);
    }

    // 4. Market comparison for the selected crop
    if (marketsResult.status === 'fulfilled') {
      setMarketComparison(marketsResult.value?.markets || []);
    } else {
      setMarketComparison([]);
      console.error('Failed to load market comparison:', marketsResult.reason);
    }

    const failedRequests = results.filter(
      (result) => result.status === 'rejected'
    ).length;

    if (failedRequests > 0) {
      setApiError(
        `${failedRequests} of 4 analytics requests failed. Some dashboard sections may be unavailable.`
      );
    }
  } catch (error) {
    console.error('Unable to load mandi dashboard:', error);
    setApiError('Unable to load mandi dashboard data. Please try again.');
    setMandiRates([]);
    setAnalytics(null);
    setPriceTrends([]);
    setMarketComparison([]);
  } finally {
    setLoading(false);
  }
};

  useEffect(() => {
  loadRatesAndAnalytics();
}, [selectedCrop]);

    const handleManualRefresh = async () => {
    setRefreshing(true);

    try {
      await loadRatesAndAnalytics();
    } finally {
      setRefreshing(false);
    }
  };

  // Benchmark logic

const currentBenchmark =
  analytics?.commodityTrends?.find(
    (item) =>
      String(item.commodity || '').toUpperCase() ===
      selectedCrop.toUpperCase()
  ) || null;


// Use the actual modal price from the API.
// Do not insert a fabricated fallback price.

    const modalRate = currentBenchmark
  ? Number(currentBenchmark.avgModalPrice)
  : null;

    const benchmarkAvailable =
      modalRate !== null &&
      Number.isFinite(modalRate) &&
      modalRate > 0;

    // Illustrative threshold only — not a statutory minimum price.
    const minCorridor = benchmarkAvailable
      ? Math.round(modalRate * 0.9)
      : null;

    const farmerOffer = Number(testFarmerOffer);

    const validFarmerOffer =
  String(testFarmerOffer).trim() !== '' &&
  Number.isFinite(farmerOffer) &&
  farmerOffer >= 0;

    const isExploitative =
      benchmarkAvailable &&
      validFarmerOffer &&
      farmerOffer < minCorridor;

    // const isApproved =
    //   benchmarkAvailable &&
    //   validFarmerOffer &&
    //   !isExploitative;


    const totalCorridorArrivals =
      analytics?.districtArrivals?.reduce(
        (sum, district) => sum + (Number(district.totalArrivals) || 0),
        0
      ) ?? 0;

    const totalDistrictsTracked =
      analytics?.districtArrivals?.length ?? 0;
      const totalCommoditiesTracked = new Set(
      mandiRates.map((rate) => rate.crop || rate.commodity).filter(Boolean)
    ).size;

    const totalMandisTracked = new Set(
      mandiRates.map((rate) => rate.marketCenter || rate.market).filter(Boolean)
    ).size;
  return (
  <div className="space-y-6">
    {apiError && (
      <div
        role="alert"
        className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200"
      >
        {apiError}
      </div>
    )}

    {loading && (
      <div
        role="status"
        className="rounded-xl border border-slate-700 bg-slate-900/70 px-4 py-3 text-sm text-slate-300"
      >
        Loading mandi analytics...
      </div>
    )}

    {/* Top Banner */}
      <div className="bg-gradient-to-r from-emerald-950/80 via-slate-900 to-slate-900 border border-emerald-800/40 rounded-2xl p-6 relative overflow-hidden shadow-xl">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-900/60 border border-emerald-700/60 text-emerald-300 text-xs font-semibold mb-3">
            <TrendingUp className="w-3.5 h-3.5" /> {m.tag || 'UASD Dharwad APMC Price Intelligence Pipeline'}
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            {m.title || 'Mandi Price Analytics & Fair-Price Corridor Monitor'}
          </h1>
          <p className="text-slate-300 text-sm mt-2 leading-relaxed">
            {m.subtitle || 'Explore aggregated mandi price observations, compare market centers, and evaluate illustrative farmer offers using demonstration data from Karnataka & Maharashtra.'}
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
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Districts Covered</div>
          <div className="text-2xl font-extrabold text-white mt-1">
            {totalDistrictsTracked} Districts
          </div>
          <div className="text-[11px] text-emerald-400 mt-1">{totalMandisTracked} unique market centers in loaded records</div>
        </div>

        <div className="glass-panel p-4 rounded-xl border border-slate-800">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{m.modalSpread || m.mandiSpread || 'Corridor Inflow Volume'}</div>
          <div className="text-2xl font-extrabold text-emerald-400 mt-1">
            {totalCorridorArrivals.toLocaleString('en-IN')} <span className="text-xs font-normal text-slate-400">qtl</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Total arrivals across available demo mandi records</div>
        </div>

        <div className="glass-panel p-4 rounded-xl border border-slate-800">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Commodities Tracked
            </div>
            <div className="text-2xl font-extrabold text-white mt-1">
              {totalCommoditiesTracked}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Unique commodities in loaded mandi records
            </div>
          </div>

        <div className="glass-panel p-4 rounded-xl border border-slate-800">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Market Centers Tracked
          </div>
          <div className="text-2xl font-extrabold text-emerald-400 mt-1">
            {totalMandisTracked}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Unique market centers in loaded records
          </div>
        </div>
      </div>
      {/* Charts Section 1: Price Spread & Realization */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Min, Modal, Max APMC Price Spread */}
        <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-white text-base">{m.spreadChartTitle || 'APMC Price Spread by Commodity'}</h3>
              <p className="text-xs text-slate-400">{m.spreadChartSub || 'Min vs Modal vs Max Rate (₹ per Quintal)'}</p>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
              Demo Mandi Rates
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
              <h3 className="font-bold text-white text-base">
  Historical Mandi Price Observations
</h3>
<p className="text-xs text-slate-400">
  Recorded average modal prices by commodity and date (₹ per Quintal)
</p>
            </div>
            <span className="text-xs px-2.5 py-1 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 font-semibold">
              Demo Data
            </span>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
  data={priceTrends.filter(
    (item) => item.commodity === selectedCrop
  )}
  margin={{ top: 10, right: 10, left: -10, bottom: 5 }}
>
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
                <XAxis
                  dataKey="date"
                  stroke="#94a3b8"
                  fontSize={11}
                  tickLine={false}
/>
                <YAxis
  stroke="#94a3b8"
  fontSize={11}
  tickLine={false}
/>
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
  dataKey="avgModalPrice"
  stroke="#10b981"
  strokeWidth={2}
  fillOpacity={1}
  fill="url(#colorDirect)"
  name="Average Modal Price (₹)"
/>
              </AreaChart>
            </ResponsiveContainer>
            {priceTrends.filter(
  (item) => item.commodity === selectedCrop
).length === 0 && (
  <p className="text-xs text-slate-400 text-center mt-2">
    No historical price observations available for {selectedCrop}.
  </p>
)}
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

      {/* Market Center Comparison */}
      <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="font-bold text-white text-base flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-emerald-400" />
              Market Center Price Comparison
            </h3>
            <p className="text-xs text-slate-400">
              Average modal price across market centers for {selectedCrop}
            </p>
          </div>
          <span className="text-xs px-2.5 py-1 rounded bg-slate-900 text-slate-300 border border-slate-800">
            ₹ per Quintal
          </span>
        </div>

        {marketComparison.length > 0 ? (
          <div className="space-y-5">
            {marketComparison.map((market, index) => {
              const maxPrice = Math.max(
                ...marketComparison.map((item) =>
                  Number(item.avgModalPrice) || 0
                )
              );

              const price = Number(market.avgModalPrice) || 0;
              const barWidth = maxPrice > 0
                ? (price / maxPrice) * 100
                : 0;

              return (
                <div key={`${market.state}-${market.district}-${market.marketCenter}`}>
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {market.marketCenter}
                      </p>
                      <p className="text-xs text-slate-400">
                        {market.district}, {market.state}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-emerald-400">
                        ₹{price.toLocaleString('en-IN')}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        {market.totalArrivals || 0} Quintals
                      </p>
                    </div>
                  </div>

                  <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>

                  {index === 0 && (
                    <p className="text-[10px] text-emerald-400 mt-1">
                      Lowest average modal price in this comparison
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-slate-400 text-center py-6">
            No market comparison data available for {selectedCrop}.
          </p>
        )}

        <p className="text-[11px] text-slate-500 border-t border-slate-800 pt-3">
          Comparison uses aggregated mandi observations. Current records are
          synthetic demonstration data, not verified live market prices.
        </p>
      </div>

      {/* Anti-Exploitation Benchmark Simulator */}

      <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
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
              value={selectedCrop}
              onChange={(e) => setSelectedCrop(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-emerald-500 capitalize"
            >
              {(analytics?.commodityTrends || []).map((item) => (
  <option key={item.commodity} value={item.commodity}>
    {item.commodity}
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
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-emerald-500"
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
                <p className="text-[11px] text-slate-400 leading-relaxed">
          This simulator uses an illustrative 90% benchmark threshold for
          demonstration only. It does not represent an official MSP, statutory
          price floor, or regulatory compliance assessment.
        </p>
      </div>
    </div>
  );
}
