import axios from 'axios';

// Base API configuration (Direct to Express server on port 5001 or through Vite dev proxy)
const API_BASE = 'http://localhost:5001/api';

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
    const message = error.response?.data?.message || error.message || 'API Request Failed';
    console.warn('[CropGuard API Warning]:', message);
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
  getById: async (id) => {
    const res = await apiClient.get(`/listings/${id}`);
    return res.data;
  },
  create: async (data) => {
    const res = await apiClient.post('/listings', data);
    return res.data;
  },
};

// Mandi Intelligence & Benchmarks
export const mandiService = {
  getRates: async (params = {}) => {
    const res = await apiClient.get('/mandi-rates', { params });
    return res.data;
  },
  getBenchmark: async (cropName, state = 'Karnataka') => {
    const res = await apiClient.get('/mandi-rates/benchmark', {
      params: { cropName, state },
    });
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
    const res = await apiClient.patch(`/orders/${orderId}/status`, { status });
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

// System Health & Catalog
export const systemService = {
  getHealth: async () => {
    const res = await apiClient.get('/health');
    return res.data;
  },
  getDocs: async () => {
    const res = await apiClient.get('/docs');
    return res.data;
  },
};

export default apiClient;
