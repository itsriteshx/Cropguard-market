import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService, systemService } from '../services/api';
import { disconnectNegotiationSocket } from '../services/socket';
import { webTranslations } from '../i18n/translations';

const AuthContext = createContext();

export const WEB_LANGUAGES = [
  { code: 'en', name: 'English', nativeName: 'English', flag: '🌐', region: 'Pan-India / Wholesale' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', flag: '🇮🇳', region: 'North & Central Mandis' },
  { code: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ', flag: '🌾', region: 'UASD Dharwad / Karnataka' },
  { code: 'mr', name: 'Marathi', nativeName: 'मराठी', flag: '🚜', region: 'Maharashtra APMC' },
  { code: 'te', name: 'Telugu', nativeName: 'తెలుగు', flag: '🌶️', region: 'AP & Telangana' },
  { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்', flag: '🥥', region: 'Tamil Nadu' },
  { code: 'gu', name: 'Gujarati', nativeName: 'ગુજરાતી', flag: '🥜', region: 'Gujarat APMC' },
  { code: 'pa', name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ', flag: '🌾', region: 'Punjab Mandis' },
];

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('cropguard_web_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState(localStorage.getItem('cropguard_web_token') || null);
  const [language, setLanguageState] = useState(localStorage.getItem('cropguard_web_lang') || 'en');
  const [loading, setLoading] = useState(false);
  const [backendOnline, setBackendOnline] = useState(false);

  const t = webTranslations[language] || webTranslations.en;

  const setLanguage = (langCode) => {
    setLanguageState(langCode);
    localStorage.setItem('cropguard_web_lang', langCode);
  };

  // Custom User Login
  const login = async (phone, password) => {
    setLoading(true);
    try {
      const data = await authService.login(phone, password);
      if (data && data.token && data.user) {
        setToken(data.token);
        setCurrentUser(data.user);
        localStorage.setItem('cropguard_web_token', data.token);
        localStorage.setItem('cropguard_web_user', JSON.stringify(data.user));
        setBackendOnline(true);
        return { success: true, user: data.user };
      }
      return { success: false, message: 'Invalid server response' };
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Login failed';
      return { success: false, message: msg };
    } finally {
      setLoading(false);
    }
  };

  // Custom User Registration
  const register = async (userData) => {
    setLoading(true);
    try {
      const data = await authService.register(userData);
      if (data && data.token && data.user) {
        setToken(data.token);
        setCurrentUser(data.user);
        localStorage.setItem('cropguard_web_token', data.token);
        localStorage.setItem('cropguard_web_user', JSON.stringify(data.user));
        setBackendOnline(true);
        return { success: true, user: data.user };
      }
      return { success: false, message: 'Invalid registration response' };
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Registration failed';
      return { success: false, message: msg };
    } finally {
      setLoading(false);
    }
  };

  // Logout & Reset
  const logout = () => {
    disconnectNegotiationSocket();
    localStorage.removeItem('cropguard_web_token');
    localStorage.removeItem('cropguard_web_user');
    setCurrentUser(null);
    setToken(null);
  };

  useEffect(() => {
    // Listen for 401 unauthorized signals from API interceptor
    const handleAuthExpired = () => {
      logout();
    };
    window.addEventListener('cropguard_auth_expired', handleAuthExpired);

    // Verify saved session or backend gateway health honestly
    const verifySavedSession = async () => {
      const savedToken = localStorage.getItem('cropguard_web_token');
      if (!savedToken) {
        try {
          const health = await systemService.getHealth();
          setBackendOnline(Boolean(health?.success));
        } catch {
          setBackendOnline(false);
        }
        return;
      }
      try {
        const res = await authService.getMe();
        if (res && res.user) {
          setCurrentUser(res.user);
          localStorage.setItem('cropguard_web_user', JSON.stringify(res.user));
          setBackendOnline(true);
        }
      } catch (err) {
        if (err.response?.status === 401) {
          logout();
        } else {
          setBackendOnline(false);
        }
      }
    };
    verifySavedSession();

    return () => window.removeEventListener('cropguard_auth_expired', handleAuthExpired);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        login,
        register,
        logout,
        token,
        language,
        setLanguage,
        languages: WEB_LANGUAGES,
        loading,
        backendOnline,
        setBackendOnline,
        t,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
