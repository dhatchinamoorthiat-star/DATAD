import api from './axios';

export const register = (data) => api.post('/auth/register', data);
export const checkEmail = (email) => api.get('/auth/check-email', { params: { email } });
export const login = (data) => api.post('/auth/login', data);
export const verifyEmail = (token) => api.post('/auth/verify-email', { token });
export const resendVerification = (email) => api.post('/auth/resend-verification', { email });
export const getMe = () => api.get('/auth/me');
export const updateProfile = (data) => api.put('/auth/profile', data);
export const uploadAvatar = (formData) => api.post('/auth/avatar', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
export const changePassword = (data) => api.put('/auth/password', data);
export const forgotPassword = (email) => api.post('/auth/forgot-password', { email });
export const resetPassword = (data) => api.post('/auth/reset-password', data);
export const deleteAccount = (password) => api.delete('/auth/me', { data: { password } });
export const listDevices = () => api.get('/auth/devices');
export const revokeDevice = (id) => api.delete(`/auth/devices/${id}`);
