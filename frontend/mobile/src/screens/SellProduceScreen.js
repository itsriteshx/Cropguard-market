import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
  Platform
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../config/api';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { preparePhoto } from '../utils/preparePhoto';
import { convertPriceUnit } from '../utils/priceUnits';
import { buildListingLocation } from '../utils/listingLocation';

const CATEGORIES = [
  'OTHER',
  'VEGETABLES',
  'GRAINS',
  'PULSES',
  'FRUITS',
  'OILSEEDS',
  'SPICES'
];

const UNITS = ['KG', 'QUINTAL'];
const QUALITY_GRADES = ['GRADE_A', 'GRADE_B', 'ORGANIC'];
const CURATED_MOBILE_CROPS = [
  { name: 'Tomato', category: 'VEGETABLES' },
  { name: 'Onion', category: 'VEGETABLES' },
  { name: 'Potato', category: 'VEGETABLES' },
  { name: 'Wheat', category: 'GRAINS' },
  { name: 'Rice', category: 'GRAINS' },
  { name: 'Cotton', category: 'OTHER' },
  { name: 'Soyabean', category: 'OILSEEDS' },
  { name: 'Garlic', category: 'VEGETABLES' },
  { name: 'Turmeric', category: 'SPICES' },
  { name: 'Chilli', category: 'SPICES' },
  { name: 'Apple', category: 'FRUITS' },
  { name: 'Mango', category: 'FRUITS' }
];
const QTY_PRESETS = [10, 25, 50, 100];
const NOTE_PRESETS = ['Sun-dried (<12% moisture)', 'Graded Grade-A', '50kg gunny bag packed'];

