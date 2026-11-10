import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';

const CATEGORIES = ['VEGETABLES', 'GRAINS', 'PULSES', 'FRUITS', 'OILSEEDS', 'SPICES', 'OTHER'];
const UNITS = ['QUINTAL', 'KG', 'TON'];
const GRADES = ['GRADE_A', 'GRADE_B', 'GRADE_C', 'ORGANIC'];

export default function SellProducePage({ onNavigateToMarket }) {
  const { currentUser } = useAuth();

  const [cropName, setCropName] = useState('');
  const [category, setCategory] = useState('VEGETABLES');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('QUINTAL');
  const [pricePerUnit, setPricePerUnit] = useState('');
  const [qualityGrade, setQualityGrade] = useState('GRADE_A');
  const [description, setDescription] = useState('');

  // Location & India Post Pincode auto-fill
  const [pincode, setPincode] = useState(currentUser?.location?.pincode || '');
  const [village, setVillage] = useState(currentUser?.location?.village || '');
  const [district, setDistrict] = useState(currentUser?.location?.district || '');
  const [stateName, setStateName] = useState(currentUser?.location?.state || '');
  const [coordinates, setCoordinates] = useState(
    currentUser?.location?.coordinates?.length === 2 ? currentUser.location.coordinates : [0, 0]
  );
  const [lookingUpPin, setLookingUpPin] = useState(false);

  // Photos & Benchmark
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploadedUrls, setUploadedUrls] = useState([]);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [benchmark, setBenchmark] = useState(null);
  const [loadingBenchmark, setLoadingBenchmark] = useState(false);

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
  }, []);

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
        const res = await mandiService.getBenchmark(trimmed, stateName || 'Karnataka');
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
    }, 500);
    return () => clearTimeout(timer);
  }, [cropName, stateName]);

  const handlePincodeLookup = async (pinValue) => {
    const clean = pinValue.replace(/\D/g, '').slice(0, 6);
    setPincode(clean);
    if (clean.length === 6) {
      setLookingUpPin(true);
      try {
        const res = await mandiService.getPincode(clean);
        if (res?.success && res.location) {
          setDistrict(res.location.district || '');
          setStateName(res.location.state || '');
          if (!village && res.location.taluk) setVillage(res.location.taluk);
        }
      } catch {
        // Keep manual entry editable
      } finally {
        setLookingUpPin(false);
      }
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

  const suggestedPriceForUnit = benchmark?.apmcRates?.modalPricePerQuintal
    ? unit === 'KG'
      ? Math.round((benchmark.apmcRates.modalPricePerQuintal / 100) * 10) / 10
      : unit === 'TON'
      ? benchmark.apmcRates.modalPricePerQuintal * 10
      : benchmark.apmcRates.modalPricePerQuintal
    : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Sell Your Harvest</h1>
          <p className="text-xs text-slate-400 mt-1">
            Publish produce directly to verified retail & wholesale buyers with live Agmarknet price benchmarks.
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
          <div className="flex items-center gap-2 text-sm font-bold text-white border-b border-slate-800 pb-3">
            <PlusCircle className="w-4 h-4 text-emerald-400" />
            <span>Create New Produce Lot</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-300 mb-1">Crop / Commodity Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Red Onion, Sharbati Wheat, Byadagi Chilli"
                value={cropName}
                onChange={(e) => setCropName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl text-sm text-white outline-none"
              />
              {loadingBenchmark && (
                <p className="text-[11px] text-slate-400 mt-1">Checking live Agmarknet mandi price...</p>
              )}
              {benchmark?.apmcRates && suggestedPriceForUnit && (
                <div className="mt-2 p-2.5 rounded-xl bg-emerald-950/60 border border-emerald-800/70 flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 text-emerald-300">
                    <TrendingUp className="w-4 h-4 shrink-0" />
                    <span>
                      Live APMC Modal ({benchmark.marketCenter}): <strong>₹{benchmark.apmcRates.modalPricePerQuintal}/qtl</strong>
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPricePerUnit(String(suggestedPriceForUnit))}
                    className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] shrink-0"
                  >
                    Use ₹{suggestedPriceForUnit}/{unit.toLowerCase()}
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
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Asking Rate (₹ per {unit}) *
              </label>
              <input
                type="number"
                required
                min={1}
                placeholder="e.g. 2450"
                value={pricePerUnit}
                onChange={(e) => setPricePerUnit(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl text-sm text-white outline-none"
              />
            </div>
          </div>

          {/* Farm Location with India Post Pincode Auto-fill */}
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
                  Pincode {lookingUpPin ? '(Looking up...)' : ''}
                </label>
                <input
                  type="text"
                  maxLength={6}
                  placeholder="580001"
                  value={pincode}
                  onChange={(e) => handlePincodeLookup(e.target.value)}
                  className="w-full px-2.5 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-400 mb-1">Village / Taluk</label>
                <input
                  type="text"
                  placeholder="Navalgund"
                  value={village}
                  onChange={(e) => setVillage(e.target.value)}
                  className="w-full px-2.5 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-400 mb-1">District</label>
                <input
                  type="text"
                  placeholder="Dharwad"
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  className="w-full px-2.5 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-400 mb-1">State</label>
                <input
                  type="text"
                  placeholder="Karnataka"
                  value={stateName}
                  onChange={(e) => setStateName(e.target.value)}
                  className="w-full px-2.5 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white outline-none"
                />
              </div>
            </div>
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

