import "@/App.css";
import React, { Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useParams } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { OrgProvider } from "./contexts/OrgContext";
import { Toaster } from "./components/ui/sonner";
import Layout from "./components/Layout";
import ErrorBoundary from "./components/ErrorBoundary";
import { SkeletonPage } from "./components/Skeleton";

// Helper component for redirecting with params
function RedirectWithParams({ to }) {
  const params = useParams();
  let path = to;
  Object.keys(params).forEach(key => {
    path = path.replace(`:${key}`, params[key]);
  });
  return <Navigate to={path} replace />;
}

// ── Eager imports (auth flow — must load instantly) ──
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import ForcePasswordChange from "./pages/ForcePasswordChange";
import SetupOTP from "./pages/SetupOTP";
import VerifyOTP from "./pages/VerifyOTP";

// ── Lazy imports (code-split — loaded on demand) ──
const RateSurvey = React.lazy(() => import("./pages/RateSurvey"));
const ClientHome = React.lazy(() => import("./pages/ClientHome"));
const Clients = React.lazy(() => import("./pages/Clients"));
const ServiceCatalog = React.lazy(() => import("./pages/ServiceCatalog"));
const MyAccount = React.lazy(() => import("./pages/MyAccount"));
const Orders = React.lazy(() => import("./pages/Orders"));
const Requests = React.lazy(() => import("./pages/Requests"));
const Settings = React.lazy(() => import("./pages/Settings"));
const OrderDetail = React.lazy(() => import("./pages/OrderDetail"));
const Users = React.lazy(() => import("./pages/Users"));
const Notifications = React.lazy(() => import("./pages/Notifications"));
const CommandCenter = React.lazy(() => import("./pages/CommandCenter"));
const Categories = React.lazy(() => import("./pages/Categories"));
const Profile = React.lazy(() => import("./pages/Profile"));
const Roles = React.lazy(() => import("./pages/Roles"));
const Teams = React.lazy(() => import("./pages/Teams"));
const Announcements = React.lazy(() => import("./pages/Announcements"));
const Logs = React.lazy(() => import("./pages/Logs"));
const Integrations = React.lazy(() => import("./pages/Integrations"));
const Services = React.lazy(() => import("./pages/Services"));
const EmailSettings = React.lazy(() => import("./pages/EmailSettings"));
const DraftEditor = React.lazy(() => import("./pages/DraftEditor"));
const Reports = React.lazy(() => import("./pages/Reports"));
const SpecialtiesAdmin = React.lazy(() => import("./pages/SpecialtiesAdmin"));
const MyRequests = React.lazy(() => import("./pages/MyRequests"));
const ReportIssue = React.lazy(() => import("./pages/ReportIssue"));
const IAMPage = React.lazy(() => import("./pages/IAMPage"));
const SettingsHub = React.lazy(() => import("./pages/SettingsHub"));
const DeletedTickets = React.lazy(() => import("./pages/DeletedTickets"));
const OnboardingWizard = React.lazy(() => import("./pages/OnboardingWizard"));
const DocumentationPage = React.lazy(() => import("./pages/DocumentationPage"));
const TranslationEditorPage = React.lazy(() => import("./pages/TranslationEditorPage"));
const DashboardBuilder = React.lazy(() => import("./pages/DashboardBuilder"));
const TaskBoard = React.lazy(() => import("./pages/TaskBoard"));
const Projects = React.lazy(() => import("./pages/Projects"));
const ProjectPage = React.lazy(() => import("./pages/ProjectPage"));
const Finance = React.lazy(() => import("./pages/Finance"));
const SOPs = React.lazy(() => import("./pages/SOPs"));
const CRM = React.lazy(() => import("./pages/CRM"));
const Ambassador = React.lazy(() => import("./pages/Ambassador"));
const AIAssistant = React.lazy(() => import("./pages/AIAssistant"));
const Files = React.lazy(() => import("./pages/Files"));
const ClientPage = React.lazy(() => import("./pages/ClientPage"));
const Team = React.lazy(() => import("./pages/Team"));
const TeamMemberPage = React.lazy(() => import("./pages/TeamMemberPage"));
const AdPerformance = React.lazy(() => import("./pages/AdPerformance"));
const Onboarding = React.lazy(() => import("./pages/Onboarding"));
const Documents = React.lazy(() => import("./pages/Documents"));
const KnowledgeBase = React.lazy(() => import("./pages/KnowledgeBase"));
const Drive = React.lazy(() => import("./pages/Drive"));
const Calendar = React.lazy(() => import("./pages/Calendar"));
const SheetEditor = React.lazy(() => import("./pages/SheetEditor"));
const OperatorDashboard = React.lazy(() => import("./pages/OperatorDashboard"));
const StandardDashboard = React.lazy(() => import("./pages/StandardDashboard"));
const Conversations = React.lazy(() => import("./pages/Conversations"));
const Support = React.lazy(() => import("./pages/Support"));
const NotFound = React.lazy(() => import("./pages/NotFound"));
const ClientPortalAdmin = React.lazy(() => import("./pages/ClientPortalAdmin"));
const ClientPortal = React.lazy(() => import("./pages/ClientPortal"));
const AdminJarvis = React.lazy(() => import("./pages/AdminJarvis"));

