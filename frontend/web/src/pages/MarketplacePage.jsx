import React, { useState, useEffect, useMemo } from 'react';
import { listingsService, ordersService, negotiationsService, mandiService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  Search,
  MapPin,
  CheckCircle2,
  Truck,
  ArrowRight,
  ShieldCheck,
  SlidersHorizontal,
  Eye,
  X,
  Award,
  RefreshCw,
  Zap,
  Calendar,
  Building2,
  TrendingUp,
  Star,
  Leaf,
  BarChart3,
  Lock,
  Globe,
  Sparkles,
  ChevronRight,
  MessageSquare,
  PlusCircle,
} from 'lucide-react';

// Multilingual crop names dictionary for full immersion
const LOCALIZED_CROPS = {
  hi: {
    'Red Onion (Garva Special)': 'लाल प्याज (गारवा स्पेशल)',
    'Sharbati Golden Wheat': 'शरबती सुनहरा गेहूं (UASD)',
    'Roma Plum Tomatoes': 'रोमा प्लम टमाटर (ग्रेड A)',
    'Byadagi Stemless Chilli': 'ब्याडगी डंठल-रहित लाल मिर्च (GI)',
    'Yellow Soybean (JS-335)': 'पीली सोयाबीन (JS-335)',
    'Salem Golden Turmeric': 'सलेम गोल्डन हल्दी (4.2% करक्यूमिन)',
    'Shimla Green Bell Peppers': 'शिमला हरी मिर्च (पॉलीहाउस)',
    'Kagzi Seedless Lemons': 'कागजी बीज-रहित नींबू',
  },
  kn: {
    'Red Onion (Garva Special)': 'ಕೆಂಪು ಈರುಳ್ಳಿ (ಗಾರ್ವಾ ಸ್ಪೆಷಲ್)',
    'Sharbati Golden Wheat': 'ಶರ್ಬತಿ ಗೋಧಿ (UASD ಪ್ರಮಾಣಿತ)',
    'Roma Plum Tomatoes': 'ರೋಮಾ ಪ್ಲಮ್ ಟೊಮೆಟೊ (ಗ್ರೇಡ್ A)',
    'Byadagi Stemless Chilli': 'ಬ್ಯಾಡಗಿ ತೊಟ್ಟು ರಹಿತ ಮೆಣಸಿನಕಾಯಿ (GI)',
    'Yellow Soybean (JS-335)': 'ಹಳದಿ ಸೋಯಾಬೀನ್ (JS-335)',
    'Salem Golden Turmeric': 'ಸೇಲಂ ಅರಿಶಿನ (4.2% ಕರ್ಕ್ಯುಮಿನ್)',
    'Shimla Green Bell Peppers': 'ದಪ್ಪ ಮೆಣಸಿನಕಾಯಿ (ಕ್ಯಾಪ್ಸಿಕಂ)',
    'Kagzi Seedless Lemons': 'ಕಾಗಜಿ ನಿಂಬೆಹಣ್ಣು',
  },
  mr: {
    'Red Onion (Garva Special)': 'लाल कांदा (गारवा स्पेशल)',
    'Sharbati Golden Wheat': 'शरबती सुवर्ण गहू (UASD)',
    'Roma Plum Tomatoes': 'रोमा प्लम टोमॅटो (ग्रेड A)',
    'Byadagi Stemless Chilli': 'ब्याडगी देठ विरहित मिरची (GI)',
    'Yellow Soybean (JS-335)': 'पिवळी सोयाबीन (JS-335)',
    'Salem Golden Turmeric': 'सलेम हळद (4.2% करक्युमिन)',
    'Shimla Green Bell Peppers': 'ढोबळी मिरची (पॉलीहाऊस)',
    'Kagzi Seedless Lemons': 'कागदी लिंबू',
  },
  te: {
    'Red Onion (Garva Special)': 'ఎర్ర ఉల్లిపాయ (గర్వా స్పెషల్)',
    'Sharbati Golden Wheat': 'శర్బతి గోధుమలు (UASD ధృవీకరించినవి)',
    'Roma Plum Tomatoes': 'రోమా ప్లమ్ టమోటాలు (గ్రేడ్ A)',
    'Byadagi Stemless Chilli': 'బ్యాడగి తొడిమ లేని మిర్చి (GI)',
    'Yellow Soybean (JS-335)': 'పసుపు సోయాబీన్ (JS-335)',
    'Salem Golden Turmeric': 'సేలం పసుపు (4.2% కర్కుమిన్)',
    'Shimla Green Bell Peppers': 'బెంగళూరు క్యాప్సికమ్',
    'Kagzi Seedless Lemons': 'కాగ్జీ నిమ్మకాయలు',
  },
  ta: {
    'Red Onion (Garva Special)': 'சிவப்பு வெங்காயம் (கார்வா ஸ்பெஷல்)',
    'Sharbati Golden Wheat': 'ஷர்பதி தங்க கோதுமை (UASD)',
    'Roma Plum Tomatoes': 'ரோமா தக்காளி (கிரேடு A)',
    'Byadagi Stemless Chilli': 'பியாடகி காம்பில்லா மிளகாய் (GI)',
    'Yellow Soybean (JS-335)': 'மஞ்சள் சோயாபீன் (JS-335)',
    'Salem Golden Turmeric': 'சேலம் மஞ்சள் (4.2% குர்குமின்)',
    'Shimla Green Bell Peppers': 'குடைமிளகாய் (பச்சை)',
    'Kagzi Seedless Lemons': 'காக்ஸி எலுமிச்சை',
  },
  gu: {
    'Red Onion (Garva Special)': 'લાલ ડુંગળી (ગારવા સ્પેશિયલ)',
    'Sharbati Golden Wheat': 'શરબતી ઘઉં (UASD પ્રમાણિત)',
    'Roma Plum Tomatoes': 'રોમા પ્લમ ટમેટા (ગ્રેડ A)',
    'Byadagi Stemless Chilli': 'બ્યાડગી મરચાં (GI ટેગ)',
    'Yellow Soybean (JS-335)': 'પીળી સોયાબીન (JS-335)',
    'Salem Golden Turmeric': 'સેલમ હળદર (4.2% કરક્યુમિન)',
    'Shimla Green Bell Peppers': 'શિમલા મરચાં (કેપ્સિકમ)',
    'Kagzi Seedless Lemons': 'કાગઝી લીંબુ',
  },
  pa: {
    'Red Onion (Garva Special)': 'ਲਾਲ ਪਿਆਜ਼ (ਗਾਰਵਾ ਸਪੈਸ਼ਲ)',
    'Sharbati Golden Wheat': 'ਸ਼ਰਬਤੀ ਸੁਨਹਿਰੀ ਕਣਕ (UASD)',
    'Roma Plum Tomatoes': 'ਰੋਮਾ ਪਲਮ ਟਮਾਟਰ (ਗ੍ਰੇਡ A)',
    'Byadagi Stemless Chilli': 'ਬਿਆਡਗੀ ਲਾਲ ਮਿਰਚ (GI)',
    'Yellow Soybean (JS-335)': 'ਪੀਲੀ ਸੋਇਆਬੀਨ (JS-335)',
    'Salem Golden Turmeric': 'ਸਲੇਮ ਹਲਦੀ (4.2% ਕਰਕਿਊਮਿਨ)',
    'Shimla Green Bell Peppers': 'ਸ਼ਿਮਲਾ ਮਿਰਚ',
    'Kagzi Seedless Lemons': 'ਕਾਗਜ਼ੀ ਨਿੰਬੂ',
  },
};

