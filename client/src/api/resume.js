import api from './axios';

export const getMyResume = () => api.get('/resume');
export const saveResume = (data) => api.put('/resume', data);
// Saves and emails a confirmation with the completeness score and the PDF attached.
export const submitResume = (data) => api.post('/resume/submit', data);
// The server renders the same PDF the confirmation email attaches, so the
// downloaded file and the mailed file can never disagree.
export const downloadResumePdf = () => api.get('/resume/pdf', { responseType: 'blob' });
