import React, { createContext, useContext, useState, useEffect } from 'react';
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

// Pre-seeded demo accounts in our MongoDB Atlas
const DEMO_USERS = {
  FARMER: {
    phone: '9876543210',
    password: 'farmerpassword123',
    role: 'FARMER',
    name: 'Ramesh Patil',
    district: 'Dharwad'
  },
  BUYER: {
    phone: '9811223344',
    password: 'buyerpassword123',
    role: 'BUYER_RETAIL',
    name: 'Sunil Retail Stores',
    district: 'Hubballi'
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [role, setRole] = useState('FARMER');
  const [language, setLanguageState] = useState('en');
  const [loading, setLoading] = useState(true);

  const t = translations[language] || translations.en;

  // Auto-login with default demo Farmer on launch
  useEffect(() => {
    loginDemoUser('FARMER');
  }, []);

  const loginDemoUser = async (targetRole = 'FARMER') => {
    setLoading(true);
    const credentials = DEMO_USERS[targetRole];
    try {
      const data = await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          phone: credentials.phone,
          password: credentials.password
        })
      });

      if (data.success && data.token) {
        setToken(data.token);
        setUser(data.user);
        setRole(data.user.role);
        if (data.user.languagePreference) {
          setLanguageState(data.user.languagePreference);
        }
      } else {
        // Fallback local mock user if backend is offline
        setUser({
          _id: targetRole === 'FARMER' ? 'farmer_demo_id' : 'buyer_demo_id',
          name: credentials.name,
          phone: credentials.phone,
          role: credentials.role,
          location: { district: credentials.district, state: 'Karnataka' },
          isVerified: true
        });
        setRole(credentials.role);
      }
    } catch (err) {
      console.warn('Auto login fallback:', err.message);
    } finally {
      setLoading(false);
    }
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

  const switchUser = () => {
    const nextRole = role === 'FARMER' ? 'BUYER' : 'FARMER';
    loginDemoUser(nextRole);
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
        switchUser,
        loginDemoUser,
        loading,
        t
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
