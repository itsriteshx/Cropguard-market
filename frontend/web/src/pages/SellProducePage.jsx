import React, { useEffect, useMemo, useState } from 'react';
import { listingsService, mandiService, uploadService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  PlusCircle,
  Upload,
  MapPin,
  Trash2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  TrendingUp,
  Package,
  Compass,
  Sparkles,
} from 'lucide-react';

const CATEGORIES = ['VEGETABLES', 'GRAINS', 'PULSES', 'FRUITS', 'OILSEEDS', 'SPICES', 'OTHER'];
const UNITS = ['QUINTAL', 'KG', 'TON'];
const GRADES = ['GRADE_A', 'GRADE_B', 'GRADE_C', 'ORGANIC'];
const QUANTITY_PRESETS = [10, 25, 50, 100, 200];
const NOTE_TEMPLATES = [
  'Sun-dried (<12% moisture)',
  'Graded Grade-A & cleaned',
  'Packed in 50kg gunny bags',
  'Ready for immediate dispatch',
];

const CURATED_CROPS = [
  { name: 'Onion', category: 'VEGETABLES' },
  { name: 'Red Onion', category: 'VEGETABLES' },
  { name: 'Potato', category: 'VEGETABLES' },
  { name: 'Tomato', category: 'VEGETABLES' },
  { name: 'Wheat', category: 'GRAINS' },
  { name: 'Sharbati Wheat', category: 'GRAINS' },
  { name: 'Rice', category: 'GRAINS' },
  { name: 'Paddy (Dhan)', category: 'GRAINS' },
  { name: 'Maize', category: 'GRAINS' },
  { name: 'Soyabean', category: 'OILSEEDS' },
  { name: 'Groundnut', category: 'OILSEEDS' },
  { name: 'Mustard', category: 'OILSEEDS' },
  { name: 'Cotton', category: 'OTHER' },
  { name: 'Bengal Gram (Chana)', category: 'PULSES' },
  { name: 'Green Gram (Moong)', category: 'PULSES' },
  { name: 'Black Gram (Urad)', category: 'PULSES' },
  { name: 'Pigeon Pea (Tur)', category: 'PULSES' },
  { name: 'Garlic', category: 'VEGETABLES' },
  { name: 'Ginger', category: 'SPICES' },
  { name: 'Turmeric', category: 'SPICES' },
  { name: 'Byadagi Chilli', category: 'SPICES' },
  { name: 'Green Chilli', category: 'VEGETABLES' },
  { name: 'Cumin Seed (Jeera)', category: 'SPICES' },
  { name: 'Coriander', category: 'SPICES' },
  { name: 'Apple', category: 'FRUITS' },
  { name: 'Mango', category: 'FRUITS' },
  { name: 'Banana', category: 'FRUITS' },
  { name: 'Pomegranate', category: 'FRUITS' },
  { name: 'Cauliflower', category: 'VEGETABLES' },
  { name: 'Cabbage', category: 'VEGETABLES' },
  { name: 'Carrot', category: 'VEGETABLES' },
  { name: 'Brinjal', category: 'VEGETABLES' },
];

