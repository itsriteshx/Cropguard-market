let Platform = { OS: 'web' };
let NativeModules = {};
try {
  const rn = require('react-native');
  if (rn.Platform) Platform = rn.Platform;
  if (rn.NativeModules) NativeModules = rn.NativeModules;
} catch (_) {}

const { selectApiOrigin } = require('./apiOrigin');

// A configured origin wins; LAN host detection is a convenience for Expo Go.
const origin = selectApiOrigin(process.env.EXPO_PUBLIC_API_ORIGIN, Platform.OS, NativeModules.SourceCode?.scriptURL);

const getSocketUrl = () => origin;
const resolveMediaUrl = (url) => url?.startsWith('/uploads/') ? `${origin}${url}` : url;
const API_BASE_URL = `${origin}/api`;
const getImageSource = (url) => {
  const resolved = resolveMediaUrl(url);
  if (!resolved || typeof resolved !== 'string') return null;
  if (/^https?:\/\/([^/]+\.)?(wikimedia\.org|wikipedia\.org)\//i.test(resolved)) {
    return { uri: `${API_BASE_URL}/mandi-rates/image?url=${encodeURIComponent(resolved)}` };
  }
  return { uri: resolved };
};
const SOCKET_URL = getSocketUrl();

const unauthorizedListeners = new Set();
const subscribeUnauthorized = (listener) => {
  if (typeof listener !== 'function') return () => {};
  unauthorizedListeners.add(listener);
  return () => unauthorizedListeners.delete(listener);
};

const apiRequest = async (endpoint, options = {}, token = null) => {
  const url = `${API_BASE_URL}${endpoint}`;
  const isFormData =
    (typeof FormData !== 'undefined' && options.body instanceof FormData) ||
    options.body?.constructor?.name === 'FormData';

  const headers = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };

  const { timeoutMs = 25000, ...fetchOptions } = options;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { ...fetchOptions, headers, signal: controller.signal });
    if (res.status === 204) {
      clearTimeout(timeoutId);
      return { success: true, httpStatus: 204 };
    }
    let data;
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      try {
        data = await res.json();
      } catch (_) {
        data = { success: false, message: `Malformed JSON response (HTTP ${res.status})` };
      }
    } else {
      const text = await res.text();
      data = { success: false, message: text || `HTTP error ${res.status}` };
    }
    clearTimeout(timeoutId);
    if (res.status === 401 && !String(endpoint).startsWith('/auth/')) {
      unauthorizedListeners.forEach((fn) => {
        try {
          fn(data?.message || 'Session expired');
        } catch (_) {}
      });
    }
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

module.exports = {
  getSocketUrl,
  resolveMediaUrl,
  getImageSource,
  subscribeUnauthorized,
  API_BASE_URL,
  SOCKET_URL,
  apiRequest
};
