import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { apiRequest } from '../config/api';

const STATES = [
  { label: 'All India', value: 'ALL' },
  { label: 'Karnataka', value: 'Karnataka' },
  { label: 'Maharashtra', value: 'Maharashtra' },
  { label: 'Punjab', value: 'Punjab' },
  { label: 'Gujarat', value: 'Gujarat' },
  { label: 'MP', value: 'Madhya Pradesh' },
  { label: 'UP', value: 'Uttar Pradesh' },
  { label: 'Rajasthan', value: 'Rajasthan' },
  { label: 'Tamil Nadu', value: 'Tamil Nadu' },
];

const QUICK_CROPS = [
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
  'Banana',
];

const getCategoryEmoji = (category = '') => {
  const map = {
    GRAINS: '🌾',
    PULSES: '🫘',
    VEGETABLES: '🥬',
    FRUITS: '🍎',
    SPICES: '🌶️',
    OILSEEDS: '🌻',
    FIBRES: '🧶',
  };
  return map[String(category).toUpperCase()] || '🌿';
};

const formatDate = (item) => {
  if (item.arrivalDateRaw) return item.arrivalDateRaw;
  if (!item.priceDate) return 'Today';
  const d = new Date(item.priceDate);
  if (Number.isNaN(d.getTime())) return 'Today';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
};