const STATE_DISTRICT_MAP = {
  Maharashtra: ['Pune', 'Nashik', 'Nagpur', 'Kolhapur', 'Satara', 'Solapur', 'Sangli', 'Aurangabad', 'Ahmednagar', 'Jalgaon', 'Latur', 'Amravati'],
  Karnataka: ['Dharwad', 'Hubballi', 'Belagavi', 'Haveri', 'Gadag', 'Bengaluru', 'Mysuru', 'Mandya', 'Shivamogga', 'Kalaburagi', 'Vijayapura', 'Raichur'],
  Punjab: ['Ludhiana', 'Amritsar', 'Jalandhar', 'Patiala', 'Bathinda', 'Moga', 'Ferozepur', 'Sangrur', 'Hoshiarpur'],
  Gujarat: ['Rajkot', 'Surat', 'Ahmedabad', 'Vadodara', 'Unjha', 'Gondal', 'Bhavnagar', 'Junagadh', 'Anand'],
  'Madhya Pradesh': ['Indore', 'Bhopal', 'Ujjain', 'Jabalpur', 'Sagar', 'Ratlam', 'Dewas', 'Sehore', 'Neemuch'],
  'Uttar Pradesh': ['Agra', 'Lucknow', 'Kanpur', 'Varanasi', 'Meerut', 'Bareilly', 'Aligarh', 'Gorakhpur', 'Jhansi'],
  Rajasthan: ['Jaipur', 'Kota', 'Jodhpur', 'Alwar', 'Bikaner', 'Udaipur', 'Sikar', 'Sri Ganganagar'],
  'Tamil Nadu': ['Coimbatore', 'Madurai', 'Salem', 'Erode', 'Tiruchirappalli', 'Thanjavur', 'Vellore', 'Dindigul'],
  Telangana: ['Hyderabad', 'Warangal', 'Nizamabad', 'Karimnagar', 'Khammam', 'Nalgonda'],
  'Andhra Pradesh': ['Guntur', 'Kurnool', 'Vijayawada', 'Visakhapatnam', 'Anantapur', 'Nellore', 'Chittoor'],
  'West Bengal': ['Kolkata', 'Hooghly', 'Bardhaman', 'Siliguri', 'Murshidabad', 'Nadia'],
  Haryana: ['Karnal', 'Hisar', 'Rohtak', 'Sirsa', 'Ambala', 'Panipat', 'Sonipat'],
  Bihar: ['Patna', 'Muzaffarpur', 'Gaya', 'Bhagalpur', 'Purnia', 'Darbhanga'],
  Kerala: ['Kochi', 'Kozhikode', 'Thrissur', 'Kottayam', 'Palakkad', 'Idukki'],
  Odisha: ['Cuttack', 'Bhubaneswar', 'Sambalpur', 'Bargarh', 'Balangir'],
  'Himachal Pradesh': ['Shimla', 'Kullu', 'Mandi', 'Solan', 'Kangra'],
  'Jammu and Kashmir': ['Srinagar', 'Anantnag', 'Baramulla', 'Jammu', 'Shopian'],
};

const INDIAN_STATES = Object.keys(STATE_DISTRICT_MAP).concat([
  'Assam',
  'Chhattisgarh',
  'Goa',
  'Jharkhand',
  'Uttarakhand',
]);

const scalePerUnit = (pricePerQuintal, unit) => {
  const base = Number(pricePerQuintal) || 0;
  if (!base) return null;
  if (unit === 'KG') return Math.round((base / 100) * 10) / 10;
  if (unit === 'TON') return Math.round(base * 10);
  return Math.round(base);
};

