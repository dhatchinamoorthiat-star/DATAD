import api from './axios';

// Talent Exchange. The server mounts these under /api/talent and applies
// verifyToken once at the router, so every call here requires a signed-in user.

// --- Opportunities ---------------------------------------------------------

// `mine: true` returns your own posts in every status; otherwise the server
// returns open ones you are allowed to see (public, your program, or yours).
export const listOpportunities = (params = {}) => api.get('/talent/opportunities', { params });
export const searchOpportunities = (q, limit) =>
  api.get('/talent/opportunities/search', { params: { q, limit } });
export const getOpportunity = (id) => api.get(`/talent/opportunities/${id}`);
export const updateOpportunity = (id, body) => api.put(`/talent/opportunities/${id}`, body);
export const closeOpportunity = (id) => api.post(`/talent/opportunities/${id}/close`);
export const archiveOpportunity = (id) => api.delete(`/talent/opportunities/${id}`);
export const reportOpportunity = (id, reason) =>
  api.post(`/talent/opportunities/${id}/report`, { reason });

// create() saves a draft — a draft is invisible to everyone else and cannot be
// applied to. Publishing is what makes it 'open'. Nothing in this product asks
// a student to post twice, so the two calls are paired here rather than
// leaving a half-posted opportunity behind if the caller forgets the second.
export const createOpportunity = async (body) => {
  const { data: draft } = await api.post('/talent/opportunities', body);
  try {
    const { data: published } = await api.post(`/talent/opportunities/${draft._id}/publish`);
    return published;
  } catch (err) {
    // The draft exists but is not open. Tell the caller which it was so the
    // student is not left thinking the whole post vanished.
    err.draftId = draft._id;
    throw err;
  }
};

// --- Applications ----------------------------------------------------------

export const applyToOpportunity = (id, body) =>
  api.post(`/talent/opportunities/${id}/apply`, body);
export const listApplicants = (id) => api.get(`/talent/opportunities/${id}/applications`);
export const listMyApplications = () => api.get('/talent/applications');
export const acceptApplication = (id, body = {}) =>
  api.post(`/talent/applications/${id}/accept`, body);
export const rejectApplication = (id) => api.post(`/talent/applications/${id}/reject`);
export const withdrawApplication = (id) => api.post(`/talent/applications/${id}/withdraw`);