import { useAppMode, APP_MODES } from "./hooks/useAppMode";

// Suspense fallback shown while lazy chunks load
function PageLoader() {
  return <SkeletonPage />;
}

// Home route — three distinct dashboards by role + client portal for Media Clients.
//   Administrator      → CommandCenter (full agency visibility)
//   Operator           → OperatorDashboard (task-first execution)
//   Standard User      → StandardDashboard (minimal, calm)
//   Media Client       → ClientHome (client portal)
function HomeRoute() {
  const { user } = useAuth();
  const isPreview = typeof window !== 'undefined' && localStorage.getItem('preview_as_client') === 'true';
  const isClient = isPreview || user?.account_type === 'Media Client' || user?.role === 'Media Client';
  if (isClient) return <Navigate to="/portal" replace />;

  const role = user?.role;
  if (role === 'Operator') return <OperatorDashboard />;
  if (role === 'Standard User') return <StandardDashboard />;
  // Administrator, Admin alias, Privileged User, and anything else falls
  // back to the full agency Command Center.
  return <CommandCenter />;
}

// Route guard that checks mode access
function ModeRoute({ children, allowedModes = [] }) {
  const modeConfig = useAppMode();
  const { user } = useAuth();
  
  if (!user) return <Navigate to="/login" />;
  
  // Check if user has access to any of the allowed modes
  const hasAccess = allowedModes.length === 0 || allowedModes.some(mode => {
    switch (mode) {
      case APP_MODES.CLIENT_PORTAL: return modeConfig.canAccessClientPortal;
      case APP_MODES.OPERATOR_CONSOLE: return modeConfig.canAccessOperatorConsole;
      case APP_MODES.ADMIN_STUDIO: return modeConfig.canAccessAdminStudio;
      default: return false;
    }
  });
  
  if (!hasAccess) {
    // Redirect to appropriate home based on primary mode
    if (modeConfig.primaryMode === APP_MODES.CLIENT_PORTAL) return <Navigate to="/" />;
    if (modeConfig.primaryMode === APP_MODES.OPERATOR_CONSOLE) return <Navigate to="/queue" />;
    if (modeConfig.primaryMode === APP_MODES.ADMIN_STUDIO) return <Navigate to="/admin" />;
    return <Navigate to="/" />;
  }
  
  return children;
}

