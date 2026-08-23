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

// The optional headshot. Uploaded on its own rather than as part of a save so
// the student sees it land immediately, and so the stored file is never at the
// mercy of whatever the form happens to be holding — saveResume deliberately
// cannot write these fields.
export const uploadResumePhoto = (formData) =>
  api.post('/resume/photo', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
export const deleteResumePhoto = () => api.delete('/resume/photo');

// Today's AI-written resume tip. A scheduler writes one a day (see
// server/automation/resume/generateResumeTip.js); until this call existed the
// tip was generated, stored and never read by anyone.
//
// 404 means "no tip published for today yet", which is an ordinary state on a
// day the scheduler has not run — the caller renders nothing rather than an
// error.
export const getResumeTipToday = () => api.get('/resume-tip/today');
