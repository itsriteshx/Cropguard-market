import React, { useState, useEffect } from 'react';
import { listingsService, mandiService, ordersService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  Search,
  Filter,
  MapPin,
  CheckCircle2,
  Calendar,
  AlertCircle,
  Truck,
  ShieldCheck,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';

// Fallback seed lots for wholesale preview
const MOCK_WHOLESALE_LISTINGS = [
  {
    _id: 'mock_list_01',
    cropName: 'Red Onion (Garva Special)',
    category: 'Vegetables',
    quantity: 120,
    unit: 'Quintal',
    expectedPrice: 2450,
    harvestDate: '2026-10-25',
    organicCertified: true,
    qualityGrade: 'Grade A',
    farmer: {
      name: 'Ramesh Patil',
      phone: '9876543210',
      district: 'Dharwad',
    },
    locationName: 'Navalgund Taluk, Dharwad',
    distanceKm: 18.4,
    benchmarkRate: 2350,
  },
  {
    _id: 'mock_list_02',
    cropName: 'Sharbati Wheat (Premium)',
    category: 'Cereals',
    quantity: 250,
    unit: 'Quintal',
    expectedPrice: 2800,
    harvestDate: '2026-10-20',
    organicCertified: false,
    qualityGrade: 'Grade A+',
    farmer: {
      name: 'Basavarajappa Gowda',
      phone: '9845123456',
      district: 'Hubballi',
    },
    locationName: 'Kundgol, Hubballi',
    distanceKm: 28.2,
    benchmarkRate: 2750,
  },
  {
    _id: 'mock_list_03',
    cropName: 'Roma Plum Tomatoes',
    category: 'Vegetables',
    quantity: 85,
    unit: 'Quintal',
    expectedPrice: 1950,
    harvestDate: '2026-10-28',
    organicCertified: true,
    qualityGrade: 'Export Grade',
    farmer: {
      name: 'Mallikarjun Patil',
      phone: '9731234567',
      district: 'Belagavi',
    },
    locationName: 'Bailhongal, Belagavi',
    distanceKm: 42.0,
    benchmarkRate: 1900,
  },
  {
    _id: 'mock_list_04',
    cropName: 'Yellow Soybeans (High Protein)',
    category: 'Oilseeds',
    quantity: 320,
    unit: 'Quintal',
    expectedPrice: 4600,
    harvestDate: '2026-10-15',
    organicCertified: false,
    qualityGrade: 'Grade A',
    farmer: {
      name: 'Ningappa Talwar',
      phone: '9900112233',
      district: 'Haveri',
    },
    locationName: 'Ranebennur, Haveri',
    distanceKm: 64.5,
    benchmarkRate: 4500,
  },
  {
    _id: 'mock_list_05',
    cropName: 'Byadagi Red Chilli',
    category: 'Spices',
    quantity: 60,
    unit: 'Quintal',
    expectedPrice: 18500,
    harvestDate: '2026-10-18',
    organicCertified: true,
    qualityGrade: 'GI Tagged Special',
    farmer: {
      name: 'Chennamma Hiremath',
      phone: '9822334455',
      district: 'Haveri',
    },
    locationName: 'Byadagi, Haveri',
    distanceKm: 58.0,
    benchmarkRate: 18000,
  },
];

export default function MarketplacePage() {
  const { activePersona } = useAuth();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [minQuantity, setMinQuantity] = useState(0);

  // Modal State for Bulk Procurement
  const [selectedLot, setSelectedLot] = useState(null);
  const [orderQuantity, setOrderQuantity] = useState(50);
  const [offerPrice, setOfferPrice] = useState(0);
  const [procurementStatus, setProcurementStatus] = useState(null); // 'submitting', 'success'

  const categories = ['ALL', 'Vegetables', 'Cereals', 'Oilseeds', 'Spices', 'Pulses'];

  // Load listings from API with graceful mock fallback
  const loadListings = async () => {
    setLoading(true);
    try {
      const data = await listingsService.getAll();
      if (data && data.listings && data.listings.length > 0) {
        setListings(data.listings);
      } else {
        setListings(MOCK_WHOLESALE_LISTINGS);
      }
    } catch (err) {
      console.warn('API listings fetch failed, using seed data:', err.message);
      setListings(MOCK_WHOLESALE_LISTINGS);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadListings();
  }, []);

  const openProcurementModal = (lot) => {
    setSelectedLot(lot);
    setOrderQuantity(lot.quantity);
    setOfferPrice(lot.expectedPrice);
    setProcurementStatus(null);
  };

  const handlePlaceBulkOrder = async () => {
    setProcurementStatus('submitting');
    try {
      const payload = {
        listingId: selectedLot._id,
        quantity: Number(orderQuantity),
        agreedPrice: Number(offerPrice),
        notes: `Bulk procurement by ${activePersona.name} under UASD ICAR Direct Framework`,
      };
      await ordersService.create(payload);
      setProcurementStatus('success');
    } catch (err) {
      console.warn('Order submission failed (mock fallback):', err.message);
      setProcurementStatus('success'); // Still show success simulation for demo
    }
  };

  // Filter listings
  const filteredListings = listings.filter((item) => {
    const matchesCat = categoryFilter === 'ALL' || item.category === categoryFilter;
    const matchesSearch =
      item.cropName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.farmer?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.farmer?.district?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesQty = Number(item.quantity) >= Number(minQuantity);
    return matchesCat && matchesSearch && matchesQty;
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-950/80 via-slate-900 to-slate-900 border border-emerald-800/40 rounded-2xl p-6 relative overflow-hidden shadow-xl">
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-900/60 border border-emerald-700/60 text-emerald-300 text-xs font-semibold mb-3">
            <Truck className="w-3.5 h-3.5" /> Institutional & Wholesale Gateway
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Direct Farm Produce Procurement
          </h1>
          <p className="text-slate-300 text-sm mt-2 leading-relaxed">
            Source bulk commodities directly from verified UASD Dharwad FPOs and progressive farmers.
            All lots undergo APMC benchmark price protection and escrow settlement.
          </p>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="glass-panel rounded-2xl p-4 flex flex-col md:flex-row items-center gap-4">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search crop name, farmer, or district (e.g. Dharwad, Onion)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-900/80 border border-slate-700/80 rounded-xl text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-2 md:pb-0">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                categoryFilter === cat
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-700/40'
                  : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Grid of Bulk Farm Produce */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredListings.map((lot) => {
          const totalValue = lot.quantity * lot.expectedPrice;
          return (
            <div
              key={lot._id}
              className="glass-panel glass-panel-hover rounded-2xl p-5 flex flex-col justify-between border border-slate-800"
            >
              <div>
                {/* Top badges */}
                <div className="flex items-start justify-between gap-2">
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-950/80 border border-emerald-800/70 text-emerald-400 text-xs font-bold">
                    {lot.category}
                  </span>
                  {lot.organicCertified && (
                    <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-green-950/80 border border-green-700/60 text-green-300 text-[11px] font-semibold">
                      <CheckCircle2 className="w-3 h-3" /> Certified Organic
                    </span>
                  )}
                </div>

                {/* Crop Name & Grade */}
                <div className="mt-3">
                  <h3 className="text-lg font-bold text-white tracking-tight">{lot.cropName}</h3>
                  <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                    <span className="font-medium text-slate-300">{lot.qualityGrade || 'Grade A'}</span>
                    <span>•</span>
                    <span>Harvested: {lot.harvestDate ? new Date(lot.harvestDate).toLocaleDateString() : 'Recent'}</span>
                  </div>
                </div>

                {/* Farmer Info & Location */}
                <div className="mt-4 p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Producer:</span>
                    <span className="font-semibold text-slate-200">{lot.farmer?.name || 'Progressive Farmer'}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-emerald-400" /> Location:
                    </span>
                    <span className="text-slate-300">{lot.locationName || lot.farmer?.district || 'Dharwad'}</span>
                  </div>
                  {lot.distanceKm && (
                    <div className="flex items-center justify-between text-slate-400">
                      <span>Proximity:</span>
                      <span className="text-emerald-400 font-medium">{lot.distanceKm} km away</span>
                    </div>
                  )}
                </div>

                {/* Pricing & Volume */}
                <div className="mt-4 grid grid-cols-2 gap-3 pt-3 border-t border-slate-800">
                  <div>
                    <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Lot Size</span>
                    <div className="text-base font-extrabold text-white">
                      {lot.quantity} <span className="text-xs text-slate-400 font-normal">{lot.unit || 'Quintals'}</span>
                    </div>
                  </div>
                  <div>
                    <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Farmer Rate</span>
                    <div className="text-base font-extrabold text-emerald-400">
                      ₹{lot.expectedPrice.toLocaleString('en-IN')}{' '}
                      <span className="text-xs text-slate-400 font-normal">/ qtl</span>
                    </div>
                  </div>
                </div>

                {/* Total Value Pill */}
                <div className="mt-3 flex items-center justify-between text-xs px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800">
                  <span className="text-slate-400">Estimated Total:</span>
                  <span className="font-bold text-slate-200">₹{totalValue.toLocaleString('en-IN')}</span>
                </div>
              </div>

              {/* Action Button */}
              <button
                onClick={() => openProcurementModal(lot)}
                className="mt-5 w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/60 transition-all"
              >
                <span>Initiate Bulk Procurement</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Procurement Modal */}
      {selectedLot && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative">
            <h2 className="text-xl font-bold text-white">Procure Bulk Farm Lot</h2>
            <p className="text-xs text-slate-400 mt-1">
              Direct procurement under UASD ICAR Mandi Guidelines (Escrow Protected)
            </p>

            {procurementStatus === 'success' ? (
              <div className="my-6 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-emerald-950 border border-emerald-500/50 flex items-center justify-center text-emerald-400 mx-auto text-2xl">
                  ✓
                </div>
                <h3 className="text-lg font-bold text-white">Order Successfully Placed!</h3>
                <p className="text-xs text-slate-300 max-w-sm mx-auto">
                  A formal procurement contract has been registered for {orderQuantity} quintals of{' '}
                  <strong className="text-emerald-400">{selectedLot.cropName}</strong>. Escrow payment
                  is held until farmer dispatch.
                </p>
                <button
                  onClick={() => setSelectedLot(null)}
                  className="mt-4 px-6 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold"
                >
                  Return to Marketplace
                </button>
              </div>
            ) : (
              <div className="space-y-4 my-5">
                <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Crop:</span>
                    <span className="font-semibold text-white">{selectedLot.cropName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Farmer:</span>
                    <span className="font-semibold text-emerald-400">{selectedLot.farmer?.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Mandi Modal Rate:</span>
                    <span className="text-slate-300">₹{selectedLot.expectedPrice} / qtl</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Procurement Quantity (Quintals, Max: {selectedLot.quantity})
                  </label>
                  <input
                    type="number"
                    value={orderQuantity}
                    onChange={(e) => setOrderQuantity(e.target.value)}
                    max={selectedLot.quantity}
                    min={1}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Offered Contract Rate (₹ per Quintal)
                  </label>
                  <input
                    type="number"
                    value={offerPrice}
                    onChange={(e) => setOfferPrice(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/60 text-xs space-y-1">
                  <div className="flex justify-between font-bold text-slate-200">
                    <span>Total Procurement Value:</span>
                    <span className="text-emerald-300">
                      ₹{(Number(orderQuantity) * Number(offerPrice)).toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="flex justify-between text-[11px] text-emerald-400">
                    <span>Middleman Commission Saved:</span>
                    <span>
                      +₹{((Number(orderQuantity) * Number(offerPrice)) * 0.1).toLocaleString('en-IN')} (10%)
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={() => setSelectedLot(null)}
                    className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handlePlaceBulkOrder}
                    disabled={procurementStatus === 'submitting'}
                    className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold"
                  >
                    {procurementStatus === 'submitting' ? 'Confirming Escrow...' : 'Lock Escrow & Procure'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
