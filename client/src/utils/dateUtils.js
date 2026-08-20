export const formatDate = (date) =>
  new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

export const formatDateTime = (date) =>
  new Date(date).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });

export const isOverdue = (date) => new Date(date) < new Date();

// YYYY-MM-DD / YYYY-MM in the browser's local timezone. toISOString() gives
// the UTC date instead, which drifts a day off local "today" for part of
// the day for any user not on UTC — e.g. near midnight in India (UTC+5:30).
export const localDateKey = (date = new Date()) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const localMonthKey = (date = new Date()) => localDateKey(date).slice(0, 7);

export const daysUntil = (date) => {
  const diff = new Date(date).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0);
  return Math.round(diff / 86400000);
};
