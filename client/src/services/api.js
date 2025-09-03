import axios from 'axios';

// Configuration de base d'axios
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Intercepteur pour ajouter le token d'authentification
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Intercepteur pour gérer les erreurs
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// API d'authentification
export const authAPI = {
  login: (credentials) => api.post('/auth/login', credentials),
  register: (userData) => api.post('/auth/register', userData),
  getCurrentUser: () => api.get('/auth/me'),
  updateProfile: (profileData) => api.put('/auth/profile', profileData),
  becomeCreator: () => api.post('/auth/become-creator'),
};

// API des événements
export const eventAPI = {
  getEvents: (params) => api.get('/events', { params }),
  getEvent: (id) => api.get(`/events/${id}`),
  createEvent: (eventData) => api.post('/events', eventData),
  updateEvent: (id, eventData) => api.put(`/events/${id}`, eventData),
  deleteEvent: (id) => api.delete(`/events/${id}`),
  registerToEvent: (id) => api.post(`/events/${id}/register`),
  unregisterFromEvent: (id) => api.delete(`/events/${id}/unregister`),
};

// API des notes
export const ratingAPI = {
  getEventRatings: (eventId, params) => api.get(`/ratings/event/${eventId}`, { params }),
  createRating: (ratingData) => api.post('/ratings', ratingData),
  updateRating: (id, ratingData) => api.put(`/ratings/${id}`, ratingData),
  deleteRating: (id) => api.delete(`/ratings/${id}`),
  markHelpful: (id) => api.post(`/ratings/${id}/helpful`),
  reportRating: (id) => api.post(`/ratings/${id}/report`),
};

// API des utilisateurs
export const userAPI = {
  getProfile: (username) => api.get(`/users/profile/${username}`),
  getUserEvents: (username, params) => api.get(`/users/${username}/events`, { params }),
  getUserRatings: (username, params) => api.get(`/users/${username}/ratings`, { params }),
  searchUsers: (params) => api.get('/users/search', { params }),
  getTopCreators: (params) => api.get('/users/top-creators', { params }),
  getUserStats: (username) => api.get(`/users/stats/${username}`),
};

// API de santé
export const healthAPI = {
  checkHealth: () => api.get('/health'),
};

export default api;
