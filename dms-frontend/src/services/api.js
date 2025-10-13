import axios from 'axios';

// Decide the base URL:
// - Dev: talk to your local Django
// - Staging/Prod: same-origin '/api' (Nginx proxies it to Django)
// - Optional: override with REACT_APP_API_BASE_URL
const baseURL =
  (process.env.REACT_APP_API_BASE_URL && process.env.REACT_APP_API_BASE_URL.trim()) ||
  (process.env.NODE_ENV === 'development' ? 'http://127.0.0.1:8000/api' : '/api');

const API = axios.create({ baseURL });

// Attach JWT if present
API.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) config.headers['Authorization'] = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

// Silent refresh on 401 (once)
API.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error?.config;
    const status = error?.response?.status;

    if (status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) throw new Error('no refresh token');

        // Call refresh on the same base as the API instance
        const refreshURL = `${API.defaults.baseURL.replace(/\/$/, '')}/token/refresh/`;
        const { data } = await axios.post(refreshURL, { refresh: refreshToken });

        localStorage.setItem('accessToken', data.access);
        originalRequest.headers['Authorization'] = `Bearer ${data.access}`;
        return API(originalRequest); // replay the original request
      } catch (e) {
        localStorage.clear();
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);

// Helpers
export const uploadPaymentProof = (formData) => API.post('/payment-proofs/', formData);
export const getPaymentProofs = (main_document) =>
  API.get(`/payment-proofs/?main_document=${main_document}`);
export const getProgress = (jobId) => API.get(`/progress/${jobId}/`);

export default API;