const getLocalizedCropName = (cropName, lang) => {
  return LOCALIZED_CROPS[lang]?.[cropName] || cropName;
};

export default function MarketplacePage({ onNavigateToSell, onNavigateToNegotiations, onNavigateToMandi }) {
  const { activePersona, currentUser, t, language } = useAuth();
  const m = t.marketplace || {};
  const modalText = m.modal || {};
  const userRole = currentUser?.role;
  const isFarmer = userRole === 'FARMER';
  const isBuyer = ['BUYER_RETAIL', 'BUYER_WHOLESALE'].includes(userRole);
  const canOrder = ['BUYER_RETAIL', 'BUYER_WHOLESALE', 'ADMIN'].includes(userRole);

  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [organicOnly, setOrganicOnly] = useState(false);
  const [sortBy, setSortBy] = useState('featured'); // 'featured', 'price_asc', 'price_desc', 'quantity', 'distance'
  const [liveMandiMatches, setLiveMandiMatches] = useState([]);
  const [liveMandiLoading, setLiveMandiLoading] = useState(false);

  // Modals state
  const [selectedLot, setSelectedLot] = useState(null);
  const [inspectLot, setInspectLot] = useState(null);
  const [offerLot, setOfferLot] = useState(null);
  const [orderQuantity, setOrderQuantity] = useState(50);
  const [offerPrice, setOfferPrice] = useState(0);
  const [procurementStatus, setProcurementStatus] = useState(null); // 'submitting', 'success', 'error'
  const [orderError, setOrderError] = useState('');
  const [escrowContractId, setEscrowContractId] = useState('');

  // Quick Bargaining Offer Modal State
  const [bidPrice, setBidPrice] = useState('');
  const [bidQty, setBidQty] = useState('');
  const [bidNote, setBidNote] = useState('');
  const [bidError, setBidError] = useState('');
  const [bidSubmitting, setBidSubmitting] = useState(false);

  const categories = [
    { id: 'ALL', label: 'All Crops', icon: '🌾' },
    { id: 'Vegetables', label: 'Vegetables', icon: '🥬' },
    { id: 'Cereals', label: 'Cereals & Grains', icon: '🌾' },
    { id: 'Spices', label: 'Spices', icon: '🌶️' },
    { id: 'Oilseeds', label: 'Oilseeds', icon: '🌻' },
    { id: 'Fruits', label: 'Fruits', icon: '🥭' },
    { id: 'Pulses', label: 'Pulses', icon: '🫘' },
  ];

  // Load real listings directly from backend MongoDB + Agmarknet benchmark + Wikimedia media API
  const loadListings = async (viewerCoords = null) => {
    setLoading(true);
    setFetchError('');
    try {
      const params = { limit: 50 };
      if (viewerCoords?.lat && viewerCoords?.lon) {
        params.viewerLat = viewerCoords.lat;
        params.viewerLon = viewerCoords.lon;
      }
      const data = await listingsService.getAll(params);
      if (data && data.success && Array.isArray(data.listings)) {
        setListings(data.listings);
      } else {
        setListings([]);
      }
    } catch (err) {
      setFetchError(err.response?.data?.message || err.message || 'Failed to load marketplace listings from API');
      setListings([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadListings();
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          loadListings({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        },
        () => {},
        { timeout: 3000 }
      );
    }
  }, []);

  // Automatically fetch live Govt Agmarknet APMC prices when user searches a crop in Marketplace
  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      setLiveMandiMatches([]);
      return;
    }

    let active = true;
    const timer = setTimeout(async () => {
      setLiveMandiLoading(true);
      try {
        const res = await mandiService.getLiveRates({
          state: 'ALL',
          commodity: q,
          limit: 20,
        });
        if (active && Array.isArray(res?.rates)) {
          setLiveMandiMatches(res.rates);
        }
      } catch {
        if (active) setLiveMandiMatches([]);
      } finally {
        if (active) setLiveMandiLoading(false);
      }
    }, 450);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [searchQuery]);

  const openProcurementModal = (lot) => {
    setSelectedLot(lot);
    setOrderQuantity(lot.quantity);
    setOfferPrice(lot.expectedPrice || lot.pricePerUnit || 0);
    setProcurementStatus(null);
    setOrderError('');
    setEscrowContractId('');
  };

  const handlePlaceBulkOrder = async () => {
    setProcurementStatus('submitting');
    setOrderError('');

    try {
      const buyerName = currentUser?.name || activePersona?.name || 'Registered Buyer';
      const payload = {
        listingId: selectedLot._id,
        quantity: Number(orderQuantity),
        agreedPrice: Number(offerPrice),
        notes: `Direct purchase by ${buyerName}`,
      };
      const res = await ordersService.create(payload);
      setEscrowContractId(res?.order?.orderNumber || res?.order?._id || 'CONFIRMED');
      setProcurementStatus('success');
      loadListings();
    } catch (err) {
      setOrderError(err.response?.data?.message || err.message || 'Unable to place order');
      setProcurementStatus('error');
    }
  };

  const openBargainModal = (lot) => {
    setOfferLot(lot);
    setBidPrice(String(lot.expectedPrice || lot.pricePerUnit || ''));
    setBidQty(String(lot.quantity || 1));
    setBidNote('');
    setBidError('');
  };

  const handleSubmitBargainOffer = async (e) => {
    e.preventDefault();
    if (!offerLot) return;
    setBidError('');
    setBidSubmitting(true);
    try {
      const res = await negotiationsService.start({
        listingId: offerLot._id,
        offeredPrice: Number(bidPrice),
        quantity: Number(bidQty),
        note: bidNote.trim() || undefined,
      });
      if (res?.success) {
        setOfferLot(null);
        if (onNavigateToNegotiations) onNavigateToNegotiations();
      } else {
        setBidError(res?.message || 'Unable to submit offer.');
      }
    } catch (err) {
      setBidError(err.response?.data?.message || err.message || 'Unable to start negotiation.');
    } finally {
      setBidSubmitting(false);
    }
  };

  // Filter & Sort Logic
  const filteredAndSortedListings = useMemo(() => {
    const filtered = listings.filter((item) => {
      const itemCat = (item.category || '').toUpperCase();
      const selectedCat = categoryFilter.toUpperCase();

      const matchesCat =
        selectedCat === 'ALL' ||
        itemCat === selectedCat ||
        (selectedCat === 'CEREALS' && (itemCat === 'GRAINS' || itemCat === 'CEREALS')) ||
        (selectedCat === 'PULSES' && itemCat === 'PULSES');

      const matchesSearch =
        !searchQuery ||
        item.cropName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.farmer?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.farmer?.district?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.locationName?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesOrganic = !organicOnly || item.organicCertified;

      return matchesCat && matchesSearch && matchesOrganic;
    });

    return filtered.sort((a, b) => {
      const priceA = a.expectedPrice || a.pricePerUnit || 0;
      const priceB = b.expectedPrice || b.pricePerUnit || 0;
      if (sortBy === 'price_asc') return priceA - priceB;
      if (sortBy === 'price_desc') return priceB - priceA;
      if (sortBy === 'quantity') return b.quantity - a.quantity;
      if (sortBy === 'distance') return (a.distanceKm ?? Number.MAX_SAFE_INTEGER) - (b.distanceKm ?? Number.MAX_SAFE_INTEGER);
      return 0; // featured default
    });
  }, [listings, categoryFilter, searchQuery, organicOnly, sortBy]);

  // Aggregate stats
  const totalVolumeMT = useMemo(() => {
    return Math.round(listings.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0) / 10);
  }, [listings]);

  return (
    <div className="space-y-5 pb-14">
      {/* Compact Action-Focused Marketplace Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 rounded-2xl p-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
            {isFarmer ? 'Marketplace & Your Crops' : 'Fresh Produce Marketplace'}
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            {listings.length} active harvest lots ({totalVolumeMT} MT available) • 0% middleman commission
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {isFarmer && onNavigateToSell && (
            <button
              onClick={onNavigateToSell}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-emerald-950 transition-colors"
            >
              <PlusCircle className="w-4 h-4" />
              <span>+ List New Harvest</span>
            </button>
          )}
          {onNavigateToNegotiations && (
            <button
              onClick={onNavigateToNegotiations}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors"
            >
              <MessageSquare className="w-4 h-4 text-emerald-400" />
              <span>Bargaining Room</span>
            </button>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════
          🔍 PREMIUM SEARCH, FILTER & CATEGORY SECTION
          ═══════════════════════════════════════════════════════ */}
      <div className="space-y-4 mb-6">
        {/* Search Bar */}
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-emerald-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={m.searchPlaceholder || 'Search crop name, farmer, or district (e.g. Red Onion, Wheat, Dharwad)...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-11 py-3.5 rounded-2xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none transition-all"
              style={{
                background: 'rgba(15,23,42,0.8)',
                border: '1px solid rgba(51,65,85,0.6)',
                backdropFilter: 'blur(12px)',
              }}
              onFocus={e => { e.target.style.borderColor = 'rgba(16,185,129,0.5)'; e.target.style.boxShadow = '0 0 0 3px rgba(16,185,129,0.08)'; }}
              onBlur={e => { e.target.style.borderColor = 'rgba(51,65,85,0.6)'; e.target.style.boxShadow = 'none'; }}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button onClick={() => setOrganicOnly(!organicOnly)}
              className="px-4 py-3 rounded-2xl text-xs font-bold flex items-center gap-2 transition-all"
              style={organicOnly
                ? { background: 'linear-gradient(135deg, #059669, #10b981)', color: 'white', boxShadow: '0 4px 15px rgba(16,185,129,0.3)' }
                : { background: 'rgba(15,23,42,0.8)', color: '#94a3b8', border: '1px solid rgba(51,65,85,0.6)' }
              }>
              <Leaf className={`w-3.5 h-3.5 ${organicOnly ? 'text-white' : 'text-emerald-400'}`} />
              <span>{m.certifiedOrganic || 'Certified Organic'}</span>
            </button>

            <div className="flex items-center gap-2 px-3 py-3 rounded-2xl"
              style={{ background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(51,65,85,0.6)' }}>
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}
                className="bg-transparent border-none text-xs font-bold text-slate-200 focus:outline-none cursor-pointer">
                <option value="featured">{m.sortFeatured || 'Featured'}</option>
                <option value="price_asc">{m.sortPriceAsc || 'Price: Low → High'}</option>
                <option value="price_desc">{m.sortPriceDesc || 'Price: High → Low'}</option>
                <option value="quantity">{m.sortQuantity || 'Largest Lots'}</option>
                <option value="distance">{m.sortDistance || 'Nearest First'}</option>
              </select>
            </div>
          </div>
        </div>

        {/* Category Pills — Premium Style */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          {categories.map((cat) => {
            const isSelected = categoryFilter === cat.id;
            const categoryLabel = m.categories?.[cat.id] || cat.label;
            return (
              <button key={cat.id} onClick={() => setCategoryFilter(cat.id)}
                className="px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-2"
                style={isSelected
                  ? {
                    background: 'linear-gradient(135deg, #065f46, #059669)',
                    color: '#a7f3d0',
                    border: '1px solid rgba(52,211,153,0.4)',
                    boxShadow: '0 4px 12px rgba(5,150,105,0.25)',
                  }
                  : {
                    background: 'rgba(15,23,42,0.6)',
                    color: '#64748b',
                    border: '1px solid rgba(51,65,85,0.5)',
                  }
                }>
                <span style={{ fontSize: '14px' }}>{cat.icon}</span>
                <span>{categoryLabel}</span>
              </button>
            );
          })}
        </div>

        {/* Results counter */}
        <div className="flex items-center justify-between text-xs px-1">
          <div className="flex items-center gap-2 text-slate-400">
            <span>
              {m.showing || 'Showing'}{' '}
              <strong className="text-emerald-400 font-bold">{filteredAndSortedListings.length}</strong>
              {' '}{m.showingLots || 'verified wholesale farm lots'}
            </span>
            {(searchQuery || categoryFilter !== 'ALL' || organicOnly) && (
              <button onClick={() => { setSearchQuery(''); setCategoryFilter('ALL'); setOrganicOnly(false); }}
                className="text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1 ml-1 underline underline-offset-2">
                <RefreshCw className="w-3 h-3" /> {m.resetFilters || 'Reset'}
              </button>
            )}
          </div>
          <span className="hidden sm:flex items-center gap-1 text-slate-500 text-[11px]">
            <Zap className="w-3 h-3 text-amber-400" />
            {m.verifiedBadge || 'Direct APMC Modal Rates Verified'}
          </span>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════
          📦 PREMIUM CROP LISTING CARDS GRID
          ═══════════════════════════════════════════════════════ */}
      {loading ? (
        <div className="py-24 text-center space-y-4">
          <div className="relative mx-auto w-14 h-14">
            <div className="w-14 h-14 rounded-full border-2 border-emerald-500/20 absolute inset-0" />
            <div className="w-14 h-14 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin absolute inset-0" />
            <div className="w-5 h-5 rounded-full bg-emerald-500/20 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>
          <p className="text-sm font-semibold text-slate-400">{m.loading || 'Loading verified wholesale lots...'}</p>
        </div>
      ) : fetchError ? (
        <div className="py-20 text-center space-y-4 rounded-3xl border border-red-900/50 bg-red-950/20">
          <div className="text-4xl">⚠️</div>
          <h3 className="text-xl font-bold text-white">Unable to Load Live Listings</h3>
          <p className="text-sm text-red-300 max-w-md mx-auto leading-relaxed">{fetchError}</p>
          <button onClick={() => loadListings()}
            className="px-5 py-2.5 rounded-xl text-white font-bold text-sm bg-emerald-600 hover:bg-emerald-500 transition-all">
            Retry Live API
          </button>
        </div>
      ) : filteredAndSortedListings.length === 0 ? (
        <div className="space-y-6">
          <div className="py-12 px-6 text-center space-y-4 rounded-3xl border border-slate-800/60"
            style={{ background: 'rgba(15,23,42,0.5)' }}>
            <div className="text-4xl">🌾</div>
            <h3 className="text-xl font-bold text-white">{m.noLotsFound || 'No Matching Farm Lots Found'}</h3>
            <p className="text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
              {searchQuery.trim()
                ? `No farmer harvest lot listed for "${searchQuery.trim()}" yet. Live Govt APMC mandi benchmarks for your search are shown below.`
                : (m.noLotsSub || 'Try adjusting your search keywords or switching category filters.')}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button onClick={() => { setSearchQuery(''); setCategoryFilter('ALL'); setOrganicOnly(false); }}
                className="px-5 py-2.5 rounded-xl text-white font-bold text-sm transition-all"
                style={{ background: 'linear-gradient(135deg, #059669, #10b981)' }}>
                {m.clearFilters || 'Clear All Filters'}
              </button>
              {onNavigateToMandi && (
                <button
                  type="button"
                  onClick={onNavigateToMandi}
                  className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-sm flex items-center gap-2 transition-all"
                >
                  <BarChart3 className="w-4 h-4" />
                  <span>Open Full APMC Mandi Intelligence</span>
                </button>
              )}
            </div>
          </div>

          {searchQuery.trim().length >= 2 && (
            <div className="bg-slate-900/80 border border-emerald-800/40 rounded-2xl overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <h4 className="text-sm font-extrabold text-white flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-emerald-400" />
                    Live Govt Agmarknet APMC Prices for &quot;{searchQuery.trim()}&quot;
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Fetched directly from data.gov.in across Indian APMC mandis
                  </p>
                </div>
                {onNavigateToMandi && (
                  <button
                    type="button"
                    onClick={onNavigateToMandi}
                    className="text-xs font-bold text-emerald-400 hover:text-emerald-300 underline underline-offset-2 self-start sm:self-auto"
                  >
                    Explore All 300+ Crops &amp; Filters →
                  </button>
                )}
              </div>

              {liveMandiLoading ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  Searching live Agmarknet mandis for &quot;{searchQuery.trim()}&quot;...
                </div>
              ) : liveMandiMatches.length > 0 ? (
                <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {liveMandiMatches.map((r, idx) => (
                    <div
                      key={`${r.marketCenter}-${r.district}-${idx}`}
                      className="rounded-2xl bg-slate-950/90 border border-slate-800 overflow-hidden flex flex-col hover:border-emerald-500/50 transition-colors"
                    >
                      <div className="relative h-36 bg-gradient-to-br from-emerald-950 to-slate-900 flex items-center justify-center overflow-hidden">
                        {r.imageUrl ? (
                          <img
                            src={r.imageUrl}
                            alt={r.commodity}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <span className="text-4xl">🌾</span>
                        )}
                        <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-full bg-slate-950/85 border border-slate-700 text-[10px] font-bold text-emerald-300">
                          {r.category || 'AGMARKNET'}
                        </span>
                        <span className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-full bg-slate-950/85 border border-slate-700 text-[10px] font-semibold text-slate-200">
                          {r.grade || 'Standard'}
                        </span>
                      </div>

                      <div className="p-3.5 space-y-2.5 flex-1 flex flex-col justify-between">
                        <div>
                          <div className="font-extrabold text-sm text-white">
                            {r.commodity}
                            {r.variety ? (
                              <span className="text-emerald-300 font-semibold text-xs ml-1.5">
                                ({r.variety})
                              </span>
                            ) : null}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-emerald-400 shrink-0" />
                            <span className="truncate">
                              {r.marketCenter} • {r.district}, {r.state}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            Arrival: {r.arrivalDateRaw || (r.priceDate ? new Date(r.priceDate).toLocaleDateString('en-IN') : 'Today')}
                          </div>
                        </div>

                        <div className="pt-2 border-t border-slate-800 grid grid-cols-3 gap-2 text-center">
                          <div className="bg-slate-900/90 rounded-lg py-1.5 px-1">
                            <div className="text-[10px] text-slate-400">Min</div>
                            <div className="font-mono text-xs font-bold text-amber-300">
                              ₹{Number(r.minPrice).toLocaleString('en-IN')}
                            </div>
                          </div>
                          <div className="bg-emerald-950/60 border border-emerald-800/50 rounded-lg py-1.5 px-1">
                            <div className="text-[10px] text-emerald-300">Modal/qtl</div>
                            <div className="font-mono text-xs font-black text-emerald-400">
                              ₹{Number(r.modalPrice).toLocaleString('en-IN')}
                            </div>
                          </div>
                          <div className="bg-slate-900/90 rounded-lg py-1.5 px-1">
                            <div className="text-[10px] text-slate-400">Max</div>
                            <div className="font-mono text-xs font-bold text-sky-300">
                              ₹{Number(r.maxPrice).toLocaleString('en-IN')}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 text-center text-xs text-slate-400">
                  No daily Agmarknet APMC rows arrived today for &quot;{searchQuery.trim()}&quot;. Open <strong className="text-emerald-300">APMC Mandi Intelligence</strong> in the left sidebar to browse all live commodities.
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredAndSortedListings.map((lot) => {
            const price = Number(lot.expectedPrice || lot.pricePerUnit || 0);
            const totalValue = lot.quantity * price;
            const benchmark = lot.benchmarkRate != null ? Number(lot.benchmarkRate) : null;
            const spreadDelta = benchmark !== null ? price - benchmark : null;
            const cropImg = (Array.isArray(lot.images) && lot.images.find((u) => typeof u === 'string' && (/^https?:\/\//i.test(u) || u.startsWith('/uploads/')))) || lot.resolvedImageUrl || null;
            const middlemanSaved = Math.round(totalValue * 0.1);
            const localizedCrop = getLocalizedCropName(lot.cropName, language);
            const translatedCategory = m.categories?.[lot.category] || lot.category;
            const fillPercent = Math.min(95, Math.max(20, (lot.quantity / 300) * 100));

            return (
              <div key={lot._id}
                className="group relative flex flex-col rounded-3xl overflow-hidden transition-all duration-300"
                style={{
                  background: 'linear-gradient(145deg, rgba(15,23,42,0.95) 0%, rgba(8,14,26,0.98) 100%)',
                  border: '1px solid rgba(51,65,85,0.5)',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.border = '1px solid rgba(16,185,129,0.4)';
                  e.currentTarget.style.boxShadow = '0 8px 32px rgba(16,185,129,0.12), 0 4px 20px rgba(0,0,0,0.4)';
                  e.currentTarget.style.transform = 'translateY(-3px)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.border = '1px solid rgba(51,65,85,0.5)';
                  e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.3)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                {/* Crop Image from Farmer Upload or Wikipedia REST Media API */}
                <div className="relative h-52 overflow-hidden bg-gradient-to-br from-emerald-950 to-slate-900 flex items-center justify-center">
                  {cropImg ? (
                    <img src={cropImg} alt={lot.cropName}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                      loading="lazy" />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-emerald-400/70 gap-2">
                      <Leaf className="w-10 h-10" />
                      <span className="text-xs font-semibold text-slate-400">{lot.category}</span>
                    </div>
                  )}

                  {/* Multi-layer gradient overlay */}
                  <div className="absolute inset-0"
                    style={{ background: 'linear-gradient(to top, rgba(8,14,26,1) 0%, rgba(8,14,26,0.4) 50%, rgba(0,0,0,0.3) 100%)' }} />

                  {/* Top badges */}
                  <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2 z-10">
                    <span className="px-2.5 py-1 rounded-lg text-[11px] font-extrabold tracking-wider uppercase backdrop-blur-md"
                      style={{ background: 'rgba(8,14,26,0.8)', border: '1px solid rgba(51,65,85,0.7)', color: '#94a3b8' }}>
                      {translatedCategory}
                    </span>
                    {lot.organicCertified ? (
                      <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold backdrop-blur-md"
                        style={{ background: 'rgba(5,46,22,0.9)', border: '1px solid rgba(16,185,129,0.6)', color: '#6ee7b7' }}>
                        <Leaf className="w-3 h-3 text-emerald-400" />
                        {m.certifiedOrganic || 'Organic'}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold backdrop-blur-md"
                        style={{ background: 'rgba(8,14,26,0.8)', border: '1px solid rgba(51,65,85,0.6)', color: '#fcd34d' }}>
                        <Award className="w-3 h-3 text-amber-400" />
                        {lot.qualityGrade?.split(' ').slice(0, 2).join(' ') || 'Grade A'}
                      </span>
                    )}
                  </div>

                  {/* Bottom image meta */}
                  <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between z-10">
                    <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] backdrop-blur-md"
                      style={{ background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.08)', color: '#cbd5e1' }}>
                      <Calendar className="w-3 h-3 text-emerald-400" />
                      {lot.harvestDate ? new Date(lot.harvestDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'Fresh Harvest'}
                    </span>
                    {lot.distanceKm && (
                      <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold backdrop-blur-md"
                        style={{ background: 'rgba(5,46,22,0.85)', border: '1px solid rgba(16,185,129,0.4)', color: '#6ee7b7' }}>
                        <MapPin className="w-3 h-3 text-emerald-400" />
                        {lot.distanceKm} km {m.away || 'away'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Body */}
                <div className="flex flex-col flex-1 p-5 space-y-4">
                  {/* Title + Description */}
                  <div>
                    <h3 className="text-lg font-black text-white tracking-tight mb-1 transition-colors group-hover:text-emerald-300">
                      {localizedCrop}
                    </h3>
                    <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                      {lot.description || 'Quality certified wholesale lot ready for bulk dispatch under UASD ICAR Mandi framework.'}
                    </p>
                  </div>

                  {/* Farmer Card */}
                  <div className="flex items-center justify-between p-3 rounded-2xl"
                    style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(51,65,85,0.5)' }}>
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black text-white shrink-0"
                        style={{ background: 'linear-gradient(135deg, #065f46, #059669)' }}>
                        {lot.farmer?.name?.charAt(0) || 'F'}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1 text-xs font-bold text-white truncate">
                          {lot.farmer?.name || 'Verified Producer'}
                          <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                        </div>
                        <div className="text-[10px] text-slate-500 truncate flex items-center gap-1 mt-0.5">
                          <MapPin className="w-2.5 h-2.5 shrink-0" />
                          {lot.locationName || lot.farmer?.district || 'Karnataka'}
                        </div>
                      </div>
                    </div>
                    <button onClick={() => setInspectLot(lot)}
                      className="px-2.5 py-1.5 rounded-xl text-[11px] font-bold shrink-0 transition-all flex items-center gap-1"
                      style={{ background: 'rgba(30,41,59,0.8)', color: '#94a3b8', border: '1px solid rgba(51,65,85,0.6)' }}
                      onMouseEnter={e => { e.currentTarget.style.color = 'white'; e.currentTarget.style.borderColor = 'rgba(16,185,129,0.4)'; }}
                      onMouseLeave={e => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.borderColor = 'rgba(51,65,85,0.6)'; }}>
                      <Eye className="w-3 h-3 text-emerald-400" />
                      {m.specsBtn || 'Specs'}
                    </button>
                  </div>

                  {/* Pricing Grid */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-2xl" style={{ background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(51,65,85,0.4)' }}>
                      <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500 mb-1">
                        {m.lotSize || 'Available Lot'}
                      </div>
                      <div className="text-lg font-black text-white">
                        {lot.quantity} <span className="text-xs text-slate-500 font-normal">{lot.unit || 'Qtl'}</span>
                      </div>
                      <div className="mt-2 w-full rounded-full overflow-hidden" style={{ height: '3px', background: 'rgba(51,65,85,0.6)' }}>
                        <div className="h-full rounded-full" style={{ width: `${fillPercent}%`, background: 'linear-gradient(90deg, #059669, #34d399)' }} />
                      </div>
                    </div>
                    <div className="p-3 rounded-2xl" style={{ background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(51,65,85,0.4)' }}>
                      <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500 mb-1">
                        {m.farmerRate || 'Farmer Rate'}
                      </div>
                      <div className="text-lg font-black" style={{ color: '#34d399' }}>
                        ₹{price.toLocaleString('en-IN')} <span className="text-xs text-slate-500 font-normal">/ {lot.unit || 'qtl'}</span>
                      </div>
                      <div className="text-[10px] mt-1 font-semibold" style={{ color: '#6ee7b7' }}>
                        {spreadDelta === null
                          ? 'Direct Farm Quote'
                          : spreadDelta > 0
                          ? `+₹${spreadDelta} vs APMC Modal`
                          : spreadDelta < 0
                          ? `₹${Math.abs(spreadDelta)} below APMC Modal`
                          : 'Matches APMC Modal'}
                      </div>
                    </div>
                  </div>

                  {/* Value Summary */}
                  <div className="p-3.5 rounded-2xl" style={{ background: 'rgba(5,46,22,0.3)', border: '1px solid rgba(16,185,129,0.15)' }}>
                    <div className="flex items-center justify-between text-xs mb-2">
                      <span className="text-slate-400">{m.totalLotValue || 'Total Lot Value'}</span>
                      <span className="font-black text-white text-sm">₹{totalValue.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] pt-2"
                      style={{ borderTop: '1px solid rgba(16,185,129,0.1)' }}>
                      <span className="flex items-center gap-1 text-slate-400">
                        <Zap className="w-3 h-3 text-amber-400" />
                        {m.middlemanSavedTag || 'Middleman Fee Saved'}
                      </span>
                      <span className="font-bold" style={{ color: '#6ee7b7' }}>+₹{middlemanSaved.toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                </div>

                {/* Role-aware Action CTAs */}
                <div className="px-5 pb-5">
                  {currentUser && lot.farmer?._id && String(lot.farmer._id) === String(currentUser._id) ? (
                    <button
                      onClick={() => onNavigateToSell && onNavigateToSell()}
                      className="w-full py-3 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-800/60 transition-colors"
                    >
                      <span>🌾 Your Active Lot • Manage in Sell Produce</span>
                    </button>
                  ) : isBuyer ? (
                    <div className="grid grid-cols-2 gap-2.5">
                      <button
                        onClick={() => openBargainModal(lot)}
                        className="py-3 rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-700/60 transition-colors"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Make Offer</span>
                      </button>
                      <button
                        onClick={() => openProcurementModal(lot)}
                        className="py-3 rounded-2xl text-xs font-extrabold flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
                      >
                        <Truck className="w-3.5 h-3.5" />
                        <span>Buy Direct</span>
                      </button>
                    </div>
                  ) : canOrder ? (
                    <button
                      onClick={() => openProcurementModal(lot)}
                      className="w-full py-3 rounded-2xl text-xs font-extrabold flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
                    >
                      <Truck className="w-4 h-4" />
                      <span>Order Produce Lot</span>
                    </button>
                  ) : (
                    <div className="w-full py-2.5 px-3 rounded-xl text-center text-[11px] font-medium text-slate-400 bg-slate-900 border border-slate-800">
                      Farmer account active • Use "Sell Produce" to list crops
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 📋 QUICK INSPECTION DRAWER / MODAL */}
      {inspectLot && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-lg w-full p-6 shadow-2xl relative space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between">
              <div>
                <span className="px-2.5 py-1 rounded-lg bg-emerald-950 text-emerald-400 text-xs font-bold border border-emerald-800">
                  {m.categories?.[inspectLot.category] || inspectLot.category}
                </span>
                <h2 className="text-2xl font-black text-white mt-2">
                  {getLocalizedCropName(inspectLot.cropName, language)}
                </h2>
                <p className="text-xs text-slate-400">{inspectLot.locationName || inspectLot.location?.district || 'Registered Farm Gate'}</p>
              </div>
              <button
                onClick={() => setInspectLot(null)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quality Metrics */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-1">
                <span className="text-slate-400 text-[10px] uppercase font-bold">
                  {m.certStatus || 'Certification Status'}
                </span>
                <div className="font-bold text-white flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{inspectLot.qualityGrade || 'Grade A'}</span>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-1">
                <span className="text-slate-400 text-[10px] uppercase font-bold">
                  {m.moistureContent || 'Moisture Content'}
                </span>
                <div className="font-bold text-amber-300">
                  {inspectLot.moistureContent || 'Quality Inspected'}
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-1">
                <span className="text-slate-400 text-[10px] uppercase font-bold">
                  {modalText.modalRate || 'APMC Mandi Modal Rate'}
                </span>
                <div className="font-bold text-slate-200">
                  {inspectLot.benchmarkRate != null
                    ? `₹${Number(inspectLot.benchmarkRate).toLocaleString('en-IN')} / qtl`
                    : 'Not listed in today APMC feed'}
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-1">
                <span className="text-slate-400 text-[10px] uppercase font-bold">
                  {m.fpoOrg || 'Mandi Reference'}
                </span>
                <div className="font-bold text-emerald-400 truncate">
                  {inspectLot.benchmarkMarket || inspectLot.farmer?.fpo || 'Direct Farm Lot'}
                </div>
              </div>
            </div>

            {/* Full Description */}
            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-1 text-xs text-slate-300 leading-relaxed">
              <span className="text-slate-400 text-[10px] uppercase font-bold block mb-1">
                {m.lotSummary || 'Lot Agronomic Summary'}
              </span>
              <p>{inspectLot.description}</p>
            </div>

            {/* Farmer Direct Connection */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-800/60 border border-slate-700/60 text-xs">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-emerald-700 flex items-center justify-center font-bold text-white text-xs">
                  {inspectLot.farmer?.name?.charAt(0) || 'F'}
                </div>
                <div>
                  <div className="font-bold text-white">{inspectLot.farmer?.name}</div>
                  <div className="text-[10px] text-slate-400">{inspectLot.location?.district || inspectLot.farmer?.location?.district || 'India'}</div>
                </div>
              </div>
              <div className="text-emerald-400 text-xs font-mono font-bold">
                {inspectLot.farmer?.phone ? `📱 ${inspectLot.farmer.phone}` : 'Verified Member'}
              </div>
            </div>

            {canOrder && !(currentUser && inspectLot.farmer?._id && String(inspectLot.farmer._id) === String(currentUser._id)) && (
              <div className="flex gap-2.5">
                {isBuyer && (
                  <button
                    onClick={() => {
                      const lot = inspectLot;
                      setInspectLot(null);
                      openBargainModal(lot);
                    }}
                    className="flex-1 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-700 font-bold text-xs flex items-center justify-center gap-2"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>Make Offer</span>
                  </button>
                )}
                <button
                  onClick={() => {
                    const lot = inspectLot;
                    setInspectLot(null);
                    openProcurementModal(lot);
                  }}
                  className="flex-1 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-950"
                >
                  <Truck className="w-4 h-4" />
                  <span>{m.proceedProcure || 'Buy Direct'}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 💼 BULK PROCUREMENT & ESCROW MODAL */}
      {selectedLot && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-lg w-full p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-xl font-black text-white">{modalText.title || 'Procure Bulk Farm Lot'}</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {modalText.subtitle || 'Direct procurement under UASD ICAR Mandi Guidelines (Escrow Protected)'}
                </p>
              </div>
              <button
                onClick={() => setSelectedLot(null)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {procurementStatus === 'success' ? (
              <div className="my-6 text-center space-y-4">
                <div className="w-14 h-14 rounded-full bg-emerald-950 border-2 border-emerald-500 flex items-center justify-center text-emerald-400 mx-auto text-3xl shadow-lg shadow-emerald-950">
                  ✓
                </div>
                <div>
                  <h3 className="text-xl font-black text-white">
                    {modalText.successTitle || m.escrowContractRegistered || 'Escrow Contract Registered!'}
                  </h3>
                  <p className="text-xs text-slate-300 max-w-sm mx-auto mt-1 leading-relaxed">
                    {modalText.successMsg || m.escrowRegisteredSub || 'A legally binding procurement contract has been generated under Karnataka APMC rules.'}
                  </p>
                </div>

                <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 text-xs space-y-1 font-mono text-left max-w-sm mx-auto">
                  <div className="flex justify-between">
                    <span className="text-slate-500">{m.contractId || 'Contract ID:'}</span>
                    <span className="text-emerald-400 font-bold">{escrowContractId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">{m.lockedValue || 'Locked Value:'}</span>
                    <span className="text-white font-bold">₹{(orderQuantity * offerPrice).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">{m.status || 'Status:'}</span>
                    <span className="text-amber-400 font-semibold">{m.heldInEscrow || 'HELD IN ESCROW'}</span>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedLot(null)}
                  className="mt-4 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-900"
                >
                  {modalText.returnBtn || 'Return to Marketplace'}
                </button>
              </div>
            ) : (
              <div className="space-y-4 my-3">
                {/* Lot Overview Bar */}
                <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 text-xs space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">{modalText.crop || 'Crop Commodity:'}</span>
                    <span className="font-extrabold text-white">
                      {getLocalizedCropName(selectedLot.cropName, language)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">{modalText.farmer || 'Registered Farmer:'}</span>
                    <span className="font-semibold text-emerald-400">{selectedLot.farmer?.name}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">{modalText.modalRate || 'Seller Asking Rate:'}</span>
                    <span className="text-slate-300 font-mono">
                      ₹{selectedLot.expectedPrice || selectedLot.pricePerUnit} / {selectedLot.unit || 'qtl'}
                    </span>
                  </div>
                </div>

                {/* Procurement Quantity Input */}
                <div>
                  <div className="flex justify-between text-xs font-bold text-slate-300 mb-1.5">
                    <label>{modalText.qtyLabel || 'Procurement Quantity (Quintals)'}</label>
                    <span className="text-slate-400 text-[11px] font-normal">Max: {selectedLot.quantity}</span>
                  </div>
                  <input
                    type="number"
                    value={orderQuantity}
                    onChange={(e) => setOrderQuantity(e.target.value)}
                    max={selectedLot.quantity}
                    min={1}
                    className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {/* Offered Rate Input */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    {modalText.rateLabel || m.contractRate || 'Contract Procurement Rate (₹ per Quintal)'}
                  </label>
                  <input
                    type="number"
                    value={offerPrice}
                    onChange={(e) => setOfferPrice(e.target.value)}
                    min={100}
                    className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {/* Live Escrow Calculation Box */}
                <div className="p-3.5 rounded-2xl bg-emerald-950/40 border border-emerald-800/50 space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-300">
                    <span>{m.baseValue || modalText.totalValue || 'Base Consignment Value:'}</span>
                    <span className="font-bold text-white">
                      ₹{(Number(orderQuantity) * Number(offerPrice)).toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>{modalText.savedCommission || 'Escrow Platform Fee:'}</span>
                    <span className="text-emerald-400 font-bold">{m.zeroFee || '₹0 (Zero Fee Protocol)'}</span>
                  </div>
                  <div className="flex justify-between text-emerald-400 font-bold pt-1.5 border-t border-emerald-900/60 text-sm">
                    <span>{m.totalEscrowDeposit || modalText.totalValue || 'Total Escrow Deposit:'}</span>
                    <span className="text-emerald-300 font-black">
                      ₹{(Number(orderQuantity) * Number(offerPrice)).toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>

                {/* Live Error Display */}
                {procurementStatus === 'error' && orderError && (
                  <div className="p-3 rounded-xl bg-red-950/60 border border-red-800 text-red-300 text-xs">
                    {orderError}
                  </div>
                )}

                {/* Modal Action Buttons */}
                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={() => setSelectedLot(null)}
                    className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors"
                  >
                    {modalText.cancel || 'Cancel'}
                  </button>
                  <button
                    onClick={handlePlaceBulkOrder}
                    disabled={procurementStatus === 'submitting' || !orderQuantity || orderQuantity <= 0}
                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-950 transition-all disabled:opacity-50"
                  >
                    {procurementStatus === 'submitting' ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>{m.lockingEscrow || modalText.confirming || 'Locking Escrow...'}</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4" />
                        <span>{m.depositEscrowBtn || modalText.confirm || 'Deposit & Lock Escrow'}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {/* 💬 START BARGAINING / NEGOTIATION MODAL */}
      {offerLot && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <form
            onSubmit={handleSubmitBargainOffer}
            className="bg-slate-900 border border-slate-700 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-black text-white">Make Direct Price Offer</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {offerLot.cropName} • Asking ₹{Number(offerLot.expectedPrice || offerLot.pricePerUnit).toLocaleString('en-IN')}/{offerLot.unit || 'unit'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOfferLot(null)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Quantity ({offerLot.unit || 'Quintal'} • Max {offerLot.quantity})
              </label>
              <input
                type="number"
                required
                min={1}
                max={offerLot.quantity}
                value={bidQty}
                onChange={(e) => setBidQty(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Your Offered Rate (₹ per {offerLot.unit || 'unit'})
              </label>
              <input
                type="number"
                required
                min={1}
                value={bidPrice}
                onChange={(e) => setBidPrice(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Note for Farmer (optional)</label>
              <input
                type="text"
                placeholder="e.g. Ready for pickup tomorrow"
                value={bidNote}
                onChange={(e) => setBidNote(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs outline-none focus:border-emerald-500"
              />
            </div>

            {bidError && (
              <div className="p-3 rounded-xl bg-red-950/60 border border-red-800 text-red-300 text-xs">{bidError}</div>
            )}

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setOfferLot(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={bidSubmitting}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs disabled:opacity-50"
              >
                {bidSubmitting ? 'Sending...' : 'Send Live Offer'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
