import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TextInput,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  RefreshControl,
  Alert
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../config/api';

const CATEGORIES = ['ALL', 'VEGETABLES', 'GRAINS', 'PULSES', 'FRUITS', 'OILSEEDS', 'SPICES'];

export default function MarketplaceScreen({ onNavigateToNegotiations }) {
  const { t, token, user, role } = useAuth();

  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Offer Modal State
  const [selectedListing, setSelectedListing] = useState(null);
  const [offerPrice, setOfferPrice] = useState('');
  const [offerQuantity, setOfferQuantity] = useState('');
  const [offerNote, setOfferNote] = useState('');
  const [submittingOffer, setSubmittingOffer] = useState(false);

  useEffect(() => {
    fetchListings();
  }, [selectedCategory]);

  const fetchListings = async () => {
    setLoading(true);
    let endpoint = '/listings?status=AVAILABLE';
    if (selectedCategory !== 'ALL') {
      endpoint += `&category=${selectedCategory}`;
    }
    const res = await apiRequest(endpoint);
    if (res.success && res.listings) {
      setListings(res.listings);
    } else {
      setListings([]);
    }
    setLoading(false);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchListings();
    setRefreshing(false);
  };

  const filteredListings = listings.filter((item) => {
    if (!searchQuery) return true;
    const nameMatch = item.cropName?.toLowerCase().includes(searchQuery.toLowerCase());
    const locMatch = item.location?.district?.toLowerCase().includes(searchQuery.toLowerCase());
    return nameMatch || locMatch;
  });

  const handleOpenOfferModal = (listing) => {
    setSelectedListing(listing);
    setOfferPrice(listing.pricePerUnit ? String(listing.pricePerUnit) : '');
    setOfferQuantity(listing.quantity ? String(listing.quantity) : '100');
    setOfferNote('');
  };

  const handleSubmitOffer = async () => {
    if (!offerPrice || !offerQuantity) {
      Alert.alert('Required', 'Please enter offer price and quantity');
      return;
    }

    setSubmittingOffer(true);
    const res = await apiRequest(
      '/negotiations',
      {
        method: 'POST',
        body: JSON.stringify({
          listingId: selectedListing._id,
          offeredPrice: parseFloat(offerPrice),
          quantity: parseFloat(offerQuantity),
          note: offerNote || `Direct purchase offer on ${selectedListing.cropName}`
        })
      },
      token
    );

    setSubmittingOffer(false);
    if (res.success) {
      Alert.alert(
        'Offer Sent! 🎉',
        `Your offer of ₹${offerPrice}/kg for ${offerQuantity} ${selectedListing.unit || 'Kg'} was sent to farmer ${selectedListing.farmer?.name || ''}.`,
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
              {item.location?.village ? `${item.location.village}, ` : ''}{item.location?.district || 'Dharwad'}, {item.location?.state || 'Karnataka'}
            </Text>
          </View>
          {item.description ? (
            <Text style={styles.descriptionText}>"{item.description}"</Text>
          ) : null}
        </View>

        <View style={styles.cardFooter}>
          {isOwner ? (
            <View style={styles.ownListingBadge}>
              <Text style={styles.ownListingText}>🌾 Your Active Harvest Listing</Text>
            </View>
          ) : (
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
          data={filteredListings}
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
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyEmoji}>🌾</Text>
              <Text style={styles.emptyText}>{t.market.noListings}</Text>
            </View>
          }
        />
      )}

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
