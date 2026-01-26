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

function PrivateRoute({ children, roles }) {
  const { isAuthenticated, loading, user } = useAuth();

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
        path="/orders" 
        element={
          <PrivateRoute roles={["Administrator", "Privileged User"]}>
            <Orders />
          </PrivateRoute>
        } 
      />
      <Route 
        path="/orders/new" 
        element={
          <PrivateRoute roles={["Administrator", "Privileged User", "Standard User"]}>
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
        path="/categories" 
        element={
          <PrivateRoute roles={["Administrator", "Privileged User"]}>
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
        path="/teams" 
        element={
          <PrivateRoute roles={["Administrator", "Privileged User"]}>
            <Teams />
          </PrivateRoute>
        } 
      />
      <Route 
        path="/workflows" 
        element={
          <PrivateRoute roles={["Administrator", "Privileged User"]}>
            <Workflows />
          </PrivateRoute>
        } 
      />
      <Route 
        path="/workflows/:workflowId" 
        element={
          <PrivateRoute roles={["Administrator", "Privileged User"]}>
            <WorkflowEditor />
          </PrivateRoute>
        } 
      />
      <Route 
        path="/settings" 
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
          <PrivateRoute roles={["Administrator", "Privileged User"]}>
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
