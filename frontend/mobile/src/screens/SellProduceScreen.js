import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../config/api';

const CATEGORIES = [
  'VEGETABLES',
  'GRAINS',
  'PULSES',
  'FRUITS',
  'OILSEEDS',
  'SPICES'
];

const UNITS = ['KG', 'QUINTAL'];
const QUALITY_GRADES = ['GRADE_A', 'GRADE_B', 'ORGANIC'];

export default function SellProduceScreen({ onNavigateToMarket }) {
  const { t, token, user } = useAuth();

  const [cropName, setCropName] = useState('');
  const [category, setCategory] = useState('VEGETABLES');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('KG');
  const [pricePerUnit, setPricePerUnit] = useState('');
  const [qualityGrade, setQualityGrade] = useState('GRADE_A');
  const [description, setDescription] = useState('');

  // Mandi Benchmark State
  const [mandiBenchmark, setMandiBenchmark] = useState(null);
  const [loadingBenchmark, setLoadingBenchmark] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Auto-check Mandi rates when crop name changes
  useEffect(() => {
    const trimmed = cropName.trim();
    if (trimmed.length >= 3) {
      const timer = setTimeout(() => {
        fetchMandiBenchmark(trimmed);
      }, 500);
      return () => clearTimeout(timer);
    } else {
      setMandiBenchmark(null);
    }
  }, [cropName]);

  const fetchMandiBenchmark = async (commodity) => {
    setLoadingBenchmark(true);
    const district = user?.location?.district || 'DHARWAD';
    const res = await apiRequest(
      `/mandi-rates/benchmark?commodity=${encodeURIComponent(commodity)}&district=${encodeURIComponent(district)}`
    );
    if (res.success && res.farmerPriceGuidance) {
      setMandiBenchmark(res);
      // If price not entered yet, auto-suggest the recommended asking price!
      if (!pricePerUnit) {
        setPricePerUnit(String(res.farmerPriceGuidance.modalRatePerKg));
      }
    } else {
      setMandiBenchmark(null);
    }
    setLoadingBenchmark(false);
  };

  const handleSubmitListing = async () => {
    if (!cropName.trim() || !quantity || !pricePerUnit) {
      Alert.alert('Required Fields', 'Please fill in crop name, quantity, and your asking price.');
      return;
    }

    setSubmitting(true);
    const res = await apiRequest(
      '/listings',
      {
        method: 'POST',
        body: JSON.stringify({
          cropName: cropName.trim(),
          category,
          quantity: parseFloat(quantity),
          unit,
          pricePerUnit: parseFloat(pricePerUnit),
          qualityGrade,
          description: description.trim(),
          location: user?.location || {
            type: 'Point',
            coordinates: [75.0084, 15.3647],
            village: 'Navalgund',
            district: 'Dharwad',
            state: 'Karnataka',
            pincode: '580029'
          }
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
          <Text style={styles.benchmarkLoadingText}>Checking live APMC Mandi rates...</Text>
        </View>
      ) : mandiBenchmark ? (
        <View style={styles.benchmarkCard}>
          <View style={styles.benchmarkHeaderRow}>
            <Text style={styles.benchmarkBadge}>📊 {t.sell.mandiBenchmarkTitle}</Text>
            <Text style={styles.benchmarkYardText}>{mandiBenchmark.marketCenter}</Text>
          </View>
          <Text style={styles.benchmarkRatesText}>
            Market Average: <Text style={styles.benchmarkHighlight}>₹{mandiBenchmark.farmerPriceGuidance.modalRatePerKg}/kg</Text>
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
        />

        {/* Quick Crop Suggestions */}
        <View style={styles.suggestionRow}>
          {['Tomato', 'Onion', 'Wheat', 'Chilli', 'Cotton'].map((c) => (
            <TouchableOpacity
              key={c}
              style={styles.suggestionChip}
              onPress={() => setCropName(c)}
            >
              <Text style={styles.suggestionText}>+ {c}</Text>
            </TouchableOpacity>
          ))}
        </View>

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
                  onPress={() => setUnit(u)}
                >
                  <Text style={[styles.unitBtnText, unit === u && styles.unitBtnTextActive]}>
                    {u}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
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
        />

        {/* Publish Button */}
        <TouchableOpacity
          style={styles.publishButton}
          onPress={handleSubmitListing}
          disabled={submitting}
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
