import api from './axios';

export const getMySubscription     = ()       => api.get('/subscription/me');
export const getSubscriptionStatus = ()       => api.get('/subscription/me');
export const submitPaymentRef   = (data)      => api.post('/subscription/request', data);
export const activateTrial      = ()          => api.post('/subscription/trial');

// Razorpay. getPaymentConfig decides which checkout the UI offers, so the key
// id and the gateway's availability come from the server rather than a build
// time VITE_ variable that could disagree with it.
export const getPaymentConfig   = ()          => api.get('/subscription/config');
export const createOrder        = (data)      => api.post('/subscription/order', data);
export const verifyPayment      = (data)      => api.post('/subscription/verify', data);
