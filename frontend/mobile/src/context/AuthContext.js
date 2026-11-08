import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { apiRequest } from '../config/api';
import { translations } from '../i18n/translations';

const AuthContext = createContext();
const SESSION_KEY = 'cropguard_session_token';
const USER_KEY = 'cropguard_user_profile';

// Browser storage is scoped to the current tab; native tokens use encrypted storage.
const sessionStore = {
  get: () => Platform.OS === 'web' ? Promise.resolve(sessionStorage.getItem(SESSION_KEY)) : SecureStore.getItemAsync(SESSION_KEY),
  set: (value) => Platform.OS === 'web' ? Promise.resolve(sessionStorage.setItem(SESSION_KEY, value)) : SecureStore.setItemAsync(SESSION_KEY, value),
  remove: () => Platform.OS === 'web' ? Promise.resolve(sessionStorage.removeItem(SESSION_KEY)) : SecureStore.deleteItemAsync(SESSION_KEY)
};

const userStore = {
  get: () => Platform.OS === 'web' ? Promise.resolve(sessionStorage.getItem(USER_KEY)) : SecureStore.getItemAsync(USER_KEY),
  set: (value) => Platform.OS === 'web' ? Promise.resolve(sessionStorage.setItem(USER_KEY, value)) : SecureStore.setItemAsync(USER_KEY, value),
  remove: () => Platform.OS === 'web' ? Promise.resolve(sessionStorage.removeItem(USER_KEY)) : SecureStore.deleteItemAsync(USER_KEY)
};

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
      const savedToken = await sessionStore.get();
      if (!savedToken) return;

      // Optimistically restore cached user profile for offline resilience
      let hasCachedUser = false;
      try {
        const cachedUserStr = await userStore.get();
        if (cachedUserStr) {
          const cachedUser = JSON.parse(cachedUserStr);
          if (cachedUser && cachedUser._id) {
            setToken(savedToken);
            setUser(cachedUser);
            setRole(cachedUser.role);
            setLanguageState(cachedUser.languagePreference || 'en');
            hasCachedUser = true;
          }
        }
      } catch (e) {
        // Cache parse issue, ignore
      }

      const result = await apiRequest('/auth/me', {}, savedToken);
      if (result.success && result.user) {
        setToken(savedToken);
        setUser(result.user);
        setRole(result.user.role);
        setLanguageState(result.user.languagePreference || 'en');
        try {
          await userStore.set(JSON.stringify(result.user));
        } catch (e) {}
      } else if (result.httpStatus === 401) {
        await sessionStore.remove();
        await userStore.remove();
        setToken(null);
        setUser(null);
      } else if (!hasCachedUser) {
        // Only lock the UI with error screen if we don't have a cached session
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
  const t = translations[language] || translations.en;

  const authenticate = async (mode, fields) => {
    setLoading(true);
    try {
      const data = await apiRequest(`/auth/${mode}`, {
        method: 'POST', body: JSON.stringify(fields)
      });
      if (data.success && data.token && data.user) {
        try {
          await sessionStore.set(data.token);
          await userStore.set(JSON.stringify(data.user));
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
      await sessionStore.remove();
      await userStore.remove();
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
    if (!newLang) return;
    setLanguageState(newLang);

    // Synchronize language preference with backend if logged in
    if (token) {
      try {
        await apiRequest(
          '/auth/language',
          {
            method: 'PATCH',
            body: JSON.stringify({ languagePreference: newLang })
          },
          token
        );
      } catch (err) {
        console.warn('Failed to sync language to backend:', err.message);
      }
    }
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
