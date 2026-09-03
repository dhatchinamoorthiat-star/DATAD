const NAV_ITEMS = [
  { id: 'dashboard',   title: 'Dashboard',   subtitle: 'Home',            url: '/',                          icon: 'LayoutDashboard', priority: 90 },
  { id: 'planner',     title: 'Planner',     subtitle: 'Tasks & schedule', url: '/me/planner',                icon: 'CalendarDays',   priority: 85 },
  { id: 'notes',       title: 'Notes',       subtitle: 'Study notes',      url: '/study/notes',               icon: 'FileText',       priority: 80 },
  { id: 'finance',     title: 'Finance',     subtitle: 'Budget & expenses', url: '/finance',               icon: 'Wallet',         priority: 75 },
  { id: 'career',      title: 'Career Hub',  subtitle: 'Placement journey', url: '/placement',                   icon: 'Briefcase',      priority: 74 },
  { id: 'resume',      title: 'Resume',      subtitle: 'Build & review',    url: '/placement/resume',            icon: 'FileUser',       priority: 73 },
  { id: 'companies',   title: 'Companies',   subtitle: 'Research',          url: '/placement/companies',         icon: 'Building2',      priority: 72 },
  { id: 'interview',   title: 'Interview Questions', subtitle: 'Prep',     url: '/placement/questions',         icon: 'MessageSquare',  priority: 71 },
  { id: 'community',   title: 'Community',   subtitle: 'Feed & events',     url: '/community',                icon: 'Users',          priority: 70 },
  { id: 'feed',        title: 'Feed',        subtitle: 'Community stream',  url: '/community/feed',           icon: 'Rss',            priority: 69 },
  { id: 'events',      title: 'Events',      subtitle: 'Upcoming events',   url: '/community/events',         icon: 'Calendar',       priority: 68 },
  { id: 'briefing',    title: 'Briefing',    subtitle: 'News & market',     url: '/briefing',                 icon: 'Newspaper',      priority: 67 },
  { id: 'journal',     title: 'Journal',     subtitle: 'Personal journal',  url: '/me/journal',               icon: 'BookOpen',       priority: 65 },
  { id: 'wellbeing',   title: 'Wellbeing',   subtitle: 'Health & habits',   url: '/wellbeing',             icon: 'Heart',          priority: 64 },
  { id: 'settings',    title: 'Settings',    subtitle: 'Preferences',       url: '/me/settings',              icon: 'Settings',       priority: 63 },
  { id: 'study',       title: 'Study Hub',   subtitle: 'All study tools',   url: '/study',                    icon: 'GraduationCap',  priority: 62 },
  { id: 'marketplace', title: 'Marketplace', subtitle: 'Buy & sell',        url: '/community/marketplace',    icon: 'ShoppingBag',    priority: 55 },
  { id: 'directory',   title: 'Directory',   subtitle: 'Find classmates',   url: '/community/directory',      icon: 'AddressBook',    priority: 50 },
  { id: 'memories',    title: 'Memories',    subtitle: 'Archive',           url: '/community/memories',       icon: 'History',        priority: 45 },
  { id: 'announcements', title: 'Announcements', subtitle: 'Official news', url: '/community/announcements',  icon: 'Megaphone',      priority: 44 },
  { id: 'roadmap',       title: 'Skill Roadmap',  subtitle: '3-month upskilling plan', url: '/growth/roadmap',          icon: 'Map',         priority: 41 },
  { id: 'opportunities', title: 'Opportunities', subtitle: 'Jobs & internships', url: '/placement/opportunities', icon: 'Target',       priority: 40 },
  { id: 'skill-exchange', title: 'Skill Exchange', subtitle: 'Peer learning', url: '/community/skills',       icon: 'Handshake',      priority: 35 },
];

