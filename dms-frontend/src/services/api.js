import axios from 'axios';

const API = axios.create({
  baseURL: 'http://127.0.0.1:8000/api',
});

// Add a request interceptor
API.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// silent refresh
API.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) throw new Error('no refresh token');
        const { data } = await axios.post(
          'http://127.0.0.1:8000/api/token/refresh/',
          { refresh: refreshToken }
        );
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

export default API;
