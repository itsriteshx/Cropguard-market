import { Platform } from 'react-native';

// In Expo, localhost works in web & iOS simulator; Android emulator uses 10.0.2.2
const getBaseUrl = () => {
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:5001/api';
  }
  return 'http://localhost:5001/api';
};

export const API_BASE_URL = getBaseUrl();

export const apiRequest = async (endpoint, options = {}, token = null) => {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };

  try {
    const res = await fetch(url, {
      ...options,
      headers
    });
    const data = await res.json();
    return data;
  } catch (error) {
    console.error(`API Error on ${endpoint}:`, error.message);
    return {
      success: false,
      message: error.message || 'Network error connecting to backend'
    };
  }
};
