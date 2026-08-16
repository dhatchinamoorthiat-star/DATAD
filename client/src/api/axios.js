import axios from 'axios';
import { beginRequest, endRequest, isBackgroundRequest } from '../utils/inflight';
import { getDeviceId } from '../utils/deviceId';

// Default to a relative /api base: in dev Vite proxies it to the server,
// and in production (or through an ngrok tunnel) the API is same-origin.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  // Sent on every request, including login, so the server can register and
  // count devices without each call site having to thread it through.
  config.headers['X-Device-Id'] = getDeviceId();
  const program = localStorage.getItem('activeProgram');
  if (program && program !== 'mba') config.headers['x-program'] = program;

  // Tag rather than re-deriving on the way out: the flag is what guarantees
  // every begin() is matched by exactly one end(), even if the URL is rewritten.
  if (!isBackgroundRequest(config.url, config.method)) {
    config.__trackInflight = true;
    beginRequest();
  }
  return config;
});

// Settle the counter on BOTH paths. A rejected request that never decremented
// would pin the count above zero and hold any waiting UI open indefinitely.
const settle = (config) => {
  if (config?.__trackInflight) {
    config.__trackInflight = false;
    endRequest();
  }
};

// The 401 handler has to clear auth *through* AuthContext, not by writing to
// localStorage directly — otherwise the provider keeps its stale token in
// React state and the app renders as logged-in against an API that refuses it.
// AuthProvider registers its logout here on mount.
let onUnauthorized = null;
export const registerUnauthorizedHandler = (fn) => {
  onUnauthorized = fn;
};

api.interceptors.response.use(
  (res) => {
    settle(res.config);
    return res;
  },
  (err) => {
    settle(err.config);

    const status = err.response?.status;
    const url = err.config?.url || '';
    // A 401 from /auth/* is a failed login or reset — that's the endpoint
    // answering the question it was asked, not an expired session.
    const isAuthRequest = url.includes('/auth/');
    const isLoginPage = window.location.pathname === '/login';

    if (status === 401 && !isAuthRequest && !isLoginPage) {
      onUnauthorized?.();
    }

    return Promise.reject(err);
  }
);
export default api;
