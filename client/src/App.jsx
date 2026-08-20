import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Outlet, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { SubscriptionProvider } from './context/SubscriptionContext';
import { PWAProvider } from './context/PWAContext';
import { ProgramProvider } from './context/ProgramContext';
import { ToastProvider } from './context/ToastContext';
import InstallPrompt from './components/pwa/InstallPrompt';
import OfflineBanner from './components/pwa/OfflineBanner';
import UpdateBanner from './components/pwa/UpdateBanner';
import ProtectedRoute from './components/common/ProtectedRoute';
import AppShell from './components/layout/AppShell';
import WorkspaceLayout from './components/layout/WorkspaceLayout';
import Loader from './components/common/Loader';
import SectionTransition from './components/common/SectionTransition';
import RouteBeacon from './components/common/RouteBeacon';
import ErrorBoundary from './components/common/ErrorBoundary';


// Route-level code splitting: each page loads on demand, keeping the initial
// bundle small. Vite emits one chunk per page.
const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));
const VerifyEmailPage = lazy(() => import('./pages/VerifyEmailPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const LandingPage = lazy(() => import('./pages/LandingPage'));
const NotesListPage = lazy(() => import('./pages/NotesListPage'));
const NoteDetailPage = lazy(() => import('./pages/NoteDetailPage'));
const NoteEditorPage = lazy(() => import('./pages/NoteEditorPage'));
const PlannerPage = lazy(() => import('./pages/PlannerPage'));
const FinanceHubPage        = lazy(() => import('./pages/me/FinanceHubPage'));
const FinanceTrackerPage    = lazy(() => import('./pages/me/FinanceTrackerPage'));
const FinanceCalculatorPage = lazy(() => import('./pages/me/FinanceCalculatorPage'));
const FinanceStocksPage = lazy(() => import('./pages/me/FinanceStocksPage'));
const FinanceLearnPage      = lazy(() => import('./pages/me/FinanceLearnPage'));
const IntelligencePage = lazy(() => import('./pages/IntelligencePage'));
const ResumePage = lazy(() => import('./pages/ResumePage'));
const ResumePreviewPage = lazy(() => import('./pages/ResumePreviewPage'));
const SupportPage = lazy(() => import('./pages/SupportPage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));
const AdminStudentsPage = lazy(() => import('./pages/admin/AdminStudentsPage'));
const AdminStudioPage = lazy(() => import('./pages/admin/AdminStudioPage'));
const AdminStudioReviewPage = lazy(() => import('./pages/admin/AdminStudioReviewPage'));
const AdminAnnouncementsPage = lazy(() => import('./pages/admin/AdminAnnouncementsPage'));
const AdminLogsPage = lazy(() => import('./pages/admin/AdminLogsPage'));
const AdminReferralsPage = lazy(() => import('./pages/admin/AdminReferralsPage'));
const AdminArchivePage = lazy(() => import('./pages/admin/AdminArchivePage'));
const AdminCompaniesPage = lazy(() => import('./pages/admin/AdminCompaniesPage'));
const AdminCasesPage = lazy(() => import('./pages/admin/AdminCasesPage'));
const AdminAutomationPage = lazy(() => import('./pages/admin/AdminAutomationPage'));
const CompaniesPage = lazy(() => import('./pages/CompaniesPage'));
const CompanyDetailPage = lazy(() => import('./pages/CompanyDetailPage'));
const CreatorPage = lazy(() => import('./pages/CreatorPage'));
const JournalPage = lazy(() => import('./pages/JournalPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const PrivacyPage = lazy(() => import('./pages/PrivacyPage'));
const TermsPage = lazy(() => import('./pages/TermsPage'));
const EntertainmentDetailPage = lazy(() => import('./pages/EntertainmentDetailPage'));
const AboutPage = lazy(() => import('./pages/AboutPage'));
const BrandPage = lazy(() => import('./pages/BrandPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));
const SubscribePage = lazy(() => import('./pages/SubscribePage'));
const DeveloperPage = lazy(() => import('./pages/DeveloperPage'));
const AdminSubscriptionsPage = lazy(() => import('./pages/admin/AdminSubscriptionsPage'));
const AdminSubscriptionsAnalyticsPage = lazy(() => import('./pages/admin/AdminSubscriptionsAnalyticsPage'));
const CalendarPage = lazy(() => import('./pages/me/CalendarPage'));
const StudyHubPage = lazy(() => import('./pages/study/StudyHubPage'));
const WellbeingPage         = lazy(() => import('./pages/me/WellbeingPage'));
const WellbeingStudyPage    = lazy(() => import('./pages/me/WellbeingStudyPage'));
const WellbeingMemoryPage   = lazy(() => import('./pages/me/WellbeingMemoryPage'));
const WellbeingRoutinesPage = lazy(() => import('./pages/me/WellbeingRoutinesPage'));
const WellbeingSupportPage  = lazy(() => import('./pages/me/WellbeingSupportPage'));
const ProgramSettingsPage   = lazy(() => import('./pages/me/ProgramSettingsPage'));
const SearchPage = lazy(() => import('./pages/SearchPage'));
const WorkPage = lazy(() => import('./pages/study/WorkPage'));
const CareerHubPage = lazy(() => import('./pages/career/CareerHubPage'));
const OpportunitiesPage = lazy(() => import('./pages/career/OpportunitiesPage'));
const InterviewQuestionsPage = lazy(() => import('./pages/career/InterviewQuestionsPage'));
const LinkedInPage = lazy(() => import('./pages/career/LinkedInPage'));
const CommunityHubPage  = lazy(() => import('./pages/community/CommunityHubPage'));
const AnnouncementsPage = lazy(() => import('./pages/community/AnnouncementsPage'));
const StreamPage        = lazy(() => import('./pages/community/StreamPage'));
const MemoriesPage      = lazy(() => import('./pages/community/MemoriesPage'));
const DirectoryPage     = lazy(() => import('./pages/community/DirectoryPage'));
const EventsPage        = lazy(() => import('./pages/community/EventsPage'));
const MarketplacePage   = lazy(() => import('./pages/community/MarketplacePage'));
const MeHubPage         = lazy(() => import('./pages/me/MeHubPage'));
const SubjectPage       = lazy(() => import('./pages/study/SubjectPage'));
const ResourcesPage     = lazy(() => import('./pages/study/ResourcesPage'));
const StudyToolsPage    = lazy(() => import('./pages/study/StudyToolsPage'));
const SkillExchangePage = lazy(() => import('./pages/career/SkillExchangePage'));
const AdminAICenterPage = lazy(() => import('./pages/admin/AdminAICenterPage'));
const AdminAIDashboardPage = lazy(() => import('./pages/admin/AdminAIDashboardPage'));
const AdminCohortPage = lazy(() => import('./pages/admin/AdminCohortPage'));
const PivotPage         = lazy(() => import('./pages/career/PivotPage'));
const StarStoriesPage   = lazy(() => import('./pages/career/StarStoriesPage'));
const GrowthHubPage     = lazy(() => import('./pages/growth/GrowthHubPage'));
const FinanceROIPage    = lazy(() => import('./pages/me/FinanceROIPage'));
const ReflectionPage    = lazy(() => import('./pages/ReflectionPage'));
const DaxPage           = lazy(() => import('./pages/DaxPage'));
const PSWPage           = lazy(() => import('./pages/psw/PSWPage'));

function AdminRoute({ children }) {
  const { user } = useAuth();
  if (user?.role !== 'admin') return <Navigate to="/" replace />;
  return children;
}

function AppLayout() {
  const { user } = useAuth();

  return (
    <ProtectedRoute>
      <ProgramProvider program={user?.program}>
        <SubscriptionProvider>
          <AppShell>
            <ErrorBoundary>
              <Outlet />
            </ErrorBoundary>
          </AppShell>
        </SubscriptionProvider>
      </ProgramProvider>
    </ProtectedRoute>
  );
}

// "/" is always the public landing page. A logged-in user is sent straight
// to /dashboard — "/" itself never renders app content.
function HomeGate() {
  const { user } = useAuth();
  if (!user) return <LandingPage />;
  return <Navigate to="/dashboard" replace />;
}

// Old top-level URLs keep working: strip the legacy prefix, keep the rest.
function LegacyRedirect({ from, to }) {
  const location = useLocation();
  const rest = location.pathname.startsWith(from) ? location.pathname.slice(from.length) : '';
  return <Navigate to={`${to}${rest}${location.search}`} replace />;
}

export default function App() {
  return (
    <PWAProvider>
      <ThemeProvider>
        <AuthProvider>
            <ToastProvider>
          <BrowserRouter>
            <OfflineBanner />
            <UpdateBanner />
            <SectionTransition />
            <Toaster
              position="top-right"
              gutter={12}
              containerStyle={{ top: 60, right: 16 }}
              toastOptions={{
                className: 'datad-toast',
                duration: 3500,
                style: {
                  borderRadius: '12px',
                  padding: '12px 16px',
                  fontSize: '14px',
                  fontWeight: 500,
                  boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                },
                success: {
                  iconTheme: { primary: '#10b981', secondary: '#fff' },
                  style: { borderLeft: '4px solid #10b981' },
                },
                error: {
                  iconTheme: { primary: '#f43f5e', secondary: '#fff' },
                  style: { borderLeft: '4px solid #f43f5e' },
                },
              }}
            />
          <Suspense fallback={<Loader />}>
            {/* Inside Suspense on purpose — see RouteBeacon. */}
            <RouteBeacon />
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/verify-email" element={<VerifyEmailPage />} />
              <Route path="/creator" element={<CreatorPage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/psw" element={<PSWPage />} />
              <Route path="/brand" element={<BrandPage />} />
              <Route path="/privacy" element={<PrivacyPage />} />
              <Route path="/terms" element={<TermsPage />} />
              {/* "/" is reserved for the public landing page — always, logged in or not. */}
              <Route path="/" element={<HomeGate />} />
              <Route
                path="/dax"
                element={
                  <ProtectedRoute>
                    <ErrorBoundary>
                      <DaxPage />
                    </ErrorBoundary>
                  </ProtectedRoute>
                }
              />
              <Route element={<AppLayout />}>
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/roadmap" element={<Navigate to="/growth/roadmap" replace />} />
                <Route path="/briefing" element={<IntelligencePage />} />

                <Route path="/study" element={<WorkspaceLayout workspace="study" title="Study" />}>
                  <Route index element={<StudyHubPage />} />
                  <Route path="notes" element={<NotesListPage />} />
                  <Route path="notes/new" element={<NoteEditorPage />} />
                  <Route path="notes/:id" element={<NoteDetailPage />} />
                  <Route path="notes/:id/edit" element={<NoteEditorPage />} />
                  <Route path="work" element={<WorkPage />} />
                  <Route path="subject" element={<SubjectPage />} />
                  <Route path="resources" element={<ResourcesPage />} />
                  <Route path="focus" element={<StudyToolsPage />} />
                  {/* Merged/dissolved tabs — old URLs keep working */}
                  <Route path="assignments" element={<Navigate to="/study/work" replace />} />
                  <Route path="projects" element={<Navigate to="/study/work?view=projects" replace />} />
                  <Route path="study-tools" element={<Navigate to="/study/focus" replace />} />
                  <Route path="ai-tools" element={<Navigate to="/study/notes" replace />} />
                </Route>

                <Route path="/career" element={<WorkspaceLayout workspace="career" title="Career" />}>
                  {/* The hub is the overview: placement journey, countdown,
                      readiness score and its breakdown (absorbed from the old
                      standalone ReadinessPage). /career/readiness still lands here. */}
                  <Route index element={<CareerHubPage />} />
                  <Route path="resume" element={<ResumePage />} />
                  <Route path="resume/preview" element={<ResumePreviewPage />} />
                  <Route path="linkedin" element={<LinkedInPage />} />
                  <Route path="companies" element={<CompaniesPage />} />
                  <Route path="companies/:slug" element={<CompanyDetailPage />} />
                  <Route path="questions" element={<InterviewQuestionsPage />} />
                  <Route path="opportunities" element={<OpportunitiesPage />} />
                  {/* Merged/moved tabs — old URLs keep working */}
                  <Route path="readiness" element={<Navigate to="/career" replace />} />
                  <Route path="placements" element={<Navigate to="/career/opportunities" replace />} />
                  <Route path="internships" element={<Navigate to="/career/opportunities?view=internships" replace />} />
                  <Route path="skills" element={<Navigate to="/community/skills" replace />} />
                  {/* Roadmap/Pivot/STAR Stories moved out to their own Growth
                      sub-section (like Finance/Wellbeing under Life) — the
                      Career tab row was carrying too many sub-categories. */}
                  <Route path="roadmap" element={<Navigate to="/growth/roadmap" replace />} />
                  <Route path="pivot" element={<Navigate to="/growth/pivot" replace />} />
                  <Route path="stories" element={<Navigate to="/growth/stories" replace />} />
                </Route>

                <Route path="/growth" element={<WorkspaceLayout workspace="growth" title="Growth" />}>
                  <Route index element={<GrowthHubPage />} />
                  <Route path="roadmap" element={<PivotPage mode="roadmap" />} />
                  <Route path="pivot" element={<PivotPage />} />
                  <Route path="stories" element={<StarStoriesPage />} />
                </Route>

                <Route path="/community" element={<WorkspaceLayout workspace="community" title="Community" />}>
                  <Route index element={<CommunityHubPage />} />
                  <Route path="announcements" element={<AnnouncementsPage />} />
                  <Route path="feed" element={<StreamPage />} />
                  <Route path="memories" element={<MemoriesPage />} />
                  <Route path="archive/:category/:slug" element={<EntertainmentDetailPage />} />
                  <Route path="directory" element={<DirectoryPage />} />
                  <Route path="events" element={<EventsPage />} />
                  {/* No top tab — reachable from the Community overview */}
                  <Route path="marketplace" element={<MarketplacePage />} />
                  <Route path="skills" element={<SkillExchangePage />} />
                  {/* Merged tabs — old URLs keep working */}
                  <Route path="discussions" element={<Navigate to="/community/feed?view=discussions" replace />} />
                  <Route path="gallery" element={<Navigate to="/community/memories" replace />} />
                  <Route path="archive" element={<Navigate to="/community/memories?view=archive" replace />} />
                </Route>

                <Route path="/me" element={<WorkspaceLayout workspace="me" title="Life" />}>
                  <Route index element={<MeHubPage />} />
                  <Route path="planner" element={<PlannerPage />} />
                  <Route path="settings" element={<SettingsPage />} />
                  <Route path="program" element={<ProgramSettingsPage />} />
                  <Route path="journal" element={<JournalPage />} />
                  <Route path="reflection" element={<ReflectionPage />} />
                  <Route path="calendar" element={<CalendarPage />} />
                </Route>

                <Route path="/finance" element={<WorkspaceLayout workspace="finance" title="Finance" />}>
                  <Route index element={<FinanceHubPage />} />
                  <Route path="tracker" element={<FinanceTrackerPage />} />
                  <Route path="calculator" element={<FinanceCalculatorPage />} />
                  <Route path="stocks" element={<FinanceStocksPage />} />
                  <Route path="learn" element={<FinanceLearnPage />} />
                  <Route path="roi" element={<FinanceROIPage />} />
                </Route>

                <Route path="/wellbeing" element={<WorkspaceLayout workspace="wellbeing" title="Wellbeing" />}>
                  <Route index element={<WellbeingPage />} />
                  <Route path="study" element={<WellbeingStudyPage />} />
                  <Route path="memory" element={<WellbeingMemoryPage />} />
                  <Route path="routines" element={<WellbeingRoutinesPage />} />
                  <Route path="support" element={<WellbeingSupportPage />} />
                </Route>

                <Route path="/search" element={<SearchPage />} />

                <Route path="/subscribe" element={<SubscribePage />} />
                <Route path="/developer" element={<DeveloperPage />} />
                <Route path="/support" element={<SupportPage />} />
                <Route path="/admin" element={<AdminRoute><AdminPage /></AdminRoute>} />
                <Route path="/admin/students" element={<AdminRoute><AdminStudentsPage /></AdminRoute>} />
                <Route path="/admin/studio" element={<AdminRoute><AdminStudioPage /></AdminRoute>} />
                <Route path="/admin/studio/:id" element={<AdminRoute><AdminStudioReviewPage /></AdminRoute>} />
                <Route path="/admin/announcements" element={<AdminRoute><AdminAnnouncementsPage /></AdminRoute>} />
                <Route path="/admin/logs" element={<AdminRoute><AdminLogsPage /></AdminRoute>} />
                <Route path="/admin/referrals" element={<AdminRoute><AdminReferralsPage /></AdminRoute>} />
                <Route path="/admin/archive" element={<AdminRoute><AdminArchivePage /></AdminRoute>} />
                <Route path="/admin/companies" element={<AdminRoute><AdminCompaniesPage /></AdminRoute>} />
                <Route path="/admin/cases" element={<AdminRoute><AdminCasesPage /></AdminRoute>} />
                <Route path="/admin/automation" element={<AdminRoute><AdminAutomationPage /></AdminRoute>} />
                <Route path="/admin/ai-center" element={<AdminRoute><AdminAICenterPage /></AdminRoute>} />
                <Route path="/admin/ai-runtime" element={<AdminRoute><AdminAIDashboardPage /></AdminRoute>} />
                <Route path="/admin/cohort" element={<AdminRoute><AdminCohortPage /></AdminRoute>} />
                <Route path="/admin/subscriptions" element={<AdminRoute><AdminSubscriptionsPage /></AdminRoute>} />
                <Route path="/admin/subscriptions/analytics" element={<AdminRoute><AdminSubscriptionsAnalyticsPage /></AdminRoute>} />

                {/* Legacy routes → new workspace homes */}
                <Route path="/notes/*" element={<LegacyRedirect from="/notes" to="/study/notes" />} />
                <Route path="/calendar" element={<Navigate to="/me/calendar" replace />} />
                <Route path="/planner" element={<Navigate to="/me/planner" replace />} />
                <Route path="/me/finance/*" element={<LegacyRedirect from="/me/finance" to="/finance" />} />
                <Route path="/me/wellbeing/*" element={<LegacyRedirect from="/me/wellbeing" to="/wellbeing" />} />
                <Route path="/settings" element={<Navigate to="/me/settings" replace />} />
                <Route path="/journal" element={<Navigate to="/me/journal" replace />} />
                <Route path="/reflection" element={<Navigate to="/me/reflection" replace />} />
                <Route path="/news" element={<Navigate to="/briefing" replace />} />
                <Route path="/resume/*" element={<LegacyRedirect from="/resume" to="/career/resume" />} />
                <Route path="/companies/*" element={<LegacyRedirect from="/companies" to="/career/companies" />} />
                <Route path="/albums" element={<Navigate to="/community/gallery" replace />} />
                <Route path="/entertainment/*" element={<LegacyRedirect from="/entertainment" to="/community/archive" />} />
                <Route path="*" element={<NotFoundPage />} />
              </Route>
            </Routes>
          </Suspense>
          <InstallPrompt />
          </BrowserRouter>
            </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </PWAProvider>
  );
}
