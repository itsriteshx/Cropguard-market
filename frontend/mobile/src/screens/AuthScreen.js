import React, { useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../context/AuthContext';

export default function AuthScreen() {
  const { authenticate, loading } = useAuth();
  const [register, setRegister] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('FARMER');
  const [error, setError] = useState('');

  const submit = async () => {
    if (loading) return;
    if (register && !name.trim()) return setError('Enter your name.');
    if (!/^[6-9]\d{9}$/.test(phone.trim())) return setError('Enter a valid 10-digit Indian mobile number.');
    if (password.length < 6) return setError('Password must have at least 6 characters.');
    setError('');
    const fields = register ? { name: name.trim(), phone: phone.trim(), password, role } : { phone: phone.trim(), password };
    const result = await authenticate(register ? 'register' : 'login', fields);
    if (!result.success) setError(result.message || 'Unable to sign in. Please try again.');
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>🌾 CropGuard Market</Text>
        <Text style={styles.subtitle}>{register ? 'Create your account' : 'Sign in to your account'}</Text>
        {register && <TextInput style={styles.input} placeholder="Full name" placeholderTextColor="#94a3b8" value={name} onChangeText={setName} autoComplete="name" />}
        <TextInput style={styles.input} placeholder="Mobile number" placeholderTextColor="#94a3b8" value={phone} onChangeText={setPhone} keyboardType="phone-pad" maxLength={10} autoComplete="tel" />
        <TextInput style={styles.input} placeholder="Password" placeholderTextColor="#94a3b8" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" />
        {register && <View style={styles.roles}>{[['FARMER', 'Farmer'], ['BUYER_RETAIL', 'Retail buyer'], ['BUYER_WHOLESALE', 'Wholesale buyer']].map(([value, label]) => <TouchableOpacity key={value} onPress={() => setRole(value)} style={[styles.role, role === value && styles.selected]} accessibilityRole="button" accessibilityState={{ selected: role === value }}><Text style={styles.text}>{label}</Text></TouchableOpacity>)}</View>}
        {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
        <TouchableOpacity style={styles.button} onPress={submit} disabled={loading} accessibilityRole="button"><Text style={styles.text}>{loading ? 'Please wait…' : register ? 'Create account' : 'Sign in'}</Text></TouchableOpacity>
        <TouchableOpacity onPress={() => { setRegister(!register); setError(''); }} accessibilityRole="button"><Text style={styles.link}>{register ? 'Already have an account? Sign in' : 'New here? Create an account'}</Text></TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' }, content: { flexGrow: 1, justifyContent: 'center', padding: 24, gap: 14 },
  title: { color: '#fff', fontSize: 27, fontWeight: 'bold' }, subtitle: { color: '#cbd5e1', fontSize: 16, marginBottom: 10 },
  input: { borderWidth: 1, borderColor: '#475569', borderRadius: 10, padding: 14, color: '#fff', backgroundColor: '#1e293b' },
  roles: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, role: { borderWidth: 1, borderColor: '#475569', borderRadius: 8, padding: 10 }, selected: { backgroundColor: '#047857', borderColor: '#10b981' },
  button: { backgroundColor: '#059669', padding: 16, borderRadius: 10, alignItems: 'center' }, text: { color: '#fff', fontWeight: '600' }, error: { color: '#fca5a5' }, link: { color: '#6ee7b7', textAlign: 'center', padding: 10 }
});
