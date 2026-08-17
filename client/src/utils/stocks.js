// Stock sectors — value must match the `sector` field in
// server/config/stockUniverse.js. Same shape as CATEGORIES in intelligence.js
// so the Stocks page can reuse the news page's filter-chip pattern.
export const SECTORS = [
  { value: 'it',          label: 'IT Services',   emoji: '💻' },
  { value: 'banking',     label: 'Banking & Financials', emoji: '🏦' },
  { value: 'fmcg',        label: 'FMCG',          emoji: '🛒' },
  { value: 'auto',        label: 'Automobiles',   emoji: '🚗' },
  { value: 'energy',      label: 'Energy',        emoji: '⚡' },
  { value: 'pharma',      label: 'Pharma & Health', emoji: '💊' },
  { value: 'industrials', label: 'Industrials',   emoji: '🏗️' },
  { value: 'telecom',     label: 'Telecom',       emoji: '📡' },
  { value: 'consumer',    label: 'Consumer & Retail', emoji: '🛍️' },
];

export const sectorMeta = (value) =>
  SECTORS.find((s) => s.value === value) || { value, label: value, emoji: '📈' };
