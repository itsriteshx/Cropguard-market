import React, { useState, useEffect, useRef } from 'react';
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
  Image
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { apiRequest, resolveMediaUrl } from '../config/api';

const CATEGORIES = ['ALL', 'VEGETABLES', 'GRAINS', 'PULSES', 'FRUITS', 'OILSEEDS', 'SPICES', 'OTHER'];

export default function MarketplaceScreen({ onNavigateToNegotiations }) {
  const { t, token, user, role } = useAuth();

  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState('');
  const requestId = useRef(0);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Offer Modal State
  const [selectedListing, setSelectedListing] = useState(null);
  const [listingDetails, setListingDetails] = useState(null);
  const [offerPrice, setOfferPrice] = useState('');
  const [offerQuantity, setOfferQuantity] = useState('');
  const [offerNote, setOfferNote] = useState('');
  const [submittingOffer, setSubmittingOffer] = useState(false);

  useEffect(() => {
    fetchListings(1);
    return () => { requestId.current += 1; };
  }, [selectedCategory, debouncedSearch]);

  const fetchListings = async (nextPage = 1, refresh = false) => {
    const id = ++requestId.current;
    if (nextPage > 1) setLoadingMore(true);
    else if (refresh) setRefreshing(true);
    else setLoading(true);
    setLoadError('');
    const params = [`status=AVAILABLE`, `page=${nextPage}`, 'limit=10'];
    if (selectedCategory !== 'ALL') params.push(`category=${encodeURIComponent(selectedCategory)}`);
    if (debouncedSearch) params.push(`search=${encodeURIComponent(debouncedSearch)}`);
    const res = await apiRequest(`/listings?${params.join('&')}`);
    if (id !== requestId.current) return;
    if (res.success && Array.isArray(res.listings)) {
      setListings((previous) => nextPage === 1 ? res.listings : [...previous, ...res.listings.filter((item) => !previous.some((old) => old._id === item._id))]);
      setPage(res.page);
      setPages(res.pages);
    } else {
      if (nextPage === 1) setListings([]);
      setLoadError(res.message || 'Could not load listings. Please try again.');
    }
    setLoading(false);
    setLoadingMore(false);
    setRefreshing(false);
  };

  const onRefresh = () => fetchListings(1, true);

  const handleOpenOfferModal = (listing) => {
    setSelectedListing(listing);
    setOfferPrice(listing.pricePerUnit ? String(listing.pricePerUnit) : '');
    setOfferQuantity(listing.quantity ? String(listing.quantity) : '100');
    setOfferNote('');
  };

  const handleSubmitOffer = async () => {
    if (submittingOffer) return;
    const price = Number(offerPrice);
    const quantity = Number(offerQuantity);
    if (!offerPrice.trim() || !Number.isFinite(price) || price < 0.1) {
      Alert.alert('Invalid price', 'Enter a price of at least ₹0.10.');
      return;
    }
    if (!offerQuantity.trim() || !Number.isFinite(quantity) || quantity < 1 || quantity > selectedListing.quantity) {
      Alert.alert('Invalid quantity', `Enter a quantity of at least 1 and no more than ${selectedListing.quantity} ${selectedListing.unit}.`);
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
    if (res.success) {
      Alert.alert(
        'Offer Sent! 🎉',
        `Your offer of ₹${offerPrice}/${selectedListing.unit || 'Kg'} for ${offerQuantity} ${selectedListing.unit || 'Kg'} was sent to farmer ${selectedListing.farmer?.name || ''}.`,
        [
          {
            text: 'View in Bargaining Room',
            onPress: () => {
              setSelectedListing(null);
              if (onNavigateToNegotiations) onNavigateToNegotiations();
            }
          },
          { text: 'Done', onPress: () => setSelectedListing(null) }
        ]
      );
    } else {
      Alert.alert('Notice', res.message || 'Could not submit offer');
    }
  };

  const renderListingItem = ({ item }) => {
    const isOwner = user && item.farmer && String(item.farmer._id) === String(user._id);

    return (
      <View style={styles.card}>
        {item.images?.[0] ? <Image source={{ uri: resolveMediaUrl(item.images[0]) }} style={styles.listingImage} accessibilityLabel={`${item.cropName} produce photo`} /> : null}
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.cropName}>{item.cropName}</Text>
            <Text style={styles.categoryBadge}>{item.category} • {item.qualityGrade || 'GRADE_A'}</Text>
          </View>
          <View style={styles.priceContainer}>
            <Text style={styles.priceAmount}>₹{item.pricePerUnit}</Text>
            <Text style={styles.priceUnit}>/{item.unit || 'Kg'}</Text>
          </View>
        </View>

        <View style={styles.cardBody}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>📦 {t.market.quantityAvailable}:</Text>
            <Text style={styles.infoValue}>{item.quantity} {item.unit || 'Kg'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>👨‍🌾 {t.market.seller}:</Text>
            <Text style={styles.infoValue}>{item.farmer?.name || 'Local Farmer'} {item.farmer?.isVerified ? '✔' : ''}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>📍 {t.market.location}:</Text>
            <Text style={styles.infoValue}>
              {[item.location?.village, item.location?.district, item.location?.state].filter(Boolean).join(', ') || 'Location not provided'}
            </Text>
          </View>
          {item.description ? (
            <Text style={styles.descriptionText}>"{item.description}"</Text>
          ) : null}
        </View>

        <View style={styles.cardFooter}>
          <TouchableOpacity style={styles.detailsButton} onPress={() => setListingDetails(item)} accessibilityRole="button"><Text style={styles.detailsButtonText}>View listing details</Text></TouchableOpacity>
          {isOwner ? (
            <View style={styles.ownListingBadge}>
              <Text style={styles.ownListingText}>🌾 Your Active Harvest Listing</Text>
            </View>
          ) : !['BUYER_RETAIL', 'BUYER_WHOLESALE'].includes(role) ? null : (
            <TouchableOpacity
              style={styles.offerButton}
              onPress={() => handleOpenOfferModal(item)}
            >
              <Text style={styles.offerButtonText}>🤝 {t.market.makeOffer}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t.market.title}</Text>
        <Text style={styles.headerSubtitle}>{t.market.subtitle}</Text>
        <TextInput
          style={styles.searchInput}
          placeholder={t.market.searchPlaceholder}
          placeholderTextColor="#94A3B8"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Category Pills */}
      <View style={styles.categoryContainer}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={CATEGORIES}
          keyExtractor={(item) => item}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.categoryPill,
                selectedCategory === item && styles.categoryPillActive
              ]}
              onPress={() => setSelectedCategory(item)}
            >
              <Text
                style={[
                  styles.categoryPillText,
                  selectedCategory === item && styles.categoryPillTextActive
                ]}
              >
                {item === 'ALL' ? t.market.allCategories : item}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* Produce List */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#10B981" />
          <Text style={styles.loadingText}>{t.common.loading}</Text>
        </View>
      ) : (
        <FlatList
          data={listings}
          keyExtractor={(item) => item._id}
          renderItem={renderListingItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#10B981"
            />
          }
          ListFooterComponent={
            <View style={styles.listFooter}>
              {!!loadError && <Text style={styles.emptyText}>{loadError}</Text>}
              {(loadError || page < pages) && <TouchableOpacity style={styles.photoRetry} onPress={() => fetchListings(loadError && listings.length === 0 ? 1 : page + 1)} disabled={loadingMore} accessibilityRole="button"><Text style={styles.offerButtonText}>{loadingMore ? 'Loading…' : loadError ? 'Try again' : 'Load more'}</Text></TouchableOpacity>}
            </View>
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyEmoji}>🌾</Text>
              <Text style={styles.emptyText}>{loadError ? 'Unable to load the marketplace.' : t.market.noListings}</Text>
            </View>
          }
        />
      )}

      <Modal visible={!!listingDetails} transparent animationType="slide" onRequestClose={() => setListingDetails(null)}>
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modalCard} contentContainerStyle={styles.detailsContent}>
            <Text style={styles.modalTitle}>{listingDetails?.cropName}</Text>
            {listingDetails?.images?.[0] && <Image source={{ uri: resolveMediaUrl(listingDetails.images[0]) }} style={styles.detailsImage} accessibilityLabel={`${listingDetails.cropName} produce photo`} />}
            <Text style={styles.detailText}>Category: {listingDetails?.category}</Text>
            <Text style={styles.detailText}>Quality: {listingDetails?.qualityGrade || 'Not provided'}</Text>
            <Text style={styles.detailText}>Available: {listingDetails?.quantity} {listingDetails?.unit}</Text>
            <Text style={styles.detailText}>Asking price: ₹{listingDetails?.pricePerUnit} / {listingDetails?.unit}</Text>
            <Text style={styles.detailText}>Seller: {listingDetails?.farmer?.name || 'Not provided'}</Text>
            <Text style={styles.detailText}>Location: {[listingDetails?.location?.village, listingDetails?.location?.district, listingDetails?.location?.state].filter(Boolean).join(', ') || 'Not provided'}</Text>
            <Text style={styles.detailText}>Harvest date: {listingDetails?.harvestDate ? new Date(listingDetails.harvestDate).toLocaleDateString('en-IN') : 'Not provided'}</Text>
            <Text style={styles.detailText}>Description: {listingDetails?.description || 'Not provided'}</Text>
            <TouchableOpacity style={styles.confirmButton} onPress={() => setListingDetails(null)} accessibilityRole="button"><Text style={styles.confirmButtonText}>Close</Text></TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* Make Offer Modal */}
      <Modal
        visible={!!selectedListing}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedListing(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t.market.offerModalTitle}</Text>
            <Text style={styles.modalSubtitle}>
              {selectedListing?.cropName} • Farmer Asking: ₹{selectedListing?.pricePerUnit}/{selectedListing?.unit}
            </Text>

            <Text style={styles.inputLabel}>{t.market.offerPriceLabel}</Text>
            <TextInput
              style={styles.modalInput}
              keyboardType="numeric"
              placeholder="e.g. 23"
              placeholderTextColor="#64748B"
              value={offerPrice}
              onChangeText={setOfferPrice}
            />

            <Text style={styles.inputLabel}>{t.market.offerQtyLabel}</Text>
            <TextInput
              style={styles.modalInput}
              keyboardType="numeric"
              placeholder="e.g. 100"
              placeholderTextColor="#64748B"
              value={offerQuantity}
              onChangeText={setOfferQuantity}
            />

            <Text style={styles.inputLabel}>{t.market.offerNoteLabel}</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. Immediate pickup with cash/UPI escrow"
              placeholderTextColor="#64748B"
              value={offerNote}
              onChangeText={setOfferNote}
            />

            <View style={styles.modalActionRow}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setSelectedListing(null)}
              >
                <Text style={styles.cancelButtonText}>{t.common.cancel}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.confirmButton}
                onPress={handleSubmitOffer}
                disabled={submittingOffer}
              >
                {submittingOffer ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.confirmButtonText}>{t.market.submitOfferBtn}</Text>
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
  detailsButton: { borderColor: '#10B981', borderWidth: 1, borderRadius: 8, paddingVertical: 10, alignItems: 'center', marginBottom: 8 },
  detailsButtonText: { color: '#6EE7B7', fontWeight: '600' },
  detailsContent: { gap: 12 },
  detailsImage: { width: '100%', height: 180, borderRadius: 8 },
  detailText: { color: '#E2E8F0', fontSize: 14 },
  listFooter: { alignItems: 'center', gap: 8, paddingBottom: 20 },
  photoRetry: { backgroundColor: '#10B981', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8 },
  listingImage: { width: '100%', height: 160, backgroundColor: '#1E293B' },
  container: {
    flex: 1,
    backgroundColor: '#0F172A'
  },
  header: {
    padding: 16,
    paddingTop: 10,
    backgroundColor: '#1E293B',
    borderBottomWidth: 1,
    borderBottomColor: '#334155'
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#10B981'
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 2,
    marginBottom: 10
  },
  searchInput: {
    backgroundColor: '#0F172A',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#334155',
    fontSize: 14
  },
  categoryContainer: {
    paddingVertical: 10,
    backgroundColor: '#1E293B'
  },
  categoryPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#0F172A',
    marginHorizontal: 5,
    borderWidth: 1,
    borderColor: '#334155'
  },
  categoryPillActive: {
    backgroundColor: '#10B981',
    borderColor: '#10B981'
  },
  categoryPillText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600'
  },
  categoryPillTextActive: {
    color: '#0F172A',
    fontWeight: 'bold'
  },
  listContent: {
    padding: 14
  },
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#334155'
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    paddingBottom: 10
  },
  cropName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#F8FAFC'
  },
  categoryBadge: {
    fontSize: 11,
    color: '#38BDF8',
    marginTop: 2,
    fontWeight: '600'
  },
  priceContainer: {
    alignItems: 'flex-end'
  },
  priceAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#10B981'
  },
  priceUnit: {
    fontSize: 11,
    color: '#94A3B8'
  },
  cardBody: {
    paddingVertical: 10
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 2
  },
  infoLabel: {
    fontSize: 13,
    color: '#94A3B8'
  },
  infoValue: {
    fontSize: 13,
    color: '#E2E8F0',
    fontWeight: '500'
  },
  descriptionText: {
    fontSize: 12,
    color: '#CBD5E1',
    fontStyle: 'italic',
    marginTop: 6
  },
  cardFooter: {
    marginTop: 8
  },
  offerButton: {
    backgroundColor: '#10B981',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center'
  },
  offerButtonText: {
    color: '#0F172A',
    fontWeight: 'bold',
    fontSize: 14
  },
  ownListingBadge: {
    backgroundColor: '#334155',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center'
  },
  ownListingText: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '600'
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  loadingText: {
    color: '#94A3B8',
    marginTop: 10,
    fontSize: 14
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 40
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 10
  },
  emptyText: {
    color: '#94A3B8',
    fontSize: 14,
    textAlign: 'center'
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: 20
  },
  modalCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#10B981'
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#10B981',
    marginBottom: 4
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    marginBottom: 16
  },
  inputLabel: {
    color: '#CBD5E1',
    fontSize: 12,
    marginBottom: 4,
    fontWeight: '600'
  },
  modalInput: {
    backgroundColor: '#0F172A',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 12,
    fontSize: 14
  },
  modalActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 10
  },
  cancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 10
  },
  cancelButtonText: {
    color: '#94A3B8',
    fontWeight: '600'
  },
  confirmButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8
  },
  confirmButtonText: {
    color: '#0F172A',
    fontWeight: 'bold'
  }
});
