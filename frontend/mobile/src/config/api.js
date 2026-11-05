import { Platform } from 'react-native';

// Set EXPO_PUBLIC_API_ORIGIN to the backend origin for a physical device.
const defaultOrigin = Platform.OS === 'android' ? 'http://10.0.2.2:5001' : 'http://localhost:5001';
const origin = (process.env.EXPO_PUBLIC_API_ORIGIN || defaultOrigin).replace(/\/+$/, '');

export const getSocketUrl = () => origin;
export const resolveMediaUrl = (url) => url?.startsWith('/uploads/') ? `${origin}${url}` : url;
export const API_BASE_URL = `${origin}/api`;
export const SOCKET_URL = getSocketUrl();

export const apiRequest = async (endpoint, options = {}, token = null) => {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers = {
    ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };

  try {
    const res = await fetch(url, { ...options, headers });
    const data = await res.json();
    return { ...data, httpStatus: res.status };
  } catch (error) {
    console.error(`API Error on ${endpoint}:`, error.message);
    return { success: false, networkError: true, message: error.message || 'Network error connecting to backend' };
  }
};