export default function SellProduceScreen({ onNavigateToMarket }) {
  const { t, token, user, role } = useAuth();

  const [cropName, setCropName] = useState('');
  const [category, setCategory] = useState('VEGETABLES');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('KG');
  const [pricePerUnit, setPricePerUnit] = useState('');
  const [qualityGrade, setQualityGrade] = useState('GRADE_A');
  const [description, setDescription] = useState('');
  const [photo, setPhoto] = useState(null);
  const [uploadedPhoto, setUploadedPhoto] = useState(null);
  const [pincode, setPincode] = useState(user?.location?.pincode || '');
  const [village, setVillage] = useState(user?.location?.village || '');
  const [taluk, setTaluk] = useState(user?.location?.taluk || '');
  const [district, setDistrict] = useState(user?.location?.district || '');
  const [stateName, setStateName] = useState(user?.location?.state || '');
  const [lookingUpPin, setLookingUpPin] = useState(false);
  const [pinStatus, setPinStatus] = useState('');

  // Mandi Benchmark & Catalog State
  const [mandiBenchmark, setMandiBenchmark] = useState(null);
  const [loadingBenchmark, setLoadingBenchmark] = useState(false);
  const [liveCropCatalog, setLiveCropCatalog] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [preparingPhoto, setPreparingPhoto] = useState(false);

  useEffect(() => {
    apiRequest('/mandi-rates?state=ALL&limit=150').then((res) => {
      if (res?.success && Array.isArray(res.rates)) {
        const seen = new Map();
        res.rates.forEach((r) => {
          const k = String(r.commodity || '').trim().toUpperCase();
          if (k && !seen.has(k)) {
            seen.set(k, {
              name: r.commodity,
              category: CATEGORIES.includes(r.category) ? r.category : 'OTHER',
              modalPrice: Number(r.modalPrice) || null
            });
          }
        });
        setLiveCropCatalog(Array.from(seen.values()));
      }
    });
  }, []);

  useEffect(() => {
    if (!user?.location) return;
    setPincode((prev) => prev || user.location.pincode || '');
    setVillage((prev) => prev || user.location.village || '');
    setTaluk((prev) => prev || user.location.taluk || '');
    setDistrict((prev) => prev || user.location.district || '');
    setStateName((prev) => prev || user.location.state || '');
  }, [user?.location]);

  // Keep stale benchmark responses from changing a newer crop selection.
  useEffect(() => {
    let active = true;
    const trimmed = cropName.trim();
    setMandiBenchmark(null);
    if (trimmed.length < 3) { setLoadingBenchmark(false); return () => { active = false; }; }
    const timer = setTimeout(async () => {
      setLoadingBenchmark(true);
      const benchmarkDistrict = district.trim() || user?.location?.district;
      const params = `commodity=${encodeURIComponent(trimmed)}${benchmarkDistrict ? `&district=${encodeURIComponent(benchmarkDistrict)}` : ''}`;
      const response = await apiRequest(`/mandi-rates/benchmark?${params}`);
      if (!active) return;
      setMandiBenchmark(response.success && response.farmerPriceGuidance ? response : null);
      setLoadingBenchmark(false);
    }, 500);
    return () => { active = false; clearTimeout(timer); };
  }, [cropName, district, user?.location?.district]);

  const handlePincodeChange = async (raw) => {
    const cleanPin = String(raw || '').replace(/\D/g, '').slice(0, 6);
    setPincode(cleanPin);
    if (cleanPin.length < 6) {
      setPinStatus('');
      return;
    }
    setLookingUpPin(true);
    setPinStatus('Looking up India Post pincode...');
    const res = await apiRequest(`/mandi-rates/pincode/${cleanPin}`);
    setLookingUpPin(false);
    if (res?.success && res.location) {
      if (res.location.district) setDistrict(res.location.district);
      if (res.location.state) setStateName(res.location.state);
      if (res.location.taluk) setTaluk(res.location.taluk);
      setPinStatus(`Verified: ${res.location.district}, ${res.location.state}`);
    } else {
      setPinStatus(res?.message || 'Pincode not found — enter district & state manually.');
    }
  };

  const pickPhoto = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
      if (result.canceled) return;
      setPreparingPhoto(true);
      const prepared = await preparePhoto(result.assets[0], Platform.OS, ImageManipulator);
      setPhoto(prepared);
      setUploadedPhoto(null);
    } catch (error) {
      Alert.alert('Photo unavailable', error.message || 'Could not prepare this photo. Please choose another image.');
    } finally {
      setPreparingPhoto(false);
    }
  };

  const handleSubmitListing = async () => {
    if (submitting || preparingPhoto) return;
    if (role !== 'FARMER') {
      Alert.alert('Farmer account required', 'Sign in as a farmer to publish produce.');
      return;
    }
    const name = cropName.trim();
    const quantityValue = Number(quantity);
    const priceValue = Number(pricePerUnit);
    if (!name || name.length > 100) {
      Alert.alert('Invalid crop name', 'Enter a crop name of up to 100 characters.');
      return;
    }
    if (!quantity.trim() || !Number.isFinite(quantityValue) || quantityValue < 1) {
      Alert.alert('Invalid quantity', 'Enter a quantity of at least 1.');
      return;
    }
    if (!pricePerUnit.trim() || !Number.isFinite(priceValue) || priceValue < 1) {
      Alert.alert('Invalid price', 'Enter a price of at least ₹1 per selected unit.');
      return;
    }
    if (description.trim().length > 500) {
      Alert.alert('Description too long', 'Use at most 500 characters.');
      return;
    }

    const locationResult = buildListingLocation(
      { village, taluk, district, state: stateName, pincode },
      user?.location
    );
    if (!locationResult.valid) {
      Alert.alert('Location required', locationResult.message);
      return;
    }

    setSubmitting(true);
    let photoUrl = uploadedPhoto;
    if (photo && !photoUrl) {
      const form = new FormData();
      if (Platform.OS === 'web') {
        if (!photo.file) {
          setSubmitting(false);
          Alert.alert('Photo unavailable', 'Please select the photo again.');
          return;
        }
        form.append('photos', photo.file);
      } else {
        const mime = photo.mimeType || 'image/jpeg';
        form.append('photos', { uri: photo.uri, name: photo.fileName || 'produce.jpg', type: mime });
      }
      const upload = await apiRequest('/upload', { method: 'POST', body: form }, token);
      if (!upload.success || !upload.images?.[0]) {
        setSubmitting(false);
        Alert.alert('Photo upload failed', upload.message || 'Please try again. Your listing has not been published.');
        return;
      }
      photoUrl = upload.images[0];
      setUploadedPhoto(photoUrl);
    }
    const res = await apiRequest(
      '/listings',
      {
        method: 'POST',
        body: JSON.stringify({
          cropName: name,
          category,
          quantity: quantityValue,
          unit,
          pricePerUnit: priceValue,
          qualityGrade,
          description: description.trim(),
          images: photoUrl ? [photoUrl] : [],
          location: locationResult.location
        })
      },
      token
    );

    setSubmitting(false);
    if (res.success) {
      Alert.alert(
        'Harvest Listed! 🌾',
        `${cropName} (${quantity} ${unit} @ ₹${pricePerUnit}/${unit}) is now live on the marketplace for direct buyers!`,
        [
          {
            text: 'View in Market',
            onPress: () => {
              // Clear form
              setCropName('');
              setQuantity('');
              setPricePerUnit('');
              setDescription('');
              setPhoto(null);
              setUploadedPhoto(null);
              setMandiBenchmark(null);
              if (onNavigateToMarket) onNavigateToMarket();
            }
          }
        ]
      );
    } else {
      Alert.alert('Listing Failed', res.message || 'Could not post produce listing');
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t.sell.title}</Text>
        <Text style={styles.headerSubtitle}>{t.sell.subtitle}</Text>
      </View>

      {/* Live Mandi Intelligence Box */}
      {loadingBenchmark ? (
        <View style={styles.benchmarkLoadingCard}>
          <ActivityIndicator size="small" color="#10B981" />
          <Text style={styles.benchmarkLoadingText}>Checking saved mandi rates...</Text>
        </View>
      ) : mandiBenchmark ? (
        <View style={styles.benchmarkCard}>
          <View style={styles.benchmarkHeaderRow}>
            <Text style={styles.benchmarkBadge}>📊 {t.sell.mandiBenchmarkTitle}</Text>
            <Text style={styles.benchmarkYardText}>{mandiBenchmark.marketCenter}</Text>
          </View>
          <Text style={styles.benchmarkRatesText}>
            Reference modal price: <Text style={styles.benchmarkHighlight}>₹{mandiBenchmark.farmerPriceGuidance.modalRatePerKg}/kg</Text>
            {'  '}(Range: ₹{mandiBenchmark.farmerPriceGuidance.minimumAcceptablePerKg} - ₹{mandiBenchmark.farmerPriceGuidance.maximumMarketPerKg}/kg)
          </Text>
          <View style={styles.adviceBanner}>
            <Text style={styles.adviceText}>
              🛡️ {mandiBenchmark.farmerPriceGuidance.antiExploitationNotice}
            </Text>
          </View>
        </View>
      ) : null}

      {/* Form Fields */}
      <View style={styles.formCard}>
        <Text style={styles.inputLabel}>🌱 {t.sell.cropNameLabel} *</Text>
        <TextInput
          style={styles.input}
          placeholder={t.sell.cropNamePlaceholder}
          placeholderTextColor="#64748B"
          value={cropName}
          onChangeText={setCropName}
          maxLength={100}
        />

        {/* Dynamic Filtered Crop Suggestions */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillRow}>
          {[
            ...liveCropCatalog,
            ...CURATED_MOBILE_CROPS.filter(
              (c) => !liveCropCatalog.some((l) => l.name.toUpperCase() === c.name.toUpperCase())
            )
          ]
            .filter((item) =>
              !cropName.trim() || item.name.toLowerCase().includes(cropName.trim().toLowerCase())
            )
            .slice(0, 8)
            .map((item) => (
              <TouchableOpacity
                key={item.name}
                style={styles.suggestionChip}
                onPress={() => {
                  setCropName(item.name);
                  if (CATEGORIES.includes(item.category)) setCategory(item.category);
                }}
              >
                <Text style={styles.suggestionText}>
                  + {item.name}{item.modalPrice ? ` (₹${item.modalPrice}/qtl)` : ''}
                </Text>
              </TouchableOpacity>
            ))}
        </ScrollView>

        {/* Category Picker */}
        <Text style={styles.inputLabel}>📁 {t.sell.categoryLabel}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillRow}>
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[
                styles.formPill,
                category === cat && styles.formPillActive
              ]}
              onPress={() => setCategory(cat)}
            >
              <Text
                style={[
                  styles.formPillText,
                  category === cat && styles.formPillTextActive
                ]}
              >
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Quantity & Unit Row */}
        <View style={styles.dualRow}>
          <View style={{ flex: 1, marginRight: 10 }}>
            <Text style={styles.inputLabel}>⚖️ {t.sell.qtyLabel} *</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              placeholder="e.g. 500"
              placeholderTextColor="#64748B"
              value={quantity}
              onChangeText={setQuantity}
            />
          </View>
          <View style={{ width: 110 }}>
            <Text style={styles.inputLabel}>{t.sell.unitLabel}</Text>
            <View style={styles.unitSelector}>
              {UNITS.map((u) => (
                <TouchableOpacity
                  key={u}
                  style={[styles.unitBtn, unit === u && styles.unitBtnActive]}
                  onPress={() => { setPricePerUnit((value) => convertPriceUnit(value, unit, u)); setUnit(u); }}
                >
                  <Text style={[styles.unitBtnText, unit === u && styles.unitBtnTextActive]}>
                    {u}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Quantity Quick Picks */}
        <View style={styles.suggestionRow}>
          {QTY_PRESETS.map((q) => (
            <TouchableOpacity key={q} style={styles.suggestionChip} onPress={() => setQuantity(String(q))}>
              <Text style={styles.suggestionText}>{q} {unit.toLowerCase()}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Expected Price */}
        <Text style={styles.inputLabel}>💰 {t.sell.priceLabel} per {unit} *</Text>
        <TextInput
          style={styles.input}
          keyboardType="numeric"
          placeholder="e.g. 24"
          placeholderTextColor="#64748B"
          value={pricePerUnit}
          onChangeText={setPricePerUnit}
        />
        {mandiBenchmark?.farmerPriceGuidance && (
          <View style={styles.suggestionRow}>
            {[
              {
                label: 'Min',
                val:
                  unit === 'QUINTAL'
                    ? Math.round(mandiBenchmark.farmerPriceGuidance.minimumAcceptablePerKg * 100)
                    : mandiBenchmark.farmerPriceGuidance.minimumAcceptablePerKg
              },
              {
                label: 'Modal ★',
                val:
                  unit === 'QUINTAL'
                    ? Math.round(mandiBenchmark.farmerPriceGuidance.modalRatePerKg * 100)
                    : mandiBenchmark.farmerPriceGuidance.modalRatePerKg
              },
              {
                label: 'Max',
                val:
                  unit === 'QUINTAL'
                    ? Math.round(mandiBenchmark.farmerPriceGuidance.maximumMarketPerKg * 100)
                    : mandiBenchmark.farmerPriceGuidance.maximumMarketPerKg
              }
            ].map((p) => (
              <TouchableOpacity
                key={p.label}
                style={styles.suggestionChip}
                onPress={() => setPricePerUnit(String(p.val))}
              >
                <Text style={styles.suggestionText}>{p.label}: ₹{p.val}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Quality Grade */}
        <Text style={styles.inputLabel}>⭐ {t.sell.qualityLabel}</Text>
        <View style={styles.pillRow}>
          {QUALITY_GRADES.map((g) => (
            <TouchableOpacity
              key={g}
              style={[
                styles.formPill,
                qualityGrade === g && styles.formPillActive
              ]}
              onPress={() => setQualityGrade(g)}
            >
              <Text
                style={[
                  styles.formPillText,
                  qualityGrade === g && styles.formPillTextActive
                ]}
              >
                {g.replace('_', ' ')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Description */}
        <Text style={styles.inputLabel}>📝 {t.sell.descLabel}</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          multiline
          numberOfLines={3}
          placeholder={t.sell.descPlaceholder}
          placeholderTextColor="#64748B"
          value={description}
          onChangeText={setDescription}
          maxLength={500}
        />
        <View style={styles.suggestionRow}>
          {NOTE_PRESETS.map((tpl) => (
            <TouchableOpacity
              key={tpl}
              style={styles.suggestionChip}
              onPress={() =>
                setDescription((prev) =>
                  prev.trim() ? `${prev.trim()} • ${tpl}`.slice(0, 500) : tpl
                )
              }
            >
              <Text style={styles.suggestionText}>+ {tpl}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.inputLabel}>📍 Farm Location</Text>
        <View style={styles.dualRow}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              maxLength={6}
              placeholder="Pincode (6 digits)"
              placeholderTextColor="#64748B"
              value={pincode}
              onChangeText={handlePincodeChange}
            />
          </View>
          <View style={{ flex: 1 }}>
            <TextInput
              style={styles.input}
              placeholder="Village / Town"
              placeholderTextColor="#64748B"
              value={village}
              onChangeText={setVillage}
            />
          </View>
        </View>
        <View style={[styles.dualRow, { marginTop: 8 }]}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <TextInput
              style={styles.input}
              placeholder="District *"
              placeholderTextColor="#64748B"
              value={district}
              onChangeText={setDistrict}
            />
          </View>
          <View style={{ flex: 1 }}>
            <TextInput
              style={styles.input}
              placeholder="State *"
              placeholderTextColor="#64748B"
              value={stateName}
              onChangeText={setStateName}
            />
          </View>
        </View>
        {(lookingUpPin || !!pinStatus) && (
          <Text style={styles.photoHint}>{lookingUpPin ? 'Checking India Post pincode…' : pinStatus}</Text>
        )}

        <Text style={styles.inputLabel}>📷 Produce photo (optional)</Text>
        {photo && <Image source={{ uri: photo.uri }} style={styles.photoPreview} accessibilityLabel="Selected produce photo" />}
        <View style={styles.photoActions}>
          <TouchableOpacity onPress={pickPhoto} disabled={submitting || preparingPhoto} style={styles.photoButton} accessibilityRole="button">
            <Text style={styles.photoButtonText}>{preparingPhoto ? 'Preparing photo…' : photo ? 'Change photo' : 'Choose photo'}</Text>
          </TouchableOpacity>
          {photo && <TouchableOpacity onPress={() => { setPhoto(null); setUploadedPhoto(null); }} disabled={submitting || preparingPhoto} style={styles.photoButton} accessibilityRole="button"><Text style={styles.photoButtonText}>Remove</Text></TouchableOpacity>}
        </View>
        <Text style={styles.photoHint}>Choose a produce photo. Browser uploads must be JPG, PNG, or WebP under 5 MB.</Text>

        {/* Publish Button */}
        <TouchableOpacity
          style={styles.publishButton}
          onPress={handleSubmitListing}
          disabled={submitting || preparingPhoto}
        >
          {submitting ? (
            <ActivityIndicator color="#0F172A" />
          ) : (
            <Text style={styles.publishButtonText}>🚀 {t.sell.publishBtn}</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  photoPreview: { width: '100%', height: 180, borderRadius: 10, marginBottom: 10, backgroundColor: '#1E293B' },
  photoActions: { flexDirection: 'row', gap: 10 },
  photoButton: { padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#10B981' },
  photoButtonText: { color: '#6EE7B7', fontWeight: '600' },
  photoHint: { color: '#94A3B8', marginTop: 8, marginBottom: 12 },
  container: {
    flex: 1,
    backgroundColor: '#0F172A'
  },
  content: {
    padding: 16,
    paddingBottom: 40
  },
  header: {
    marginBottom: 16
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#10B981'
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 2
  },
  benchmarkLoadingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155'
  },
  benchmarkLoadingText: {
    color: '#94A3B8',
    fontSize: 13,
    marginLeft: 10
  },
  benchmarkCard: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#10B981'
  },
  benchmarkHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6
  },
  benchmarkBadge: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#34D399'
  },
  benchmarkYardText: {
    fontSize: 11,
    color: '#94A3B8'
  },
  benchmarkRatesText: {
    fontSize: 14,
    color: '#F8FAFC',
    marginBottom: 8
  },
  benchmarkHighlight: {
    color: '#10B981',
    fontWeight: 'bold'
  },
  adviceBanner: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    padding: 8,
    borderRadius: 6
  },
  adviceText: {
    fontSize: 12,
    color: '#38BDF8',
    lineHeight: 16
  },
  formCard: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155'
  },
  inputLabel: {
    color: '#CBD5E1',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 6
  },
  input: {
    backgroundColor: '#0F172A',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#334155',
    fontSize: 14
  },
  textArea: {
    height: 70,
    textAlignVertical: 'top'
  },
  suggestionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 6
  },
  suggestionChip: {
    backgroundColor: '#334155',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 6,
    marginBottom: 4
  },
  suggestionText: {
    color: '#94A3B8',
    fontSize: 11
  },
  pillRow: {
    flexDirection: 'row',
    marginVertical: 4
  },
  formPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#0F172A',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#334155'
  },
  formPillActive: {
    backgroundColor: '#10B981',
    borderColor: '#10B981'
  },
  formPillText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600'
  },
  formPillTextActive: {
    color: '#0F172A',
    fontWeight: 'bold'
  },
  dualRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  unitSelector: {
    flexDirection: 'row',
    backgroundColor: '#0F172A',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    overflow: 'hidden'
  },
  unitBtn: {
    flex: 1,
    paddingVertical: 11,
    alignItems: 'center'
  },
  unitBtnActive: {
    backgroundColor: '#10B981'
  },
  unitBtnText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: 'bold'
  },
  unitBtnTextActive: {
    color: '#0F172A'
  },
  publishButton: {
    backgroundColor: '#10B981',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 22
  },
  publishButtonText: {
    color: '#0F172A',
    fontSize: 16,
    fontWeight: 'bold'
  }
});
