import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import {
  LayoutDashboard,
  CheckSquare,
  FolderKanban,
  FileText,
  Users,
  UsersRound,
  DollarSign,
  BookOpen,
  Sparkles,
  Settings,
  LogOut,
  Menu,
  X,
  Search,
  Plus,
  Bell,
  BarChart2,
  ChevronRight,
  ChevronDown,
  Cloud,
  ShoppingBag,
  Plug,
  User,
  Contact,
  Gift,
  Building2,
  ArrowLeftRight,
  Eye,
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// ─────────────────────────────────────────────
// Navigation config
// ─────────────────────────────────────────────
const NAV_MAIN = [
  { path: '/',         icon: LayoutDashboard, label: 'Home',     roles: ['Administrator','Operator','Standard User'] },
  { path: '/tasks',    icon: CheckSquare,     label: 'Tasks',    roles: ['Administrator','Operator','Standard User'], badge: true },
  { path: '/projects', icon: FolderKanban,    label: 'Projects', roles: ['Administrator','Operator','Standard User'] },
  { path: '/requests', icon: FileText,        label: 'Requests', roles: ['Administrator','Operator','Standard User'], badge: true },
  { path: '/services', icon: ShoppingBag,     label: 'Services', roles: ['Administrator','Operator','Standard User'] },
];
const NAV_BUSINESS = [
  { path: '/clients',  icon: Users,      label: 'Clients',  roles: ['Administrator','Operator'] },
  { path: '/crm',      icon: Contact,    label: 'Pipeline',  roles: ['Administrator','Operator'] },
  { path: '/team',     icon: UsersRound, label: 'Team',     roles: ['Administrator','Operator'] },
  { path: '/reports',  icon: BarChart2,  label: 'Reports',  roles: ['Administrator','Operator'] },
];
const NAV_SERVICES = [];
const NAV_SYSTEM = [
  { path: '/ai',       icon: Sparkles,  label: 'AI Assistant', roles: ['Administrator','Operator','Standard User'] },
  { path: '/sops',     icon: BookOpen,   label: 'Knowledge Base', roles: ['Administrator','Operator','Standard User'] },
  { href: 'https://ops.redribbongroup.ca', icon: Cloud, label: 'Files', roles: ['Administrator','Operator','Standard User'], external: true },
  { path: '/settings', icon: Settings,  label: 'Settings',     roles: ['Administrator'] },
];

// Client portal nav (shown only to Media Client role)
const NAV_CLIENT = [
  { path: '/',             icon: LayoutDashboard, label: 'Dashboard',      roles: ['Media Client'] },
  { path: '/tasks',        icon: CheckSquare,     label: 'My Tasks',       roles: ['Media Client'] },
  { path: '/projects',     icon: FolderKanban,    label: 'My Projects',    roles: ['Media Client'] },
  { path: '/my-requests',  icon: FileText,        label: 'My Requests',    roles: ['Media Client'] },
  { path: '/services',     icon: ShoppingBag,     label: 'Services',       roles: ['Media Client'] },
  { path: '/sops',         icon: BookOpen,        label: 'Resources',      roles: ['Media Client'] },
  { path: '/my-account',   icon: User,            label: 'My Account',     roles: ['Media Client'] },
];

// Command palette items
const CMD_ITEMS = [
  { label:'Home',            icon:'🏠', to:'/',              group:'Navigate' },
  { label:'Tasks',           icon:'✅', to:'/tasks',         group:'Navigate' },
  { label:'Projects',        icon:'📁', to:'/projects',      group:'Navigate' },
  { label:'Requests',        icon:'📋', to:'/requests',      group:'Navigate' },
  { label:'Services',        icon:'🛍', to:'/services',      group:'Navigate' },
  { label:'Clients',         icon:'👥', to:'/clients',       group:'Navigate' },
  { label:'Pipeline',        icon:'📇', to:'/crm',           group:'Navigate' },
  { label:'Team',            icon:'👫', to:'/team',          group:'Navigate' },
  { label:'Reports',         icon:'📊', to:'/reports',       group:'Navigate' },
  { label:'AI Assistant',    icon:'✨', to:'/ai',            group:'Navigate' },
  { label:'Knowledge Base',  icon:'📚', to:'/sops',          group:'Navigate' },
  { label:'Settings',        icon:'⚙️',  to:'/settings',      group:'Navigate' },
  { label:'New Task',        icon:'✏️',  to:'/tasks?new=1',      group:'Create', shortcut:'T' },
  { label:'New Request',     icon:'📝', to:'/requests?new=1',    group:'Create', shortcut:'R' },
  { label:'New Project',     icon:'🗂',  to:'/projects?new=1',   group:'Create', shortcut:'P' },
  { label:'New Client',      icon:'👤', to:'/clients?new=1',     group:'Create', shortcut:'C' },
];

// ─────────────────────────────────────────────
// Account Switcher (GHL-style sub-account dropdown)
// ─────────────────────────────────────────────
function AccountSwitcher({ user }) {
  const [open, setOpen] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const dropRef = useRef(null);
  const navigate = useNavigate();

  const isAdmin = user?.role === 'Administrator' || user?.role === 'Operator';
  const isPreview = typeof window !== 'undefined' && localStorage.getItem('preview_as_client') === 'true';
  const previewName = typeof window !== 'undefined' && localStorage.getItem('preview_client_name');

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (dropRef.current && !dropRef.current.contains(e.target)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Fetch client accounts when dropdown opens
  useEffect(() => {
    if (!open || accounts.length > 0) return;
    setLoading(true);
    const token = localStorage.getItem('token');
    axios.get(`${API}/users`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => {
        const clients = (r.data || []).filter(u =>
          u.account_type === 'Media Client' || u.role === 'Media Client'
        );
        setAccounts(clients);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open]); // eslint-disable-line

  const handleSwitchToClient = (client) => {
    localStorage.setItem('preview_as_client', 'true');
    localStorage.setItem('preview_client_id', client.id);
    localStorage.setItem('preview_client_name', client.name || client.company_name || client.email);
    setOpen(false);
    navigate('/');
    window.location.reload();
  };

  const handleBackToAdmin = () => {
    localStorage.removeItem('preview_as_client');
    localStorage.removeItem('preview_client_id');
    localStorage.removeItem('preview_client_name');
    setOpen(false);
    navigate('/');
    window.location.reload();
  };

  if (!isAdmin) return null;

  const filtered = search.trim()
    ? accounts.filter(a =>
        (a.name || '').toLowerCase().includes(search.toLowerCase()) ||
        (a.company_name || '').toLowerCase().includes(search.toLowerCase()) ||
        (a.email || '').toLowerCase().includes(search.toLowerCase()))
    : accounts;

  return (
    <div ref={dropRef} style={{ padding: '4px 10px 0', position: 'relative' }}>
      <button onClick={() => setOpen(!open)} style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 8,
        padding: '7px 9px', background: isPreview ? 'rgba(168,85,247,.12)' : 'var(--bg-elevated)',
        border: `1px solid ${isPreview ? 'rgba(168,85,247,.3)' : 'var(--border)'}`,
        borderRadius: 8, cursor: 'pointer', color: 'var(--tx-1)', fontSize: 12, transition: 'all .1s',
      }}>
        <div style={{
          width: 22, height: 22, borderRadius: 5,
          background: isPreview ? '#a855f7' : 'var(--red)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 10, fontWeight: 700, color: '#fff', flexShrink: 0,
        }}>
          {isPreview ? <Eye size={11} /> : <Building2 size={11} />}
        </div>
        <div style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
          <div style={{
            fontSize: 11.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            color: isPreview ? '#a855f7' : 'var(--tx-1)',
          }}>
            {isPreview ? (previewName || 'Client View') : 'Agency View'}
          </div>
          <div style={{ fontSize: 9.5, color: 'var(--tx-3)', marginTop: 0 }}>
            {isPreview ? 'Viewing as client' : 'Red Ribbon Group'}
          </div>
        </div>
        <ChevronDown size={12} color="var(--tx-3)" style={{ flexShrink: 0, transition: 'transform .15s', transform: open ? 'rotate(180deg)' : 'none' }} />
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 10, right: 10, marginTop: 4,
          background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10,
          boxShadow: '0 8px 30px rgba(0,0,0,.35)', zIndex: 999, overflow: 'hidden',
          maxHeight: 400, display: 'flex', flexDirection: 'column',
        }}>
          {/* Header */}
          <div style={{ padding: '10px 12px 6px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>
              Switch Account
            </div>
            <input
              placeholder="Search clients..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              autoFocus
              style={{
                width: '100%', padding: '5px 8px', fontSize: 12, background: 'var(--bg-elevated)',
                border: '1px solid var(--border)', borderRadius: 5, color: 'var(--tx-1)', outline: 'none',
              }}
            />
          </div>

          {/* Agency view option */}
          <div style={{ borderBottom: '1px solid var(--border)' }}>
            <button
              onClick={isPreview ? handleBackToAdmin : () => setOpen(false)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 12px', background: !isPreview ? 'var(--bg-elevated)' : 'transparent',
                border: 'none', cursor: 'pointer', color: 'var(--tx-1)', fontSize: 12, textAlign: 'left',
                transition: 'background .08s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-elevated)'}
              onMouseLeave={e => { if (isPreview) e.currentTarget.style.background = 'transparent'; }}>
              <div style={{
                width: 28, height: 28, borderRadius: 6, background: 'var(--red)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: 11, color: '#fff', flexShrink: 0,
              }}>
                <Building2 size={13} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 600 }}>Agency View</div>
                <div style={{ fontSize: 10, color: 'var(--tx-3)' }}>Red Ribbon Group — Admin</div>
              </div>
              {!isPreview && (
                <span style={{ fontSize: 9, fontWeight: 600, padding: '2px 6px', borderRadius: 4, background: '#22c55e22', color: '#22c55e' }}>ACTIVE</span>
              )}
            </button>
          </div>

          {/* Client accounts */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
            {loading ? (
              <div style={{ padding: '20px 12px', textAlign: 'center', fontSize: 12, color: 'var(--tx-3)' }}>Loading accounts...</div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: '20px 12px', textAlign: 'center', fontSize: 12, color: 'var(--tx-3)' }}>
                {accounts.length === 0 ? 'No client accounts yet' : 'No clients match your search'}
              </div>
            ) : (
              filtered.map(client => {
                const isViewing = isPreview && localStorage.getItem('preview_client_id') === client.id;
                const initials = (client.name || client.email || '??').split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
                return (
                  <button key={client.id}
                    onClick={() => handleSwitchToClient(client)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                      padding: '7px 12px', background: isViewing ? 'rgba(168,85,247,.08)' : 'transparent',
                      border: 'none', cursor: 'pointer', color: 'var(--tx-1)', fontSize: 12, textAlign: 'left',
                      transition: 'background .08s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = isViewing ? 'rgba(168,85,247,.12)' : 'var(--bg-elevated)'}
                    onMouseLeave={e => e.currentTarget.style.background = isViewing ? 'rgba(168,85,247,.08)' : 'transparent'}>
                    <div style={{
                      width: 28, height: 28, borderRadius: 6,
                      background: isViewing ? '#a855f7' : 'var(--bg-elevated)',
                      border: `1px solid ${isViewing ? '#a855f7' : 'var(--border)'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 700, fontSize: 10, color: isViewing ? '#fff' : 'var(--tx-2)', flexShrink: 0,
                    }}>
                      {initials}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        color: isViewing ? '#a855f7' : 'var(--tx-1)',
                      }}>
                        {client.company_name || client.name || client.email}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--tx-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {client.company_name ? (client.name || client.email) : (client.subscription_plan_name || 'Media Client')}
                      </div>
                    </div>
                    {isViewing && (
                      <span style={{ fontSize: 9, fontWeight: 600, padding: '2px 6px', borderRadius: 4, background: '#a855f722', color: '#a855f7' }}>VIEWING</span>
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div style={{ padding: '8px 12px', borderTop: '1px solid var(--border)', display: 'flex', gap: 6 }}>
            <button onClick={() => { setOpen(false); navigate('/clients?new=1'); }}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                padding: '6px 8px', background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 600, color: 'var(--tx-2)',
              }}>
              <Plus size={11} /> New Client
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Single nav item
// ─────────────────────────────────────────────
function NavItem({ item, location, onClick, badgeCount }) {
  if (item.external) {
    return (
      <a href={item.href} target="_blank" rel="noopener noreferrer"
        className="nav-item" onClick={onClick}>
        <item.icon size={15} />
        <span>{item.label}</span>
      </a>
    );
  }
  const isActive = item.path === '/'
    ? location.pathname === '/'
    : location.pathname.startsWith(item.path);

  return (
    <Link to={item.path} className={`nav-item${isActive ? ' active' : ''}`} onClick={onClick}>
      <item.icon size={15} />
      <span style={{ flex: 1 }}>{item.label}</span>
      {item.isNew && (
        <span style={{ fontSize:9, fontWeight:700, background:'#a855f718', color:'#a855f7', padding:'1px 5px', borderRadius:4, letterSpacing:'.05em' }}>
          NEW
        </span>
      )}
      {item.badge && badgeCount > 0 && (
        <span className="nav-badge">{badgeCount > 99 ? '99+' : badgeCount}</span>
      )}
    </Link>
  );
}

// ─────────────────────────────────────────────
// Main Layout
// ─────────────────────────────────────────────
export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const location  = useLocation();
  const navigate  = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [cmdOpen,     setCmdOpen]     = useState(false);
  const [cmdQuery,    setCmdQuery]    = useState('');
  const [cmdIdx,      setCmdIdx]      = useState(0);
  const [unread,      setUnread]      = useState(0);
  const [badges,      setBadges]      = useState({ tasks: 0, requests: 0 });
  const cmdInputRef = useRef(null);

  // Filter items by role
  const filter = (items) => items.filter(i => !i.roles || i.roles.includes(user?.role));
  const isClient    = user?.role === 'Media Client' || user?.account_type === 'Media Client';
  const mainItems     = isClient ? filter(NAV_CLIENT) : filter(NAV_MAIN);
  const businessItems = isClient ? [] : filter(NAV_BUSINESS);
  const servicesItems = isClient ? [] : filter(NAV_SERVICES);
  const systemItems   = isClient ? [] : filter(NAV_SYSTEM);

  // Page title for breadcrumb
  const allNavItems = isClient ? NAV_CLIENT : [...NAV_MAIN, ...NAV_BUSINESS, ...NAV_SERVICES, ...NAV_SYSTEM];
  const pageTitle = allNavItems
    .find(i => i.path && (i.path === '/' ? location.pathname === '/' : location.pathname.startsWith(i.path)))?.label || '';

  // ── Command palette ──
  const openCmd = useCallback(() => {
    setCmdQuery(''); setCmdIdx(0); setCmdOpen(true);
    setTimeout(() => cmdInputRef.current?.focus(), 40);
  }, []);
  const closeCmd = useCallback(() => setCmdOpen(false), []);

  // Client users only see client-relevant command palette items
  const clientPaths = ['/', '/tasks', '/projects', '/services', '/my-requests', '/my-account', '/sops'];
  const cmdBase = isClient ? CMD_ITEMS.filter(i => clientPaths.includes(i.to) || i.to?.startsWith('/my-')) : CMD_ITEMS;
  const filtered = cmdQuery.trim()
    ? cmdBase.filter(i => i.label.toLowerCase().includes(cmdQuery.toLowerCase()))
    : cmdBase;

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); cmdOpen ? closeCmd() : openCmd(); return; }
      if (e.key === 'Escape') { closeCmd(); setSidebarOpen(false); return; }
      if (!cmdOpen) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); setCmdIdx(i => Math.min(i+1, filtered.length-1)); }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setCmdIdx(i => Math.max(i-1, 0)); }
      if (e.key === 'Enter' && filtered[cmdIdx]) { e.preventDefault(); execCmd(filtered[cmdIdx]); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cmdOpen, cmdIdx, filtered, openCmd, closeCmd]); // eslint-disable-line

  const execCmd = (item) => { closeCmd(); navigate(item.to); };

  // ── Fetch unread notifications ──
  useEffect(() => {
    let dead = false;
    const fetch_ = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;
        const r = await fetch(`${API}/notifications?unread_only=true&limit=1`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!r.ok || dead) return;
        const d = await r.json();
        setUnread(d.total_unread ?? 0);
      } catch {}
    };
    fetch_();
    const iv = setInterval(fetch_, 60000);
    return () => { dead = true; clearInterval(iv); };
  }, []);

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div className="app-shell">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 z-40 lg:hidden animate-fade-in"
          onClick={() => setSidebarOpen(false)} />
      )}

      {/* ══ SIDEBAR ══ */}
      <aside className={`app-sidebar fixed lg:static transition-transform duration-200 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}>

        {/* Logo */}
        <div style={{ padding:'12px 14px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
          <div style={{ width:28, height:28, background:'var(--red)', borderRadius:7, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:900, fontSize:13, color:'white', flexShrink:0, letterSpacing:'-.02em' }}>
            R
          </div>
          <div>
            <div style={{ fontSize:13, fontWeight:800, letterSpacing:'-0.03em', color:'var(--tx-1)' }}>RED OPS</div>
            <div style={{ fontSize:9, color:'var(--tx-3)', letterSpacing:'0.09em', textTransform:'uppercase', marginTop:1 }}>Red Ribbon Group</div>
          </div>
          <button className="ml-auto lg:hidden" onClick={() => setSidebarOpen(false)}
            style={{ color:'var(--tx-3)', background:'none', border:'none', cursor:'pointer', padding:2 }}>
            <X size={16} />
          </button>
        </div>

        {/* Account Switcher — GHL-style sub-account dropdown */}
        <AccountSwitcher user={user} />

        {/* Search trigger */}
        <div style={{ padding:'8px 10px 4px' }}>
          <button onClick={openCmd} style={{
            width:'100%', display:'flex', alignItems:'center', gap:7, padding:'6px 9px',
            background:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:7,
            cursor:'pointer', color:'var(--tx-3)', fontSize:12,
          }}>
            <Search size={12} style={{ flexShrink:0 }} />
            <span style={{ flex:1, textAlign:'left' }}>Search...</span>
            <kbd>⌘K</kbd>
          </button>
        </div>

        {/* Nav items */}
        <nav style={{ flex:1, overflowY:'auto', padding:'2px 8px 8px' }}>
          {mainItems.length > 0 && (
            <>
              <div className="nav-section-label" style={{ marginTop:10 }}>{isClient ? 'Portal' : 'Workspace'}</div>
              {mainItems.map(i => <NavItem key={i.path} item={i} location={location} onClick={() => setSidebarOpen(false)} badgeCount={badges[i.path === '/tasks' ? 'tasks' : 'requests']} />)}
            </>
          )}
          {businessItems.length > 0 && (
            <>
              <div className="nav-section-label">Business</div>
              {businessItems.map(i => <NavItem key={i.path} item={i} location={location} onClick={() => setSidebarOpen(false)} />)}
            </>
          )}
          {servicesItems.length > 0 && (
            <>
              <div className="nav-section-label">More</div>
              {servicesItems.map(i => <NavItem key={i.path} item={i} location={location} onClick={() => setSidebarOpen(false)} />)}
            </>
          )}
          {systemItems.length > 0 && (
            <>
              <div className="nav-section-label">Tools</div>
              {systemItems.map(i => <NavItem key={i.path || i.href} item={i} location={location} onClick={() => setSidebarOpen(false)} />)}
            </>
          )}
        </nav>

        {/* User */}
        <div style={{ padding:'8px', borderTop:'1px solid var(--border)', flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 8px', borderRadius:7, cursor:'pointer' }}
            onClick={() => navigate(isClient ? '/my-account' : '/profile')}
            onMouseEnter={e => e.currentTarget.style.background='var(--bg-elevated)'}
            onMouseLeave={e => e.currentTarget.style.background='transparent'}>
            <div style={{ width:26, height:26, background:'var(--red)', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:11, color:'white', flexShrink:0 }}>
              {user?.name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:12.5, fontWeight:600, color:'var(--tx-1)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{user?.name || 'User'}</div>
              <div style={{ fontSize:10.5, color:'var(--tx-3)', marginTop:1 }}>{user?.role || ''}</div>
            </div>
            <button onClick={e => { e.stopPropagation(); handleLogout(); }} title="Sign out"
              style={{ background:'none', border:'none', cursor:'pointer', color:'var(--tx-3)', display:'flex', alignItems:'center', padding:4, borderRadius:5, flexShrink:0 }}
              onMouseEnter={e => { e.currentTarget.style.color='#ef4444'; e.currentTarget.style.background='rgba(239,68,68,.12)'; }}
              onMouseLeave={e => { e.currentTarget.style.color='var(--tx-3)'; e.currentTarget.style.background='none'; }}>
              <LogOut size={13} />
            </button>
          </div>
        </div>
      </aside>

      {/* ══ MAIN ══ */}
      <div className="app-main">

        {/* Preview banner */}
        {typeof window !== 'undefined' && localStorage.getItem('preview_as_client') === 'true' && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '5px 16px', background: 'rgba(168,85,247,.12)', borderBottom: '1px solid rgba(168,85,247,.2)',
            fontSize: 11, fontWeight: 600, color: '#a855f7', flexShrink: 0,
          }}>
            <Eye size={12} />
            <span>Viewing as {localStorage.getItem('preview_client_name') || 'client'}</span>
            <button onClick={() => {
              localStorage.removeItem('preview_as_client');
              localStorage.removeItem('preview_client_id');
              localStorage.removeItem('preview_client_name');
              navigate('/');
              window.location.reload();
            }} style={{
              background: 'rgba(168,85,247,.18)', border: '1px solid rgba(168,85,247,.3)',
              borderRadius: 4, padding: '2px 8px', cursor: 'pointer',
              fontSize: 10, fontWeight: 600, color: '#a855f7', marginLeft: 4,
            }}>
              Exit Preview
            </button>
          </div>
        )}

        {/* Top bar */}
        <div className="top-bar">
          <button className="lg:hidden" onClick={() => setSidebarOpen(true)}
            style={{ background:'none', border:'none', cursor:'pointer', color:'var(--tx-2)', display:'flex', padding:0 }}>
            <Menu size={18} />
          </button>

          <div style={{ display:'flex', alignItems:'center', gap:5, fontSize:12.5 }}>
            <span style={{ color:'var(--tx-3)' }}>Red Ops</span>
            {pageTitle && <>
              <ChevronRight size={11} style={{ color:'var(--tx-3)' }} />
              <span style={{ color:'var(--tx-1)', fontWeight:600 }}>{pageTitle}</span>
            </>}
          </div>

          <div style={{ flex:1 }} />

          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <button onClick={openCmd}
              style={{ display:'flex', alignItems:'center', gap:6, background:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:7, padding:'5px 11px', cursor:'pointer', color:'var(--tx-3)', fontSize:12 }}>
              <Search size={12} />
              <span>Search</span>
              <kbd>⌘K</kbd>
            </button>

            <div style={{ position:'relative' }}>
              <Link to="/notifications"
                style={{ width:32, height:32, background:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:7, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--tx-2)' }}>
                <Bell size={14} />
              </Link>
              {unread > 0 && <div className="notif-dot" />}
            </div>

            <button onClick={() => navigate(isClient ? '/services' : '/requests?new=1')} className="btn-primary btn-sm" style={{ gap:5 }}>
              <Plus size={13} />
              New Request
            </button>
          </div>
        </div>

        {/* Page content — flex:1 with proper scroll/fill handling */}
        <div style={{ flex:1, minHeight:0, display:'flex', flexDirection:'column', overflow:'hidden' }}>
          {children}
        </div>
      </div>

      {/* ══ COMMAND PALETTE ══ */}
      {cmdOpen && (
        <div className="cmd-overlay" onClick={closeCmd}>
          <div className="cmd-box" onClick={e => e.stopPropagation()}>
            <div className="cmd-input-row">
              <Search size={15} style={{ color:'var(--tx-3)', flexShrink:0 }} />
              <input ref={cmdInputRef} placeholder="Go to, search, or create..."
                value={cmdQuery}
                onChange={e => { setCmdQuery(e.target.value); setCmdIdx(0); }} />
              <kbd onClick={closeCmd} style={{ cursor:'pointer' }}>Esc</kbd>
            </div>
            <div className="cmd-results">
              {filtered.length === 0 ? (
                <div style={{ padding:'20px', textAlign:'center', color:'var(--tx-3)', fontSize:13 }}>No results for "{cmdQuery}"</div>
              ) : (
                <>
                  <div className="cmd-group">Navigate & Create</div>
                  {filtered.map((item, i) => (
                    <div key={item.label}
                      className={`cmd-item${i === cmdIdx ? ' highlighted' : ''}`}
                      onClick={() => execCmd(item)}
                      onMouseEnter={() => setCmdIdx(i)}>
                      <div className="cmd-icon">{item.icon}</div>
                      <span>{item.label}</span>
                      {item.shortcut && <span className="cmd-shortcut">{item.shortcut}</span>}
                    </div>
                  ))}
                </>
              )}
            </div>
            <div style={{ padding:'8px 16px', borderTop:'1px solid var(--border)', display:'flex', gap:16, fontSize:11, color:'var(--tx-3)' }}>
              <span><kbd>↑↓</kbd> navigate</span>
              <span><kbd>↵</kbd> select</span>
              <span><kbd>Esc</kbd> close</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
