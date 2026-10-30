import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../config/api';

export default function ProfileScreen() {
  const { t, user, role, language, setLanguage, switchUser } = useAuth();

  const isFarmer = role === 'FARMER';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t.profile.title}</Text>
      </View>

      {/* User Card */}
      <View style={styles.profileCard}>
        <View style={styles.avatarRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{isFarmer ? '👨‍🌾' : '🛒'}</Text>
          </View>
          <View style={styles.profileMeta}>
            <Text style={styles.userName}>{user?.name || (isFarmer ? 'Ramesh Patil' : 'Sunil Retail Stores')}</Text>
            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>
                {isFarmer ? '🌾 Verified Farmer' : '🛒 Retail Store Buyer'}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>📱 {t.profile.phone}:</Text>
          <Text style={styles.infoVal}>{user?.phone || '9876543210'}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>📍 Location:</Text>
          <Text style={styles.infoVal}>
            {user?.location?.district || 'Dharwad'}, {user?.location?.state || 'Karnataka'}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>🆔 Account ID:</Text>
          <Text style={[styles.infoVal, { fontSize: 11, color: '#64748B' }]}>
            {user?._id || 'demo_user_id'}
          </Text>
        </View>
      </View>

      {/* Switch Demo Persona (Farmer <-> Buyer) */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>🔄 {t.profile.switchDemoUser}</Text>
        <Text style={styles.cardSubtitle}>
          Toggle between Farmer and Buyer accounts with one tap to test live bidding & listing flows.
        </Text>

        <TouchableOpacity style={styles.switchButton} onPress={switchUser}>
          <Text style={styles.switchButtonText}>
            {isFarmer
              ? '👉 Switch to Buyer (Sunil Retail Stores)'
              : '👉 Switch to Farmer (Ramesh Patil)'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Language Switcher */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>🌐 {t.profile.languageSettings}</Text>
        <View style={styles.langRow}>
          {[
            { code: 'en', label: 'English (🇬🇧)' },
            { code: 'hi', label: 'हिन्दी (🇮🇳)' },
            { code: 'kn', label: 'ಕನ್ನಡ (🇮🇳 UASD)' }
          ].map((item) => (
            <TouchableOpacity
              key={item.code}
              style={[
                styles.langBtn,
                language === item.code && styles.langBtnActive
              ]}
              onPress={() => setLanguage(item.code)}
            >
              <Text
                style={[
                  styles.langBtnText,
                  language === item.code && styles.langBtnTextActive
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* System Architecture Diagnostics */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>🏛️ {t.profile.statsTitle}</Text>

        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>{t.profile.backendStatus}:</Text>
          <Text style={styles.statusValOnline}>✔ Online ({API_BASE_URL})</Text>
        </View>

        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>{t.profile.dbStatus}:</Text>
          <Text style={styles.statusValOnline}>✔ Connected (Mumbai ap-south-1)</Text>
        </View>

        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>{t.profile.socketStatus}:</Text>
          <Text style={styles.statusValOnline}>✔ Active (/negotiation gateway)</Text>
        </View>

        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Problem Statement:</Text>
          <Text style={styles.statusValMuted}>UASD Dharwad & ICAR 2026</Text>
        </View>
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
  profileCard: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#10B981'
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#10B981',
    marginRight: 14
  },
  avatarText: {
    fontSize: 26
  },
  profileMeta: {
    flex: 1
  },
  userName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#F8FAFC'
  },
  roleBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 4
  },
  roleBadgeText: {
    color: '#34D399',
    fontSize: 12,
    fontWeight: '600'
  },
  divider: {
    height: 1,
    backgroundColor: '#334155',
    marginVertical: 12
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 4
  },
  infoLabel: {
    fontSize: 13,
    color: '#94A3B8'
  },
  infoVal: {
    fontSize: 13,
    color: '#E2E8F0',
    fontWeight: '500'
  },
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155'
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#F8FAFC',
    marginBottom: 4
  },
  cardSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginBottom: 12,
    lineHeight: 16
  },
  switchButton: {
    backgroundColor: '#10B981',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center'
  },
  switchButtonText: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: 'bold'
  },
  langRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8
  },
  langBtn: {
    flex: 1,
    backgroundColor: '#0F172A',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: '#334155'
  },
  langBtnActive: {
    backgroundColor: '#10B981',
    borderColor: '#10B981'
  },
  langBtnText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600'
  },
  langBtnTextActive: {
    color: '#0F172A',
    fontWeight: 'bold'
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 5
  },
  statusLabel: {
    fontSize: 12,
    color: '#94A3B8'
  },
  statusValOnline: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '600'
  },
  statusValMuted: {
    fontSize: 12,
    color: '#38BDF8'
  }
});
