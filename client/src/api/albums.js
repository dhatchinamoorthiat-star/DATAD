import api from './axios';

export const listAlbums = () => api.get('/albums');
export const getAlbum = (id) => api.get(`/albums/${id}`);
export const createAlbum = (data) => api.post('/albums', data);
export const deleteAlbum = (id) => api.delete(`/albums/${id}`);
