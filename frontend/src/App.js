import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useParams } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { Toaster } from "./components/ui/sonner";
import Layout from "./components/Layout";

// Helper component for redirecting with params
function RedirectWithParams({ to }) {
  const params = useParams();
  let path = to;
  Object.keys(params).forEach(key => {
    path = path.replace(`:${key}`, params[key]);
  });
  return <Navigate to={path} replace />;
}
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import RateSurvey from "./pages/RateSurvey";
import Dashboard from "./pages/Dashboard";
import ClientHome from "./pages/ClientHome";
import ServiceCatalog from "./pages/ServiceCatalog";
import MyAccount from "./pages/MyAccount";
import Orders from "./pages/Orders";
import OrderDetail from "./pages/OrderDetail";
import Users from "./pages/Users";
import Notifications from "./pages/Notifications";
import CommandCenter from "./pages/CommandCenter";
import Categories from "./pages/Categories";
import Profile from "./pages/Profile";
import Roles from "./pages/Roles";
import Teams from "./pages/Teams";
import Workflows from "./pages/Workflows";
import WorkflowEditor from "./pages/WorkflowEditor";
import UISettings from "./pages/UISettings";
import Announcements from "./pages/Announcements";
import Logs from "./pages/Logs";
import Integrations from "./pages/Integrations";
import EmailSettings from "./pages/EmailSettings";
import DraftEditor from "./pages/DraftEditor";
import Reports from "./pages/Reports";
import MyServices from "./pages/MyServices";
import SpecialtiesAdmin from "./pages/SpecialtiesAdmin";
import MyRequests from "./pages/MyRequests";
import ReportIssue from "./pages/ReportIssue";
import IAMPage from "./pages/IAMPage";
import SettingsHub from "./pages/SettingsHub";
import DeletedTickets from "./pages/DeletedTickets";
import ForcePasswordChange from "./pages/ForcePasswordChange";
import SetupOTP from "./pages/SetupOTP";
import VerifyOTP from "./pages/VerifyOTP";
import DocumentationPage from "./pages/DocumentationPage";
import TranslationEditorPage from "./pages/TranslationEditorPage";
import DashboardBuilder from "./pages/DashboardBuilder";
import TaskBoard from "./pages/TaskBoard";
import Tasks from "./pages/Tasks";
import Projects from "./pages/Projects";
import Finance from "./pages/Finance";
import SOPs from "./pages/SOPs";
import AIAssistant from "./pages/AIAssistant";
import Team from "./pages/Team";
import { useAppMode, APP_MODES } from "./hooks/useAppMode";

// Home route — Command Center for internal roles, ClientHome for clients
function HomeRoute() {
  const { user } = useAuth();
  const isClient = user?.account_type === 'Media Client' || user?.role === 'Media Client';
  if (isClient) return <ClientHome />;
  return <Dashboard />;
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
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin h-8 w-8 border-4 border-rose-600 border-t-transparent rounded-full" />
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

  // Preview-as-client enforcement: block non-client routes
  const isPreview = typeof window !== 'undefined' && localStorage.getItem('preview_as_client') === 'true';
  if (isPreview) {
    const CLIENT_ALLOWED = ['/', '/services', '/my-requests', '/tasks', '/task-board', '/my-account'];
    const path = location.pathname;
    const allowed = CLIENT_ALLOWED.includes(path) || path.startsWith('/requests');
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
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="animate-spin h-8 w-8 border-4 border-rose-600 border-t-transparent rounded-full" />
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

      {/* ========== CLIENT PORTAL ROUTES ========== */}
      {/* Service Catalog - Browse services */}
      <Route 
        path="/services" 
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
      <Route path="/command-center" element={
        <PrivateRoute roles={["Administrator", "Operator"]}>
          <CommandCenter />
        </PrivateRoute>
      } />
      <Route path="/tickets" element={<Navigate to="/my-requests" replace />} />
      <Route path="/tickets/:orderId" element={<RedirectWithParams to="/requests/:orderId" />} />
      
      {/* ========== CORE APP ROUTES ========== */}
      <Route path="/tasks" element={<PrivateRoute><Tasks /></PrivateRoute>} />
      <Route path="/projects" element={<PrivateRoute roles={['Administrator','Operator','Standard User']}><Projects /></PrivateRoute>} />
      <Route path="/finance" element={<PrivateRoute roles={['Administrator']}><Finance /></PrivateRoute>} />
      <Route path="/sops" element={<PrivateRoute><SOPs /></PrivateRoute>} />
      <Route path="/ai" element={<PrivateRoute><AIAssistant /></PrivateRoute>} />
      <Route path="/team" element={<PrivateRoute roles={['Administrator','Operator']}><Team /></PrivateRoute>} />
      <Route path="/clients" element={<PrivateRoute roles={['Administrator','Operator']}><Clients /></PrivateRoute>} />
      <Route path="/requests" element={<PrivateRoute roles={['Administrator','Operator','Standard User']}><Orders /></PrivateRoute>} />

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
      {/* MVP: Pool routing disabled - routes commented out */}
      {/* Pool - Available requests to pick */}
      {/* <Route 
        path="/pool" 
        element={
          <PrivateRoute>
            <RibbonBoard />
          </PrivateRoute>
        } 
      /> */}
      
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
        path="/workflows" 
        element={
          <PrivateRoute roles={["Administrator", "Operator"]}>
            <Workflows />
          </PrivateRoute>
        } 
      />
      <Route 
        path="/workflows/:workflowId" 
        element={
          <PrivateRoute roles={["Administrator", "Operator"]}>
            <WorkflowEditor />
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
        path="/settings/ui" 
        element={
          <PrivateRoute roles={["Administrator"]}>
            <UISettings />
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
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        <Toaster position="top-right" richColors />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
