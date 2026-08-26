import {
  Activity, AlertTriangle, Archive, AtSign, Award, BarChart3, Bell, BookOpen, Bot,
  Brain, Briefcase, Building2, Calendar, CalendarDays, CheckSquare, Circle, Clock,
  Command, Contact, CreditCard, Download, FileText, FileUser, FolderGit2, GitFork,
  GraduationCap, Handshake, Heart, History, Key, LayoutDashboard, Lightbulb, Lock,
  Megaphone, MessageCircle, MessageSquare, Navigation, Newspaper, Palette, Pin, Rss,
  ScrollText, Settings, Shield, ShoppingBag, Sparkles, Star, Tags, Target, Terminal,
  ThumbsUp, Trash, Trash2, TrendingDown, TrendingUp, User, Users, Wallet, Wrench, Zap,
} from 'lucide-react';

// Server-named icons, resolved to real icon components.
//
// Search results and notifications both arrive from the API tagged with an
// icon, and both surfaces used to keep their own map from that tag to an
// emoji. That had three costs: the same result was one glyph in the command
// palette and a different one on the search page, emoji are drawn by whatever
// font the reader's OS ships (so the product genuinely looked different on a
// Mac, a Windows laptop and an Android phone), and none of them matched the
// lucide icons used everywhere else in the app.
//
// The API now sends lucide names, which is what the emoji maps were keyed by
// all along, and this is the single place that turns a name into a glyph.
//
// Imported explicitly rather than as `import * as lucide` so the bundler can
// still drop the ~1500 icons this app never asks for.
const ICONS = {
  Activity, AlertTriangle, Archive, AtSign, Award, BarChart3, Bell, BookOpen, Bot,
  Brain, Briefcase, Building2, Calendar, CalendarDays, CheckSquare, Clock, Command,
  CreditCard, Download, FileText, FileUser, FolderGit2, GitFork, GraduationCap,
  Handshake, Heart, History, Key, LayoutDashboard, Lightbulb, Lock, Megaphone,
  MessageCircle, MessageSquare, Navigation, Newspaper, Palette, Pin, Rss, ScrollText,
  Settings, Shield, ShoppingBag, Sparkles, Star, Tags, Target, Terminal, ThumbsUp,
  Trash, Trash2, TrendingDown, TrendingUp, User, Users, Wallet, Wrench, Zap,
  // Names the API sends that lucide does not carry under that spelling.
  AddressBook: Contact,
  Certificate: Award,
};

/**
 * `name` is either a lucide icon name, or a URL/path when the item carries a
 * real image of its own (a company logo, an avatar) — those are shown as-is.
 *
 * Anything unrecognised falls back to a neutral dot rather than disappearing,
 * so a new result or notification type added on the server can never blank out
 * a row here.
 */
export default function NamedIcon({ name, className = 'h-4 w-4' }) {
  if (name?.startsWith('http') || name?.startsWith('/')) {
    return <img src={name} alt="" className={`${className} rounded object-cover`} />;
  }
  const Icon = ICONS[name] || Circle;
  return <Icon className={`${className} shrink-0`} aria-hidden />;
}
