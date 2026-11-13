import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';

const ROLES = [
  { value: 'FARMER', label: 'Farmer', icon: '🌾' },
  { value: 'BUYER_RETAIL', label: 'Retail Buyer', icon: '🛒' },
  { value: 'BUYER_WHOLESALE', label: 'Wholesale', icon: '🏢' }
];

export default function AuthScreen() {
  const { authenticate, loading } = useAuth();
  const [register, setRegister] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('FARMER');
  const [error, setError] = useState('');

  const handlePhoneChange = (text) => {
    let clean = text.replace(/\D/g, '');
    if (clean.length === 12 && clean.startsWith('91')) clean = clean.slice(2);
    if (clean.length === 11 && clean.startsWith('0')) clean = clean.slice(1);
    if (clean.length > 10) clean = clean.slice(0, 10);
    setPhone(clean);
    if (error) setError('');
  };

  const submit = async () => {
    if (loading) return;
    if (register && !name.trim()) return setError('Please enter your full name.');

    const cleanPhone = phone.replace(/\D/g, '').replace(/^91/, '').replace(/^0/, '');
    if (!/^[6-9]\d{9}$/.test(cleanPhone)) return setError('Enter a valid 10-digit Indian mobile number (e.g. 9876543210).');
    if (password.length < 6) return setError('Password must have at least 6 characters.');
    setError('');

    const fields = register
      ? { name: name.trim(), phone: cleanPhone, password, role }
      : { phone: cleanPhone, password };

    const result = await authenticate(register ? 'register' : 'login', fields);
    if (!result.success) {
      setError(result.message || 'Unable to authenticate. Please check your network & credentials.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header Branding */}
          <View style={styles.header}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>UASD APMC NETWORK</Text>
            </View>
            <Text style={styles.title}>🌾 CropGuard Market</Text>
            <Text style={styles.subtitle}>
              {register
                ? 'Direct farm-to-market trade registration'
                : 'Welcome back. Sign in to your account'}
            </Text>
          </View>

          {/* Form Card */}
          <View style={styles.card}>
            {register && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Full Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Ramesh Patil"
                  placeholderTextColor="#64748b"
                  value={name}
                  onChangeText={setName}
                  autoComplete="name"
                />
              </View>
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Mobile Number</Text>
              <TextInput
                style={styles.input}
                placeholder="10-digit mobile (e.g. 9876543210)"
                placeholderTextColor="#64748b"
                value={phone}
                onChangeText={handlePhoneChange}
                keyboardType="phone-pad"
                maxLength={16}
                autoComplete="tel"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
                placeholder="Minimum 6 characters"
                placeholderTextColor="#64748b"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
              />
            </View>

            {register && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Account Role</Text>
                <View style={styles.roles}>
                  {ROLES.map((r) => {
                    const isSelected = role === r.value;
                    return (
                      <TouchableOpacity
                        key={r.value}
                        onPress={() => setRole(r.value)}
                        style={[styles.role, isSelected && styles.selectedRole]}
                        accessibilityRole="button"
                        accessibilityState={{ selected: isSelected }}
                      >
                        <Text style={styles.roleIcon}>{r.icon}</Text>
                        <Text style={[styles.roleText, isSelected && styles.selectedRoleText]}>
                          {r.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {!!error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>⚠️ {error}</Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={submit}
              disabled={loading}
              accessibilityRole="button"
            >
              {loading ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator size="small" color="#ffffff" />
                  <Text style={styles.buttonText}>Connecting Escrow...</Text>
                </View>
              ) : (
                <Text style={styles.buttonText}>
                  {register ? 'Create Verified Account' : 'Sign In to Portal'}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                setRegister(!register);
                setError('');
              }}
              style={styles.toggleBtn}
              accessibilityRole="button"
            >
              <Text style={styles.toggleText}>
                {register
                  ? 'Already have an account? Sign in'
                  : "Don't have an account? Register as Farmer/Buyer"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Trust Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              🔒 100% Escrow Secured • 0% Broker Commission • ICAR Benchmarked
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0f1d'
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20
  },
  header: {
    marginBottom: 20
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 8
  },
  badgeText: {
    color: '#34d399',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8
  },
  title: {
    color: '#ffffff',
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.5
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: 13,
    marginTop: 4
  },
  card: {
    backgroundColor: '#111827',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 6
  },
  inputGroup: {
    marginBottom: 14
  },
  label: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6
  },
  input: {
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#ffffff',
    backgroundColor: '#0f172a',
    fontSize: 14
  },
  roles: {
    flexDirection: 'row',
    gap: 8
  },
  role: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#0f172a',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center'
  },
  selectedRole: {
    backgroundColor: 'rgba(5, 150, 105, 0.25)',
    borderColor: '#10b981'
  },
  roleIcon: {
    fontSize: 18,
    marginBottom: 2
  },
  roleText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '600'
  },
  selectedRoleText: {
    color: '#34d399',
    fontWeight: '800'
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 10,
    padding: 10,
    marginBottom: 14
  },
  errorText: {
    color: '#fca5a5',
    fontSize: 12,
    lineHeight: 16
  },
  button: {
    backgroundColor: '#059669',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    shadowColor: '#059669',
    shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 3
  },
  buttonDisabled: {
    opacity: 0.7
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800'
  },
  toggleBtn: {
    marginTop: 16,
    padding: 6,
    alignItems: 'center'
  },
  toggleText: {
    color: '#34d399',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center'
  },
  footer: {
    marginTop: 20,
    alignItems: 'center'
  },
  footerText: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center'
  }
});
