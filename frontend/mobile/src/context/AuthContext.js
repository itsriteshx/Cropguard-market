import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { apiRequest, subscribeUnauthorized } from '../config/api';
import { translations } from '../i18n/translations';
import { createSessionManager } from '../auth/sessionManager';
import { syncLanguagePreference } from '../auth/languageSync';

const AuthContext = createContext();
const SESSION_KEY = 'cropguard_session_token';
const LEGACY_PROFILE_KEY = 'cropguard_user_profile';
// Storage errors must reach the caller: otherwise logout can appear to succeed
// while the old token remains on the device.
const sessionStore = {
  get: () => Platform.OS === 'web' ? Promise.resolve(sessionStorage.getItem(SESSION_KEY)) : SecureStore.getItemAsync(SESSION_KEY),
  set: (value) => Platform.OS === 'web' ? Promise.resolve(sessionStorage.setItem(SESSION_KEY, value)) : SecureStore.setItemAsync(SESSION_KEY, value),
  remove: async () => {
    if (Platform.OS === 'web') {
      sessionStorage.removeItem(LEGACY_PROFILE_KEY);
      sessionStorage.removeItem(SESSION_KEY);
    } else {
      await SecureStore.deleteItemAsync(LEGACY_PROFILE_KEY);
      await SecureStore.deleteItemAsync(SESSION_KEY);
    }
  }
};
const sessionManager = createSessionManager(sessionStore, apiRequest);

export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English', native: 'English', flag: '🌐', region: 'Pan-India' },
  { code: 'hi', label: 'हिन्दी', native: 'हिन्दी', flag: '🇮🇳', region: 'North / Central' },
  { code: 'kn', label: 'ಕನ್ನಡ', native: 'ಕನ್ನಡ', flag: '🌾', region: 'UASD Karnataka' },
  { code: 'mr', label: 'मराठी', native: 'मराठी', flag: '🚜', region: 'Maharashtra APMC' },
  { code: 'te', label: 'తెలుగు', native: 'తెలుగు', flag: '🌶️', region: 'AP & Telangana' },
  { code: 'ta', label: 'தமிழ்', native: 'தமிழ்', flag: '🥥', region: 'Tamil Nadu' },
  { code: 'gu', label: 'ગુજરાતી', native: 'ગુજરાતી', flag: '🥜', region: 'Gujarat APMC' },
  { code: 'pa', label: 'ਪੰਜਾਬੀ', native: 'ਪੰਜਾਬੀ', flag: '🌾', region: 'Punjab Mandis' }
];

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [role, setRole] = useState(null);
  const [language, setLanguageState] = useState('en');
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(true);
  const [restoreError, setRestoreError] = useState('');

  const restoreSession = useCallback(async () => {
    setRestoring(true);
    setRestoreError('');
    try {
      const restored = await sessionManager.restore();
      if (restored.state === 'authenticated') {
        setToken(restored.token);
        setUser(restored.user);
        setRole(restored.user.role);
        setLanguageState(restored.user.languagePreference || 'en');
      } else if (restored.state === 'signedOut') {
        setToken(null);
        setUser(null);
        setRole(null);
      } else {
        setRestoreError('Could not restore your session. Check your connection and try again.');
      }
    } catch (error) {
      // If we don't have user in state, report error
      setRestoreError('Could not access your saved session. Please try again.');
    } finally {
      setRestoring(false);
    }
  }, []);

  useEffect(() => { restoreSession(); }, [restoreSession]);

  useEffect(() => {
    return subscribeUnauthorized(async (msg) => {
      try { await sessionManager.clear(); } catch (_) {}
      setToken(null);
      setUser(null);
      setRole(null);
      setRestoreError(msg || 'Session expired. Please sign in again.');
    });
  }, []);
  const t = translations[language] || translations.en;

  const authenticate = async (mode, fields) => {
    setLoading(true);
    try {
      const data = await apiRequest(`/auth/${mode}`, {
        method: 'POST', body: JSON.stringify(fields)
      });
      if (data.success && data.token && data.user) {
        try {
          await sessionManager.save(data.token);
        } catch (error) {
          return { success: false, message: 'Could not save your session on this device. Please sign in again.' };
        }
        setToken(data.token);
        setUser(data.user);
        setRole(data.user.role);
        setLanguageState(data.user.languagePreference || 'en');
      }
      return data;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await sessionManager.clear();
    } catch (error) {
      return { success: false, message: 'Could not remove the saved session. Please try again.' };
    }
    setToken(null);
    setUser(null);
    setRole(null);
    setLanguageState('en');
    setRestoreError('');
    return { success: true };
  };

  const setLanguage = async (newLang) => {
    if (!newLang) return { success: false, synced: false, error: 'Language code is required' };

    // Always preserve local language switching regardless of network or backend state
    setLanguageState(newLang);
    if (user) {
      setUser((prev) => (prev ? { ...prev, languagePreference: newLang } : prev));
    }

    // Synchronize language preference with backend if authenticated
    if (token) {
      const syncResult = await syncLanguagePreference(apiRequest, token, newLang);
      if (!syncResult.success) {
        console.warn('[AuthContext] Language synchronization warning:', syncResult.error);
      }
      return syncResult;
    }

    return { success: true, synced: false, language: newLang };
  };

  const toggleLanguage = () => {
    const sequence = SUPPORTED_LANGUAGES.map((l) => l.code);
    const nextIndex = (sequence.indexOf(language) + 1) % sequence.length;
    setLanguage(sequence[nextIndex]);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        role,
        language,
        languages: SUPPORTED_LANGUAGES,
        setLanguage,
        toggleLanguage,
        authenticate,
        logout,
        loading,
        restoring,
        restoreError,
        restoreSession,
        t
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
