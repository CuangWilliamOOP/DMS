import axios from 'axios';

// Use REACT_APP_API_URL if available, otherwise default to local development server
const baseURL = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000/api';

const API = axios.create({
  baseURL,
});

export default API;
