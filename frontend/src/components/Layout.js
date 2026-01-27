import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import {
  LayoutDashboard,
  ClipboardList,
  Users,
  LogOut,
  Menu,
  X,
  ChevronDown,
  Bug,
  Lightbulb,
  PlusCircle,
  FolderTree,
  User,
  Shield,
  UsersRound,
  Star,
  GitBranch,
  Settings,
  FileText,
  Plug,
  Clock,
  Megaphone,
  Mail,
  AlertTriangle,
  BarChart3,
  PackageOpen,
  Briefcase,
  CreditCard,
  Inbox,
  Layers,
  KeyRound
} from 'lucide-react';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import NotificationDropdown from './NotificationDropdown';
import LanguageSwitcher from './LanguageSwitcher';
import AnnouncementTicker from './AnnouncementTicker';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function Layout({ children }) {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [ratingStats, setRatingStats] = useState(null);

  useEffect(() => {
    const fetchRatingStats = async () => {
      try {
        const res = await axios.get(`${API}/ratings/my-stats`);
        setRatingStats(res.data);
      } catch (error) {
        // Silently fail - ratings not critical for layout
      }
    };
    fetchRatingStats();
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { path: '/', icon: LayoutDashboard, labelKey: 'nav.dashboard', roles: ['Administrator', 'Operator', 'Standard User'] },
    { path: '/my-services', icon: PackageOpen, label: 'My Services', roles: ['Administrator', 'Operator', 'Standard User'] },
    { path: '/my-requests', icon: Inbox, label: 'My Requests', roles: ['Administrator', 'Operator', 'Standard User'] },
    { path: '/command-center', icon: PlusCircle, label: 'Submit New Request', roles: ['Administrator', 'Operator', 'Standard User'] },
    { path: '/report-issue', icon: Bug, label: 'Report an Issue', roles: ['Administrator', 'Operator', 'Standard User'] },
    { path: '/ribbon-board', icon: Layers, label: 'The Ribbon Board', roles: ['Administrator', 'Operator', 'Standard User'] },
    { path: '/orders', icon: ClipboardList, labelKey: 'nav.allOrders', roles: ['Administrator', 'Operator'] },
    { path: '/workflows', icon: GitBranch, labelKey: 'nav.workflows', roles: ['Administrator', 'Operator'] },
    { path: '/sla-policies', icon: Shield, label: 'SLA & Escalation', roles: ['Administrator'] },
    { path: '/reports', icon: BarChart3, label: 'Reports', roles: ['Administrator', 'Operator', 'Standard User'] },
    { path: '/users', icon: Users, labelKey: 'nav.users', roles: ['Administrator'] },
    { path: '/teams', icon: UsersRound, labelKey: 'nav.teams', roles: ['Administrator', 'Operator'] },
    { path: '/iam', icon: KeyRound, label: 'Identity & Access', roles: ['Administrator'] },
    { path: '/specialties', icon: Briefcase, label: 'Specialties', roles: ['Administrator'] },
    { path: '/subscription-plans', icon: CreditCard, label: 'Subscription Plans', roles: ['Administrator'] },
    { path: '/categories', icon: FolderTree, labelKey: 'nav.categories', roles: ['Administrator', 'Operator'] },
    { path: '/logs', icon: FileText, labelKey: 'nav.logs', roles: ['Administrator', 'Operator'] },
    { path: '/integrations', icon: Plug, labelKey: 'nav.integrations', roles: ['Administrator'] },
    { path: '/announcements', icon: Megaphone, labelKey: 'nav.announcements', roles: ['Administrator'] },
    { path: '/email-settings', icon: Mail, labelKey: 'nav.emailSettings', roles: ['Administrator'] },
    { path: '/settings', icon: Settings, labelKey: 'nav.settings', roles: ['Administrator'] },
  ];

  // Quick Links removed as per user request

  const filteredNavItems = navItems.filter(item => 
    item.roles.includes(user?.role)
  );

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
            <img 
              src="/assets/logos/logo-icon.jpg" 
              alt="Red Ops" 
              className="w-10 h-10 rounded-lg object-cover animate-pulse"
              style={{ animationDuration: '3s' }}
            />
            <span className="font-bold text-lg tracking-tight">RED OPS</span>
          </div>
          <button 
            className="ml-auto lg:hidden text-white/70 hover:text-white"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-6 px-3 overflow-y-auto">
          <div className="space-y-1">
            {filteredNavItems.map(item => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${
                  location.pathname === item.path
                    ? 'bg-white text-[#A2182C] shadow-lg'
                    : 'text-white/80 hover:text-white hover:bg-white/10'
                }`}
              >
                <item.icon size={18} strokeWidth={1.5} />
                {item.label || t(item.labelKey)}
              </Link>
            ))}
          </div>

          {/* Quick Links */}
          {filteredQuickLinks.length > 0 && (
            <div className="mt-6">
              <p className="px-4 text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">{t('dashboard.quickActions')}</p>
              <div className="space-y-1">
                {filteredQuickLinks.map(item => (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setSidebarOpen(false)}
                    className="flex items-center gap-3 px-4 py-2 text-sm text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-all duration-200"
                    data-testid={`quick-link-${item.labelKey}`}
                  >
                    <item.icon size={16} strokeWidth={1.5} />
                    {t(item.labelKey)}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </nav>

        {/* User section */}
        <div className="p-4 border-t border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
              <span className="text-sm font-medium">{user?.name?.charAt(0) || 'U'}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.name}</p>
              <p className="text-xs text-white/60">{user?.role}</p>
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

          {/* Rating Display (Google Review Style) */}
          {ratingStats && (
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

          {/* Announcement Banner - inline in header */}
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
                <p className="text-xs text-[#A2182C] font-medium mt-1">{user?.role}</p>
              </div>
              <DropdownMenuItem asChild>
                <Link to="/profile" className="flex items-center cursor-pointer" data-testid="profile-menu-item">
                  <User size={16} className="mr-2" />
                  {t('nav.profile')}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-red-600" data-testid="logout-menu-item">
                <LogOut size={16} className="mr-2" />
                {t('auth.logout')}
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
