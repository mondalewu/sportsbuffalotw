import axios from 'axios';

// production: VITE_API_BASE_URL=https://xxx.railway.app
// development: '' (使用 Vite proxy 轉發至 localhost:3001)
const BASE = import.meta.env.VITE_API_BASE_URL || '';

const apiClient = axios.create({
  baseURL: `${BASE}/api/v1`,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

export default apiClient;

