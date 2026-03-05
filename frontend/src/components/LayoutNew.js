import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { displayAccountType } from '../utils/displayAccountType';
import { useAppMode, APP_MODES } from '../hooks/useAppMode';
import {
  Home,
  ShoppingBag,
  FileText,
  User,
  Inbox,
  Layers,
  ClipboardList,
  BarChart3,
  LayoutDashboard,
  KeyRound,
  Settings,
  Megaphone,
  LogOut,
  Menu,
  X,
  ChevronDown,
  Star,
  Eye,
  ChevronRight,
  CheckSquare
} from 'lucide-react';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Badge } from './ui/badge';
import NotificationDropdown from './NotificationDropdown';
import LanguageSwitcher from './LanguageSwitcher';
import AnnouncementTicker from './AnnouncementTicker';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Routes shared across modes — mode determined by active_app_mode, not URL
const SHARED_ROUTES = ['/tasks', '/task-board', '/reports'];

// Icon mapping
const ICONS = {
  Home, ShoppingBag, FileText, User, Inbox, Layers, ClipboardList,
  BarChart3, LayoutDashboard, KeyRound, Settings, Megaphone, CheckSquare
};

export default function Layout({ children }) {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const modeConfig = useAppMode();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [ratingStats, setRatingStats] = useState(null);
  const [previewAsClient, setPreviewAsClient] = useState(false);

  // Check for preview mode in localStorage
  useEffect(() => {
    const preview = localStorage.getItem('preview_as_client');
    setPreviewAsClient(preview === 'true');
  }, []);

  useEffect(() => {
    const fetchRatingStats = async () => {
      try {
        const res = await axios.get(`${API}/ratings/my-stats`);
        setRatingStats(res.data);
      } catch (error) {
        // Silently fail
      }
    };
    fetchRatingStats();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('preview_as_client');
    localStorage.removeItem('active_app_mode');
    logout();
    navigate('/login');
  };

  const toggleClientPreview = () => {
    const newValue = !previewAsClient;
    setPreviewAsClient(newValue);
    localStorage.setItem('preview_as_client', newValue.toString());
    // Refresh the page to apply new mode
    window.location.reload();
  };

  // Determine current mode
  const getCurrentMode = () => {
    // Preview as Client always forces client portal
    if (previewAsClient && modeConfig.canAccessAdminStudio) {
      return APP_MODES.CLIENT_PORTAL;
    }
    
    const path = location.pathname;
    
    // Shared routes: respect the sticky active_app_mode from localStorage
    if (SHARED_ROUTES.some(p => path === p || path.startsWith(p + '/'))) {
      const stored = localStorage.getItem('active_app_mode');
      if (stored === 'client_portal') return APP_MODES.CLIENT_PORTAL;
      if (stored === 'operator_console' && modeConfig.canAccessOperatorConsole) return APP_MODES.OPERATOR_CONSOLE;
      if (stored === 'admin_studio' && modeConfig.canAccessAdminStudio) return APP_MODES.ADMIN_STUDIO;
      return modeConfig.primaryMode;
    }
    
    // Admin routes
    if (['/iam', '/settings', '/announcements', '/logs', '/admin'].some(p => path.startsWith(p))) {
      return modeConfig.canAccessAdminStudio ? APP_MODES.ADMIN_STUDIO : modeConfig.primaryMode;
    }
    
    // Operator routes
    if (['/queue', '/pool', '/all-requests'].some(p => path.startsWith(p))) {
      return modeConfig.canAccessOperatorConsole ? APP_MODES.OPERATOR_CONSOLE : modeConfig.primaryMode;
    }
    
    // Client routes
    if (['/', '/services', '/my-requests', '/my-account', '/requests'].some(p => path === p || path.startsWith('/requests/'))) {
      return APP_MODES.CLIENT_PORTAL;
    }
    
    return modeConfig.primaryMode;
  };

  const currentMode = getCurrentMode();
  const isClientMode = currentMode === APP_MODES.CLIENT_PORTAL;
  const isOperatorMode = currentMode === APP_MODES.OPERATOR_CONSOLE;
  const isAdminMode = currentMode === APP_MODES.ADMIN_STUDIO;

  // Get navigation items for current mode
  const getNavItems = () => {
    // If pure client (Media Client), always show client portal nav
    if (modeConfig.isClient || previewAsClient) {
      return [
        { path: '/', icon: 'Home', labelKey: 'nav.home' },
        { path: '/services', icon: 'ShoppingBag', labelKey: 'nav.requestService' },
        { path: '/my-requests', icon: 'FileText', labelKey: 'nav.myRequests' },
        { path: '/tasks', icon: 'CheckSquare', labelKey: 'nav.tasks' },
        { path: '/my-account', icon: 'User', labelKey: 'nav.myAccount' }
      ];
    }

    // Admin gets all modes accessible via dropdown
    if (modeConfig.isAdmin) {
      if (isClientMode) {
        return [
          { path: '/', icon: 'Home', labelKey: 'nav.home' },
          { path: '/services', icon: 'ShoppingBag', labelKey: 'nav.requestService' },
          { path: '/my-requests', icon: 'FileText', labelKey: 'nav.myRequests' },
          { path: '/tasks', icon: 'CheckSquare', labelKey: 'nav.tasks' },
          { path: '/my-account', icon: 'User', labelKey: 'nav.myAccount' }
        ];
      }
      
      if (isOperatorMode) {
        const items = [
          { path: '/queue', icon: 'Inbox', labelKey: 'nav.myQueue' }
        ];
        if (modeConfig.canPickFromPools) {
          items.push({ path: '/pool', icon: 'Layers', labelKey: 'nav.pool' });
        }
        items.push({ path: '/tasks', icon: 'CheckSquare', labelKey: 'nav.tasks' });
        items.push({ path: '/all-requests', icon: 'ClipboardList', labelKey: 'nav.allRequests' });
        items.push({ path: '/reports', icon: 'BarChart3', labelKey: 'nav.reports' });
        return items;
      }
      
      // Admin Studio
      return [
        { path: '/admin', icon: 'LayoutDashboard', labelKey: 'nav.adminDashboard' },
        { path: '/tasks', icon: 'CheckSquare', labelKey: 'nav.tasks' },
        { path: '/iam', icon: 'KeyRound', labelKey: 'iam.title' },
        { path: '/settings', icon: 'Settings', labelKey: 'nav.settings' },
        { path: '/reports', icon: 'BarChart3', labelKey: 'nav.reports' },
        { path: '/logs', icon: 'FileText', labelKey: 'nav.logs' },
        { path: '/announcements', icon: 'Megaphone', labelKey: 'nav.announcements' }
      ];
    }

    // Operator mode for non-admins
    if (modeConfig.isOperator) {
      const items = [
        { path: '/queue', icon: 'Inbox', labelKey: 'nav.myQueue' }
      ];
      if (modeConfig.canPickFromPools) {
        items.push({ path: '/pool', icon: 'Layers', labelKey: 'nav.pool' });
      }
      items.push({ path: '/tasks', icon: 'CheckSquare', labelKey: 'nav.tasks' });
      if (modeConfig.isInternalStaff) {
        items.push({ path: '/all-requests', icon: 'ClipboardList', labelKey: 'nav.allRequests' });
        items.push({ path: '/reports', icon: 'BarChart3', labelKey: 'nav.reports' });
      }
      return items;
    }

    // Default client portal
    return [
      { path: '/', icon: 'Home', labelKey: 'nav.home' },
      { path: '/services', icon: 'ShoppingBag', labelKey: 'nav.requestService' },
      { path: '/my-requests', icon: 'FileText', labelKey: 'nav.myRequests' },
      { path: '/tasks', icon: 'CheckSquare', labelKey: 'nav.tasks' },
      { path: '/my-account', icon: 'User', labelKey: 'nav.myAccount' }
    ];
  };

  const navItems = getNavItems();

  // Mode indicator text
  const getModeLabel = () => {
    if (previewAsClient) return t('nav.clientPreview', 'Client Preview');
    if (isClientMode) return t('nav.clientPortal', 'Client Portal');
    if (isOperatorMode) return t('nav.operatorConsole', 'Operator Console');
    if (isAdminMode) return t('nav.adminStudio', 'Admin Studio');
    return '';
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed left-0 top-0 h-screen w-64 bg-[#A2182C] text-white flex flex-col z-50 transition-transform duration-300 lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        {/* Logo */}
        <div className="h-16 flex items-center px-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="relative">
              <img 
                src="/assets/logos/logo-icon.jpg" 
                alt="Red Ops" 
                className="w-10 h-10 rounded-lg object-cover relative z-10"
              />
              <span className="absolute inset-0 rounded-lg bg-white/20 blur-sm" />
            </div>
            <div>
              <span className="font-bold text-lg tracking-tight block">RED OPS</span>
              {modeConfig.availableModes.length > 1 && (
                <span className="text-[10px] text-white/60 uppercase tracking-wider">
                  {getModeLabel()}
                </span>
              )}
            </div>
          </div>
          <button 
            className="ml-auto lg:hidden text-white/70 hover:text-white"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={20} />
          </button>
        </div>

        {/* Mode Switcher - Only for users with multiple modes */}
        {modeConfig.availableModes.length > 1 && !previewAsClient && (
          <div className="px-3 py-3 border-b border-white/10">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="w-full flex items-center justify-between px-3 py-2 bg-white/10 rounded-lg hover:bg-white/15 transition-colors">
                  <span className="text-sm font-medium">{getModeLabel()}</span>
                  <ChevronDown size={16} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                {modeConfig.canAccessClientPortal && (
                  <DropdownMenuItem asChild>
                    <Link to="/" onClick={() => localStorage.setItem('active_app_mode', 'client_portal')} className="flex items-center cursor-pointer">
                      <Home size={16} className="mr-2" />
                      {t('nav.clientPortal', 'Client Portal')}
                    </Link>
                  </DropdownMenuItem>
                )}
                {modeConfig.canAccessOperatorConsole && (
                  <DropdownMenuItem asChild>
                    <Link to="/queue" onClick={() => localStorage.setItem('active_app_mode', 'operator_console')} className="flex items-center cursor-pointer">
                      <Inbox size={16} className="mr-2" />
                      {t('nav.operatorConsole', 'Operator Console')}
                    </Link>
                  </DropdownMenuItem>
                )}
                {modeConfig.canAccessAdminStudio && (
                  <DropdownMenuItem asChild>
                    <Link to="/admin" onClick={() => localStorage.setItem('active_app_mode', 'admin_studio')} className="flex items-center cursor-pointer">
                      <LayoutDashboard size={16} className="mr-2" />
                      {t('nav.adminStudio', 'Admin Studio')}
                    </Link>
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

        {/* Preview Mode Banner */}
        {previewAsClient && (
          <div className="px-3 py-2 bg-amber-500">
            <div className="flex items-center gap-2 text-sm">
              <Eye size={14} />
              <span className="font-medium">{t('nav.previewMode', 'Preview Mode')}</span>
            </div>
            <button 
              onClick={toggleClientPreview}
              className="text-xs underline mt-1 hover:no-underline"
            >
              {t('nav.exitPreview', 'Exit Preview')}
            </button>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 py-6 px-3 overflow-y-auto">
          <div className="space-y-1">
            {navItems.map(item => {
              const IconComponent = ICONS[item.icon] || FileText;
              const isActive = location.pathname === item.path || 
                (item.path !== '/' && location.pathname.startsWith(item.path));
              
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${
                    isActive
                      ? 'bg-white text-[#A2182C] shadow-lg'
                      : 'text-white/80 hover:text-white hover:bg-white/10'
                  }`}
                  data-testid={`nav-${item.path.replace('/', '') || 'home'}`}
                >
                  <IconComponent size={18} strokeWidth={1.5} />
                  {t(item.labelKey, item.labelKey)}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Admin Preview as Client Button */}
        {modeConfig.canAccessAdminStudio && !previewAsClient && (
          <div className="px-4 py-3 border-t border-white/10">
            <button
              onClick={toggleClientPreview}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              data-testid="preview-as-client-btn"
            >
              <Eye size={16} />
              {t('nav.previewAsClient', 'Preview as Client')}
            </button>
          </div>
        )}

        {/* User section */}
        <div className="p-4 border-t border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
              <span className="text-sm font-medium">{user?.name?.charAt(0) || 'U'}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.name}</p>
              <p className="text-xs text-white/60">{displayAccountType(user?.account_type) || user?.role}</p>
            </div>
            <button 
              onClick={handleLogout}
              className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              data-testid="logout-btn"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 lg:ml-64">
        {/* Top header */}
        <header className="sticky top-0 z-30 h-16 bg-white border-b border-slate-200 flex items-center px-4 lg:px-8">
          <button 
            className="lg:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg mr-4"
            onClick={() => setSidebarOpen(true)}
            data-testid="mobile-menu-btn"
          >
            <Menu size={20} />
          </button>

          {/* Rating Display - Only for non-client modes */}
          {!isClientMode && ratingStats && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-lg mr-4" data-testid="header-rating">
              <div className="flex gap-0.5">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    size={14}
                    className={
                      star <= Math.round(ratingStats.average_rating)
                        ? 'fill-[#97662D] text-[#97662D]'
                        : 'fill-gray-200 text-gray-200'
                    }
                  />
                ))}
              </div>
              <span className="font-semibold text-sm text-slate-900">{ratingStats.average_rating.toFixed(1)}</span>
              <span className="text-xs text-slate-500">({ratingStats.total_ratings})</span>
            </div>
          )}

          {/* Announcement Banner */}
          <AnnouncementTicker />

          <div className="flex-1" />

          {/* Language Switcher */}
          <LanguageSwitcher variant="compact" />

          {/* Notification Dropdown */}
          <NotificationDropdown />

          {/* User dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 p-2 hover:bg-slate-100 rounded-lg ml-2" data-testid="user-menu-btn">
                <div className="w-8 h-8 rounded-full bg-[#AEC6C8] flex items-center justify-center overflow-hidden">
                  {user?.avatar ? (
                    <img src={user.avatar} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-sm font-medium text-[#A2182C]">{user?.name?.charAt(0) || 'U'}</span>
                  )}
                </div>
                <ChevronDown size={16} className="text-slate-400" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="px-3 py-2 border-b border-slate-100">
                <p className="font-medium text-sm">{user?.name}</p>
                <p className="text-xs text-slate-500">{user?.email}</p>
                <p className="text-xs text-[#A2182C] font-medium mt-1">{displayAccountType(user?.account_type) || user?.role}</p>
              </div>
              <DropdownMenuItem asChild>
                <Link to="/my-account" className="flex items-center cursor-pointer" data-testid="account-menu-item">
                  <User size={16} className="mr-2" />
                  {t('nav.myAccount', 'My Account')}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-red-600" data-testid="logout-menu-item">
                <LogOut size={16} className="mr-2" />
                {t('auth.logout', 'Logout')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        {/* Page content */}
        <main className="p-4 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
