import api from './axios';

export const listArticles = (category) => api.get('/intelligence', { params: { category } });
export const getForYouNews = () => api.get('/intelligence/for-you');
export const listBookmarked = () => api.get('/intelligence/bookmarks');
export const toggleBookmark = (id) => api.post(`/intelligence/${id}/bookmark`);
export const setInterests = (interests) => api.put('/intelligence/interests', { interests });
export const refreshNews = () => api.post('/intelligence/refresh');

export const getMarket = () => api.get('/intelligence/market');
