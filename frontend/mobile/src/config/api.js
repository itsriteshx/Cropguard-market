import { Platform, NativeModules } from 'react-native';
import { selectApiOrigin } from './apiOrigin';

// A configured origin wins; LAN host detection is a convenience for Expo Go.
const origin = selectApiOrigin(process.env.EXPO_PUBLIC_API_ORIGIN, Platform.OS, NativeModules.SourceCode?.scriptURL);

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

  const { timeoutMs = 8000, ...fetchOptions } = options;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { ...fetchOptions, headers, signal: controller.signal });
    let data;
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      data = await res.json();
    } else {
      const text = await res.text();
      data = { success: false, message: text || `HTTP error ${res.status}` };
    }
    clearTimeout(timeoutId);
    return { ...data, httpStatus: res.status };
  } catch (error) {
    clearTimeout(timeoutId);
    const isTimeout = error.name === 'AbortError';
    const errorMsg = isTimeout
      ? `Server timeout (${Math.round(timeoutMs / 1000)}s). Check the connection and try again.`
      : (error.message || 'Network error connecting to backend');
    console.error(`API Error on ${endpoint}:`, errorMsg);
    return { success: false, networkError: true, message: errorMsg };
  }
};
