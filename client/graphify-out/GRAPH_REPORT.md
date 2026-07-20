# Graph Report - client  (2026-07-20)

## Corpus Check
- 283 files · ~122,518 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1383 nodes · 3201 edges · 88 communities (75 shown, 13 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 7 edges (avg confidence: 0.76)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `0becd618`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- FinancePage.jsx
- formatDate
- App.jsx
- FeedPage.jsx
- DaxApp.jsx
- AdminStudioReviewPage.jsx
- axios.js
- ProjectsPage.jsx
- SearchPage.jsx
- RegisterPage.jsx
- PlacementsPage.jsx
- manifest.json
- IntelligencePage.jsx
- motion.jsx
- useDocumentTitle
- AppShell.jsx
- LivingSurface.jsx
- AIToolsPage.jsx
- react
- SettingsPage.jsx
- devDependencies
- Skeleton.jsx
- AssistantMessage.jsx
- dependencies
- .eslintrc.json
- dax.js
- DiscussionsPage.jsx
- ResumePage.jsx
- DaxHome.jsx
- StudyHubPage.jsx
- Button.jsx
- SubscriptionContext.jsx
- PlannerPage.jsx
- useAuth
- DirectoryPage.jsx
- ReadinessPage.jsx
- ResourcesPage.jsx
- ComposerToolbar.jsx
- daxChatAdapter.js
- CareerHubPage.jsx
- EventsPage.jsx
- TierGate.jsx
- Composer.jsx
- PageHeader.jsx
- StudyToolsPage.jsx
- AboutPage.jsx
- PWAContext.jsx
- sw.js
- MarketplacePage.jsx
- StarStoriesPage.jsx
- MessageContent.jsx
- FinanceCalculatorPage.jsx
- AIEnhancement.jsx
- SupportPage.jsx
- package.json
- DaxMemoryPanel.jsx
- SkillExchangePage.jsx
- AdminStudioPage.jsx
- Calculators.jsx
- LoginPage.jsx
- PlacementCountdown.jsx
- NotificationBell.jsx
- DailyCaseCard.jsx
- PremiumPanel.jsx
- LegalLayout.jsx
- MessageList.jsx
- ErrorBoundary
- useRegisterForm.js
- useOfflineQueue.js
- modules.js
- eslint.config.cjs
- TodayFocus.jsx
- CreatorPage.jsx
- ProgressBar.jsx
- date-fns
- react
- react-dom
- react-hook-form
- react-hot-toast
- remark-gfm
- @tanstack/react-virtual

## God Nodes (most connected - your core abstractions)
1. `react` - 140 edges
2. `useDocumentTitle()` - 59 edges
3. `useAuth()` - 47 edges
4. `api` - 40 edges
5. `Page()` - 40 edges
6. `formatDate()` - 36 edges
7. `EmptyState()` - 26 edges
8. `Button` - 22 edges
9. `Modal()` - 22 edges
10. `FeedSkeleton()` - 20 edges

## Surprising Connections (you probably didn't know these)
- `ResumePreviewPage()` --calls--> `getMyResume()`  [EXTRACTED]
  src/pages/ResumePreviewPage.jsx → src/api/resume.js
- `ChatBot()` --indirect_call--> `chip()`  [INFERRED]
  src/components/chat/ChatBot.jsx → src/pages/IntelligencePage.jsx
- `SectionTransition()` --indirect_call--> `wait()`  [INFERRED]
  src/components/common/SectionTransition.jsx → src/dax/lib/streaming.js
- `AIToolsPage()` --calls--> `useDocumentTitle()`  [EXTRACTED]
  src/pages/study/AIToolsPage.jsx → src/hooks/useDocumentTitle.js
- `AdminRoute()` --calls--> `useAuth()`  [EXTRACTED]
  src/App.jsx → src/context/AuthContext.jsx

## Import Cycles
- None detected.

## Communities (88 total, 13 thin omitted)

### Community 0 - "FinancePage.jsx"
Cohesion: 0.06
Nodes (62): createEvent(), deleteEvent(), getEvents(), getHolidays(), createExpense(), deleteExpense(), getSummary(), listExpenses() (+54 more)

### Community 1 - "formatDate"
Cohesion: 0.05
Nodes (47): approveStudent(), createAnnouncement(), deleteAnnouncement(), getActivityLogs(), getReferralMap(), listAnnouncements(), listStudents(), listSubscriptionRequests() (+39 more)

### Community 2 - "App.jsx"
Cohesion: 0.03
Nodes (73): AboutPage, AdminAICenterPage, AdminAIDashboardPage, AdminAnnouncementsPage, AdminArchivePage, AdminAutomationPage, AdminCasesPage, AdminCompaniesPage (+65 more)

### Community 3 - "FeedPage.jsx"
Cohesion: 0.07
Nodes (35): addMemory(), createItem(), deleteItem(), getItem(), listItems(), toggleBookmark(), toggleLike(), createPost() (+27 more)

### Community 4 - "DaxApp.jsx"
Cohesion: 0.08
Nodes (36): deleteConversationRemote(), getAvailableModels(), getModelPreference(), importConversations(), setModelPreference(), updateConversationRemote(), AIPresencePanel(), SUGGESTIONS (+28 more)

### Community 5 - "AdminStudioReviewPage.jsx"
Cohesion: 0.11
Nodes (30): createAlbum(), deleteAlbum(), listAlbums(), createCompany(), deleteCompany(), getCompany(), listCompanies(), draftItem() (+22 more)

### Community 6 - "axios.js"
Cohesion: 0.10
Nodes (27): api, settle(), createNote(), deleteNote(), getNote(), updateNote(), DATADLoader(), RouteBeacon() (+19 more)

### Community 7 - "ProjectsPage.jsx"
Cohesion: 0.09
Nodes (19): createProject(), createProjectTask(), deleteProjectTask(), getProject(), listProjects(), updateProjectTask(), RowSkeleton(), AdminAICenterPage() (+11 more)

### Community 8 - "SearchPage.jsx"
Cohesion: 0.12
Nodes (21): getFrequentSearches(), getPinned(), getRecentSearches(), parseIntent(), recordClick(), searchAll(), togglePin(), CATEGORY_ORDER (+13 more)

### Community 9 - "RegisterPage.jsx"
Cohesion: 0.09
Nodes (17): RegisterBackground(), AcademicStep(), PROGRAM_OPTIONS, SPEC_MAP, YEARS, ChallengesStep(), GOALS, GoalsStep() (+9 more)

### Community 10 - "PlacementsPage.jsx"
Cohesion: 0.14
Nodes (19): createInternship(), deleteInternship(), listInternships(), applyToDrive(), createDrive(), deleteDrive(), listDrives(), listMyApplications() (+11 more)

### Community 11 - "manifest.json"
Cohesion: 0.08
Nodes (24): background_color, categories, description, dir, display, display_override, icons, id (+16 more)

### Community 12 - "IntelligencePage.jsx"
Cohesion: 0.17
Nodes (16): getMarket(), listArticles(), listBookmarked(), refreshNews(), setInterests(), toggleBookmark(), IntelligenceCard(), isDown() (+8 more)

### Community 13 - "motion.jsx"
Cohesion: 0.12
Nodes (10): getStats(), AnimatedNumber(), Page(), Stagger(), StaggerItem(), AdminPage(), LESSONS, MEMORY_TECHNIQUES (+2 more)

### Community 14 - "useDocumentTitle"
Cohesion: 0.12
Nodes (13): useDocumentTitle(), CommunityHubPage(), ACCENTS, FEATURES, LandingPage(), FinanceROIPage(), fmt(), yrs() (+5 more)

### Community 15 - "AppShell.jsx"
Cohesion: 0.11
Nodes (15): Footer(), mailto(), WorkspaceLayout(), ThemeContext, ThemeProvider(), TIER_BADGE_STYLE, TIER_COLOR_MAP, TIER_COLORS (+7 more)

### Community 16 - "LivingSurface.jsx"
Cohesion: 0.13
Nodes (10): dashboardInsights(), getReadiness(), getTodayReflection(), Skeleton(), Arrival(), ASK_SUGGESTIONS, greeting(), LivingSurface() (+2 more)

### Community 17 - "AIToolsPage.jsx"
Cohesion: 0.15
Nodes (18): askCareerAdvice(), careerAdvice(), compareCompanies(), daxTask(), plannerSuggest(), reviewResume(), semanticSearch(), simulateInterview() (+10 more)

### Community 18 - "react"
Cohesion: 0.12
Nodes (4): react, ConversationList(), ConversationListItem(), useClickOutside()

### Community 19 - "SettingsPage.jsx"
Cohesion: 0.21
Nodes (16): changePassword(), deleteAccount(), getMe(), updateProfile(), uploadAvatar(), InviteCard(), whatsappInviteUrl(), useTheme() (+8 more)

### Community 20 - "devDependencies"
Cohesion: 0.11
Nodes (19): autoprefixer, eslint, eslint-plugin-jsx-a11y, eslint-plugin-react, devDependencies, autoprefixer, eslint, eslint-plugin-jsx-a11y (+11 more)

### Community 21 - "Skeleton.jsx"
Cohesion: 0.18
Nodes (11): getQuestionBank(), listNotes(), EmptyState(), CardGridSkeleton(), FeedSkeleton(), CATEGORY_META, InterviewQuestionsPage(), NotesListPage() (+3 more)

### Community 22 - "AssistantMessage.jsx"
Cohesion: 0.17
Nodes (11): Avatar(), AttachmentChip(), formatSize(), ICONS, AssistantMessage(), Citation(), Message(), MessageToolbar() (+3 more)

### Community 23 - "dependencies"
Cohesion: 0.12
Nodes (17): axios, framer-motion, jwt-decode, lucide-react, dependencies, axios, framer-motion, jwt-decode (+9 more)

### Community 24 - ".eslintrc.json"
Cohesion: 0.12
Nodes (16): jsx, env, browser, es2021, extends, parserOptions, ecmaFeatures, ecmaVersion (+8 more)

### Community 25 - "dax.js"
Cohesion: 0.17
Nodes (6): confirmProposal(), rejectProposal(), undoProposal(), ProposalCard(), STATUS_LABEL, SUCCEEDED

### Community 26 - "DiscussionsPage.jsx"
Cohesion: 0.25
Nodes (15): createPost(), createReply(), deletePost(), deleteReply(), getPost(), likePost(), likeReply(), listPosts() (+7 more)

### Community 27 - "ResumePage.jsx"
Cohesion: 0.19
Nodes (9): getMyResume(), saveResume(), AIBadge(), AIInsight(), CONFIDENCE_COLOR, CONFIDENCE_LABEL, ResumePage(), DAX_CAPABILITY (+1 more)

### Community 28 - "DaxHome.jsx"
Cohesion: 0.18
Nodes (12): DaxOrb(), GROUP_ORDER, groupModels(), ModelIndicator(), DaxTransition(), timeGreeting(), DaxHome(), EASE (+4 more)

### Community 29 - "StudyHubPage.jsx"
Cohesion: 0.23
Nodes (13): listTasks(), Card(), PADDING, FEATURE_CARDS, MeHubPage(), AssignmentsPage(), ACADEMIC_TYPES, deriveInsight() (+5 more)

### Community 30 - "Button.jsx"
Cohesion: 0.21
Nodes (11): forgotPassword(), register(), resetPassword(), Button, ICON_SIZE, SIZE_CLASS, VARIANTS, Logo() (+3 more)

### Community 31 - "SubscriptionContext.jsx"
Cohesion: 0.23
Nodes (11): activateTrial(), getSubscriptionStatus(), submitPaymentRef(), SubscriptionContext, SubscriptionProvider(), TIER_RANK, fmtDate(), oneMonthFrom() (+3 more)

### Community 32 - "PlannerPage.jsx"
Cohesion: 0.25
Nodes (10): createTask(), deleteTask(), updateTask(), PlannerPage(), TaskRow(), ACADEMIC_TYPES, NewAssignmentModal(), TYPE_LABEL (+2 more)

### Community 33 - "useAuth"
Cohesion: 0.21
Nodes (10): createDaxChatAdapter(), AdminRoute(), HomeGate(), ProtectedRoute(), AppShell(), AuthContext, AuthProvider(), decodeUser() (+2 more)

### Community 34 - "DirectoryPage.jsx"
Cohesion: 0.23
Nodes (9): getDirectory(), getMyProfile(), upsertMyProfile(), SmartSelect(), DOMAINS, ExperienceStep(), STYLES, TIME_OPTIONS (+1 more)

### Community 35 - "ReadinessPage.jsx"
Cohesion: 0.24
Nodes (9): getReadiness(), barColor(), COMPONENT_LINKS, ReadinessCard(), RING_COLOR(), ScoreRing(), COMPONENT_LINKS, HOW_TO_IMPROVE (+1 more)

### Community 36 - "ResourcesPage.jsx"
Cohesion: 0.25
Nodes (11): createResource(), deleteResource(), downloadResource(), listResources(), uploadResourceFile(), FOLDER_COLORS, groupBySubject(), ResourcesPage() (+3 more)

### Community 37 - "ComposerToolbar.jsx"
Cohesion: 0.29
Nodes (6): ICON_SIZE, IconButton, SIZE_CLASS, Tooltip(), SidebarFooter(), SidebarHeader()

### Community 38 - "daxChatAdapter.js"
Cohesion: 0.21
Nodes (8): clearChat(), getChatHistory(), sendMessage(), clearChat(), daxChat(), getChatHistory(), ChatBot(), AskDax()

### Community 39 - "CareerHubPage.jsx"
Cohesion: 0.21
Nodes (9): getCompanyNews(), PlacementJourney(), STEPS, band(), COMPONENT_LINKS, HOW_TO_IMPROVE, ReadinessBreakdown(), CareerHubPage() (+1 more)

### Community 40 - "EventsPage.jsx"
Cohesion: 0.28
Nodes (8): createEvent(), getEventAttendees(), getMyRSVPs(), listEvents(), rsvpEvent(), CAT_COLORS, EventsPage(), RSVP_LABELS

### Community 41 - "TierGate.jsx"
Cohesion: 0.26
Nodes (9): CrownBadge(), DEFAULT_DESCRIPTIONS, TierGate(), PremiumPanel(), UsageSummary(), AvatarMenu(), useSubscription(), useAiUsage() (+1 more)

### Community 42 - "Composer.jsx"
Cohesion: 0.24
Nodes (8): AttachmentDropzone(), Composer(), ComposerToolbar(), SendStopButton(), VoiceInputButton(), resize(), useAutosizeTextarea(), useDragAndDrop()

### Community 43 - "PageHeader.jsx"
Cohesion: 0.27
Nodes (8): getPivot(), updateGap(), upsertPivot(), PageHeader(), DOMAINS, GAP_STATUS, NEXT_STATUS, PivotPage()

### Community 44 - "StudyToolsPage.jsx"
Cohesion: 0.29
Nodes (8): getStreak(), getTodayLog(), getWeekStats(), updateLog(), FOCUS_TIPS, MODES, POMODORO_STEPS, StudyToolsPage()

### Community 45 - "AboutPage.jsx"
Cohesion: 0.21
Nodes (7): DatadMark(), dataFacts, letters, milestones, pillars, Reveal(), useReveal()

### Community 46 - "PWAContext.jsx"
Cohesion: 0.29
Nodes (8): InstallPrompt(), OfflineBanner(), UpdateBanner(), detectIOS(), isStandalone(), PWAContext, PWAProvider(), usePWA()

### Community 47 - "sw.js"
Cohesion: 0.24
Nodes (5): deleteItem(), flushOfflineQueue(), getAllItems(), openDB(), PRECACHE_URLS

### Community 48 - "MarketplacePage.jsx"
Cohesion: 0.33
Nodes (8): createListing(), deleteListing(), listListings(), markSold(), CATEGORIES, COND_COLORS, CONDITIONS, MarketplacePage()

### Community 49 - "StarStoriesPage.jsx"
Cohesion: 0.33
Nodes (7): createStory(), deleteStory(), listStories(), updateStory(), COMPETENCIES, EMPTY, StarStoriesPage()

### Community 50 - "MessageContent.jsx"
Cohesion: 0.31
Nodes (6): CodeBlock(), MessageContent(), StreamingCaret(), buildComponents(), rehypePlugins, remarkPlugins

### Community 51 - "FinanceCalculatorPage.jsx"
Cohesion: 0.27
Nodes (6): BudgetCalculator(), CompoundCalculator(), EmergencyFundCalculator(), EmiCalculator(), inr(), SipCalculator()

### Community 52 - "AIEnhancement.jsx"
Cohesion: 0.29
Nodes (6): enhance(), AIEnhancement(), CONFIDENCE_COLOR, CONFIDENCE_LABEL, VARIANTS, useEnhancement()

### Community 54 - "SupportPage.jsx"
Cohesion: 0.22
Nodes (8): COST_LINES, FAQ, PRESETS, PRINCIPLES, ROADMAP, statusIcon, SupportPage(), upiLink()

### Community 55 - "package.json"
Cohesion: 0.22
Nodes (8): name, private, scripts, build, dev, preview, type, version

### Community 56 - "DaxMemoryPanel.jsx"
Cohesion: 0.36
Nodes (7): forgetDaxMemory(), getDaxMemory(), updateDaxMemory(), asList(), DaxMemoryPanel(), EXPLANATION_STYLES, toList()

### Community 57 - "SkillExchangePage.jsx"
Cohesion: 0.44
Nodes (5): createSkill(), deleteSkill(), listSkills(), rateSkill(), SkillExchangePage()

### Community 58 - "AdminStudioPage.jsx"
Cohesion: 0.28
Nodes (7): listItems(), uploadFiles(), AdminStudioPage(), STATUS_LABEL, STATUS_STYLE, TABS, TYPE_ICON

### Community 59 - "Calculators.jsx"
Cohesion: 0.31
Nodes (4): EMICalculator(), formatINR(), SavingsForecast(), SIPCalculator()

### Community 60 - "LoginPage.jsx"
Cohesion: 0.36
Nodes (6): checkEmail(), login(), BinaryRainBackground(), randomBits(), LoginPage(), RegisterPage()

### Community 61 - "PlacementCountdown.jsx"
Cohesion: 0.43
Nodes (6): getMeta(), updateMeta(), PlacementCountdown(), urgencyClass(), urgencyText(), PlacementDateForm()

### Community 62 - "NotificationBell.jsx"
Cohesion: 0.57
Nodes (6): deleteNotification(), listNotifications(), markAllRead(), markRead(), NotificationBell(), timeAgo()

### Community 63 - "DailyCaseCard.jsx"
Cohesion: 0.38
Nodes (6): getTodayCase(), solveCase(), CATEGORY_COLOR, CATEGORY_LABEL, DailyCaseCard(), THINK_TIPS

### Community 64 - "PremiumPanel.jsx"
Cohesion: 0.43
Nodes (5): AI_TOOLS_PRO, fmtDate(), MaxPanel(), ProPanel(), TrialBanner()

### Community 66 - "MessageList.jsx"
Cohesion: 0.52
Nodes (4): ConversationView(), MessageList(), branchAt(), visibleMessages()

### Community 68 - "useRegisterForm.js"
Cohesion: 0.53
Nodes (3): useRegisterForm(), validatePassword(), useValidation()

### Community 69 - "useOfflineQueue.js"
Cohesion: 0.70
Nodes (4): addToQueue(), openDB(), registerSync(), useOfflineQueue()

### Community 71 - "eslint.config.cjs"
Cohesion: 0.50
Nodes (3): globals, js, reactPlugin

## Knowledge Gaps
- **294 isolated node(s):** `browser`, `es2021`, `eslint:recommended`, `plugin:react/recommended`, `plugin:jsx-a11y/recommended` (+289 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **13 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `react` to `FinancePage.jsx`, `formatDate`, `App.jsx`, `FeedPage.jsx`, `DaxApp.jsx`, `AdminStudioReviewPage.jsx`, `axios.js`, `ProjectsPage.jsx`, `SearchPage.jsx`, `RegisterPage.jsx`, `PlacementsPage.jsx`, `IntelligencePage.jsx`, `motion.jsx`, `useDocumentTitle`, `AppShell.jsx`, `LivingSurface.jsx`, `AIToolsPage.jsx`, `SettingsPage.jsx`, `Skeleton.jsx`, `AssistantMessage.jsx`, `.eslintrc.json`, `dax.js`, `DiscussionsPage.jsx`, `ResumePage.jsx`, `DaxHome.jsx`, `StudyHubPage.jsx`, `Button.jsx`, `SubscriptionContext.jsx`, `PlannerPage.jsx`, `useAuth`, `DirectoryPage.jsx`, `ReadinessPage.jsx`, `ResourcesPage.jsx`, `ComposerToolbar.jsx`, `CareerHubPage.jsx`, `EventsPage.jsx`, `TierGate.jsx`, `Composer.jsx`, `PageHeader.jsx`, `StudyToolsPage.jsx`, `AboutPage.jsx`, `PWAContext.jsx`, `MarketplacePage.jsx`, `StarStoriesPage.jsx`, `MessageContent.jsx`, `FinanceCalculatorPage.jsx`, `AIEnhancement.jsx`, `SupportPage.jsx`, `DaxMemoryPanel.jsx`, `SkillExchangePage.jsx`, `AdminStudioPage.jsx`, `Calculators.jsx`, `LoginPage.jsx`, `PlacementCountdown.jsx`, `NotificationBell.jsx`, `DailyCaseCard.jsx`, `MessageList.jsx`, `ErrorBoundary`, `useRegisterForm.js`, `useOfflineQueue.js`, `CreatorPage.jsx`?**
  _High betweenness centrality (0.504) - this node is a cross-community bridge._
- **Why does `useDocumentTitle()` connect `useDocumentTitle` to `FinancePage.jsx`, `FeedPage.jsx`, `ProjectsPage.jsx`, `SearchPage.jsx`, `PlacementsPage.jsx`, `LivingSurface.jsx`, `AIToolsPage.jsx`, `SettingsPage.jsx`, `DiscussionsPage.jsx`, `StudyHubPage.jsx`, `useAuth`, `DirectoryPage.jsx`, `ResourcesPage.jsx`, `CareerHubPage.jsx`, `EventsPage.jsx`, `PageHeader.jsx`, `StudyToolsPage.jsx`, `MarketplacePage.jsx`, `StarStoriesPage.jsx`, `SkillExchangePage.jsx`?**
  _High betweenness centrality (0.035) - this node is a cross-community bridge._
- **Why does `useAuth()` connect `useAuth` to `formatDate`, `App.jsx`, `AdminStudioReviewPage.jsx`, `axios.js`, `RegisterPage.jsx`, `PlacementsPage.jsx`, `IntelligencePage.jsx`, `motion.jsx`, `AppShell.jsx`, `LivingSurface.jsx`, `SettingsPage.jsx`, `DiscussionsPage.jsx`, `ResumePage.jsx`, `SubscriptionContext.jsx`, `PlannerPage.jsx`, `ResourcesPage.jsx`, `daxChatAdapter.js`, `TierGate.jsx`, `MarketplacePage.jsx`, `SkillExchangePage.jsx`, `LoginPage.jsx`?**
  _High betweenness centrality (0.032) - this node is a cross-community bridge._
- **What connects `browser`, `es2021`, `eslint:recommended` to the rest of the system?**
  _294 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `FinancePage.jsx` be split into smaller, more focused modules?**
  _Cohesion score 0.057124310288867254 - nodes in this community are weakly interconnected._
- **Should `formatDate` be split into smaller, more focused modules?**
  _Cohesion score 0.05468215994531784 - nodes in this community are weakly interconnected._
- **Should `App.jsx` be split into smaller, more focused modules?**
  _Cohesion score 0.02631578947368421 - nodes in this community are weakly interconnected._