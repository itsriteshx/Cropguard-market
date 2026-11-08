import { Platform } from 'react-native';

// Set EXPO_PUBLIC_API_ORIGIN to the backend origin for a physical device (e.g. http://192.168.1.X:5001).
// For Android Emulator, localhost is reached via 10.0.2.2.
const defaultOrigin = Platform.OS === 'android' ? 'http://10.0.2.2:5001' : 'http://localhost:5001';
let rawOrigin = process.env.EXPO_PUBLIC_API_ORIGIN || defaultOrigin;

// If on Android and configured with localhost, convert to 10.0.2.2 for emulator compatibility
if (Platform.OS === 'android' && rawOrigin.includes('localhost')) {
  rawOrigin = rawOrigin.replace('localhost', '10.0.2.2');
}

const origin = rawOrigin.replace(/\/+$/, '');

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

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(url, { ...options, headers, signal: controller.signal });
    clearTimeout(timeoutId);
    const data = await res.json();
    return { ...data, httpStatus: res.status };
  } catch (error) {
    clearTimeout(timeoutId);
    const isTimeout = error.name === 'AbortError';
    const errorMsg = isTimeout
      ? `Server timeout (8s). Cannot reach ${origin}. Check Wi-Fi & backend.`
      : (error.message || 'Network error connecting to backend');
    console.error(`API Error on ${endpoint}:`, errorMsg);
    return { success: false, networkError: true, message: errorMsg };
  }
};
