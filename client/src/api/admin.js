import api from './axios';

export const getStats = () => api.get('/admin/stats');
export const listStudents = () => api.get('/admin/students');
export const approveStudent = (id) => api.patch(`/admin/students/${id}/approve`);
export const rejectStudent = (id) => api.delete(`/admin/students/${id}/reject`);
export const getActivityLogs = () => api.get('/admin/logs');
export const getReferralMap = () => api.get('/admin/referrals');

export const listJournal = () => api.get('/admin/journal');
export const createJournalEntry = (data) => api.post('/admin/journal', data);
export const updateJournalEntry = (id, data) => api.put(`/admin/journal/${id}`, data);
export const deleteJournalEntry = (id) => api.delete(`/admin/journal/${id}`);

export const createAnnouncement = (data) => api.post('/admin/announcements', data);
export const deleteAnnouncement = (id) => api.delete(`/admin/announcements/${id}`);
export const listAnnouncements = () => api.get('/announcements');

// Subscription management
export const listSubscriptionUsers    = ()              => api.get('/admin/subscriptions/users');
export const listSubscriptionRequests = (status)        => api.get('/admin/subscriptions', { params: status ? { status } : {} });
export const updateUserTier           = (id, data)      => api.patch(`/admin/subscriptions/users/${id}/tier`, data);
export const reviewSubscriptionRequest= (id, data)      => api.patch(`/admin/subscriptions/${id}/review`, data);
export const getSubscriptionAnalytics = ()              => api.get('/admin/subscriptions/analytics');
