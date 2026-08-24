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

// --- Weekly newsletter -----------------------------------------------------
//
// generateWeeklyNewsletter writes a NewsletterDraft every week; sendDraft is
// the only path by which one reaches a student's inbox. The server treats an
// admin as the human in that path — see controllers/newsletterController.js —
// so these calls exist to give that human somewhere to stand.

export const listNewsletterDrafts = () => api.get('/admin/newsletter');
// Returns the draft plus a freshly computed `verdict` and `recipientCount`,
// so a reviewer sees what the content check thinks before deciding.
export const getNewsletterDraft = (id) => api.get(`/admin/newsletter/${id}`);
// Irreversible: mails every approved non-admin member. The server re-validates
// at this moment rather than trusting the verdict shown at review time.
export const sendNewsletterDraft = (id) => api.post(`/admin/newsletter/${id}/send`);
export const discardNewsletterDraft = (id) => api.delete(`/admin/newsletter/${id}`);

// --- Program approvals -----------------------------------------------------
//
// Registering with a non-preset program files a ProgramApproval and admits the
// person immediately; whether their program gets its own curated feed is the
// separate question these endpoints answer.

// Only pending ones — the server has no history endpoint, so an approval
// leaves this list the moment it is decided.
export const listPendingPrograms = () => api.get('/admin/programs/pending-approval');
// Returns { status, progress: syncLog, emailSent }. The approve call kicks off
// a fire-and-forget sync, so this is the only way to see how it went.
export const getProgramSyncStatus = (id) => api.get(`/admin/programs/${id}/sync-status`);
// Approves the program, admits the requester, and starts the data sync. Returns
// as soon as the sync is queued, not when it finishes.
export const approveProgram = (id) => api.post(`/admin/programs/${id}/approve`);
export const rejectProgram = (id, reason) => api.post(`/admin/programs/${id}/reject`, { reason });