export default function SellProducePage({ onNavigateToMarket }) {
  const { currentUser } = useAuth();

  const [cropName, setCropName] = useState('');
  const [category, setCategory] = useState('VEGETABLES');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('QUINTAL');
  const [pricePerUnit, setPricePerUnit] = useState('');
  const [qualityGrade, setQualityGrade] = useState('GRADE_A');
  const [description, setDescription] = useState('');

  // Autocomplete visibility states
  const [showCropSug, setShowCropSug] = useState(false);
  const [showStateSug, setShowStateSug] = useState(false);
  const [showDistrictSug, setShowDistrictSug] = useState(false);

  // Location & India Post Pincode auto-fill
  const [pincode, setPincode] = useState(currentUser?.location?.pincode || '');
  const [village, setVillage] = useState(currentUser?.location?.village || '');
  const [district, setDistrict] = useState(currentUser?.location?.district || '');
  const [stateName, setStateName] = useState(currentUser?.location?.state || '');
  const [pinPostOffices, setPinPostOffices] = useState([]);
  const [pinStatus, setPinStatus] = useState('');
  const [coordinates, setCoordinates] = useState(
    currentUser?.location?.coordinates?.length === 2 ? currentUser.location.coordinates : [0, 0]
  );
  const [lookingUpPin, setLookingUpPin] = useState(false);

  // Photos & Benchmark & Catalog
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploadedUrls, setUploadedUrls] = useState([]);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [benchmark, setBenchmark] = useState(null);
  const [loadingBenchmark, setLoadingBenchmark] = useState(false);
  const [liveCatalog, setLiveCatalog] = useState([]);

  // Form submission & My listings
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [myListings, setMyListings] = useState([]);
  const [loadingMine, setLoadingMine] = useState(true);

  const loadMyListings = async () => {
    setLoadingMine(true);
    try {
      const res = await listingsService.getMyListings();
      if (res?.success && Array.isArray(res.listings)) {
        setMyListings(res.listings);
      }
    } catch {
      setMyListings([]);
    } finally {
      setLoadingMine(false);
    }
  };

  useEffect(() => {
    loadMyListings();
    mandiService
      .getRates({ state: 'ALL', limit: 200 })
      .then((res) => {
        if (res?.success && Array.isArray(res.rates)) {
          setLiveCatalog(res.rates);
        }
      })
      .catch(() => {});
  }, []);

  // Build deduplicated autocomplete catalog from live Agmarknet rates + curated Indian crops
  const mergedCropCatalog = useMemo(() => {
    const map = new Map();

    liveCatalog.forEach((r) => {
      const name = String(r.commodity || '').trim();
      if (!name) return;
      const key = name.toUpperCase();
      if (!map.has(key)) {
        map.set(key, {
          name,
          category: CATEGORIES.includes(r.category) ? r.category : 'OTHER',
          modalPrice: Number(r.modalPrice) || null,
          minPrice: Number(r.minPrice) || null,
          maxPrice: Number(r.maxPrice) || null,
          market: r.marketCenter || r.district || null,
          isLive: true,
        });
      }
    });

    CURATED_CROPS.forEach((c) => {
      const key = c.name.toUpperCase();
      if (!map.has(key)) {
        map.set(key, {
          name: c.name,
          category: c.category,
          modalPrice: null,
          isLive: false,
        });
      }
    });

    return Array.from(map.values());
  }, [liveCatalog]);

  const cropSuggestions = useMemo(() => {
    const q = cropName.trim().toLowerCase();
    const list = q
      ? mergedCropCatalog.filter((c) => c.name.toLowerCase().includes(q))
      : mergedCropCatalog;
    return list.slice(0, 8);
  }, [cropName, mergedCropCatalog]);

  const stateSuggestions = useMemo(() => {
    const q = stateName.trim().toLowerCase();
    const list = q
      ? INDIAN_STATES.filter((s) => s.toLowerCase().includes(q))
      : INDIAN_STATES;
    return list.slice(0, 7);
  }, [stateName]);

  const districtSuggestions = useMemo(() => {
    const matchedState = Object.keys(STATE_DISTRICT_MAP).find(
      (s) => s.toLowerCase() === stateName.trim().toLowerCase()
    );
    const pool = matchedState
      ? STATE_DISTRICT_MAP[matchedState].map((d) => ({ district: d, state: matchedState }))
      : Object.entries(STATE_DISTRICT_MAP).flatMap(([st, dists]) =>
          dists.map((d) => ({ district: d, state: st }))
        );
    const q = district.trim().toLowerCase();
    const filtered = q
      ? pool.filter((item) => item.district.toLowerCase().includes(q))
      : pool;
    return filtered.slice(0, 8);
  }, [district, stateName]);

  // Debounced live Agmarknet benchmark lookup on crop name
  useEffect(() => {
    const trimmed = cropName.trim();
    if (trimmed.length < 3) {
      setBenchmark(null);
      return;
    }
    const timer = setTimeout(async () => {
      setLoadingBenchmark(true);
      try {
        const res = await mandiService.getBenchmark(trimmed, stateName || 'ALL');
        if (res?.success && res.apmcRates) {
          setBenchmark(res);
        } else {
          setBenchmark(null);
        }
      } catch {
        setBenchmark(null);
      } finally {
        setLoadingBenchmark(false);
      }
    }, 450);
    return () => clearTimeout(timer);
  }, [cropName, stateName]);

  const handleSelectCropSuggestion = (item) => {
    setCropName(item.name);
    if (CATEGORIES.includes(item.category)) {
      setCategory(item.category);
    }
    setShowCropSug(false);
    if (item.modalPrice && !pricePerUnit) {
      const scaled = scalePerUnit(item.modalPrice, unit);
      if (scaled) setPricePerUnit(String(scaled));
    }
  };

  const handlePincodeLookup = async (pinValue) => {
    const clean = pinValue.replace(/\D/g, '').slice(0, 6);
    setPincode(clean);
    setPinStatus('');
    if (clean.length < 6) {
      setPinPostOffices([]);
      return;
    }
    setLookingUpPin(true);
    try {
      const res = await mandiService.getPincode(clean);
      if (res?.success && res.location) {
        setDistrict(res.location.district || '');
        setStateName(res.location.state || '');
        const offices = Array.isArray(res.location.postOffices) ? res.location.postOffices : [];
        setPinPostOffices(offices);
        if (!village) {
          setVillage(res.location.taluk || offices[0] || '');
        }
        setPinStatus(`Verified: ${res.location.district}, ${res.location.state}`);
      }
    } catch {
      setPinPostOffices([]);
      setPinStatus('Pincode not found — choose District & State from suggestions.');
    } finally {
      setLookingUpPin(false);
    }
  };

  const handleDetectGps = () => {
    if (!navigator?.geolocation) {
      setFormError('Geolocation is not supported in this browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoordinates([pos.coords.longitude, pos.coords.latitude]);
        setFormError('');
      },
      () => setFormError('Could not read GPS location. Allow location permission or enter Pincode/District manually.')
    );
  };

  const handlePhotoChange = async (e) => {
    const files = Array.from(e.target.files || []).slice(0, 5);
    if (files.length === 0) return;
    setSelectedFiles(files);
    setUploadingPhotos(true);
    setFormError('');
    try {
      const res = await uploadService.uploadPhotos(files);
      if (res?.success && Array.isArray(res.images)) {
        setUploadedUrls(res.images);
      }
    } catch (err) {
      setFormError(err.response?.data?.message || 'Photo upload failed. You can still publish without photos.');
    } finally {
      setUploadingPhotos(false);
    }
  };

  const handleAppendNote = (template) => {
    setDescription((prev) => {
      const current = prev.trim();
      if (!current) return template;
      if (current.toLowerCase().includes(template.toLowerCase())) return prev;
      return `${current} • ${template}`.slice(0, 500);
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    if (!cropName.trim()) return setFormError('Please enter a crop name.');
    if (!Number(quantity) || Number(quantity) < 1) return setFormError('Enter a valid quantity (at least 1).');
    if (!Number(pricePerUnit) || Number(pricePerUnit) < 1) return setFormError('Enter a valid asking price.');

    setSubmitting(true);
    try {
      const payload = {
        cropName: cropName.trim(),
        category,
        quantity: Number(quantity),
        unit,
        pricePerUnit: Number(pricePerUnit),
        qualityGrade,
        description: description.trim(),
        images: uploadedUrls,
        location: {
          type: 'Point',
          coordinates,
          village: village.trim(),
          district: district.trim(),
          state: stateName.trim(),
          pincode: pincode.trim(),
        },
      };
      const res = await listingsService.create(payload);
      if (res?.success) {
        setFormSuccess(`Published "${res.listing.cropName}" (${res.listing.quantity} ${res.listing.unit}) to live marketplace!`);
        setCropName('');
        setQuantity('');
        setPricePerUnit('');
        setDescription('');
        setSelectedFiles([]);
        setUploadedUrls([]);
        setBenchmark(null);
        loadMyListings();
      } else {
        setFormError(res?.message || 'Unable to publish listing.');
      }
    } catch (err) {
      setFormError(err.response?.data?.message || err.message || 'Error creating produce listing.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteListing = async (id) => {
    try {
      await listingsService.remove(id);
      setMyListings((prev) => prev.filter((item) => item._id !== id));
    } catch (err) {
      setFormError(err.response?.data?.message || 'Could not remove listing.');
    }
  };

  const matchedCatalogItem = useMemo(() => {
    const target = cropName.trim().toUpperCase();
    if (!target) return null;
    return mergedCropCatalog.find(
      (c) => c.modalPrice && (c.name.toUpperCase() === target || c.name.toUpperCase().includes(target))
    );
  }, [cropName, mergedCropCatalog]);

  const activeModalQuintal =
    benchmark?.apmcRates?.modalPricePerQuintal || matchedCatalogItem?.modalPrice || null;
  const activeMinQuintal =
    benchmark?.apmcRates?.minPricePerQuintal || matchedCatalogItem?.minPrice || null;
  const activeMaxQuintal =
    benchmark?.apmcRates?.maxPricePerQuintal || matchedCatalogItem?.maxPrice || null;

  const suggestedModal = scalePerUnit(activeModalQuintal, unit);
  const suggestedMin = scalePerUnit(activeMinQuintal, unit);
  const suggestedMax = scalePerUnit(activeMaxQuintal, unit);
  const suggestedFair = suggestedModal ? Math.round(suggestedModal * 0.95 * 10) / 10 : null;
  const suggestedPremium = suggestedModal ? Math.round(suggestedModal * 1.08 * 10) / 10 : null;

  const numericAsk = Number(pricePerUnit);
  const priceDiffPct =
    suggestedModal && numericAsk > 0
      ? Math.round(((numericAsk - suggestedModal) / suggestedModal) * 100)
      : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Sell Your Harvest</h1>
          <p className="text-xs text-slate-400 mt-1">
            Publish produce directly to buyers with live Agmarknet crop, price &amp; India Post pincode suggestions.
          </p>
        </div>
        {onNavigateToMarket && (
          <button
            onClick={onNavigateToMarket}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 self-start"
          >
            View Live Marketplace →
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Publish Listing Form */}
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-3 rounded-2xl bg-slate-900 border border-slate-800 p-5 sm:p-6 space-y-4"
        >
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2 text-sm font-bold text-white">
              <PlusCircle className="w-4 h-4 text-emerald-400" />
              <span>Create New Produce Lot</span>
            </div>
            <span className="text-[11px] text-emerald-400 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" /> Auto-suggestions active
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Crop Name with Autocomplete */}
            <div className="sm:col-span-2 relative">
              <label className="block text-xs font-semibold text-slate-300 mb-1">Crop / Commodity Name *</label>
              <input
                type="text"
                required
                placeholder="Type to see suggestions: Onion, Wheat, Apple, Garlic..."
                value={cropName}
                onFocus={() => setShowCropSug(true)}
                onBlur={() => setTimeout(() => setShowCropSug(false), 180)}
                onChange={(e) => {
                  setCropName(e.target.value);
                  setShowCropSug(true);
                }}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl text-sm text-white outline-none"
                autoComplete="off"
              />

              {showCropSug && cropSuggestions.length > 0 && (
                <div className="absolute z-30 left-0 right-0 mt-1 rounded-xl bg-slate-950 border border-emerald-700/60 shadow-2xl overflow-hidden max-h-56 overflow-y-auto">
                  {cropSuggestions.map((item) => (
                    <button
                      key={item.name}
                      type="button"
                      onMouseDown={() => handleSelectCropSuggestion(item)}
                      className="w-full px-3.5 py-2 text-left flex items-center justify-between gap-2 hover:bg-emerald-950/70 border-b border-slate-800/70 last:border-b-0 text-xs transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-bold text-white truncate">{item.name}</span>
                        <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-slate-300">
                          {item.category}
                        </span>
                      </div>
                      {item.modalPrice ? (
                        <span className="text-[11px] font-mono text-emerald-400 shrink-0">
                          ₹{item.modalPrice.toLocaleString('en-IN')}/qtl
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-500 shrink-0">Tap to fill</span>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {loadingBenchmark && (
                <p className="text-[11px] text-slate-400 mt-1">Checking live Agmarknet mandi price...</p>
              )}
              {suggestedModal && (
                <div className="mt-2 p-2.5 rounded-xl bg-emerald-950/60 border border-emerald-800/70 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 text-emerald-300">
                    <TrendingUp className="w-4 h-4 shrink-0" />
                    <span>
                      Live APMC Modal ({benchmark?.marketCenter || matchedCatalogItem?.market || 'India'}):{' '}
                      <strong>₹{Number(activeModalQuintal).toLocaleString('en-IN')}/qtl</strong>
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPricePerUnit(String(suggestedModal))}
                    className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] shrink-0"
                  >
                    Use ₹{suggestedModal}/{unit.toLowerCase()}
                  </button>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white outline-none"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Quality Grade</label>
              <select
                value={qualityGrade}
                onChange={(e) => setQualityGrade(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white outline-none"
              >
                {GRADES.map((g) => (
                  <option key={g} value={g}>{g.replace('_', ' ')}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Quantity *</label>
              <input
                type="number"
                required
                min={1}
                placeholder="e.g. 50"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl text-sm text-white outline-none"
              />
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {QUANTITY_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setQuantity(String(preset))}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold border transition-colors ${
                      String(quantity) === String(preset)
                        ? 'bg-emerald-700 border-emerald-500 text-white'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {preset} {unit.toLowerCase()}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Unit</label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white outline-none"
              >
                {UNITS.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-300">
                  Asking Rate (₹ per {unit}) *
                </label>
                {priceDiffPct !== null && (
                  <span
                    className={`text-[11px] font-bold ${
                      priceDiffPct < -10
                        ? 'text-rose-400'
                        : priceDiffPct > 15
                        ? 'text-amber-300'
                        : 'text-emerald-400'
                    }`}
                  >
                    {priceDiffPct === 0
                      ? 'Matches APMC Modal Rate'
                      : priceDiffPct > 0
                      ? `${priceDiffPct}% above APMC Modal`
                      : `${Math.abs(priceDiffPct)}% below APMC Modal`}
                  </span>
                )}
              </div>
              <input
                type="number"
                required
                min={1}
                placeholder={suggestedModal ? `Suggested: ${suggestedModal}` : 'e.g. 2450'}
                value={pricePerUnit}
                onChange={(e) => setPricePerUnit(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl text-sm text-white outline-none"
              />
              {suggestedModal && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {suggestedMin && (
                    <button
                      type="button"
                      onClick={() => setPricePerUnit(String(suggestedMin))}
                      className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 hover:border-amber-500 text-[11px] text-amber-300 font-semibold"
                    >
                      Min: ₹{suggestedMin}
                    </button>
                  )}
                  {suggestedFair && (
                    <button
                      type="button"
                      onClick={() => setPricePerUnit(String(suggestedFair))}
                      className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 hover:border-emerald-500 text-[11px] text-slate-200 font-semibold"
                    >
                      Quick Sell (-5%): ₹{suggestedFair}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setPricePerUnit(String(suggestedModal))}
                    className="px-2.5 py-1 rounded-lg bg-emerald-950 border border-emerald-700 hover:bg-emerald-900 text-[11px] text-emerald-300 font-bold"
                  >
                    Recommended Modal: ₹{suggestedModal}
                  </button>
                  {suggestedPremium && (
                    <button
                      type="button"
                      onClick={() => setPricePerUnit(String(suggestedPremium))}
                      className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 hover:border-sky-500 text-[11px] text-sky-300 font-semibold"
                    >
                      Grade A (+8%): ₹{suggestedPremium}
                    </button>
                  )}
                  {suggestedMax && (
                    <button
                      type="button"
                      onClick={() => setPricePerUnit(String(suggestedMax))}
                      className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 hover:border-sky-400 text-[11px] text-slate-300 font-semibold"
                    >
                      Mandi Max: ₹{suggestedMax}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Farm Location with India Post Pincode & State/District Autocomplete */}
          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                Farm / Dispatch Location
              </span>
              <button
                type="button"
                onClick={handleDetectGps}
                className="text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
              >
                <Compass className="w-3.5 h-3.5" />
                {coordinates[0] !== 0 ? 'GPS Set ✓' : 'Detect GPS'}
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div>
                <label className="block text-[10px] text-slate-400 mb-1">
                  Pincode {lookingUpPin ? '(Looking up...)' : '(Auto-fills)'}
                </label>
                <input
                  type="text"
                  maxLength={6}
                  placeholder="411001"
                  value={pincode}
                  onChange={(e) => handlePincodeLookup(e.target.value)}
                  className="w-full px-2.5 py-2 bg-slate-900 border border-slate-800 focus:border-emerald-500 rounded-lg text-xs text-white outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 mb-1">Village / Taluk</label>
                <input
                  type="text"
                  placeholder="Navalgund / Haveli"
                  value={village}
                  onChange={(e) => setVillage(e.target.value)}
                  className="w-full px-2.5 py-2 bg-slate-900 border border-slate-800 focus:border-emerald-500 rounded-lg text-xs text-white outline-none"
                />
              </div>

              <div className="relative">
                <label className="block text-[10px] text-slate-400 mb-1">District</label>
                <input
                  type="text"
                  placeholder="Pune / Dharwad"
                  value={district}
                  onFocus={() => setShowDistrictSug(true)}
                  onBlur={() => setTimeout(() => setShowDistrictSug(false), 180)}
                  onChange={(e) => {
                    setDistrict(e.target.value);
                    setShowDistrictSug(true);
                  }}
                  className="w-full px-2.5 py-2 bg-slate-900 border border-slate-800 focus:border-emerald-500 rounded-lg text-xs text-white outline-none"
                  autoComplete="off"
                />
                {showDistrictSug && districtSuggestions.length > 0 && (
                  <div className="absolute z-30 left-0 right-0 mt-1 rounded-lg bg-slate-950 border border-emerald-700/60 shadow-xl max-h-40 overflow-y-auto">
                    {districtSuggestions.map((d) => (
                      <button
                        key={`${d.district}-${d.state}`}
                        type="button"
                        onMouseDown={() => {
                          setDistrict(d.district);
                          setStateName(d.state);
                          setShowDistrictSug(false);
                        }}
                        className="w-full px-2.5 py-1.5 text-left text-[11px] hover:bg-emerald-950/70 text-white flex justify-between gap-1 border-b border-slate-800/60 last:border-b-0"
                      >
                        <span className="font-semibold">{d.district}</span>
                        <span className="text-slate-400 text-[10px]">{d.state}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="relative">
                <label className="block text-[10px] text-slate-400 mb-1">State</label>
                <input
                  type="text"
                  placeholder="Maharashtra"
                  value={stateName}
                  onFocus={() => setShowStateSug(true)}
                  onBlur={() => setTimeout(() => setShowStateSug(false), 180)}
                  onChange={(e) => {
                    setStateName(e.target.value);
                    setShowStateSug(true);
                  }}
                  className="w-full px-2.5 py-2 bg-slate-900 border border-slate-800 focus:border-emerald-500 rounded-lg text-xs text-white outline-none"
                  autoComplete="off"
                />
                {showStateSug && stateSuggestions.length > 0 && (
                  <div className="absolute z-30 left-0 right-0 mt-1 rounded-lg bg-slate-950 border border-emerald-700/60 shadow-xl max-h-40 overflow-y-auto">
                    {stateSuggestions.map((st) => (
                      <button
                        key={st}
                        type="button"
                        onMouseDown={() => {
                          setStateName(st);
                          setShowStateSug(false);
                        }}
                        className="w-full px-2.5 py-1.5 text-left text-[11px] font-semibold text-white hover:bg-emerald-950/70 border-b border-slate-800/60 last:border-b-0"
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {pinStatus && (
              <p className="text-[11px] text-emerald-400">{pinStatus}</p>
            )}

            {pinPostOffices.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] text-slate-400">Post Office / Village suggestions:</span>
                {pinPostOffices.slice(0, 6).map((po) => (
                  <button
                    key={po}
                    type="button"
                    onClick={() => setVillage(po)}
                    className={`px-2 py-0.5 rounded-full text-[10px] border transition-colors ${
                      village === po
                        ? 'bg-emerald-700 border-emerald-500 text-white font-bold'
                        : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-emerald-500'
                    }`}
                  >
                    {po}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Photo Upload */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Produce Photos (up to 5)
            </label>
            <label className="flex items-center justify-center gap-2 p-3 rounded-xl border border-dashed border-slate-700 hover:border-emerald-500 bg-slate-950/60 cursor-pointer text-xs text-slate-300">
              <Upload className="w-4 h-4 text-emerald-400" />
              <span>
                {uploadingPhotos
                  ? 'Uploading photos...'
                  : uploadedUrls.length > 0
                  ? `${uploadedUrls.length} photo(s) uploaded cleanly`
                  : selectedFiles.length > 0
                  ? `${selectedFiles.length} file(s) selected`
                  : 'Click to upload real crop photos'}
              </span>
              <input type="file" multiple accept="image/*" className="hidden" onChange={handlePhotoChange} />
            </label>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Notes / Harvest Quality Details</label>
            <textarea
              rows={2}
              maxLength={500}
              placeholder="Moisture level, packaging details, harvest date..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl text-sm text-white outline-none"
            />
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {NOTE_TEMPLATES.map((tpl) => (
                <button
                  key={tpl}
                  type="button"
                  onClick={() => handleAppendNote(tpl)}
                  className="px-2 py-0.5 rounded-full bg-slate-950 border border-slate-800 hover:border-emerald-500 text-[10px] text-slate-300 transition-colors"
                >
                  + {tpl}
                </button>
              ))}
            </div>
          </div>

          {formError && (
            <div className="p-3 rounded-xl bg-red-950/50 border border-red-800 text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {formSuccess && (
            <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{formSuccess}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || uploadingPhotos}
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <PlusCircle className="w-4 h-4" />}
            <span>{submitting ? 'Publishing Harvest Lot...' : 'Publish Listing to Marketplace'}</span>
          </button>
        </form>

        {/* My Active Listings */}
        <div className="lg:col-span-2 rounded-2xl bg-slate-900 border border-slate-800 p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2 text-sm font-bold text-white">
              <Package className="w-4 h-4 text-emerald-400" />
              <span>My Listed Produce ({myListings.length})</span>
            </div>
            <button onClick={loadMyListings} className="text-xs text-slate-400 hover:text-white">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          {loadingMine ? (
            <p className="text-xs text-slate-400 py-8 text-center">Loading your listings...</p>
          ) : myListings.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-400">
              You have not listed any crops yet. Use the form to publish your first lot.
            </div>
          ) : (
            <div className="space-y-3 max-h-[560px] overflow-y-auto pr-1">
              {myListings.map((item) => (
                <div key={item._id} className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-bold text-white">{item.cropName}</div>
                      <div className="text-[11px] text-slate-400">
                        {item.quantity} {item.unit} • ₹{Number(item.pricePerUnit).toLocaleString('en-IN')}/{item.unit}
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                      item.status === 'AVAILABLE'
                        ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                        : 'bg-slate-800 text-slate-300 border-slate-700'
                    }`}>
                      {item.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                    <span>{item.location?.district || 'Location set'}</span>
                    <button
                      onClick={() => handleDeleteListing(item._id)}
                      className="text-red-400 hover:text-red-300 flex items-center gap-1 font-semibold"
                    >
                      <Trash2 className="w-3 h-3" /> Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
