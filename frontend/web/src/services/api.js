import axios from 'axios';

// Base API configuration (Uses Vite proxy in dev or direct host in standalone)
const API_BASE = import.meta.env.VITE_API_URL || '/api';

const apiClient = axios.create({
  baseURL: API_BASE,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Auto-attach JWT Bearer token if present
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('cropguard_web_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response error handler
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const url = error.config?.url || '';
    const message = error.response?.data?.message || error.message || 'API Request Failed';
    console.warn('[CropGuard API Warning]:', message);

    // If token is invalid or expired on protected routes, auto-clear stale auth state
    if (status === 401 && !url.includes('/auth/login') && !url.includes('/auth/register')) {
      localStorage.removeItem('cropguard_web_token');
      localStorage.removeItem('cropguard_web_user');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('cropguard_auth_expired', { detail: { message } }));
      }
    }

    return Promise.reject(error);
  }
);

/* ==========================================================================
   API SERVICES
   ========================================================================== */

// Auth Endpoints
export const authService = {
  login: async (phone, password) => {
    const res = await apiClient.post('/auth/login', { phone, password });
    return res.data;
  },
  register: async (userData) => {
    const res = await apiClient.post('/auth/register', userData);
    return res.data;
  },
  getMe: async () => {
    const res = await apiClient.get('/auth/me');
    return res.data;
  },
};

// Produce Listings
export const listingsService = {
  getAll: async (params = {}) => {
    const res = await apiClient.get('/listings', { params });
    return res.data;
  },
  getMyListings: async () => {
    const res = await apiClient.get('/listings/my-listings');
    return res.data;
  },
  getById: async (id) => {
    const res = await apiClient.get(`/listings/${id}`);
    return res.data;
  },
  create: async (data) => {
    const res = await apiClient.post('/listings', data);
    return res.data;
  },
  update: async (id, data) => {
    const res = await apiClient.put(`/listings/${id}`, data);
    return res.data;
  },
  remove: async (id) => {
    const res = await apiClient.delete(`/listings/${id}`);
    return res.data;
  },
};

// Media Upload
export const uploadService = {
  uploadPhotos: async (files = []) => {
    const formData = new FormData();
    files.forEach((file) => formData.append('photos', file));
    const res = await apiClient.post('/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },
};

// Live Price Negotiations
export const negotiationsService = {
  getMy: async () => {
    const res = await apiClient.get('/negotiations/my');
    return res.data;
  },
  getById: async (id) => {
    const res = await apiClient.get(`/negotiations/${id}`);
    return res.data;
  },
  start: async ({ listingId, offeredPrice, quantity, note }) => {
    const res = await apiClient.post('/negotiations', {
      listingId,
      offeredPrice,
      quantity,
      note,
    });
    return res.data;
  },
  counter: async (id, { counterPrice, note }) => {
    const res = await apiClient.post(`/negotiations/${id}/counter`, {
      counterPrice,
      note,
    });
    return res.data;
  },
  accept: async (id, expectedPrice) => {
    const res = await apiClient.post(`/negotiations/${id}/accept`, {
      expectedPrice,
    });
    return res.data;
  },
  reject: async (id, reason) => {
    const res = await apiClient.post(`/negotiations/${id}/reject`, { reason });
    return res.data;
  },
};

// Mandi Intelligence & Live External APIs (Agmarknet, Open-Meteo Weather, India Post Pincode)
export const mandiService = {
  getRates: async (params = {}) => {
    const res = await apiClient.get('/mandi-rates', { params });
    return res.data;
  },
  getLiveRates: async (params = {}) => {
    const res = await apiClient.get('/mandi-rates/live', { params });
    return res.data;
  },
  getWeather: async (params = {}) => {
    const res = await apiClient.get('/mandi-rates/weather', { params });
    return res.data;
  },
  getPincode: async (pincode) => {
    const res = await apiClient.get(`/mandi-rates/pincode/${pincode}`);
    return res.data;
  },
  getBenchmark: async (cropName, state = 'Karnataka') => {
    const res = await apiClient.get('/mandi-rates/benchmark', {
      params: { commodity: cropName, cropName, state },
    });
    return res.data;
  },
  getAnalytics: async (params = {}) => {
    const res = await apiClient.get('/mandi-rates/analytics', { params });
    return res.data;
  },
  getAnalyticsTrends: async (params = {}) => {
    const res = await apiClient.get('/mandi-rates/analytics/trends', { params });
    return res.data;
  },
  getMarketComparison: async (params = {}) => {
    const res = await apiClient.get('/mandi-rates/analytics/markets', { params });
    return res.data;
  },
};

// Bulk Orders & Escrow
export const ordersService = {
  getAll: async (params = {}) => {
    const res = await apiClient.get('/orders', { params });
    return res.data;
  },
  create: async (data) => {
    const res = await apiClient.post('/orders', data);
    return res.data;
  },
  updateStatus: async (orderId, status) => {
    const res = await apiClient.patch(`/orders/${orderId}/status`, {
      nextStatus: status,
      status,
    });
    return res.data;
  },
  getFarmerLedger: async (params = {}) => {
    const res = await apiClient.get('/orders/farmer-ledger', { params });
    return res.data;
  },
  getReceipt: async (orderId) => {
    const res = await apiClient.get(`/orders/${orderId}/receipt`);
    return res.data;
  },
};

// Statutory Audit & Fair-Trade Khata
export const auditService = {
  getLogs: async (params = {}) => {
    const res = await apiClient.get('/audit', { params });
    return res.data;
  },
  getSummary: async () => {
    const res = await apiClient.get('/audit/summary');
    return res.data;
  },
};

// System Health & Catalog
export const systemService = {
  getHealth: async () => {
    const res = await apiClient.get('/health');
    return res.data;
  },
  getStats: async () => {
    const res = await apiClient.get('/health/stats');
    return res.data;
  },
  getDocs: async () => {
    const res = await apiClient.get('/docs');
    return res.data;
  },
};

export default apiClient;
