import api from './axios';

// The morning briefing written overnight by the daily-briefing scheduler
// (server/automation/briefing/generateDailyBriefing.js). Program-filtered
// server-side, and the response carries `_personalization.prioritySections`
// telling us which sections matter most for this student's specialisation.
//
// Two ordinary non-answers the caller must expect: 404 when the scheduler has
// not produced one for today, and 403 when the reader's plan does not include
// the briefing.
export const getBriefingToday = () => api.get('/briefing/today');

// Recent briefings, headline-level only (the server projects away the section
// bodies). Defaults to a week.
export const getBriefingHistory = (limit = 7) =>
  api.get('/briefing/history', { params: { limit } });
