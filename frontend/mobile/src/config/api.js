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
const SOCKET_URL = getSocketUrl();

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

  const { timeoutMs = 8000, ...fetchOptions } = options;
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
  API_BASE_URL,
  SOCKET_URL,
  apiRequest
};
