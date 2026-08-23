import api from './axios';

export function daxTask(task, payload = {}) {
  return api.post('/dax', { task, ...payload });
}

export function daxChat(message, config) {
  return api.post('/dax', { task: 'chat', message }, config);
}

export function getDaxMemory() {
  return api.get('/dax/memory');
}

export function updateDaxMemory(patch) {
  return api.patch('/dax/memory', patch);
}

export function forgetDaxMemory() {
  return api.delete('/dax/memory');
}

export function getChatHistory(conversationId) {
  return api.get('/dax/chat/history', {
    params: conversationId ? { conversationId } : undefined,
  });
}

export function clearChat() {
  return api.delete('/dax/chat');
}

// ── Conversations ───────────────────────────────────────────────
// Conversations are server-owned objects. They used to exist only in
// localStorage, which meant the sidebar and the model disagreed about what a
// conversation was, and nothing survived a change of device.

export function listConversations() {
  return api.get('/dax/conversations');
}

export function createConversationRemote(payload = {}) {
  return api.post('/dax/conversations', payload);
}

export function getConversationRemote(id) {
  return api.get(`/dax/conversations/${id}`);
}

export function updateConversationRemote(id, patch) {
  return api.patch(`/dax/conversations/${id}`, patch);
}

export function deleteConversationRemote(id) {
  return api.delete(`/dax/conversations/${id}`);
}

// One-time upload of pre-existing localStorage conversations. Idempotent
// server-side on (user, clientId), so a retry cannot duplicate history.
export function importConversations(conversations) {
  return api.post('/dax/conversations/import', { conversations });
}

// ── Model Selection ──────────────────────────────────────────

export function getAvailableModels() {
  return api.get('/dax/models');
}

export function getModelPreference() {
  return api.get('/dax/model/preference');
}

export function setModelPreference(modelId) {
  return api.put('/dax/model/preference', { modelId });
}

// ── New AI Features ─────────────────────────────────────────────

export function flashcardGenerate(topic, count = 10) {
  return api.post('/dax', { task: 'flashcard-generate', topic, count });
}

export function quizGenerate(topic, count = 5, difficulty = 'medium') {
  return api.post('/dax', { task: 'quiz-generate', topic, count, difficulty });
}

export function financeAssist(question) {
  return api.post('/dax', { task: 'finance-assist', question });
}

export function dashboardInsights() {
  return api.post('/dax', { task: 'dashboard-insights' });
}

export function companyResearch(companyName, sector) {
  return api.post('/dax', { task: 'company-research', companyName, sector });
}

export function resumeAts(targetRole) {
  return api.post('/dax', { task: 'resume-ats', targetRole });
}

// ── Consolidated from api/ai.js + api/aiTools.js (Migration Blueprint Phase 1,
// P1-4) — both were thin wrappers that already called daxTask() under the
// hood. Merging removes the extra files with zero behavior change; every
// function below calls the same endpoint it always did.

export const summariseNote = (noteId) => daxTask('summarise-note', { noteId });
export const generateFramework = (data) => daxTask('case-framework', data);
export const plannerSuggest = () => daxTask('planner-suggest');
export const careerAdvice = (data) => daxTask('career-advice', data);
export const semanticSearch = (data) => daxTask('search', data);
export const reviewResume = () => daxTask('review-resume');

export const summariseDoc = (text) => daxTask('summarise-doc', { text });
export const askCareerAdvice = (question) => daxTask('career-advice', { question });
export const simulateInterview = (payload) => daxTask('interview-simulator', payload);
export const compareCompanies = (slugA, slugB) => daxTask('compare-companies', { slugA, slugB });

// ── Proposed writes ─────────────────────────────────────────────
// Confirm/reject take an id only — the arguments were validated and stored
// server-side when the proposal was made, so nothing here can alter what
// actually gets written.

export function confirmProposal(id) {
  return api.post(`/dax/proposals/${id}/confirm`);
}

export function rejectProposal(id) {
  return api.post(`/dax/proposals/${id}/reject`);
}

export function undoProposal(id) {
  return api.post(`/dax/proposals/${id}/undo`);
}

export function listPendingProposals(conversationId) {
  return api.get('/dax/proposals', {
    params: conversationId ? { conversationId } : undefined,
  });
}

// Read an attached document's text server-side. Reuses the same extractor the
// Content Studio uses (PDF, Word, Excel, ZIP); the file is read in memory and
// never stored. Images, audio, video and slides come back with empty text —
// there is no OCR or vision behind this.
export const extractAttachmentText = (file) => {
  const formData = new FormData();
  formData.append('file', file);
  return api.post('/dax/attachments/extract', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};
