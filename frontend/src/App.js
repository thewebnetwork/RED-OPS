import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { Toaster } from "./components/ui/sonner";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import RateSurvey from "./pages/RateSurvey";
import Dashboard from "./pages/Dashboard";
import Orders from "./pages/Orders";
import OrderDetail from "./pages/OrderDetail";
import CreateOrder from "./pages/CreateOrder";
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
import SLAPolicies from "./pages/SLAPolicies";
import EmailSettings from "./pages/EmailSettings";
import DraftEditor from "./pages/DraftEditor";
import Reports from "./pages/Reports";
import MyServices from "./pages/MyServices";
import SpecialtiesAdmin from "./pages/SpecialtiesAdmin";
import SubscriptionPlansAdmin from "./pages/SubscriptionPlansAdmin";
import MyRequests from "./pages/MyRequests";
import ReportIssue from "./pages/ReportIssue";
import RibbonBoard from "./pages/RibbonBoard";
import IAMPage from "./pages/IAMPage";
import SettingsHub from "./pages/SettingsHub";
import DeletedTickets from "./pages/DeletedTickets";
import ForcePasswordChange from "./pages/ForcePasswordChange";
import SetupOTP from "./pages/SetupOTP";
import VerifyOTP from "./pages/VerifyOTP";

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
    const isTrusted = trustExpiry && Date.now() < parseInt(trustExpiry);
    
    if (!isTrusted && !otpSessionVerified) {
      return <Navigate to="/verify-otp" replace />;
    }
  }

  if (roles && !roles.includes(user?.role)) {
    return <Navigate to="/" />;
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
      <Route 
        path="/" 
        element={
          <PrivateRoute>
            <Dashboard />
          </PrivateRoute>
        } 
      />
      <Route 
        path="/my-services" 
        element={
          <PrivateRoute>
            <MyServices />
          </PrivateRoute>
        } 
      />
      <Route 
        path="/my-tickets" 
        element={
          <PrivateRoute>
            <MyRequests />
          </PrivateRoute>
        } 
      />
      <Route 
        path="/report-issue" 
        element={
          <PrivateRoute>
            <ReportIssue />
          </PrivateRoute>
        } 
      />
      <Route 
        path="/ribbon-board" 
        element={
          <PrivateRoute>
            <RibbonBoard />
          </PrivateRoute>
        } 
      />
      <Route 
        path="/orders" 
        element={
          <PrivateRoute roles={["Administrator"]}>
            <Orders />
          </PrivateRoute>
        } 
      />
      <Route 
        path="/orders/new" 
        element={
          <PrivateRoute roles={["Administrator", "Operator", "Standard User"]}>
            <CreateOrder />
          </PrivateRoute>
        } 
      />
      <Route 
        path="/orders/:orderId" 
        element={
          <PrivateRoute>
            <OrderDetail />
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
        path="/command-center" 
        element={
          <PrivateRoute>
            <CommandCenter />
          </PrivateRoute>
        } 
      />
      <Route 
        path="/drafts/:type/:draftId" 
        element={
          <PrivateRoute>
            <DraftEditor />
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
            <Reports />
          </PrivateRoute>
        } 
      />
      <Route 
        path="/my-services" 
        element={
          <PrivateRoute>
            <MyServices />
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
        path="/subscription-plans" 
        element={
          <PrivateRoute roles={["Administrator"]}>
            <SubscriptionPlansAdmin />
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
        path="/sla-policies" 
        element={
          <PrivateRoute roles={["Administrator"]}>
            <SLAPolicies />
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
        path="/sla" 
        element={<Navigate to="/sla-policies" />}
      />
      <Route 
        path="/escalation" 
        element={<Navigate to="/sla-policies" />}
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
