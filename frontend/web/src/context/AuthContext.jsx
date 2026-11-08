import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/api';
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

export const DEMO_PERSONAS = [
  {
    id: 'BUYER_WHOLESALE',
    name: 'Karnataka State Co-op Federation (KSCF)',
    role: 'BUYER_WHOLESALE',
    badge: 'Institutional Wholesaler',
    district: 'Dharwad / Hubballi',
    phone: '9811223344',
    password: 'buyerpassword123',
    initials: 'KS',
  },
  {
    id: 'ADMIN',
    name: 'UASD & ICAR Mandi Directorate',
    role: 'ADMIN',
    badge: 'Mandi Regulatory Admin',
    district: 'Dharwad',
    phone: '9800012345',
    password: 'adminpassword123',
    initials: 'UA',
  },
  {
    id: 'FARMER',
    name: 'Ramesh Patil (UASD Progressive Farmer)',
    role: 'FARMER',
    badge: 'FPO Lead / Producer',
    district: 'Dharwad',
    phone: '9876543210',
    password: 'farmerpassword123',
    initials: 'RP',
  },
];

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('cropguard_web_user');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });
  const [activePersona, setActivePersona] = useState(() => {
    try {
      const savedUser = localStorage.getItem('cropguard_web_user');
      if (savedUser) {
        const u = JSON.parse(savedUser);
        return {
          id: u.role,
          name: u.name,
          role: u.role,
          badge: u.role === 'FARMER' ? 'Registered Producer' : 'Verified Buyer',
          district: u.location?.district || 'Karnataka',
          phone: u.phone,
          initials: (u.name || 'User')
            .split(' ')
            .map((s) => s[0])
            .slice(0, 2)
            .join('')
            .toUpperCase(),
        };
      }
    } catch (e) {}
    return DEMO_PERSONAS[0];
  });
  const [token, setToken] = useState(localStorage.getItem('cropguard_web_token') || null);
  const [language, setLanguageState] = useState(localStorage.getItem('cropguard_web_lang') || 'en');
  const [loading, setLoading] = useState(false);
  const [backendOnline, setBackendOnline] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);

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

        const userPersona = {
          id: data.user.role,
          name: data.user.name,
          role: data.user.role,
          badge: data.user.role === 'FARMER' ? 'Registered Farmer' : 'Verified Buyer',
          district: data.user.location?.district || 'Karnataka',
          phone: data.user.phone,
          initials: (data.user.name || 'User')
            .split(' ')
            .map((s) => s[0])
            .slice(0, 2)
            .join('')
            .toUpperCase(),
        };
        setActivePersona(userPersona);
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

        const userPersona = {
          id: data.user.role,
          name: data.user.name,
          role: data.user.role,
          badge: data.user.role === 'FARMER' ? 'Registered Farmer' : 'Verified Buyer',
          district: data.user.location?.district || 'Karnataka',
          phone: data.user.phone,
          initials: (data.user.name || 'User')
            .split(' ')
            .map((s) => s[0])
            .slice(0, 2)
            .join('')
            .toUpperCase(),
        };
        setActivePersona(userPersona);
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
    localStorage.removeItem('cropguard_web_token');
    localStorage.removeItem('cropguard_web_user');
    setCurrentUser(null);
    setToken(null);
    setActivePersona(DEMO_PERSONAS[0]);
  };

  // Authenticate when persona switches
  const switchPersona = async (persona) => {
    // If switching persona, clear custom user
    localStorage.removeItem('cropguard_web_user');
    setCurrentUser(null);
    setActivePersona(persona);
    setLoading(true);
    try {
      const data = await authService.login(persona.phone, persona.password);
      if (data && data.token) {
        setToken(data.token);
        localStorage.setItem('cropguard_web_token', data.token);
        setBackendOnline(true);
      }
    } catch (err) {
      console.warn('Backend login attempt:', err.message);
      // Fallback: Generate mock session so offline development still previews smoothly
      const mockToken = `mock_token_${persona.role.toLowerCase()}_${Date.now()}`;
      setToken(mockToken);
      localStorage.setItem('cropguard_web_token', mockToken);
      setBackendOnline(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!currentUser) {
      switchPersona(DEMO_PERSONAS[0]);
    } else {
      setBackendOnline(true);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isCustomUser: !!currentUser,
        activePersona,
        switchPersona,
        login,
        register,
        logout,
        authModalOpen,
        setAuthModalOpen,
        token,
        language,
        setLanguage,
        languages: WEB_LANGUAGES,
        loading,
        backendOnline,
        setBackendOnline,
        personas: DEMO_PERSONAS,
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
