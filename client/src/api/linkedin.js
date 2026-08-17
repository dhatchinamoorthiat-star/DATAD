import api from './axios';

// LinkedIn Enhancer. Every call is scoped to the signed-in user server-side —
// none of these take a user id, by design.
export const getLinkedIn       = ()        => api.get('/linkedin');
export const saveLinkedInProfile = (data)  => api.put('/linkedin/profile', data);
export const setLinkedInTarget = (target)  => api.put('/linkedin/target', target);
export const analyzeLinkedIn   = (data)    => api.post('/linkedin/analyze', data || {});
export const matchLinkedInJob  = (data)    => api.post('/linkedin/job-match', data);
export const listLinkedInAnalyses = (limit = 10) => api.get('/linkedin/analyses', { params: { limit } });
export const getLinkedInAnalysis  = (id)   => api.get(`/linkedin/analyses/${id}`);
export const deleteLinkedInData   = ()     => api.delete('/linkedin');
