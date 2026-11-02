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
    phone: '9876543210',
    password: 'farmerpassword123',
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
  const [activePersona, setActivePersona] = useState(DEMO_PERSONAS[0]);
  const [token, setToken] = useState(localStorage.getItem('cropguard_web_token') || null);
  const [language, setLanguageState] = useState(localStorage.getItem('cropguard_web_lang') || 'en');
  const [loading, setLoading] = useState(false);
  const [backendOnline, setBackendOnline] = useState(false);

  const t = webTranslations[language] || webTranslations.en;

  const setLanguage = (langCode) => {
    setLanguageState(langCode);
    localStorage.setItem('cropguard_web_lang', langCode);
  };

  // Authenticate when persona switches
  const switchPersona = async (persona) => {
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
    switchPersona(DEMO_PERSONAS[0]);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        activePersona,
        switchPersona,
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
