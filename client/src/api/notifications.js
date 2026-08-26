import api from './axios';

export const listNotifications = () => api.get('/notifications');
export const markRead = (id) => api.patch(`/notifications/${id}/read`);
export const markAllRead = () => api.patch('/notifications/read-all');
export const deleteNotification = (id) => api.delete(`/notifications/${id}`);

// ── Web Push ────────────────────────────────────────────────────────────────
export const getPushKey = () => api.get('/notifications/push/key');
export const subscribePush = (subscription) =>
  api.post('/notifications/push/subscribe', { subscription });
export const unsubscribePush = (endpoint) =>
  api.delete('/notifications/push/subscribe', { data: { endpoint } });
