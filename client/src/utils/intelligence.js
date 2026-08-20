// News categories — value must match the server enum.
export const CATEGORIES = [
  { value: 'stock-market', label: 'Stock Market', emoji: '📈' },
  { value: 'economy', label: 'Economy', emoji: '💹' },
  { value: 'banking-finance', label: 'Banking & Finance', emoji: '🏦' },
  { value: 'startups', label: 'Startups', emoji: '🚀' },
  { value: 'ai-tech', label: 'AI & Technology', emoji: '🤖' },
  { value: 'global-business', label: 'Global Business', emoji: '🌍' },
  { value: 'operations', label: 'Operations & Supply Chain', emoji: '📦' },
  { value: 'marketing', label: 'Marketing & Consumer', emoji: '📢' },
  { value: 'corporate', label: 'Corporate News', emoji: '🏢' },
  { value: 'placements', label: 'Placements & Hiring', emoji: '💼' },
  { value: 'psychology', label: 'Psychology & Mind', emoji: '🧠' },
  { value: 'law', label: 'Law', emoji: '⚖️' },
  { value: 'fashion-design', label: 'Fashion & Design', emoji: '👗' },
  { value: 'veterinary', label: 'Veterinary Science', emoji: '🐾' },
  { value: 'mechanical-engineering', label: 'Mechanical & Manufacturing', emoji: '⚙️' },
  { value: 'data-science', label: 'Data Science', emoji: '📊' },
];

export const categoryMeta = (value) =>
  CATEGORIES.find((c) => c.value === value) || { value, label: value, emoji: '📰' };

// Topics a user can follow, each mapped to the categories it surfaces.
export const TOPICS = [
  { value: 'Finance', categories: ['stock-market', 'banking-finance', 'economy'] },
  { value: 'Consulting', categories: ['global-business', 'corporate', 'economy'] },
  { value: 'Marketing', categories: ['marketing'] },
  { value: 'HR', categories: ['placements', 'corporate'] },
  { value: 'Operations', categories: ['operations'] },
  { value: 'Entrepreneurship', categories: ['startups'] },
  { value: 'Technology', categories: ['ai-tech'] },
  { value: 'Data Science', categories: ['data-science'] },
  { value: 'Psychology', categories: ['psychology'] },
  { value: 'Law', categories: ['law'] },
  { value: 'Fashion & Design', categories: ['fashion-design'] },
  { value: 'Veterinary', categories: ['veterinary'] },
  { value: 'Mechanical & Manufacturing', categories: ['mechanical-engineering'] },
];

// Categories surfaced by a set of followed topics.
export const categoriesForInterests = (interests = []) => {
  const set = new Set();
  for (const t of TOPICS) {
    if (interests.includes(t.value)) t.categories.forEach((c) => set.add(c));
  }
  return set;
};
