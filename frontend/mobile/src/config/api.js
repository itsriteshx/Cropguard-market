import { Platform, NativeModules } from 'react-native';

/**
 * Universal Auto-Host Discovery:
 * Reads the active host IP from Metro bundler's scriptURL.
 * - Physical Phone (Expo Go on Android/iOS): Auto-detects Mac's active IP on Wi-Fi or Hotspot!
 * - iOS Simulator: Connects via localhost:5001
 * - Android Emulator: Connects via 10.0.2.2:5001
 * Eliminates having to edit .env every time Wi-Fi or Hotspot changes.
 */
const getAutoDetectedHost = () => {
  try {
    const scriptURL = NativeModules.SourceCode?.scriptURL;
    if (scriptURL) {
      const address = scriptURL.split('://')[1]?.split('/')[0];
      const host = address?.split(':')[0];
      if (host && host !== 'localhost' && host !== '127.0.0.1') {
        return `http://${host}:5001`;
      }
    }
  } catch (e) {}

  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:5001';
  }
  return 'http://localhost:5001';
};

const autoHost = getAutoDetectedHost();
const envHost = process.env.EXPO_PUBLIC_API_ORIGIN;
let rawOrigin = (envHost && !envHost.includes('localhost')) ? envHost : autoHost;

// Android emulator fallback
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
    let data;
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      data = await res.json();
    } else {
      const text = await res.text();
      data = { success: false, message: text || `HTTP error ${res.status}` };
    }
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
