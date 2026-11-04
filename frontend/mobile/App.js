import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  TouchableOpacity,
  Modal,
  ScrollView,
  Platform,
  ActivityIndicator
} from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { AuthProvider, useAuth } from './src/context/AuthContext';
import { SocketProvider, useSocket } from './src/context/SocketContext';
import MarketplaceScreen from './src/screens/MarketplaceScreen';
import SellProduceScreen from './src/screens/SellProduceScreen';
import NegotiationsScreen from './src/screens/NegotiationsScreen';
import LedgerScreen from './src/screens/LedgerScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import AuthScreen from './src/screens/AuthScreen';

function MainApp() {
  const { t, role, language, setLanguage, languages, user, restoring, restoreError, restoreSession, logout } = useAuth();
  const { isConnected } = useSocket();
  const [activeTab, setActiveTab] = useState('MARKET');
  const [langModalVisible, setLangModalVisible] = useState(false);

  if (restoring) return <View style={styles.restoreScreen}><ActivityIndicator size="large" color="#10B981" /><Text style={styles.restoreText}>Restoring your session…</Text></View>;
  if (restoreError) return <View style={styles.restoreScreen}><Text style={styles.restoreText}>{restoreError}</Text><TouchableOpacity onPress={restoreSession}><Text style={styles.restoreAction}>Try again</Text></TouchableOpacity><TouchableOpacity onPress={async () => { const result = await logout(); if (!result.success) restoreSession(); }}><Text style={styles.restoreAction}>Sign out</Text></TouchableOpacity></View>;
  if (!user) return <AuthScreen />;

  const isFarmer = role === 'FARMER';
  const currentLangMeta = (languages || []).find((l) => l.code === language) || {
    flag: '🌐',
    native: 'English',
    code: 'en'
  };

  const renderActiveScreen = () => {
    switch (activeTab) {
      case 'MARKET':
        return <MarketplaceScreen onNavigateToNegotiations={() => setActiveTab('NEGOTIATIONS')} />;
      case 'SELL':
        return <SellProduceScreen onNavigateToMarket={() => setActiveTab('MARKET')} />;
      case 'NEGOTIATIONS':
        return <NegotiationsScreen />;
      case 'LEDGER':
        return <LedgerScreen />;
      case 'PROFILE':
        return <ProfileScreen />;
      default:
        return <MarketplaceScreen onNavigateToNegotiations={() => setActiveTab('NEGOTIATIONS')} />;
    }
  };

  const navItems = [
    { key: 'MARKET', icon: '🌾', label: t.tabs.market },
    { key: 'SELL', icon: '➕', label: t.tabs.sell },
    { key: 'NEGOTIATIONS', icon: '💬', label: t.tabs.negotiations },
    { key: 'LEDGER', icon: '📒', label: t.tabs.ledger },
    { key: 'PROFILE', icon: '👤', label: t.tabs.profile }
  ];

  return (
    <SafeAreaView style={styles.safeContainer}>
      <StatusBar style="light" backgroundColor="#0F172A" />

      {/* Top Navbar */}
      <View style={styles.topNavbar}>
        <View style={styles.brandRow}>
          <Text style={styles.brandEmoji}>🌾</Text>
          <View>
            <Text style={styles.brandText}>CropGuard Market</Text>
            <Text style={styles.subBrandText}>UASD Dharwad • Direct Access</Text>
          </View>
        </View>

        {/* Status Pills */}
        <View style={styles.navActionsRow}>
          {/* Live Socket Status Beacon */}
          <View style={[styles.socketBadge, isConnected ? styles.socketOnline : styles.socketOffline]}>
            <View style={[styles.socketDot, isConnected ? styles.socketDotOnline : styles.socketDotOffline]} />
            <Text style={[styles.socketText, isConnected ? styles.socketTextOnline : styles.socketTextOffline]}>
              {isConnected ? 'Live' : 'Syncing'}
            </Text>
          </View>

          {/* Multilingual Selector Pill (Opens 8-Language Modal) */}
          <TouchableOpacity
            style={styles.langPill}
            onPress={() => setLangModalVisible(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.langPillText}>
              {currentLangMeta.flag} {language.toUpperCase()} ▾
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Screen Content */}
      <View style={styles.mainContent}>
        {renderActiveScreen()}
      </View>

      {/* Bottom Navigation Bar */}
      <View style={styles.bottomTabBar}>
        {navItems.map((item) => {
          const isActive = activeTab === item.key;
          return (
            <TouchableOpacity
              key={item.key}
              style={[styles.tabButton, isActive && styles.tabButtonActive]}
              onPress={() => setActiveTab(item.key)}
            >
              <Text style={styles.tabIcon}>{item.icon}</Text>
              <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* 8-Language Selection Modal */}
      <Modal
        visible={langModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setLangModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.langModalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>🌐 Select Platform Language</Text>
                <Text style={styles.modalSubtitle}>8 Agricultural Languages (UASD / ICAR)</Text>
              </View>
              <TouchableOpacity
                onPress={() => setLangModalVisible(false)}
                style={styles.modalCloseBtn}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.langModalScroll}>
              {(languages || []).map((lang) => {
                const isSelected = language === lang.code;
                return (
                  <TouchableOpacity
                    key={lang.code}
                    style={[
                      styles.langOptionCard,
                      isSelected && styles.langOptionCardActive
                    ]}
                    onPress={() => {
                      setLanguage(lang.code);
                      setLangModalVisible(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={styles.langOptionLeft}>
                      <Text style={styles.langOptionFlag}>{lang.flag}</Text>
                      <View>
                        <Text style={[styles.langOptionNative, isSelected && styles.langOptionNativeActive]}>
                          {lang.native}
                        </Text>
                        <Text style={styles.langOptionSub}>
                          {lang.label} • {lang.region}
                        </Text>
                      </View>
                    </View>

                    {isSelected && (
                      <View style={styles.selectedPill}>
                        <Text style={styles.selectedPillText}>✓ Selected</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <MainApp />
      </SocketProvider>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  restoreScreen: { flex: 1, backgroundColor: '#0F172A', justifyContent: 'center', alignItems: 'center', padding: 24, gap: 16 },
  restoreText: { color: '#F8FAFC', textAlign: 'center' },
  restoreAction: { color: '#34D399', fontSize: 16, padding: 8 },
  safeContainer: {
    flex: 1,
    backgroundColor: '#0F172A',
    paddingTop: Platform.OS === 'android' ? 30 : 0
  },
  topNavbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B'
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  brandEmoji: {
    fontSize: 24,
    marginRight: 8
  },
  brandText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#10B981'
  },
  subBrandText: {
    fontSize: 10,
    color: '#64748B'
  },
  navActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  socketBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1
  },
  socketOnline: {
    backgroundColor: 'rgba(6, 78, 59, 0.4)',
    borderColor: '#059669'
  },
  socketOffline: {
    backgroundColor: 'rgba(120, 53, 15, 0.3)',
    borderColor: '#D97706'
  },
  socketDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4
  },
  socketDotOnline: {
    backgroundColor: '#10B981'
  },
  socketDotOffline: {
    backgroundColor: '#F59E0B'
  },
  socketText: {
    fontSize: 10,
    fontWeight: '700'
  },
  socketTextOnline: {
    color: '#34D399'
  },
  socketTextOffline: {
    color: '#FBBF24'
  },
  personaPill: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#334155'
  },
  personaPillText: {
    color: '#34D399',
    fontSize: 11,
    fontWeight: '600'
  },
  langPill: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#10B981'
  },
  langPillText: {
    color: '#34D399',
    fontSize: 11,
    fontWeight: 'bold'
  },
  mainContent: {
    flex: 1,
    backgroundColor: '#0F172A'
  },
  bottomTabBar: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    borderTopWidth: 1,
    borderTopColor: '#334155',
    paddingVertical: 6,
    paddingHorizontal: 4
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
    borderRadius: 8
  },
  tabButtonActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)'
  },
  tabIcon: {
    fontSize: 18,
    marginBottom: 2
  },
  tabLabel: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '500'
  },
  tabLabelActive: {
    color: '#10B981',
    fontWeight: 'bold'
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end'
  },
  langModalCard: {
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: '#334155'
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    paddingBottom: 12
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#F8FAFC'
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2
  },
  modalCloseBtn: {
    padding: 6
  },
  modalCloseText: {
    fontSize: 18,
    color: '#94A3B8',
    fontWeight: 'bold'
  },
  langModalScroll: {
    marginBottom: 20
  },
  langOptionCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155'
  },
  langOptionCardActive: {
    borderColor: '#10B981',
    backgroundColor: 'rgba(6, 78, 59, 0.35)'
  },
  langOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  langOptionFlag: {
    fontSize: 24
  },
  langOptionNative: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#F8FAFC'
  },
  langOptionNativeActive: {
    color: '#34D399'
  },
  langOptionSub: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2
  },
  selectedPill: {
    backgroundColor: 'rgba(16, 185, 129, 0.25)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#10B981'
  },
  selectedPillText: {
    color: '#10B981',
    fontSize: 11,
    fontWeight: 'bold'
  }
});
