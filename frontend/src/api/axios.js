import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || '/api/';

const api = axios.create({ baseURL: BASE_URL, timeout: 20000 });

// ── Attach access token to every request ─────────────────────────────────────
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('access_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

// ── Silently refresh expired access tokens ────────────────────────────────────
let isRefreshing = false;
let refreshQueue = [];

const processQueue = (error, token = null) => {
    refreshQueue.forEach(p => (error ? p.reject(error) : p.resolve(token)));
    refreshQueue = [];
};

api.interceptors.response.use(
    response => response,
    async error => {
        const original = error.config;
        if (error.response?.status !== 401 || original._retry) {
            return Promise.reject(error);
        }

        if (isRefreshing) {
            return new Promise((resolve, reject) => refreshQueue.push({ resolve, reject }))
                .then(token => {
                    original.headers.Authorization = 'Bearer ' + token;
                    return api(original);
                });
        }

        original._retry = true;
        isRefreshing = true;

        const refreshToken = localStorage.getItem('refresh_token');
        if (!refreshToken) {
            localStorage.removeItem('access_token');
            window.location.href = '/login';
            return Promise.reject(error);
        }

        try {
            const { data } = await axios.post(BASE_URL + 'token/refresh/', { refresh: refreshToken });
            localStorage.setItem('access_token', data.access);
            if (data.refresh) localStorage.setItem('refresh_token', data.refresh);
            processQueue(null, data.access);
            original.headers.Authorization = 'Bearer ' + data.access;
            return api(original);
        } catch (refreshError) {
            processQueue(refreshError, null);
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
            window.location.href = '/login';
            return Promise.reject(refreshError);
        } finally {
            isRefreshing = false;
        }
    }
);

export default api;
