import api from './axios';

export const getMyResume = () => api.get('/resume');
export const saveResume = (data) => api.put('/resume', data);
// Saves and emails a confirmation with the completeness score and the PDF
// attached. `delivery` optionally also mails a copy of that same PDF to an
// address the student typed — { deliverTo: 'other', recipientEmail } — which
// the server validates and rate-limits.
export const submitResume = (data, delivery = {}) => api.post('/resume/submit', { ...data, ...delivery });
// The server renders the same PDF the confirmation email attaches, so the
// downloaded file and the mailed file can never disagree.
export const downloadResumePdf = () => api.get('/resume/pdf', { responseType: 'blob' });
