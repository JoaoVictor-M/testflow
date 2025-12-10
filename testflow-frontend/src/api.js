import axios from 'axios';

// O '/api' é a "chave" que o nginx.conf procura.
// Em produção (docker-compose), ele vai usar /api
// Em dev (npm run dev), ele vai usar a VITE_API_URL
const API_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_URL
});

// Adiciona o token em todas as requisições
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});


export default api;