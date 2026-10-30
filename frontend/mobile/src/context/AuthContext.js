import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiRequest } from '../config/api';
import { translations } from '../i18n/translations';

const AuthContext = createContext();

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
  const [language, setLanguage] = useState('en');
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
          setLanguage(data.user.languagePreference);
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

  const toggleLanguage = () => {
    const sequence = ['en', 'hi', 'kn'];
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
