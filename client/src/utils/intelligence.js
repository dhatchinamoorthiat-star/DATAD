import {
  TrendingUp, LineChart, Landmark, Rocket, Bot, Globe, Package, Megaphone,
  Building2, Briefcase, Brain, Scale, Shirt, PawPrint, Cog, BarChart3, Newspaper,
} from 'lucide-react';

// News categories — value must match the server enum.
//
// `icon` is a lucide component rather than an emoji: these render as chips on
// the Intelligence page and as the badge on every article card, and an emoji
// there was drawn by the reader's OS font, so the same category looked
// different on every device and matched none of the app's other icons.
export const CATEGORIES = [
  { value: 'stock-market',            label: 'Stock Market',                icon: TrendingUp },
  { value: 'economy',                 label: 'Economy',                     icon: LineChart },
  { value: 'banking-finance',         label: 'Banking & Finance',           icon: Landmark },
  { value: 'startups',                label: 'Startups',                    icon: Rocket },
  { value: 'ai-tech',                 label: 'AI & Technology',             icon: Bot },
  { value: 'global-business',         label: 'Global Business',             icon: Globe },
  { value: 'operations',              label: 'Operations & Supply Chain',   icon: Package },
  { value: 'marketing',               label: 'Marketing & Consumer',        icon: Megaphone },
  { value: 'corporate',               label: 'Corporate News',              icon: Building2 },
  { value: 'placements',              label: 'Placements & Hiring',         icon: Briefcase },
  { value: 'psychology',              label: 'Psychology & Mind',           icon: Brain },
  { value: 'law',                     label: 'Law',                         icon: Scale },
  { value: 'fashion-design',          label: 'Fashion & Design',            icon: Shirt },
  { value: 'veterinary',              label: 'Veterinary Science',          icon: PawPrint },
  { value: 'mechanical-engineering',  label: 'Mechanical & Manufacturing',  icon: Cog },
  { value: 'data-science',            label: 'Data Science',                icon: BarChart3 },
];

export const categoryMeta = (value) =>
  CATEGORIES.find((c) => c.value === value) || { value, label: value, icon: Newspaper };

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
