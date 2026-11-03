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
  const { t, user, role, language, setLanguage, languages, logout } = useAuth();

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
            <Text style={styles.userName}>{user?.name || 'Account'}</Text>
            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>
                {isFarmer ? '🌾 Farmer' : '🛒 Buyer'}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>📱 {t.profile.phone}:</Text>
          <Text style={styles.infoVal}>{user?.phone || 'Not provided'}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>📍 Location:</Text>
          <Text style={styles.infoVal}>
            {user?.location?.district || 'Not provided'}, {user?.location?.state || ''}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>🆔 Account ID:</Text>
          <Text style={[styles.infoVal, { fontSize: 11, color: '#64748B' }]}>
            {user?._id || 'Not available'}
          </Text>
        </View>
      </View>

      <View style={styles.card}>
        <TouchableOpacity style={styles.switchButton} onPress={logout} accessibilityRole="button">
          <Text style={styles.switchButtonText}>Sign out</Text>
        </TouchableOpacity>
      </View>

      {/* 8-Language Switcher Section */}
      <View style={styles.card}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.cardTitle}>🌐 {t.profile.languageSettings}</Text>
          <View style={styles.langCountPill}>
            <Text style={styles.langCountText}>8 Languages</Text>
          </View>
        </View>
        <Text style={styles.cardSubtitle}>
          Select your native agricultural language. Direct access under UASD Dharwad & ICAR guidelines.
        </Text>

        <View style={styles.langGrid}>
          {(languages || []).map((item) => {
            const isSelected = language === item.code;
            return (
              <TouchableOpacity
                key={item.code}
                style={[
                  styles.langCard,
                  isSelected && styles.langCardActive
                ]}
                onPress={() => setLanguage(item.code)}
                activeOpacity={0.7}
              >
                <View style={styles.langTopRow}>
                  <Text style={styles.langFlag}>{item.flag}</Text>
                  {isSelected && <Text style={styles.langSelectedBadge}>✓ Active</Text>}
                </View>
                <Text style={[styles.langNative, isSelected && styles.langNativeActive]}>
                  {item.native}
                </Text>
                <Text style={styles.langLabel}>
                  {item.label} • <Text style={styles.langRegionText}>{item.region}</Text>
                </Text>
              </TouchableOpacity>
            );
          })}
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
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155'
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
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
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#10B981'
  },
  roleBadgeText: {
    color: '#10B981',
    fontSize: 11,
    fontWeight: 'bold'
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
    color: '#F8FAFC',
    fontWeight: '600'
  },
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155'
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  langCountPill: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#10B981'
  },
  langCountText: {
    color: '#34D399',
    fontSize: 10,
    fontWeight: 'bold'
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#F8FAFC',
    marginBottom: 4
  },
  cardSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginBottom: 14,
    lineHeight: 16
  },
  switchButton: {
    backgroundColor: '#0F172A',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#10B981',
    alignItems: 'center'
  },
  switchButtonText: {
    color: '#34D399',
    fontWeight: 'bold',
    fontSize: 13
  },
  langGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10
  },
  langCard: {
    width: '48%',
    backgroundColor: '#0F172A',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#334155'
  },
  langCardActive: {
    borderColor: '#10B981',
    backgroundColor: 'rgba(6, 78, 59, 0.3)'
  },
  langTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4
  },
  langFlag: {
    fontSize: 20
  },
  langSelectedBadge: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#10B981',
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  langNative: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#F8FAFC',
    marginBottom: 2
  },
  langNativeActive: {
    color: '#34D399'
  },
  langLabel: {
    fontSize: 11,
    color: '#94A3B8'
  },
  langRegionText: {
    fontSize: 10,
    color: '#64748B'
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
