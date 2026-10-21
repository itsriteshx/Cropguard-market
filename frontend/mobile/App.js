import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>🌾 CropGuard Market</Text>
      <Text style={styles.subtitle}>Direct Market Access for Farmers</Text>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>✔ Connected to Expo Go (SDK 57)</Text>
      </View>
      <Text style={styles.footer}>Day 1 Setup Complete • Ready for Phase 1</Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#10B981',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#94A3B8',
    marginBottom: 24,
    textAlign: 'center',
  },
  badge: {
    backgroundColor: '#1E293B',
    borderColor: '#10B981',
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginBottom: 20,
  },
  badgeText: {
    color: '#34D399',
    fontSize: 14,
    fontWeight: '600',
  },
  footer: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 20,
  },
});
