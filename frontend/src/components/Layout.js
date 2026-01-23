import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  LayoutDashboard,
  ClipboardList,
  Users,
  Bell,
  LogOut,
  Menu,
  X,
  ChevronDown,
  Plus
} from 'lucide-react';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { useNotifications } from '../hooks/useNotifications';

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { unreadCount } = useNotifications();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { path: '/', icon: LayoutDashboard, label: 'Dashboard', roles: ['Admin', 'Editor', 'Requester'] },
    { path: '/orders', icon: ClipboardList, label: 'All Orders', roles: ['Admin'] },
    { path: '/users', icon: Users, label: 'Users', roles: ['Admin'] },
  ];

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
      <aside className={`fixed left-0 top-0 h-screen w-64 bg-slate-900 text-white flex flex-col z-50 transition-transform duration-300 lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        {/* Logo */}
        <div className="h-16 flex items-center px-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-rose-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">RR</span>
            </div>
            <span className="font-semibold text-lg tracking-tight">Red Ribbon Ops</span>
          </div>
          <button 
            className="ml-auto lg:hidden text-slate-400 hover:text-white"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-6 px-3 overflow-y-auto dark-scrollbar">
          <div className="space-y-1">
            {filteredNavItems.map(item => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${
                  location.pathname === item.path
                    ? 'bg-rose-600 text-white shadow-lg'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <item.icon size={18} strokeWidth={1.5} />
                {item.label}
              </Link>
            ))}
          </div>

          {/* Quick Action for Requester */}
          {user?.role === 'Requester' && (
            <div className="mt-6 px-2">
              <Link to="/orders/new">
                <Button className="w-full bg-rose-600 hover:bg-rose-700">
                  <Plus size={18} className="mr-2" />
                  New Request
                </Button>
              </Link>
            </div>
          )}
        </nav>

        {/* User section */}
        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-slate-700 flex items-center justify-center">
              <span className="text-sm font-medium">{user?.name?.charAt(0) || 'U'}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.name}</p>
              <p className="text-xs text-slate-400">{user?.role}</p>
            </div>
            <button 
              onClick={handleLogout}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
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

          <div className="flex-1" />

          {/* Notifications */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button 
                className="relative p-2 text-slate-600 hover:bg-slate-100 rounded-lg mr-2"
                data-testid="notifications-btn"
              >
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-rose-600 text-white text-xs font-bold rounded-full flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <div className="p-3 border-b border-slate-100">
                <p className="font-semibold text-sm">Notifications</p>
              </div>
              <div className="max-h-64 overflow-y-auto">
                {unreadCount === 0 ? (
                  <div className="p-4 text-center text-slate-500 text-sm">
                    No new notifications
                  </div>
                ) : (
                  <div className="p-2">
                    <Link 
                      to="/notifications" 
                      className="block text-center text-sm text-rose-600 hover:text-rose-700 py-2"
                    >
                      View all notifications
                    </Link>
                  </div>
                )}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* User dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 p-2 hover:bg-slate-100 rounded-lg" data-testid="user-menu-btn">
                <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center">
                  <span className="text-sm font-medium text-slate-700">{user?.name?.charAt(0) || 'U'}</span>
                </div>
                <ChevronDown size={16} className="text-slate-400" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <div className="px-3 py-2 border-b border-slate-100">
                <p className="font-medium text-sm">{user?.name}</p>
                <p className="text-xs text-slate-500">{user?.email}</p>
                <p className="text-xs text-rose-600 font-medium mt-1">{user?.role}</p>
              </div>
              <DropdownMenuItem onClick={handleLogout} className="text-red-600">
                <LogOut size={16} className="mr-2" />
                Logout
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
