import { dayIndex } from './rotation';

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

// The rotation below advances once per calendar day and is identical for
// everyone who opens the page that day — no per-user state to store, and two
// students comparing screens see the same thing.
//
// dayIndex now comes from utils/rotation.js, which generalised this pattern for
// the Money Basics and Wellbeing pages. It counts local days rather than UTC
// ones, so the rotation turns over at local midnight instead of 05:30 IST.

// The universe is a fixed ~54 symbols and the API returns them sorted by
// symbol, so without this the same alphabetical head of the list sat at the top
// of the page every single day and six of the nine sectors were never seen.
//
// This takes one stock per sector, stepping through each sector's own list by
// the day index, so the featured row is different every day and every stock
// comes around in turn. Sectors are stepped independently, which matters
// because they are wildly uneven in size (telecom has 2, banking has 9) — a
// single shared offset would keep re-showing the small sectors while the big
// ones crawled.
//
// This is presentation only: which of the user's own tracked stocks to surface
// first. It is not a screen, a ranking, or a claim that these are worth buying.
export function dailyRotation(quotes) {
  if (!quotes?.length) return [];
  const day = dayIndex();

  return SECTORS.map(({ value }) => {
    const inSector = quotes
      .filter((q) => q.sector === value)
      .sort((a, b) => a.symbol.localeCompare(b.symbol));
    if (!inSector.length) return null;
    return inSector[day % inSector.length];
  }).filter(Boolean);
}