function PrivateRoute({ children, roles }) {
  const { isAuthenticated, loading, user } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <div className="spinner-ring" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }

  // Check if user needs to change password (force redirect)
  if (user?.force_password_change && location.pathname !== '/force-password-change') {
    return <Navigate to="/force-password-change" replace />;
  }

  // Check if user needs to setup OTP (after password change is done)
  if (user?.force_otp_setup && !user?.otp_verified && 
      !user?.force_password_change && 
      location.pathname !== '/setup-otp') {
    return <Navigate to="/setup-otp" replace />;
  }

  // Check if OTP verification is required for this session
  if (user?.otp_verified && location.pathname !== '/verify-otp') {
    const trustExpiry = localStorage.getItem('otp_trust_expiry');
    const otpSessionVerified = sessionStorage.getItem('otp_session_verified');
    // Trust check - compare timestamps
    const trustExpiryTime = trustExpiry ? parseInt(trustExpiry, 10) : 0;
    const currentTime = new Date().getTime();
    const isTrusted = trustExpiryTime > currentTime;
    
    if (!isTrusted && !otpSessionVerified) {
      return <Navigate to="/verify-otp" replace />;
    }
  }

  if (roles && !roles.includes(user?.role)) {
    return <Navigate to="/" />;
  }

  // Check if user needs onboarding (after password + OTP are done)
  const isSetupOrVerifyPage = ['/setup-otp', '/verify-otp', '/force-password-change'].includes(location.pathname);
  const isStaff = user?.role === 'Administrator' || user?.role === 'Operator';

  if (!user?.onboarding_completed &&
      !isStaff &&
      !user?.force_password_change &&
      !(user?.force_otp_setup && !user?.otp_verified) &&
      location.pathname !== '/onboarding' &&
      !isSetupOrVerifyPage) {
    return <Navigate to="/onboarding" replace />;
  }

  // Client-route enforcement: applies to real Media Clients AND admins in
  // preview-as-client mode. Trims internal-only routes (task-board kanban,
  // SOPs, knowledge base, internal support, the /team /users /finance
  // /clients /integrations /crm /ambassador /workflows admin surfaces).
  const isPreview = typeof window !== 'undefined' && localStorage.getItem('preview_as_client') === 'true';
  const isMediaClient = user?.account_type === 'Media Client' || user?.role === 'Media Client';
  if (isPreview || isMediaClient) {
    const CLIENT_ALLOWED = [
      '/',                // home → redirects to /portal
      '/portal',          // client portal page
      '/services',
      '/my-requests',
      '/tasks',           // their own tasks (filtered server-side)
      '/projects',        // their own projects (filtered server-side)
      '/my-account',
      '/drive',           // their own files + docs (filtered server-side)
      '/files',           // legacy alias
      '/ad-performance',  // their own ad report
      '/notifications',
      '/conversations',
    ];
    const path = location.pathname;
    const allowed =
      CLIENT_ALLOWED.includes(path) ||
      path.startsWith('/requests') ||        // request detail view of their own request
      path.startsWith('/projects/') ||       // project detail — backend 404s non-assigned
      path.startsWith('/drive/') ||          // drive sub-routes (sheet editor etc.)
      path.startsWith('/notifications/');
    if (!allowed) {
      return <Navigate to="/" replace />;
    }
  }

  return <Layout>{children}</Layout>;
}

function PublicRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <div className="spinner-ring" />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/" />;
  }

  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route 
        path="/login" 
        element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        } 
      />
      <Route 
        path="/forgot-password" 
        element={
          <PublicRoute>
            <ForgotPassword />
          </PublicRoute>
        } 
      />
      {/* Force password change - requires auth but not full session */}
      <Route path="/force-password-change" element={<ForcePasswordChange />} />
      {/* OTP Setup - requires auth but not full session */}
      <Route path="/setup-otp" element={<SetupOTP />} />
      {/* OTP Verify - requires auth but not full session */}
      <Route path="/verify-otp" element={<VerifyOTP />} />
      {/* Onboarding wizard - requires auth but not full layout */}
      <Route path="/onboarding" element={<OnboardingWizard />} />
      <Route
        path="/reset-password" 
        element={
          <PublicRoute>
            <ResetPassword />
          </PublicRoute>
        } 
      />
      <Route 
        path="/rate" 
        element={<RateSurvey />}
      />
      
      {/* ========== HOME — role-based ========== */}
      <Route
        path="/"
        element={
          <PrivateRoute>
            <HomeRoute />
          </PrivateRoute>
        }
      />

      {/* ========== CLIENT PORTAL ========== */}
      <Route path="/portal" element={<PrivateRoute><ClientPortal /></PrivateRoute>} />

      {/* ========== RED OPS CORE ROUTES ========== */}
      {/* RRG Services Marketplace */}
      <Route
        path="/services"
        element={<PrivateRoute><Services /></PrivateRoute>}
      />
      {/* Integrations Hub */}
      <Route
        path="/integrations"
        element={<PrivateRoute roles={['Administrator']}><Integrations /></PrivateRoute>}
      />
      {/* Legacy Command Center redirect */}
      <Route path="/command-center" element={<Navigate to="/" replace />} />

      {/* ========== CLIENT PORTAL ROUTES ========== */}
      {/* Service Catalog - Browse services (client portal) */}
      <Route
        path="/catalog"
        element={
          <PrivateRoute>
            <ServiceCatalog />
          </PrivateRoute>
        }
      />
      {/* My Requests - Client's submitted requests */}
      <Route 
        path="/my-requests" 
        element={
          <PrivateRoute>
            <MyRequests />
          </PrivateRoute>
        } 
      />
      {/* My Account - Profile, Plan, Billing */}
      <Route 
        path="/my-account" 
        element={
          <PrivateRoute>
            <MyAccount />
          </PrivateRoute>
        } 
      />
      {/* Request form - Client: service-template-driven intake */}
      <Route 
        path="/request/new" 
        element={
          <PrivateRoute>
            <ServiceCatalog />
          </PrivateRoute>
        } 
      />
      {/* Request detail - View request */}
      <Route 
        path="/requests/:orderId" 
        element={
          <PrivateRoute>
            <OrderDetail />
          </PrivateRoute>
        } 
      />
      
      {/* Legacy routes - redirect to new paths */}
      <Route path="/my-services" element={<Navigate to="/my-account" replace />} />
      <Route path="/my-tickets" element={<Navigate to="/my-requests" replace />} />
      <Route path="/tickets" element={<Navigate to="/my-requests" replace />} />
      <Route path="/tickets/:orderId" element={<RedirectWithParams to="/requests/:orderId" />} />
      
      {/* ========== CORE APP ROUTES ========== */}
      <Route path="/tasks" element={<Navigate to="/task-board" replace />} />
      <Route path="/projects" element={<PrivateRoute><Projects /></PrivateRoute>} />
      <Route path="/projects/:id" element={<PrivateRoute><ProjectPage /></PrivateRoute>} />
      <Route path="/calendar" element={<PrivateRoute><Calendar /></PrivateRoute>} />
      <Route path="/drive/sheet/:id" element={<PrivateRoute><SheetEditor /></PrivateRoute>} />
      <Route path="/finance" element={<PrivateRoute roles={['Administrator']}><Finance /></PrivateRoute>} />
      <Route path="/drive" element={<PrivateRoute><Drive /></PrivateRoute>} />
      <Route path="/knowledge-base" element={<Navigate to="/drive" replace />} />
      <Route path="/knowledge-base/legacy" element={<PrivateRoute><KnowledgeBase /></PrivateRoute>} />
      <Route path="/sops" element={<Navigate to="/drive" replace />} />
      <Route path="/conversations" element={<PrivateRoute><Conversations /></PrivateRoute>} />
      <Route path="/support" element={<PrivateRoute><Support /></PrivateRoute>} />
      <Route path="/ad-performance" element={<PrivateRoute><AdPerformance /></PrivateRoute>} />
      <Route path="/client-onboarding" element={<PrivateRoute roles={['Administrator','Operator']}><Onboarding /></PrivateRoute>} />
      <Route path="/crm" element={<PrivateRoute roles={['Administrator','Operator']}><CRM /></PrivateRoute>} />
      <Route path="/ambassador" element={<PrivateRoute><Ambassador /></PrivateRoute>} />
      <Route path="/ai" element={<PrivateRoute><AIAssistant /></PrivateRoute>} />
      <Route path="/docs" element={<Navigate to="/drive" replace />} />
      <Route path="/files" element={<Navigate to="/drive" replace />} />
      <Route path="/files/legacy" element={<PrivateRoute><Files /></PrivateRoute>} />
      <Route path="/team" element={<PrivateRoute roles={['Administrator','Operator']}><Team /></PrivateRoute>} />
      <Route path="/team/:id" element={<PrivateRoute roles={['Administrator','Operator']}><TeamMemberPage /></PrivateRoute>} />
      <Route path="/clients" element={<PrivateRoute roles={['Administrator','Operator']}><Clients /></PrivateRoute>} />
      <Route path="/clients/:id" element={<PrivateRoute roles={['Administrator','Operator']}><ClientPage /></PrivateRoute>} />
      <Route path="/requests" element={<PrivateRoute roles={['Administrator','Operator','Standard User']}><Requests /></PrivateRoute>} />

      {/* ========== OPERATOR CONSOLE ROUTES ========== */}
      {/* Task Board - All roles (legacy) */}
      <Route
        path="/task-board"
        element={
          <PrivateRoute>
            <TaskBoard />
          </PrivateRoute>
        }
      />
      {/* My Queue - Internal/Admin only */}
      <Route 
        path="/queue" 
        element={
          <PrivateRoute>
            <ModeRoute allowedModes={[APP_MODES.OPERATOR_CONSOLE, APP_MODES.ADMIN_STUDIO]}>
              <Orders />
            </ModeRoute>
          </PrivateRoute>
        } 
      />
      {/* All Requests - Internal staff and admin only */}
      <Route 
        path="/all-requests" 
        element={
          <PrivateRoute>
            <ModeRoute allowedModes={[APP_MODES.OPERATOR_CONSOLE, APP_MODES.ADMIN_STUDIO]}>
              <Orders />
            </ModeRoute>
          </PrivateRoute>
        } 
      />
      
      {/* Legacy operator routes */}
      {/* MVP: Ribbon board disabled */}
      {/* <Route path="/ribbon-board" element={<Navigate to="/pool" replace />} /> */}
      <Route path="/orders" element={<Navigate to="/all-requests" replace />} />
      <Route path="/orders/:orderId" element={<RedirectWithParams to="/requests/:orderId" />} />
      
      <Route 
        path="/report-issue" 
        element={
          <PrivateRoute>
            <ReportIssue />
          </PrivateRoute>
        } 
      />
      <Route 
        path="/users" 
        element={
          <PrivateRoute roles={["Administrator"]}>
            <Users />
          </PrivateRoute>
        } 
      />
      <Route 
        path="/notifications" 
        element={
          <PrivateRoute>
            <Notifications />
          </PrivateRoute>
        } 
      />
      <Route 
        path="/drafts/:type/:draftId" 
        element={
          <PrivateRoute>
            <ModeRoute allowedModes={[APP_MODES.OPERATOR_CONSOLE, APP_MODES.ADMIN_STUDIO]}>
              <DraftEditor />
            </ModeRoute>
          </PrivateRoute>
        } 
      />
      
      {/* ========== ADMIN STUDIO ROUTES ========== */}
      {/* Admin redirect */}
      <Route path="/admin" element={<Navigate to="/" replace />} />
      <Route
        path="/admin/jarvis"
        element={
          <PrivateRoute roles={["Administrator", "Operator"]}>
            <AdminJarvis />
          </PrivateRoute>
        }
      />
      <Route
        path="/admin/client-portal"
        element={
          <PrivateRoute roles={["Administrator", "Operator"]}>
            <ClientPortalAdmin />
          </PrivateRoute>
        }
      />
      <Route 
        path="/categories" 
        element={
          <PrivateRoute roles={["Administrator", "Operator"]}>
            <Categories />
          </PrivateRoute>
        } 
      />
      <Route 
        path="/roles" 
        element={
          <PrivateRoute roles={["Administrator"]}>
            <Roles />
          </PrivateRoute>
        } 
      />
      <Route 
        path="/iam" 
        element={
          <PrivateRoute roles={["Administrator"]}>
            <IAMPage />
          </PrivateRoute>
        } 
      />
      <Route 
        path="/teams" 
        element={
          <PrivateRoute roles={["Administrator", "Operator"]}>
            <Teams />
          </PrivateRoute>
        } 
      />
      <Route
        path="/reports" 
        element={
          <PrivateRoute>
            <ModeRoute allowedModes={[APP_MODES.OPERATOR_CONSOLE, APP_MODES.ADMIN_STUDIO]}>
              <Reports />
            </ModeRoute>
          </PrivateRoute>
        } 
      />
      <Route 
        path="/specialties" 
        element={
          <PrivateRoute roles={["Administrator"]}>
            <SpecialtiesAdmin />
          </PrivateRoute>
        } 
      />
      <Route
        path="/settings"
        element={
          <PrivateRoute roles={["Administrator"]}>
            <SettingsHub />
          </PrivateRoute>
        }
      />
      <Route
        path="/settings/profile"
        element={
          <PrivateRoute roles={["Administrator"]}>
            <Settings />
          </PrivateRoute>
        }
      />
      <Route 
        path="/email-settings" 
        element={
          <PrivateRoute roles={["Administrator"]}>
            <EmailSettings />
          </PrivateRoute>
        } 
      />
      <Route 
        path="/announcements" 
        element={
          <PrivateRoute roles={["Administrator"]}>
            <Announcements />
          </PrivateRoute>
        } 
      />
      <Route 
        path="/logs" 
        element={
          <PrivateRoute roles={["Administrator", "Operator"]}>
            <Logs />
          </PrivateRoute>
        } 
      />
      <Route 
        path="/integrations" 
        element={
          <PrivateRoute roles={["Administrator"]}>
            <Integrations />
          </PrivateRoute>
        } 
      />
      <Route 
        path="/deleted-tickets" 
        element={
          <PrivateRoute roles={["Administrator"]}>
            <DeletedTickets />
          </PrivateRoute>
        } 
      />
      <Route 
        path="/settings/documentation" 
        element={
          <PrivateRoute roles={["Administrator"]}>
            <DocumentationPage />
          </PrivateRoute>
        } 
      />
      <Route 
        path="/settings/translations" 
        element={
          <PrivateRoute roles={["Administrator"]}>
            <TranslationEditorPage />
          </PrivateRoute>
        } 
      />
      <Route 
        path="/settings/dashboards" 
        element={
          <PrivateRoute roles={["Administrator"]}>
            <DashboardBuilder />
          </PrivateRoute>
        } 
      />
      <Route 
        path="/profile" 
        element={
          <PrivateRoute>
            <Profile />
          </PrivateRoute>
        } 
      />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <OrgProvider>
            <Suspense fallback={<PageLoader />}>
              <AppRoutes />
            </Suspense>
            <Toaster position="top-right" richColors closeButton duration={4000} />
          </OrgProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