export default function MandiRatesScreen() {
  const [selectedState, setSelectedState] = useState('ALL');
  const [selectedCrop, setSelectedCrop] = useState('ALL');
  const [searchInput, setSearchInput] = useState('');

  const [rates, setRates] = useState([]);
  const [weather, setWeather] = useState(null);
  const [totalAvailable, setTotalAvailable] = useState(null);
  const [sourceLabel, setSourceLabel] = useState('data.gov.in (Agmarknet Live)');
  const [nextOffset, setNextOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const fetchMandiFeed = async ({
    state = selectedState,
    crop = selectedCrop,
    offset = 0,
    append = false,
    isRefresh = false,
  } = {}) => {
    if (append) setLoadingMore(true);
    else if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setErrorMsg('');

    const params = [`state=${encodeURIComponent(state)}`, 'limit=60', `offset=${offset}`];
    if (crop && crop !== 'ALL') {
      params.push(`commodity=${encodeURIComponent(crop)}`);
    }

    const [liveRes, weatherRes] = await Promise.all([
      apiRequest(`/mandi-rates/live?${params.join('&')}`),
      append ? Promise.resolve(null) : apiRequest('/mandi-rates/weather?district=Dharwad'),
    ]);

    if (liveRes?.success && Array.isArray(liveRes.rates)) {
      if (append) {
        setRates((prev) => [...prev, ...liveRes.rates]);
      } else {
        setRates(liveRes.rates);
      }
      setTotalAvailable(liveRes.totalAvailable ?? null);
      setSourceLabel(liveRes.source || 'data.gov.in (Agmarknet Live)');
      setNextOffset(liveRes.nextOffset ?? offset + liveRes.rates.length);
      setHasMore(Boolean(liveRes.hasMore) && liveRes.rates.length > 0);
    } else if (!append) {
      setErrorMsg(liveRes?.message || 'Unable to load Agmarknet rates.');
    }

    if (weatherRes?.success && weatherRes.weather) {
      setWeather(weatherRes.weather);
    }

    setLoading(false);
    setRefreshing(false);
    setLoadingMore(false);
  };

  useEffect(() => {
    fetchMandiFeed({ state: selectedState, crop: selectedCrop, offset: 0 });
  }, [selectedState, selectedCrop]);

  const handleSearchSubmit = () => {
    const clean = searchInput.trim();
    const targetCrop = clean || 'ALL';
    if (targetCrop === selectedCrop) {
      fetchMandiFeed({ state: selectedState, crop: targetCrop, offset: 0 });
    } else {
      setSelectedCrop(targetCrop);
    }
  };

  const renderRateCard = ({ item }) => {
    const spread = Math.max(0, (Number(item.maxPrice) || 0) - (Number(item.minPrice) || 0));
    return (
      <View style={styles.card}>
        <View style={styles.photoBox}>
          {item.imageUrl ? (
            <Image source={{ uri: item.imageUrl }} style={styles.photo} resizeMode="cover" />
          ) : (
            <Text style={styles.photoFallback}>{getCategoryEmoji(item.category)}</Text>
          )}
          <View style={styles.catBadge}>
            <Text style={styles.catBadgeText}>{item.category || 'AGMARKNET'}</Text>
          </View>
          {!!item.grade && (
            <View style={styles.gradeBadge}>
              <Text style={styles.gradeBadgeText}>{item.grade}</Text>
            </View>
          )}
        </View>

        <View style={styles.cardBody}>
          <View style={styles.titleRow}>
            <Text style={styles.commodityText} numberOfLines={1}>
              {item.commodity}
            </Text>
            <Text style={styles.dateText}>{formatDate(item)}</Text>
          </View>

          <Text style={styles.varietyText} numberOfLines={1}>
            Variety: {item.variety || 'Standard'}
          </Text>
          <Text style={styles.marketText} numberOfLines={1}>
            🏛️ {item.marketCenter || 'APMC'} • {item.district}, {item.state}
          </Text>

          <View style={styles.priceGrid}>
            <View style={styles.priceCell}>
              <Text style={styles.priceLabel}>MIN</Text>
              <Text style={styles.minVal}>₹{Number(item.minPrice || 0).toLocaleString('en-IN')}</Text>
            </View>
            <View style={[styles.priceCell, styles.modalCell]}>
              <Text style={styles.modalLabel}>MODAL / QTL</Text>
              <Text style={styles.modalVal}>₹{Number(item.modalPrice || 0).toLocaleString('en-IN')}</Text>
            </View>
            <View style={styles.priceCell}>
              <Text style={styles.priceLabel}>MAX (SPREAD ₹{spread})</Text>
              <Text style={styles.maxVal}>₹{Number(item.maxPrice || 0).toLocaleString('en-IN')}</Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.banner}>
        <Text style={styles.heading}>📊 Live Agmarknet APMC Feed</Text>
        <Text style={styles.subHeading}>
          {rates.length} markets loaded
          {totalAvailable ? ` • ${Number(totalAvailable).toLocaleString('en-IN')} live pan-India` : ''}
        </Text>
        <Text style={styles.sourceTag}>{sourceLabel}</Text>
        {weather && (
          <Text style={styles.weatherLine}>
            🌤️ {weather.district || 'Dharwad'}: {weather.temperatureC ?? '--'}°C ({weather.condition}) • {weather.humidityPct ?? '--'}% RH
          </Text>
        )}
      </View>

      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search ANY crop (Apple, Wheat, Garlic, Mango)..."
          placeholderTextColor="#64748b"
          value={searchInput}
          onChangeText={setSearchInput}
          onSubmitEditing={handleSearchSubmit}
          returnKeyType="search"
        />
        <TouchableOpacity style={styles.searchBtn} onPress={handleSearchSubmit} activeOpacity={0.8}>
          <Text style={styles.searchBtnText}>Search</Text>
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {STATES.map((s) => {
          const active = selectedState === s.value;
          return (
            <TouchableOpacity
              key={s.value}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setSelectedState(s.value)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{s.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {QUICK_CROPS.map((crop) => {
          const active = selectedCrop.toLowerCase() === crop.toLowerCase();
          return (
            <TouchableOpacity
              key={crop}
              style={[styles.chip, active && styles.cropChipActive]}
              onPress={() => {
                setSearchInput(crop === 'ALL' ? '' : crop);
                setSelectedCrop(crop);
              }}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {crop === 'ALL' ? 'All Crops' : crop}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );

  return (
    <View style={styles.screen}>
      <FlatList
        data={rates}
        keyExtractor={(item, idx) => `${item.state}-${item.marketCenter}-${item.commodity}-${item.variety}-${idx}`}
        renderItem={renderRateCard}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator size="large" color="#10b981" style={{ marginTop: 40 }} />
          ) : (
            <Text style={styles.emptyText}>
              {errorMsg || 'No matching APMC rates arrived today. Try All Crops or All India.'}
            </Text>
          )
        }
        ListFooterComponent={
          hasMore ? (
            <TouchableOpacity
              style={styles.loadMoreBtn}
              disabled={loadingMore}
              onPress={() => fetchMandiFeed({ state: selectedState, crop: selectedCrop, offset: nextOffset, append: true })}
            >
              <Text style={styles.loadMoreText}>
                {loadingMore ? 'Loading Next Page...' : 'Load More (+60 Mandis)'}
              </Text>
            </TouchableOpacity>
          ) : null
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchMandiFeed({ state: selectedState, crop: selectedCrop, offset: 0, isRefresh: true })}
            tintColor="#10b981"
          />
        }
        contentContainerStyle={{ paddingBottom: 28 }}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0a0f1d' },
  header: { padding: 14, gap: 10 },
  banner: {
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1f2937',
    gap: 4,
  },
  heading: { color: '#ffffff', fontSize: 17, fontWeight: '800' },
  subHeading: { color: '#34d399', fontSize: 12, fontWeight: '700' },
  sourceTag: { color: '#94a3b8', fontSize: 11 },
  weatherLine: { color: '#fcd34d', fontSize: 11, marginTop: 4, fontWeight: '600' },
  searchRow: { flexDirection: 'row', gap: 8 },
  searchInput: {
    flex: 1,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#ffffff',
    fontSize: 13,
  },
  searchBtn: {
    backgroundColor: '#059669',
    paddingHorizontal: 16,
    borderRadius: 12,
    justifyContent: 'center',
  },
  searchBtnText: { color: '#ffffff', fontWeight: '800', fontSize: 12 },
  chipRow: { gap: 8, paddingVertical: 2 },
  chip: {
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1e293b',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
  },
  chipActive: { backgroundColor: '#065f46', borderColor: '#10b981' },
  cropChipActive: { backgroundColor: '#0369a1', borderColor: '#38bdf8' },
  chipText: { color: '#94a3b8', fontSize: 12, fontWeight: '700' },
  chipTextActive: { color: '#ffffff' },
  card: {
    marginHorizontal: 14,
    marginBottom: 12,
    backgroundColor: '#111827',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
    overflow: 'hidden',
  },
  photoBox: {
    height: 130,
    backgroundColor: '#064e3b',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photo: { width: '100%', height: '100%' },
  photoFallback: { fontSize: 44 },
  catBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(15,23,42,0.88)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  catBadgeText: { color: '#6ee7b7', fontSize: 10, fontWeight: '800' },
  gradeBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(15,23,42,0.88)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  gradeBadgeText: { color: '#e2e8f0', fontSize: 10, fontWeight: '700' },
  cardBody: { padding: 12, gap: 4 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  commodityText: { color: '#ffffff', fontSize: 15, fontWeight: '800', flex: 1 },
  dateText: { color: '#94a3b8', fontSize: 11 },
  varietyText: { color: '#34d399', fontSize: 12, fontWeight: '600' },
  marketText: { color: '#cbd5e1', fontSize: 12 },
  priceGrid: { flexDirection: 'row', gap: 8, marginTop: 8 },
  priceCell: {
    flex: 1,
    backgroundColor: '#0a0f1d',
    borderRadius: 10,
    padding: 8,
    alignItems: 'center',
  },
  modalCell: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.35)',
  },
  priceLabel: { color: '#94a3b8', fontSize: 9, fontWeight: '700' },
  modalLabel: { color: '#34d399', fontSize: 9, fontWeight: '800' },
  minVal: { color: '#fcd34d', fontSize: 13, fontWeight: '800', marginTop: 2 },
  modalVal: { color: '#34d399', fontSize: 14, fontWeight: '900', marginTop: 2 },
  maxVal: { color: '#38bdf8', fontSize: 13, fontWeight: '800', marginTop: 2 },
  emptyText: { color: '#94a3b8', textAlign: 'center', padding: 28, fontSize: 13 },
  loadMoreBtn: {
    marginHorizontal: 14,
    marginTop: 4,
    backgroundColor: '#0284c7',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  loadMoreText: { color: '#ffffff', fontWeight: '800', fontSize: 13 },
});
