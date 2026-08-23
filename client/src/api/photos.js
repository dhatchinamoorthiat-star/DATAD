import api from './axios';

export const listAlbumPhotos = (albumId) => api.get(`/photos/album/${albumId}`);
export const listRecentPhotos = () => api.get('/photos/recent');
export const deletePhoto = (id) => api.delete(`/photos/${id}`);

export const uploadPhoto = ({ albumId, file, caption }) => {
  const formData = new FormData();
  formData.append('image', file);
  formData.append('albumId', albumId);
  if (caption) formData.append('caption', caption);
  return api.post('/photos', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
};
