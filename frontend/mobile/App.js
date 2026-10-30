import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  TouchableOpacity,
  Platform
} from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { AuthProvider, useAuth } from './src/context/AuthContext';
import MarketplaceScreen from './src/screens/MarketplaceScreen';
import SellProduceScreen from './src/screens/SellProduceScreen';
import NegotiationsScreen from './src/screens/NegotiationsScreen';
import LedgerScreen from './src/screens/LedgerScreen';
import ProfileScreen from './src/screens/ProfileScreen';

function MainApp() {
  const { t, role, language, toggleLanguage, switchUser } = useAuth();
  const [activeTab, setActiveTab] = useState('MARKET');

  const isFarmer = role === 'FARMER';

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

        {/* Action Pills */}
        <View style={styles.navActionsRow}>
          {/* Persona Switch Pill */}
          <TouchableOpacity style={styles.personaPill} onPress={switchUser}>
            <Text style={styles.personaPillText}>
              {isFarmer ? '👨‍🌾 Farmer' : '🛒 Buyer'}
            </Text>
          </TouchableOpacity>

          {/* Language Toggle Pill */}
          <TouchableOpacity style={styles.langPill} onPress={toggleLanguage}>
            <Text style={styles.langPillText}>
              {language.toUpperCase()}
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
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
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
    alignItems: 'center'
  },
  personaPill: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#334155',
    marginRight: 6
  },
  personaPillText: {
    color: '#34D399',
    fontSize: 11,
    fontWeight: '600'
  },
  langPill: {
    backgroundColor: '#10B981',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12
  },
  langPillText: {
    color: '#0F172A',
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
  }
});
