import React, { createContext, useContext, useState } from 'react';
import { apiRequest } from '../config/api';
import { translations } from '../i18n/translations';

const AuthContext = createContext();

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
  const t = translations[language] || translations.en;

  const authenticate = async (mode, fields) => {
    setLoading(true);
    try {
      const data = await apiRequest(`/auth/${mode}`, {
        method: 'POST', body: JSON.stringify(fields)
      });
      if (data.success && data.token && data.user) {
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

  const logout = () => {
    setToken(null);
    setUser(null);
    setRole(null);
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
        t
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
