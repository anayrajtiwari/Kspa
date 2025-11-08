import axios from 'axios';

// Create base API instance
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Auth API instance (no token required for auth endpoints)
export const authAPI = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for adding auth token
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

// Response interceptor for handling common errors
api.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // Handle 401 Unauthorized errors
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (refreshToken) {
          const response = await authAPI.post('/auth/refresh-token', {
            refreshToken,
          });

          const { token } = response.data.data;
          localStorage.setItem('token', token);

          // Retry the original request with new token
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        }
      } catch (refreshError) {
        // Refresh token failed, logout user
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// API service functions
export const apiService = {
  // Auth endpoints
  auth: {
    login: (credentials) => authAPI.post('/auth/login', credentials),
    register: (userData) => authAPI.post('/auth/register', userData),
    googleLogin: (accessToken, userType) => authAPI.post('/auth/oauth/google', { accessToken, userType }),
    logout: () => api.post('/auth/logout'),
    verifyEmail: (token) => authAPI.post('/auth/verify-email', { token }),
    sendPhoneVerification: (phone) => api.post('/auth/send-phone-verification', { phone }),
    verifyPhone: (phone, code) => authAPI.post('/auth/verify-phone', { phone, code }),
    forgotPassword: (email) => authAPI.post('/auth/forgot-password', { email }),
    resetPassword: (token, password) => authAPI.post('/auth/reset-password', { token, password }),
    refreshToken: (refreshToken) => authAPI.post('/auth/refresh-token', { refreshToken }),
  },

  // User endpoints
  users: {
    getProfile: () => api.get('/users/profile'),
    updateProfile: (profileData) => api.put('/users/profile', profileData),
    uploadDocuments: (formData) => api.post('/users/upload-documents', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
    changePassword: (passwordData) => api.post('/users/change-password', passwordData),
    deactivateAccount: () => api.post('/users/deactivate'),
    getUserById: (userId) => api.get(`/users/${userId}`),
  },

  // Vehicle endpoints
  vehicles: {
    getVehicles: (params) => api.get('/vehicles', { params }),
    getVehicleById: (vehicleId) => api.get(`/vehicles/${vehicleId}`),
    createVehicle: (vehicleData) => api.post('/vehicles', vehicleData),
    updateVehicle: (vehicleId, vehicleData) => api.put(`/vehicles/${vehicleId}`, vehicleData),
    deleteVehicle: (vehicleId) => api.delete(`/vehicles/${vehicleId}`),
    uploadImages: (vehicleId, formData) => api.post(`/vehicles/${vehicleId}/upload-images`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
    featureVehicle: (vehicleId, featureData) => api.post(`/vehicles/${vehicleId}/feature`, featureData),
    compareVehicles: (vehicleIds) => api.get('/vehicles/compare', { params: { ids: vehicleIds } }),
  },

  // Search endpoints
  search: {
    getSuggestions: (params) => api.get('/search/suggestions', { params }),
    getFilters: () => api.get('/search/filters'),
    getTrending: (params) => api.get('/search/trending', { params }),
    getRecommendations: (params) => api.get('/search/recommendations', { params }),
    getPriceAnalysis: (params) => api.get('/search/price-analysis', { params }),
  },

  // Message endpoints
  messages: {
    getConversations: (params) => api.get('/messages', { params }),
    getConversation: (conversationId) => api.get(`/messages/${conversationId}`),
    sendMessage: (messageData) => api.post('/messages', messageData),
    markAsRead: (conversationId) => api.put(`/messages/${conversationId}/read`),
    archiveConversation: (conversationId) => api.put(`/messages/${conversationId}/archive`),
    addNote: (conversationId, noteData) => api.post(`/messages/${conversationId}/notes`, noteData),
    getUnreadCount: () => api.get('/messages/unread-count'),
  },

  // Appointment endpoints
  appointments: {
    getAppointments: (params) => api.get('/appointments', { params }),
    getAppointment: (appointmentId) => api.get(`/appointments/${appointmentId}`),
    scheduleAppointment: (appointmentData) => api.post('/appointments', appointmentData),
    confirmAppointment: (appointmentId, confirmData) => api.put(`/appointments/${appointmentId}/confirm`, confirmData),
    rescheduleAppointment: (appointmentId, rescheduleData) => api.put(`/appointments/${appointmentId}/reschedule`, rescheduleData),
    cancelAppointment: (appointmentId, cancelData) => api.put(`/appointments/${appointmentId}/cancel`, cancelData),
    checkAvailability: (params) => api.get('/appointments/availability', { params }),
    getUpcomingAppointments: (params) => api.get('/appointments/upcoming', { params }),
  },

  // Payment endpoints
  payments: {
    getSubscriptionPlans: () => api.get('/payments/plans'),
    createSubscription: (subscriptionData) => api.post('/payments/subscribe', subscriptionData),
    cancelSubscription: (cancelData) => api.post('/payments/cancel-subscription', cancelData),
    getSubscriptionStatus: () => api.get('/payments/subscription-status'),
  },
};

// Error handling utility
export const handleApiError = (error) => {
  if (error.response) {
    // Server responded with error status
    const { status, data } = error.response;
    return {
      message: data.error || 'An error occurred',
      status,
      details: data.details || null,
      code: data.code || null,
    };
  } else if (error.request) {
    // Request was made but no response received
    return {
      message: 'Network error. Please check your internet connection.',
      status: 0,
      details: null,
      code: 'NETWORK_ERROR',
    };
  } else {
    // Something else happened in setting up the request
    return {
      message: error.message || 'An unexpected error occurred',
      status: 0,
      details: null,
      code: 'UNKNOWN_ERROR',
    };
  }
};

// Success response utility
export const handleApiSuccess = (response) => {
  return {
    data: response.data.data,
    message: response.data.message,
    success: response.data.success,
    pagination: response.data.pagination || null,
  };
};

// Custom hooks for common API operations
export const useApi = (apiCall, dependencies = []) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const execute = async (...args) => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiCall(...args);
      setData(handleApiSuccess(response));
      return { success: true, data: response.data };
    } catch (err) {
      const errorInfo = handleApiError(err);
      setError(errorInfo);
      return { success: false, error: errorInfo };
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (dependencies.length > 0) {
      execute();
    }
  }, dependencies);

  return { data, loading, error, execute, refetch: execute };
};

export default api;