import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TextInput,
  TouchableOpacity,
  Modal,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Image,
  Dimensions
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { apiRequest, resolveMediaUrl } from '../config/api';

const { width } = Dimensions.get('window');

const getListingImage = (item) => {
  if (!item) return null;
  if (Array.isArray(item.images) && item.images.length > 0 && typeof item.images[0] === 'string') {
    const resolved = resolveMediaUrl(item.images[0]);
    if (resolved) return resolved;
  }
  return item.resolvedImageUrl || null;
};

const CATEGORIES = [
  { key: 'ALL', label: 'All Crops', icon: '🌾' },
  { key: 'Vegetables', label: 'Vegetables', icon: '🥬' },
  { key: 'Grains', label: 'Grains', icon: '🌾' },
  { key: 'Spices', label: 'Spices', icon: '🌶️' },
  { key: 'Oilseeds', label: 'Oilseeds', icon: '🌻' },
  { key: 'Fruits', label: 'Fruits', icon: '🍎' },
  { key: 'Pulses', label: 'Pulses', icon: '🫘' },
  { key: 'Other', label: 'Other', icon: '🌱' }
];

export default function MarketplaceScreen({ onNavigateToNegotiations }) {
  const { t, token, user, role } = useAuth();

  const [listings, setListings] = useState([]);
  const [tickerRates, setTickerRates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(0);
  const requestId = useRef(0);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Offer Modal State
  const [selectedListing, setSelectedListing] = useState(null);
  const [listingDetails, setListingDetails] = useState(null);
  const [offerPrice, setOfferPrice] = useState('');
  const [offerQuantity, setOfferQuantity] = useState('');
  const [offerNote, setOfferNote] = useState('');
  const [submittingOffer, setSubmittingOffer] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    fetchListings(1);
    fetchTickerRates();
    return () => { requestId.current += 1; };
  }, [selectedCategory, debouncedSearch]);

  const fetchTickerRates = async () => {
    const res = await apiRequest('/mandi-rates?limit=4');
    if (res?.success && Array.isArray(res.rates)) {
      setTickerRates(res.rates.slice(0, 4));
    }
  };

  const fetchListings = async (nextPage = 1, refresh = false) => {
    const id = ++requestId.current;
    if (nextPage > 1) setLoadingMore(true);
    else if (refresh) setRefreshing(true);
    else setLoading(true);
    setLoadError('');
    const params = ['status=AVAILABLE', `page=${nextPage}`, 'limit=10'];
    if (selectedCategory !== 'ALL') params.push(`category=${encodeURIComponent(selectedCategory)}`);
    if (debouncedSearch) params.push(`search=${encodeURIComponent(debouncedSearch)}`);
    const res = await apiRequest(`/listings?${params.join('&')}`, {}, token);
    if (id !== requestId.current) return;
    if (res.success && Array.isArray(res.listings)) {
      setListings((prev) => nextPage === 1 ? res.listings : [...prev, ...res.listings.filter((item) => !prev.some((old) => old._id === item._id))]);
      setPage(res.page || nextPage);
      setPages(res.pages || 1);
    } else {
      if (nextPage === 1) setListings([]);
      setLoadError(res.message || 'Could not load listings.');
    }
    setLoading(false); setLoadingMore(false); setRefreshing(false);
  };

  const onRefresh = () => {
    fetchListings(1, true);
    fetchTickerRates();
  };

  const handleOpenOfferModal = (listing) => {
    setSelectedListing(listing);
    setOfferPrice(listing.expectedPrice || listing.pricePerUnit ? String(listing.expectedPrice || listing.pricePerUnit) : '');
    setOfferQuantity(listing.quantity ? String(listing.quantity) : '50');
    setOfferNote('');
  };

  const handleSubmitOffer = async () => {
    if (submittingOffer) return;
    const price = Number(offerPrice);
    const quantity = Number(offerQuantity);
    if (!offerPrice.trim() || !Number.isFinite(price) || price < 0.1) {
      Alert.alert('Invalid Price', 'Enter a price of at least ₹0.10 per selected unit.');
      return;
    }
    if (!offerQuantity.trim() || !Number.isFinite(quantity) || quantity < 1 || quantity > selectedListing.quantity) {
      Alert.alert('Invalid Quantity', `Enter a quantity between 1 and ${selectedListing.quantity} ${selectedListing.unit || 'unit'}.`);
      return;
    }

    setSubmittingOffer(true);
    const res = await apiRequest(
      '/negotiations',
      {
        method: 'POST',
        body: JSON.stringify({
          listingId: selectedListing._id,
          offeredPrice: price,
          quantity,
          note: offerNote || `Direct purchase offer on ${selectedListing.cropName}`
        })
      },
      token
    );

    setSubmittingOffer(false);
    if (res && res.success) {
      Alert.alert(
        'Offer sent',
        `Offer of ₹${offerPrice}/${selectedListing.unit || 'unit'} for ${offerQuantity} ${selectedListing.unit || 'unit'} sent to ${selectedListing.farmer?.name || 'Farmer'}.`,
        [
          {
            text: 'View in Bargaining Room',
            onPress: () => {
              setSelectedListing(null);
              if (onNavigateToNegotiations) onNavigateToNegotiations();
            }
          },
          { text: 'Keep Browsing', onPress: () => setSelectedListing(null) }
        ]
      );
    } else {
      Alert.alert('Offer not sent', res?.message || 'Please check your connection and try again.');
    }
  };

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      {/* Live Agmarknet Corridor Feed */}
      <View style={styles.corridorBar}>
        <View style={styles.livePulseDot} />
        <Text style={styles.corridorBarText} numberOfLines={2}>
          {tickerRates.length > 0
            ? `Agmarknet Live: ${tickerRates
                .map((r) => `${r.commodity} ₹${Number(r.modalPrice).toLocaleString('en-IN')}/qtl`)
                .join(' • ')}`
            : 'Browse produce listed by farmers'}
        </Text>
      </View>

      {/* Modern Search Input */}
      <View style={styles.searchBox}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by crop, grade, district (e.g. Tomato, Byadagi)..."
          placeholderTextColor="#64748b"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {!!searchQuery && (
          <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearSearchBtn}>
            <Text style={styles.clearSearchText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Horizontal Category Selector */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
        {CATEGORIES.map((cat) => {
          const isSelected = selectedCategory.toLowerCase() === cat.key.toLowerCase();
          return (
            <TouchableOpacity
              key={cat.key}
              style={[styles.categoryChip, isSelected && styles.categoryChipActive]}
              onPress={() => setSelectedCategory(cat.key)}
              activeOpacity={0.7}
            >
              <Text style={styles.categoryIcon}>{cat.icon}</Text>
              <Text style={[styles.categoryLabel, isSelected && styles.categoryLabelActive]}>
                {cat.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );

  const renderListingCard = ({ item }) => {
    const isOwner = user && item.farmer && String(item.farmer._id) === String(user._id);
    const imageUrl = getListingImage(item);
    const price = Number(item.pricePerUnit ?? item.expectedPrice ?? 0);
    const benchmark = item.benchmarkRate != null ? Number(item.benchmarkRate) : null;
    const mspDiff = benchmark !== null ? price - benchmark : null;
    const distance = item.distanceKm != null ? item.distanceKm : null;

    const initial = (item.farmer?.name || 'F')[0].toUpperCase();

    return (
      <View style={styles.cropCard}>
        {/* Photo Container with Top Gradient Badges */}
        <View style={styles.imageWrapper}>
          {imageUrl ? (
            <Image
              source={{ uri: imageUrl }}
              style={styles.cropPhoto}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.cropPhoto, { backgroundColor: '#064e3b', justifyContent: 'center', alignItems: 'center' }]}>
              <Text style={{ fontSize: 42 }}>🌾</Text>
            </View>
          )}
          <View style={styles.imageScrim} />
          {!item.images?.length && <Text style={{ color: '#fff', position: 'absolute', right: 8, bottom: 8, backgroundColor: '#0f172a', padding: 4, fontSize: 10 }}>Illustrative image</Text>}

          {/* Top Badges */}
          <View style={styles.imageTopRow}>
            <View style={styles.catBadge}>
              <Text style={styles.catBadgeText}>{(item.category || 'CROPS').toUpperCase()}</Text>
            </View>

            {item.organicCertified ? (
              <View style={styles.organicBadge}>
                <Text style={styles.organicBadgeText}>🌿 Organic (farmer listed)</Text>
              </View>
            ) : (
              <View style={styles.qualityBadge}>
                <Text style={styles.qualityBadgeText}>⭐ {item.qualityGrade || 'Not provided'}</Text>
              </View>
            )}
          </View>

          {/* Bottom Floating Stats over Image */}
          <View style={styles.imageBottomRow}>
            <View style={styles.dateBadge}>
              <Text style={styles.dateBadgeText}>
                📅 {item.harvestDate ? new Date(item.harvestDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'Date not provided'}
              </Text>
            </View>
            {distance !== null && (
              <View style={styles.distanceBadge}>
                <Text style={styles.distanceBadgeText}>📍 {distance} km away</Text>
              </View>
            )}
          </View>
        </View>

        {/* Content Body */}
        <View style={styles.cardContent}>
          {/* Crop Title */}
          <Text style={styles.cropTitle} numberOfLines={1}>
            {item.cropName}
          </Text>

          {/* Subtitle / Description */}
          <Text style={styles.cropDescription} numberOfLines={2}>
            {item.description || 'No description provided.'}
          </Text>

          {/* Farmer Info Pill with Specs Button */}
          <View style={styles.farmerStrip}>
            <View style={styles.farmerLeft}>
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarText}>{initial}</Text>
              </View>
              <View>
                <Text style={styles.farmerNameText} numberOfLines={1}>
                  {item.farmer?.name || 'Unknown farmer'}
                </Text>
                <Text style={styles.farmerLocationText}>
                  📍 {[item.location?.village, item.location?.district, item.location?.state].filter(Boolean).join(', ') || 'Location not provided'}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.specsBtn}
              onPress={() => setListingDetails(item)}
              activeOpacity={0.7}
            >
              <Text style={styles.specsBtnText}>👁 Specs</Text>
            </TouchableOpacity>
          </View>

          {/* Bottom Pricing & Lot Size Strip (Exact match with Web) */}
          <View style={styles.metricsBox}>
            <View style={styles.metricColumn}>
              <Text style={styles.metricSmallLabel}>LOT SIZE</Text>
              <Text style={styles.metricBigQty}>
                {item.quantity} <Text style={{ fontSize: 11, color: '#94a3b8' }}>{item.unit || 'unit'}</Text>
              </Text>
              <View style={styles.lotIndicator} />
            </View>

            <View style={[styles.metricColumn, { alignItems: 'flex-end' }]}>
              <Text style={styles.metricSmallLabel}>FARMER RATE</Text>
              <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                <Text style={styles.currencySign}>₹</Text>
                <Text style={styles.priceValueText}>{price.toLocaleString('en-IN')}</Text>
                <Text style={styles.priceUnitText}> / {item.unit || 'unit'}</Text>
              </View>
              <Text style={styles.mspText}>
                {mspDiff === null
                  ? 'Direct Farm Quote'
                  : mspDiff >= 0
                  ? `+₹${mspDiff} vs APMC Modal`
                  : `₹${Math.abs(mspDiff)} below APMC Modal`}
              </Text>
            </View>
          </View>

          {/* Action CTA */}
          <View style={styles.actionContainer}>
            {isOwner ? (
              <View style={styles.ownerPill}>
                <Text style={styles.ownerPillText}>🌾 Your Active Harvest Listing</Text>
              </View>
            ) : !['BUYER_RETAIL', 'BUYER_WHOLESALE'].includes(role) ? null : (
              <TouchableOpacity
                style={styles.offerButton}
                onPress={() => handleOpenOfferModal(item)}
                activeOpacity={0.8}
              >
                <Text style={styles.offerButtonText}>🤝 Make offer</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      <FlatList
        data={listings}
        keyExtractor={(item) => item._id}
        renderItem={renderListingCard}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator size="large" color="#10b981" style={{ marginTop: 40 }} />
          ) : (
            <Text style={{ color: '#cbd5e1', textAlign: 'center', padding: 20 }}>
              {loadError ? 'Could not load listings.' : 'No listings found.'}
            </Text>
          )
        }
        ListFooterComponent={<View style={{ padding: 18, alignItems: 'center', gap: 8 }}>{!!loadError && <Text style={{ color: '#fca5a5' }}>{loadError}</Text>}{(loadError || page < pages) && <TouchableOpacity style={styles.offerButton} disabled={loadingMore} onPress={() => fetchListings(loadError && listings.length === 0 ? 1 : page + 1)}><Text style={styles.offerButtonText}>{loadingMore ? 'Loading…' : loadError ? 'Try again' : 'Load more'}</Text></TouchableOpacity>}</View>}
        contentContainerStyle={styles.listPadding}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#10b981"
          />
        }
      />

      {/* Lot Details Modal */}
      <Modal
        visible={!!listingDetails}
        transparent
        animationType="fade"
        onRequestClose={() => setListingDetails(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.detailCard}>
            <View style={styles.detailHeader}>
              <Text style={styles.detailCropName}>{listingDetails?.cropName}</Text>
              <TouchableOpacity onPress={() => setListingDetails(null)} style={styles.closeIconBtn}>
                <Text style={styles.closeIconText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ gap: 10, paddingVertical: 8 }}>
              {getListingImage(listingDetails) && (
                <Image
                  source={{ uri: getListingImage(listingDetails) }}
                  style={styles.detailImage}
                  resizeMode="cover"
                />
              )}

              <View style={styles.specTable}>
                <View style={styles.specRow}>
                  <Text style={styles.specTitle}>Category:</Text>
                  <Text style={styles.specValue}>{listingDetails?.category}</Text>
                </View>
                <View style={styles.specRow}>
                  <Text style={styles.specTitle}>Quality Grade:</Text>
                  <Text style={styles.specValue}>{listingDetails?.qualityGrade || 'Not provided'}</Text>
                </View>
                <View style={styles.specRow}>
                  <Text style={styles.specTitle}>Available Quantity:</Text>
                  <Text style={styles.specValue}>{listingDetails?.quantity} {listingDetails?.unit || 'unit'}</Text>
                </View>
                <View style={styles.specRow}>
                  <Text style={styles.specTitle}>Asking Rate:</Text>
                  <Text style={[styles.specValue, { color: '#34d399', fontWeight: '800' }]}>
                    ₹{(listingDetails?.expectedPrice || listingDetails?.pricePerUnit || 0).toLocaleString('en-IN')} / {listingDetails?.unit || 'unit'}
                  </Text>
                </View>
                <View style={styles.specRow}>
                  <Text style={styles.specTitle}>APMC Benchmark:</Text>
                  <Text style={styles.specValue}>
                    {listingDetails?.benchmarkRate != null ? `₹${listingDetails.benchmarkRate.toLocaleString('en-IN')}/qtl` : 'Not matched yet'}
                  </Text>
                </View>
                <View style={styles.specRow}>
                  <Text style={styles.specTitle}>Moisture Content:</Text>
                  <Text style={styles.specValue}>{listingDetails?.moistureContent || 'Not provided'}</Text>
                </View>
                <View style={styles.specRow}>
                  <Text style={styles.specTitle}>FPO / Producer:</Text>
                  <Text style={styles.specValue}>{listingDetails?.farmer?.fpo || listingDetails?.farmer?.name || 'Not provided'}</Text>
                </View>
                <View style={styles.specRow}>
                  <Text style={styles.specTitle}>Location Corridor:</Text>
                  <Text style={styles.specValue}>
                    {[listingDetails?.location?.village, listingDetails?.location?.district, listingDetails?.location?.state].filter(Boolean).join(', ') || 'Not provided'}
                  </Text>
                </View>
              </View>

              <View style={styles.descBox}>
                <Text style={styles.descTitle}>Institutional Harvest Note:</Text>
                <Text style={styles.descText}>
                  "{listingDetails?.description || 'No description provided.'}"
                </Text>
              </View>
            </ScrollView>

            <TouchableOpacity
              style={styles.closeModalButton}
              onPress={() => setListingDetails(null)}
            >
              <Text style={styles.closeModalButtonText}>Close Specifications</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Offer Modal */}
      <Modal
        visible={!!selectedListing}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedListing(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.offerModalContainer}>
            <View style={styles.detailHeader}>
              <View>
                <Text style={styles.detailCropName}>Make an offer</Text>
                <Text style={styles.offerModalSub}>
                  {selectedListing?.cropName} • Asking: ₹{selectedListing?.expectedPrice || selectedListing?.pricePerUnit}/{selectedListing?.unit || 'unit'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedListing(null)} style={styles.closeIconBtn}>
                <Text style={styles.closeIconText}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={{ gap: 12, marginVertical: 14 }}>
              <View>
                <Text style={styles.inputHeading}>Offer Price (₹ per {selectedListing?.unit || 'unit'})</Text>
                <TextInput
                  style={styles.modalField}
                  keyboardType="numeric"
                  placeholder="e.g. 1950"
                  placeholderTextColor="#64748b"
                  value={offerPrice}
                  onChangeText={setOfferPrice}
                />
              </View>

              <View>
                <Text style={styles.inputHeading}>Quantity ({selectedListing?.unit || 'unit'})</Text>
                <TextInput
                  style={styles.modalField}
                  keyboardType="numeric"
                  placeholder={`Max: ${selectedListing?.quantity}`}
                  placeholderTextColor="#64748b"
                  value={offerQuantity}
                  onChangeText={setOfferQuantity}
                />
              </View>

              {/* Live Escrow Calculation Box */}
              <View style={styles.escrowCalcBox}>
                <View style={styles.specRow}>
                  <Text style={styles.specTitle}>Base Consignment Value:</Text>
                  <Text style={[styles.specValue, { color: '#ffffff', fontWeight: 'bold' }]}>
                    ₹{((Number(offerPrice) || 0) * (Number(offerQuantity) || 0)).toLocaleString('en-IN')}
                  </Text>
                </View>

              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                style={styles.cancelOfferBtn}
                onPress={() => setSelectedListing(null)}
              >
                <Text style={styles.cancelOfferText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.submitOfferBtn}
                onPress={handleSubmitOffer}
                disabled={submittingOffer}
              >
                {submittingOffer ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.submitOfferText}>Send offer</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0a0f1d'
  },
  listPadding: {
    paddingBottom: 30
  },
  headerContainer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    marginBottom: 8
  },

  /* Live Corridor Bar */
  corridorBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderColor: 'rgba(16, 185, 129, 0.25)',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 10
  },
  livePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
    marginRight: 6
  },
  corridorBarText: {
    color: '#6ee7b7',
    fontSize: 10,
    fontWeight: '700'
  },

  /* Search */
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111827',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#1e293b',
    marginBottom: 10
  },
  searchIcon: {
    fontSize: 14,
    marginRight: 8
  },
  searchInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 13,
    padding: 0
  },
  clearSearchBtn: {
    padding: 4
  },
  clearSearchText: {
    color: '#64748b',
    fontSize: 13
  },

  /* Category Scroll */
  categoryScroll: {
    gap: 8,
    paddingRight: 16,
    paddingBottom: 6
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111827',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1e293b',
    gap: 6
  },
  categoryChipActive: {
    backgroundColor: '#059669',
    borderColor: '#10b981'
  },
  categoryIcon: {
    fontSize: 13
  },
  categoryLabel: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '600'
  },
  categoryLabelActive: {
    color: '#ffffff',
    fontWeight: '800'
  },

  /* 🌟 CROP CARD (Matches Web Exactly) */
  cropCard: {
    backgroundColor: '#111827',
    borderRadius: 20,
    marginHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 6
  },
  imageWrapper: {
    height: 175,
    width: '100%',
    position: 'relative',
    backgroundColor: '#0f172a'
  },
  cropPhoto: {
    width: '100%',
    height: '100%'
  },
  imageScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10, 15, 29, 0.4)'
  },
  imageTopRow: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  catBadge: {
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)'
  },
  catBadgeText: {
    color: '#e2e8f0',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5
  },
  organicBadge: {
    backgroundColor: 'rgba(6, 78, 59, 0.9)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#10b981'
  },
  organicBadgeText: {
    color: '#6ee7b7',
    fontSize: 10,
    fontWeight: '800'
  },
  qualityBadge: {
    backgroundColor: 'rgba(120, 53, 15, 0.85)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#f59e0b'
  },
  qualityBadgeText: {
    color: '#fcd34d',
    fontSize: 10,
    fontWeight: '800'
  },
  imageBottomRow: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    right: 10,
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  dateBadge: {
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6
  },
  dateBadgeText: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '600'
  },
  distanceBadge: {
    backgroundColor: 'rgba(6, 78, 59, 0.85)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)'
  },
  distanceBadgeText: {
    color: '#34d399',
    fontSize: 10,
    fontWeight: '700'
  },

  /* Card Content */
  cardContent: {
    padding: 16
  },
  cropTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.3,
    marginBottom: 4
  },
  cropDescription: {
    color: '#94a3b8',
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 12
  },

  /* Farmer Strip */
  farmerStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0a0f1d',
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)'
  },
  farmerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1
  },
  avatarCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center'
  },
  avatarText: {
    color: '#34d399',
    fontSize: 12,
    fontWeight: '800'
  },
  farmerNameText: {
    color: '#f8fafc',
    fontSize: 12,
    fontWeight: '700'
  },
  farmerLocationText: {
    color: '#64748b',
    fontSize: 10,
    marginTop: 1
  },
  specsBtn: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155'
  },
  specsBtnText: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: '700'
  },

  /* Metrics Box (LOT SIZE & FARMER RATE) */
  metricsBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#070c18',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)'
  },
  metricColumn: {
    flex: 1
  },
  metricSmallLabel: {
    color: '#64748b',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 3
  },
  metricBigQty: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '900'
  },
  lotIndicator: {
    width: 36,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#10b981',
    marginTop: 4
  },
  currencySign: {
    color: '#34d399',
    fontSize: 13,
    fontWeight: '700',
    marginRight: 1
  },
  priceValueText: {
    color: '#34d399',
    fontSize: 18,
    fontWeight: '900'
  },
  priceUnitText: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '600'
  },
  mspText: {
    color: '#34d399',
    fontSize: 9,
    fontWeight: '700',
    marginTop: 2
  },

  /* Action Buttons */
  actionContainer: {
    marginTop: 2
  },
  offerButton: {
    backgroundColor: '#059669',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#059669',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 3
  },
  offerButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800'
  },
  ownerPill: {
    backgroundColor: '#1e293b',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155'
  },
  ownerPillText: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '700'
  },

  /* Modals */
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    padding: 16
  },
  detailCard: {
    backgroundColor: '#111827',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#1e293b',
    maxHeight: '85%'
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b'
  },
  detailCropName: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '900'
  },
  closeIconBtn: {
    padding: 6
  },
  closeIconText: {
    color: '#94a3b8',
    fontSize: 16,
    fontWeight: 'bold'
  },
  detailImage: {
    width: '100%',
    height: 160,
    borderRadius: 12,
    marginBottom: 6
  },
  specTable: {
    backgroundColor: '#0a0f1d',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#1e293b',
    gap: 6
  },
  specRow: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  specTitle: {
    color: '#94a3b8',
    fontSize: 12
  },
  specValue: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600'
  },
  descBox: {
    backgroundColor: '#0a0f1d',
    borderRadius: 10,
    padding: 10,
    marginTop: 4
  },
  descTitle: {
    color: '#34d399',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 2
  },
  descText: {
    color: '#cbd5e1',
    fontSize: 12,
    fontStyle: 'italic',
    lineHeight: 16
  },
  closeModalButton: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 10
  },
  closeModalButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700'
  },

  /* Offer Modal */
  offerModalContainer: {
    backgroundColor: '#111827',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)'
  },
  offerModalSub: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 2
  },
  inputHeading: {
    color: '#cbd5e1',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 4
  },
  modalField: {
    backgroundColor: '#0a0f1d',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#ffffff',
    fontSize: 13
  },
  escrowCalcBox: {
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
    borderRadius: 10,
    padding: 10,
    gap: 4
  },
  cancelOfferBtn: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center'
  },
  cancelOfferText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700'
  },
  submitOfferBtn: {
    flex: 2,
    backgroundColor: '#059669',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center'
  },
  submitOfferText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800'
  }
});