const ADMIN_ITEMS = [
  { id: 'admin',          title: 'Admin Dashboard',  subtitle: 'System overview',    url: '/admin',                   icon: 'Shield',      priority: 30, admin: true },
  { id: 'admin-students', title: 'Admin — Students', subtitle: 'Manage students',    url: '/admin/students',          icon: 'Users',       priority: 29, admin: true },
  { id: 'admin-ai',       title: 'Admin — AI Center',subtitle: 'AI observability',   url: '/admin/ai-center',         icon: 'Brain',       priority: 28, admin: true },
  { id: 'admin-ai-runtime',title: 'Admin — AI Runtime',subtitle: 'Live AI dashboard',url: '/admin/ai-runtime',        icon: 'Activity',    priority: 27, admin: true },
  { id: 'admin-studio',   title: 'Admin — Studio',   subtitle: 'Content publishing',  url: '/admin/studio',            icon: 'Palette',     priority: 26, admin: true },
  { id: 'admin-announcements', title: 'Admin — Announcements', subtitle: 'Post updates', url: '/admin/announcements', icon: 'Megaphone',  priority: 25, admin: true },
  { id: 'admin-companies',title: 'Admin — Companies',subtitle: 'Company management',  url: '/admin/companies',          icon: 'Building2',   priority: 24, admin: true },
  { id: 'admin-cases',    title: 'Admin — Cases',    subtitle: 'Daily case studies',  url: '/admin/cases',              icon: 'Briefcase',   priority: 23, admin: true },
  { id: 'admin-automation',title: 'Admin — Automation',subtitle: 'Scheduled jobs',    url: '/admin/automation',         icon: 'Bot',         priority: 22, admin: true },
  { id: 'admin-logs',     title: 'Admin — Logs',     subtitle: 'Activity audit',      url: '/admin/logs',               icon: 'ScrollText',  priority: 21, admin: true },
  { id: 'admin-archive',  title: 'Admin — Archive',  subtitle: 'Content archive',     url: '/admin/archive',            icon: 'Archive',     priority: 20, admin: true },
  { id: 'admin-referrals',title: 'Admin — Referrals',subtitle: 'Referral tracking',    url: '/admin/referrals',          icon: 'GitFork',     priority: 19, admin: true },
  { id: 'admin-subscriptions', title: 'Admin — Subscriptions', subtitle: 'Billing',  url: '/admin/subscriptions',     icon: 'CreditCard',  priority: 18, admin: true },
];

const COMMANDS = [
  { id: 'go-dashboard',     title: 'Go to Dashboard',     keywords: ['home', 'main', 'start'],        url: '/' },
  { id: 'open-planner',     title: 'Open Planner',        keywords: ['schedule', 'tasks', 'todo'],     url: '/me/planner' },
  { id: 'new-note',         title: 'New Note',            keywords: ['create note', 'write'],          url: '/study/notes/new' },
  { id: 'create-task',      title: 'Create Task',         keywords: ['add task', 'new task', 'todo'],  url: '/me/planner' },
  { id: 'open-resume',      title: 'Open Resume Builder', keywords: ['cv', 'curriculum', 'profile'],   url: '/placement/resume' },
  { id: 'open-finance',     title: 'Open Finance',        keywords: ['money', 'budget', 'expenses'],   url: '/finance' },
  { id: 'open-community',   title: 'Open Community',      keywords: ['feed', 'social', 'network'],     url: '/community' },
  { id: 'open-settings',    title: 'Open Settings',       keywords: ['preferences', 'config'],         url: '/me/settings' },
  { id: 'open-roadmap',     title: 'Open Skill Roadmap',  keywords: ['roadmap', 'skill gap', 'upskill'], url: '/growth/roadmap' },
  { id: 'open-admin',       title: 'Open Admin',          keywords: ['admin', 'manage', 'control'],    url: '/admin' },
  { id: 'review-resume',    title: 'Review Resume',       keywords: ['ai review', 'feedback', 'ats'],  url: '/placement/resume' },
  { id: 'summarize-notes',  title: 'Summarize Notes',     keywords: ['ai summary', 'dax summary'],     url: '/study/notes' },
  { id: 'chat-dax',         title: 'Chat with Dax',       keywords: ['ai', 'assistant', 'help'],       action: 'open-chat' },
];

module.exports = {
  id: 'navigation',
  label: 'Pages',
  priority: 100,

  async search(query, userId) {
    const q = query.toLowerCase();
    const isAdmin = false; // will be set by router

    const items = [
      ...NAV_ITEMS,
      ...(isAdmin ? ADMIN_ITEMS : ADMIN_ITEMS.map((a) => ({ ...a, admin: true }))),
    ];

    return items
      .map((item) => {
        const title = item.title.toLowerCase();
        const subtitle = item.subtitle.toLowerCase();
        const keywords = (item.keywords || []).join(' ').toLowerCase();

        let matchScore = 0;
        if (title === q) matchScore = 100;
        else if (title.startsWith(q)) matchScore = 60;
        else if (title.includes(q)) matchScore = 30;

        if (subtitle.startsWith(q)) matchScore = Math.max(matchScore, 25);
        if (keywords.includes(q)) matchScore = Math.max(matchScore, 20);

        return {
          id: item.id,
          title: item.title,
          subtitle: item.subtitle,
          url: item.url,
          icon: item.icon || 'Navigation',
          action: item.action,
          tags: item.keywords || [],
          priority: item.priority || 0,
          admin: item.admin || false,
          matchType: matchScore >= 100 ? 'exact' : matchScore >= 60 ? 'prefix' : 'fuzzy',
          _matchScore: matchScore,
        };
      })
      .filter((r) => r._matchScore > 0)
      .sort((a, b) => b._matchScore - a._matchScore)
      .slice(0, 10);
  },

  async getCommands() {
    return COMMANDS.map((c) => ({
      id: c.id,
      title: c.title,
      keywords: c.keywords,
      url: c.url,
      action: c.action,
      icon: 'Terminal',
    }));
  },
};
