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
  const { authenticate, verifyEmailOtp, resendEmailOtp, verifyPhoneOtp, resendPhoneOtp, loading } = useAuth();
  const [register, setRegister] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('FARMER');
  const [error, setError] = useState('');

  // Verification step state: null | 'PHONE_OTP' | 'EMAIL_OTP' | 'SUCCESS'
  const [verificationStep, setVerificationStep] = useState(null);
  const [verificationToken, setVerificationToken] = useState(null);
  const [verificationUser, setVerificationUser] = useState(null);
  const [emailOtp, setEmailOtp] = useState('');
  const [phoneOtp, setPhoneOtp] = useState('');
  const [emailCooldown, setEmailCooldown] = useState(0);
  const [phoneCooldown, setPhoneCooldown] = useState(0);
  const [verificationError, setVerificationError] = useState('');
  const [verificationSuccessMsg, setVerificationSuccessMsg] = useState('');

  useEffect(() => {
    if (emailCooldown <= 0) return;
    const timer = setInterval(() => {
      setEmailCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [emailCooldown]);

  useEffect(() => {
    if (phoneCooldown <= 0) return;
    const timer = setInterval(() => {
      setPhoneCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [phoneCooldown]);

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

    const cleanEmail = email && email.trim() ? email.trim().toLowerCase() : undefined;
    const fields = register
      ? { name: name.trim(), phone: cleanPhone, email: cleanEmail, password, role }
      : { phone: cleanPhone, password };

    const result = await authenticate(register ? 'register' : 'login', fields);

    if (result.requiresVerification) {
      setVerificationToken(result.verificationToken || result.token);
      setVerificationUser(result.user);
      const pending = result.verificationStatus?.pending || ['phone'];
      if (pending.includes('phone')) {
        setVerificationStep('PHONE_OTP');
      } else if (pending.includes('email')) {
        setVerificationStep('EMAIL_OTP');
      }
      return;
    }

    if (!result.success) {
      setError(result.message || 'Unable to authenticate. Please check your network & credentials.');
    }
  };

  const handleVerifyEmail = async () => {
    if (!emailOtp || emailOtp.trim().length !== 6) {
      setVerificationError('Please enter the 6-digit email verification code.');
      return;
    }
    setVerificationError('');
    const targetEmail = verificationUser?.email || email;
    const res = await verifyEmailOtp(targetEmail, emailOtp.trim(), verificationToken);
    if (!res.success) {
      setVerificationError(res.message || 'Invalid verification code. Please check and try again.');
      return;
    }
    if (res.verificationStatus?.pending?.includes('phone')) {
      setVerificationStep('PHONE_OTP');
    } else {
      setVerificationStep('SUCCESS');
    }
  };

  const handleResendEmail = async () => {
    if (emailCooldown > 0) return;
    setVerificationError('');
    const targetEmail = verificationUser?.email || email;
    const res = await resendEmailOtp(targetEmail, verificationToken);
    if (res.success) {
      setEmailCooldown(60);
      setVerificationSuccessMsg('A new verification code has been sent to your email.');
    } else {
      setVerificationError(res.message || 'Failed to resend verification email.');
    }
  };

  const handleVerifyPhone = async () => {
    if (!phoneOtp || phoneOtp.trim().length !== 6) {
      setVerificationError('Please enter the 6-digit SMS verification code.');
      return;
    }
    setVerificationError('');
    const targetPhone = verificationUser?.phone || phone;
    const res = await verifyPhoneOtp(targetPhone, phoneOtp.trim(), verificationToken);
    if (!res.success) {
      setVerificationError(res.message || 'Invalid SMS verification code. Please check and try again.');
      return;
    }
    if (res.verificationStatus?.pending?.includes('email')) {
      setVerificationSuccessMsg('Phone verified! Please now verify your email address.');
      setVerificationStep('EMAIL_OTP');
    } else {
      setVerificationStep('SUCCESS');
    }
  };

  const handleResendPhone = async () => {
    if (phoneCooldown > 0) return;
    setVerificationError('');
    const targetPhone = verificationUser?.phone || phone;
    const res = await resendPhoneOtp(targetPhone, verificationToken);
    if (res.success) {
      setPhoneCooldown(60);
      setVerificationSuccessMsg('A new verification code has been sent via SMS.');
    } else {
      setVerificationError(res.message || 'Failed to resend SMS verification code.');
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

          {/* Verification Step: Phone SMS OTP */}
          {verificationStep === 'PHONE_OTP' ? (
            <View style={styles.card}>
              <View style={styles.verificationBadge}>
                <Text style={styles.verificationBadgeText}>📱 SMS VERIFICATION</Text>
              </View>
              <Text style={styles.cardTitle}>Verify Mobile Number</Text>
              <Text style={styles.cardSubtitle}>
                Enter the 6-digit SMS code sent to{' '}
                <Text style={{ color: '#34d399', fontWeight: 'bold' }}>
                  {verificationUser?.phone || phone}
                </Text>
              </Text>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Enter 6-Digit SMS Code</Text>
                <TextInput
                  style={[styles.input, styles.otpInput]}
                  placeholder="000000"
                  placeholderTextColor="#64748b"
                  value={phoneOtp}
                  onChangeText={(val) => {
                    setPhoneOtp(val.replace(/\D/g, '').slice(0, 6));
                    if (verificationError) setVerificationError('');
                  }}
                  keyboardType="number-pad"
                  maxLength={6}
                />
              </View>

              {!!verificationError && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>⚠️ {verificationError}</Text>
                </View>
              )}

              {!!verificationSuccessMsg && (
                <View style={[styles.errorBox, { borderColor: 'rgba(52, 211, 153, 0.4)', backgroundColor: 'rgba(52, 211, 153, 0.1)' }]}>
                  <Text style={[styles.errorText, { color: '#34d399' }]}>✅ {verificationSuccessMsg}</Text>
                </View>
              )}

              <TouchableOpacity
                style={[styles.button, (loading || phoneOtp.length !== 6) && styles.buttonDisabled]}
                onPress={handleVerifyPhone}
                disabled={loading || phoneOtp.length !== 6}
                accessibilityRole="button"
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.buttonText}>Verify Mobile Number</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.resendBtn, phoneCooldown > 0 && styles.buttonDisabled]}
                onPress={handleResendPhone}
                disabled={phoneCooldown > 0}
                accessibilityRole="button"
              >
                <Text style={styles.resendText}>
                  {phoneCooldown > 0
                    ? `Resend SMS in ${phoneCooldown}s`
                    : "Didn't receive SMS? Resend Code"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.backBtn}
                onPress={() => {
                  setVerificationStep(null);
                  setVerificationError('');
                }}
                accessibilityRole="button"
              >
                <Text style={styles.backBtnText}>← Back to Sign In</Text>
              </TouchableOpacity>
            </View>
          ) : verificationStep === 'EMAIL_OTP' ? (
            <View style={styles.card}>
              <View style={styles.verificationBadge}>
                <Text style={styles.verificationBadgeText}>✉️ EMAIL VERIFICATION</Text>
              </View>
              <Text style={styles.cardTitle}>Verify Your Email</Text>
              <Text style={styles.cardSubtitle}>
                We sent a 6-digit verification code to{' '}
                <Text style={{ color: '#34d399', fontWeight: 'bold' }}>
                  {verificationUser?.email || email}
                </Text>
              </Text>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Enter 6-Digit Code</Text>
                <TextInput
                  style={[styles.input, styles.otpInput]}
                  placeholder="000000"
                  placeholderTextColor="#64748b"
                  value={emailOtp}
                  onChangeText={(val) => {
                    setEmailOtp(val.replace(/\D/g, '').slice(0, 6));
                    if (verificationError) setVerificationError('');
                  }}
                  keyboardType="number-pad"
                  maxLength={6}
                />
              </View>

              {!!verificationError && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>⚠️ {verificationError}</Text>
                </View>
              )}

              {!!verificationSuccessMsg && (
                <View style={[styles.errorBox, { borderColor: 'rgba(52, 211, 153, 0.4)', backgroundColor: 'rgba(52, 211, 153, 0.1)' }]}>
                  <Text style={[styles.errorText, { color: '#34d399' }]}>✅ {verificationSuccessMsg}</Text>
                </View>
              )}

              <TouchableOpacity
                style={[styles.button, (loading || emailOtp.length !== 6) && styles.buttonDisabled]}
                onPress={handleVerifyEmail}
                disabled={loading || emailOtp.length !== 6}
                accessibilityRole="button"
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.buttonText}>Verify Email Address</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.resendBtn, emailCooldown > 0 && styles.buttonDisabled]}
                onPress={handleResendEmail}
                disabled={emailCooldown > 0}
                accessibilityRole="button"
              >
                <Text style={styles.resendText}>
                  {emailCooldown > 0
                    ? `Resend code in ${emailCooldown}s`
                    : "Didn't receive code? Resend Email"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.backBtn}
                onPress={() => {
                  setVerificationStep(null);
                  setVerificationError('');
                }}
                accessibilityRole="button"
              >
                <Text style={styles.backBtnText}>← Back to Sign In</Text>
              </TouchableOpacity>
            </View>
          ) : (
            /* Form Card */
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

              {register && (
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Email Address (Optional / Recommended)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. ramesh@uasd.agri.in"
                    placeholderTextColor="#64748b"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
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
        )}

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
  },
  cardTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 4
  },
  cardSubtitle: {
    color: '#94a3b8',
    fontSize: 13,
    marginBottom: 16,
    lineHeight: 18
  },
  verificationBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(52, 211, 153, 0.15)',
    borderWidth: 1,
    borderColor: '#10b981',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    marginBottom: 10
  },
  verificationBadgeText: {
    color: '#34d399',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8
  },
  otpInput: {
    textAlign: 'center',
    fontSize: 24,
    letterSpacing: 8,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: '#34d399',
    fontWeight: 'bold'
  },
  resendBtn: {
    marginTop: 14,
    alignItems: 'center',
    padding: 8
  },
  resendText: {
    color: '#38bdf8',
    fontSize: 13,
    fontWeight: '600'
  },
  backBtn: {
    marginTop: 6,
    alignItems: 'center',
    padding: 8
  },
  backBtnText: {
    color: '#94a3b8',
    fontSize: 12
  }
});
