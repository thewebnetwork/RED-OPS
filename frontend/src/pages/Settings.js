import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';
import axios from 'axios';
import {
  User,
  Settings as SettingsIcon,
  Users,
  Bell,
  CreditCard,
  Plug,
  Shield,
  Palette,
  Save,
  Plus,
  X,
  Check,
  Download,
  LogOut,
  ChevronRight,
  Trash2,
  Loader2,
} from 'lucide-react';
import { usePushNotifications } from '../hooks/usePushNotifications';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const tok = () => localStorage.getItem('token');
const axh = () => axios.create({ headers: { Authorization: `Bearer ${tok()}` } });

function PushNotificationCard() {
  const { isSupported, permission, isSubscribed, loading, subscribe, unsubscribe } = usePushNotifications();

  if (!isSupported) {
    return (
      <div className="card" style={{ padding: '20px', marginTop: '16px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--tx-1)', marginBottom: '8px' }}>Push Notifications</h3>
        <p style={{ fontSize: '12px', color: 'var(--tx-3)' }}>Push notifications are not supported in this browser. Try Chrome or Safari on desktop, or add RED OPS to your home screen on mobile.</p>
      </div>
    );
  }

  if (permission === 'denied') {
    return (
      <div className="card" style={{ padding: '20px', marginTop: '16px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--tx-1)', marginBottom: '8px' }}>Push Notifications</h3>
        <p style={{ fontSize: '12px', color: 'var(--tx-3)' }}>Push notifications are blocked. To enable them, click the lock icon in your browser address bar and allow notifications for this site.</p>
      </div>
    );
  }

  const handleToggle = async () => {
    if (isSubscribed) {
      await unsubscribe();
    } else {
      const ok = await subscribe();
      if (ok) {
        toast.success('Push notifications enabled');
      }
    }
  };

  return (
    <div className="card" style={{ padding: '20px', marginTop: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--tx-1)', marginBottom: '2px' }}>Push Notifications</div>
          <div style={{ fontSize: '12px', color: 'var(--tx-3)' }}>
            {isSubscribed
              ? 'You will receive push notifications on this device.'
              : 'Get real-time alerts even when RED OPS is closed.'}
          </div>
        </div>
        <div
          onClick={loading ? undefined : handleToggle}
          style={{
            position: 'relative', width: '36px', height: '20px', flexShrink: 0,
            cursor: loading ? 'wait' : 'pointer', marginLeft: '16px', opacity: loading ? 0.5 : 1,
          }}
        >
          <div style={{
            position: 'absolute', inset: 0, borderRadius: '10px',
            backgroundColor: isSubscribed ? 'var(--accent)' : 'var(--bg-overlay)',
            transition: 'background 0.2s',
          }} />
          <div style={{
            position: 'absolute', top: '2px',
            left: isSubscribed ? '18px' : '2px',
            width: '16px', height: '16px', borderRadius: '50%',
            backgroundColor: 'var(--tx-1)', transition: 'left 0.2s',
          }} />
        </div>
      </div>

      {isSubscribed && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
          <button
            onClick={async () => {
              try {
                const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
                const token = localStorage.getItem('token');
                const res = await fetch(`${API}/push/test`, {
                  method: 'POST',
                  headers: { Authorization: `Bearer ${token}` },
                });
                if (!res.ok) throw new Error('failed');
                toast.success('Test sent — check your lock screen.');
              } catch {
                toast.error('Test failed. Check browser notification settings.');
              }
            }}
            style={{
              padding: '7px 12px', fontSize: 12, fontWeight: 600, borderRadius: 8,
              border: '1px solid var(--border)', background: 'var(--bg-elevated)',
              color: 'var(--tx-2)', cursor: 'pointer',
            }}
          >
            Send test notification
          </button>
        </div>
      )}
    </div>
  );
}

export default function Settings() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'Administrator' || user?.role === 'Admin';
  const isOperator = user?.role === 'Operator';
  const fileInputRef = useRef(null);

  const [activeSection, setActiveSection] = useState('profile');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Profile state
  const [profile, setProfile] = useState({ firstName: '', lastName: '', email: '', role: '', phone: '', bio: '' });

  // Account state
  const [account, setAccount] = useState({ timezone: 'America/Toronto', language: 'English', dateFormat: 'MM/DD/YYYY' });

  // Notifications state
  const [notifications, setNotifications] = useState({
    emailNotifications: true, requestUpdates: true, taskAssignments: true,
    clientMessages: true, weeklyDigest: false, systemAlerts: true, marketingUpdates: false,
  });

  // Appearance state
  const [appearance, setAppearance] = useState({
    theme: 'dark', accentColor: 'red', compactMode: false, sidebarPosition: 'left', fontSize: 'normal',
  });

  // Security state
  const [security, setSecurity] = useState({ currentPassword: '', newPassword: '', confirmPassword: '', twoFactorEnabled: false });

  // Modal state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteForm, setInviteForm] = useState({ name: '', email: '', password: '', role: 'Standard User', account_type: 'Internal Staff' });

  // Real data from API
  const [teamMembers, setTeamMembers] = useState([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const [integrations, setIntegrations] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [memberCount, setMemberCount] = useState(0);

  // ── Fetch profile from /auth/me ──
  const fetchProfile = useCallback(async () => {
    try {
      const res = await axh().get(`${API}/auth/me`);
      const u = res.data;
      const nameParts = (u.name || '').split(' ');
      setProfile({
        firstName: nameParts[0] || '',
        lastName: nameParts.slice(1).join(' ') || '',
        email: u.email || '',
        role: u.role || '',
        phone: u.phone || '',
        bio: u.bio || '',
      });
      setSecurity(prev => ({ ...prev, twoFactorEnabled: u.otp_verified || false }));
    } catch { /* first load */ }
  }, []);

  // ── Fetch team members from /users ──
  const fetchTeamMembers = useCallback(async () => {
    setTeamLoading(true);
    try {
      const res = await axh().get(`${API}/users`);
      const users = Array.isArray(res.data) ? res.data : (res.data?.users || []);
      setTeamMembers(users);
      setMemberCount(users.length);
    } catch { /* silently fail for non-admins */ }
    setTeamLoading(false);
  }, []);

  // ── Fetch integrations from /integrations ──
  const fetchIntegrations = useCallback(async () => {
    try {
      const res = await axh().get(`${API}/integrations`);
      setIntegrations(res.data || []);
    } catch { /* silently */ }
  }, []);

  // ── Fetch sessions from /auth/sessions ──
  const fetchSessions = useCallback(async () => {
    setSessionsLoading(true);
    try {
      const res = await axh().get(`${API}/auth/sessions`);
      setSessions(res.data || []);
    } catch { /* endpoint may not exist yet */ }
    setSessionsLoading(false);
  }, []);

  // ── Fetch & save preferences ──
  const fetchPrefs = useCallback(async () => {
    try {
      const res = await axh().get(`${API}/users/me/preferences`);
      const p = res.data?.preferences || {};
      if (p.notifications) setNotifications(prev => ({ ...prev, ...p.notifications }));
      if (p.appearance) setAppearance(prev => ({ ...prev, ...p.appearance }));
      if (p.locale) setAccount(prev => ({ ...prev, ...p.locale }));
    } catch { /* first load, no prefs yet */ }
  }, []);

  useEffect(() => { fetchProfile(); fetchPrefs(); }, [fetchProfile, fetchPrefs]);
  useEffect(() => { if (activeSection === 'team') fetchTeamMembers(); }, [activeSection, fetchTeamMembers]);
  useEffect(() => { if (activeSection === 'integrations') fetchIntegrations(); }, [activeSection, fetchIntegrations]);
  useEffect(() => { if (activeSection === 'security') fetchSessions(); }, [activeSection, fetchSessions]);

  const savePrefs = async (section, data) => {
    try { await axh().patch(`${API}/users/me/preferences`, { [section]: data }); } catch { /* silently fail */ }
  };

  const handleToggleNotification = (key) => {
    const updated = { ...notifications, [key]: !notifications[key] };
    setNotifications(updated);
    savePrefs('notifications', updated);
  };

  const handleAccentColorChange = (color) => {
    const updated = { ...appearance, accentColor: color };
    setAppearance(updated);
    savePrefs('appearance', updated);
  };

  const getInitials = (name) => (name || '?').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const getAvatarColor = (name) => {
    const colors = ['var(--red)', '#8b5cf6', '#06b6d4', '#ec4899', '#10b981', '#f59e0b', '#6366f1', '#14b8a6'];
    let hash = 0;
    for (let i = 0; i < (name || '').length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  };

  const accentColors = [
    { name: 'red', hex: 'var(--red)' }, { name: 'blue', hex: 'var(--blue)' },
    { name: 'green', hex: 'var(--green)' }, { name: 'purple', hex: '#8b5cf6' },
    { name: 'orange', hex: 'var(--yellow)' }, { name: 'pink', hex: '#ec4899' },
  ];

  // Handler functions
  const handleChangeAvatar = () => fileInputRef.current?.click();

  const handleAvatarFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('File size must be less than 5MB'); return; }
    if (!['image/jpeg', 'image/png', 'image/gif'].includes(file.type)) { toast.error('Only JPG, PNG, and GIF images are supported'); return; }
    try {
      const formData = new FormData();
      formData.append('avatar', file);
      const response = await fetch(`${API}/users/me/avatar`, { method: 'POST', headers: { Authorization: `Bearer ${tok()}` }, body: formData });
      if (!response.ok) throw new Error('Failed to upload avatar');
      toast.success('Avatar updated successfully');
    } catch (error) { toast.error(error.message || 'Failed to upload avatar'); }
  };

  const handleSaveProfile = async () => {
    if (!profile.firstName.trim()) { toast.error('First name is required'); return; }
    if (!profile.lastName.trim()) { toast.error('Last name is required'); return; }
    try {
      await axh().patch(`${API}/auth/profile`, {
        name: `${profile.firstName} ${profile.lastName}`.trim(),
        phone: profile.phone || null,
        bio: profile.bio || null,
      });
      toast.success('Profile updated successfully');
    } catch (error) { toast.error(error.response?.data?.detail || 'Failed to save profile'); }
  };

  const handleDeleteAccount = () => setShowDeleteConfirm(true);

  const confirmDeleteAccount = async () => {
    try {
      await axh().delete(`${API}/users/me`);
      localStorage.removeItem('token');
      toast.success('Account deleted successfully');
      navigate('/login');
    } catch (error) { toast.error(error.response?.data?.detail || 'Failed to delete account'); }
    setShowDeleteConfirm(false);
  };

  const handleRemoveTeamMember = async (memberId) => {
    if (!window.confirm('Are you sure you want to deactivate this user?')) return;
    try {
      await axh().patch(`${API}/users/${memberId}`, { active: false });
      toast.success('Team member deactivated');
      fetchTeamMembers();
    } catch (error) { toast.error(error.response?.data?.detail || 'Failed to remove team member'); }
  };

  const handleConfigureIntegration = () => navigate('/integrations');

  const handleUpdatePassword = async () => {
    if (!security.currentPassword) { toast.error('Current password is required'); return; }
    if (!security.newPassword) { toast.error('New password is required'); return; }
    if (security.newPassword.length < 8) { toast.error('New password must be at least 8 characters'); return; }
    if (security.newPassword !== security.confirmPassword) { toast.error('Passwords do not match'); return; }
    if (security.currentPassword === security.newPassword) { toast.error('New password must be different'); return; }
    try {
      await axh().post(`${API}/auth/change-password`, {
        current_password: security.currentPassword,
        new_password: security.newPassword,
      });
      toast.success('Password updated successfully');
      setSecurity(prev => ({ ...prev, currentPassword: '', newPassword: '', confirmPassword: '' }));
    } catch (error) { toast.error(error.response?.data?.detail || 'Failed to update password'); }
  };

  const handleSignOutSession = async (sessionId) => {
    try {
      await axh().delete(`${API}/auth/sessions/${sessionId}`);
      toast.success('Session signed out');
      fetchSessions();
    } catch (error) { toast.error(error.response?.data?.detail || 'Failed to sign out session'); }
  };

  const handleSignOutAllDevices = async () => {
    try {
      await axh().delete(`${API}/auth/sessions`);
      localStorage.removeItem('token');
      toast.success('Signed out from all devices');
      navigate('/login');
    } catch (error) { toast.error(error.response?.data?.detail || 'Failed to sign out'); }
  };

  const handleSendInvite = async () => {
    if (!inviteForm.email) { toast.error('Email address is required'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteForm.email)) { toast.error('Please enter a valid email'); return; }
    if (!inviteForm.name) { toast.error('Name is required'); return; }
    try {
      await axh().post(`${API}/users`, {
        name: inviteForm.name,
        email: inviteForm.email,
        password: inviteForm.password || 'TempPass123!',
        role: inviteForm.role,
        account_type: inviteForm.account_type,
        force_password_change: true,
      });
      toast.success('Team member created — they will be prompted to change password on first login');
      setInviteForm({ name: '', email: '', password: '', role: 'Standard User', account_type: 'Internal Staff' });
      setShowInviteModal(false);
      fetchTeamMembers();
    } catch (error) { toast.error(error.response?.data?.detail || 'Failed to create user'); }
  };

  const formatTimeAgo = (dateStr) => {
    if (!dateStr) return '—';
    const diff = Date.now() - new Date(dateStr).getTime();
    if (diff < 60000) return 'Now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  };

  // Integration display config (for the settings summary view)
  const integrationMeta = {
    openai: { name: 'OpenAI', icon: '🤖' },
    slack_webhook: { name: 'Slack Webhook', icon: '💬' },
    stripe: { name: 'Stripe', icon: '💳' },
    ghl: { name: 'GoHighLevel', icon: '🚀' },
    nextcloud: { name: 'Nextcloud', icon: '☁️' },
    zapier: { name: 'Zapier', icon: '⚡' },
  };
  const connectedCount = integrations.filter(i => i.status === 'connected').length;

  return (
    <div className="page-content">
      <div className="settings-layout">
        {/* Left Sidebar */}
        <div className="settings-sidebar">
          {[
            // Personal — everyone gets these
            { id: 'profile',       label: 'Profile',          icon: User,         allow: 'all' },
            { id: 'notifications', label: 'Notifications',    icon: Bell,         allow: 'all' },
            { id: 'appearance',    label: 'Display & Language', icon: Palette,    allow: 'all' },
            // Operator workspace
            { id: 'security',      label: 'Sessions',         icon: Shield,       allow: 'admin_or_operator' },
            // Admin-only — org config + management
            { id: 'account',       label: 'Account',          icon: SettingsIcon, allow: 'admin' },
            { id: 'team',          label: 'Team & Roles',     icon: Users,        allow: 'admin' },
            { id: 'integrations',  label: 'Integrations',     icon: Plug,         allow: 'admin', badge: connectedCount > 0 ? `${connectedCount} connected` : null },
            { id: 'billing',       label: 'Billing',          icon: CreditCard,   allow: 'admin' },
          ].filter(item => {
            if (item.allow === 'all') return true;
            if (item.allow === 'admin') return isAdmin;
            if (item.allow === 'admin_or_operator') return isAdmin || isOperator;
            return false;
          }).map(item => {
            const IconComp = item.icon;
            return (
              <div
                key={item.id}
                className={`settings-nav-item ${activeSection === item.id ? 'active' : ''}`}
                onClick={() => setActiveSection(item.id)}
                style={{
                  backgroundColor: activeSection === item.id ? 'var(--bg-elevated)' : 'transparent',
                  color: activeSection === item.id ? 'var(--accent)' : 'var(--tx-2)',
                }}
              >
                <IconComp size={16} />
                <span>{item.label}</span>
                {item.badge && (
                  <span className="pill pill-green" style={{ marginLeft: 'auto', fontSize: '10px', padding: '2px 6px' }}>
                    {item.badge}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Right Content Area */}
        <div className="settings-content">
          {/* PROFILE SECTION */}
          <div className={`settings-section ${activeSection === 'profile' ? 'active' : ''}`}>
            <div style={{ marginBottom: '28px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '20px', color: 'var(--tx-1)' }}>Profile</h2>

              {/* Avatar Section */}
              <div className="card" style={{ padding: '20px', marginBottom: '20px', textAlign: 'center' }}>
                <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: '700', color: '#fff', margin: '0 auto 12px' }}>
                  {getInitials(`${profile.firstName} ${profile.lastName}`)}
                </div>
                <button className="btn-sm" style={{ marginBottom: '16px' }} onClick={handleChangeAvatar}>Change Avatar</button>
                <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/gif" onChange={handleAvatarFileSelect} style={{ display: 'none' }} />
              </div>

              {/* Form Fields */}
              <div className="card" style={{ padding: '20px' }}>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--tx-2)', display: 'block', marginBottom: '6px' }}>First Name</label>
                  <input className="input-field" type="text" value={profile.firstName} onChange={e => setProfile({ ...profile, firstName: e.target.value })} />
                </div>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--tx-2)', display: 'block', marginBottom: '6px' }}>Last Name</label>
                  <input className="input-field" type="text" value={profile.lastName} onChange={e => setProfile({ ...profile, lastName: e.target.value })} />
                </div>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--tx-2)', display: 'block', marginBottom: '6px' }}>Email (Read-only)</label>
                  <input className="input-field" type="email" value={profile.email} disabled style={{ opacity: 0.6 }} />
                </div>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--tx-2)', display: 'block', marginBottom: '6px' }}>Role (Read-only)</label>
                  <div className="pill" style={{ display: 'inline-block', backgroundColor: 'var(--accent)', padding: '4px 10px', borderRadius: '4px', color: '#fff', fontSize: '12px' }}>{profile.role}</div>
                </div>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--tx-2)', display: 'block', marginBottom: '6px' }}>Phone</label>
                  <input className="input-field" type="tel" value={profile.phone} onChange={e => setProfile({ ...profile, phone: e.target.value })} />
                </div>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--tx-2)', display: 'block', marginBottom: '6px' }}>Bio</label>
                  <textarea className="input-field" value={profile.bio} onChange={e => setProfile({ ...profile, bio: e.target.value })} style={{ minHeight: '100px', fontFamily: 'inherit' }} />
                </div>
                <button className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }} onClick={handleSaveProfile}>
                  <Save size={16} /> Save Changes
                </button>
              </div>
            </div>
          </div>

          {/* ACCOUNT SECTION */}
          <div className={`settings-section ${activeSection === 'account' ? 'active' : ''}`}>
            <h2 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '20px', color: 'var(--tx-1)' }}>Account Settings</h2>
            <div className="card" style={{ padding: '20px', marginBottom: '20px' }}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--tx-2)', display: 'block', marginBottom: '6px' }}>Timezone</label>
                <select className="input-field" value={account.timezone} onChange={e => { const u = { ...account, timezone: e.target.value }; setAccount(u); savePrefs('locale', u); }}>
                  <option>America/Toronto</option><option>America/Vancouver</option><option>America/New_York</option><option>America/Los_Angeles</option><option>Europe/London</option>
                </select>
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--tx-2)', display: 'block', marginBottom: '6px' }}>Language</label>
                <select className="input-field" value={account.language} onChange={e => { const u = { ...account, language: e.target.value }; setAccount(u); savePrefs('locale', u); }}>
                  <option>English</option><option>French</option><option>Spanish</option>
                </select>
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--tx-2)', display: 'block', marginBottom: '6px' }}>Date Format</label>
                <select className="input-field" value={account.dateFormat} onChange={e => { const u = { ...account, dateFormat: e.target.value }; setAccount(u); savePrefs('locale', u); }}>
                  <option>MM/DD/YYYY</option><option>DD/MM/YYYY</option><option>YYYY-MM-DD</option>
                </select>
              </div>
            </div>
            {/* Danger Zone */}
            <div className="card" style={{ padding: '20px', border: '1px solid var(--red)', backgroundColor: 'rgba(201, 42, 62, 0.05)' }}>
              <h3 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--red)', marginBottom: '12px' }}>Danger Zone</h3>
              <p style={{ fontSize: '12px', color: 'var(--tx-2)', marginBottom: '12px' }}>Deleting your account is permanent and cannot be undone.</p>
              <button className="btn-ghost" style={{ color: 'var(--red)', borderColor: 'var(--red)', display: 'flex', alignItems: 'center', gap: '6px' }} onClick={handleDeleteAccount}>
                <Trash2 size={16} /> Delete Account
              </button>
            </div>
          </div>

          {/* TEAM & ROLES SECTION */}
          <div className={`settings-section ${activeSection === 'team' ? 'active' : ''}`}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--tx-1)' }}>Team & Roles</h2>
              <button className="btn-primary" onClick={() => setShowInviteModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Plus size={16} /> Add Member
              </button>
            </div>

            {teamLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
                <Loader2 size={20} className="spin" style={{ color: 'var(--tx-3)' }} />
              </div>
            ) : (
              <div className="card" style={{ overflow: 'hidden' }}>
                <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: 'var(--tx-2)' }}>Name</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: 'var(--tx-2)' }}>Role</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: 'var(--tx-2)' }}>Email</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: 'var(--tx-2)' }}>Status</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: 'var(--tx-2)' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teamMembers.map((member, idx) => (
                      <tr key={member.id} style={{ borderBottom: idx < teamMembers.length - 1 ? '1px solid var(--border)' : 'none' }}>
                        <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--tx-1)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: getAvatarColor(member.name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '700', color: '#fff', flexShrink: 0 }}>
                              {getInitials(member.name)}
                            </div>
                            {member.name}
                          </div>
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--tx-1)' }}>{member.role}</td>
                        <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--tx-2)' }}>{member.email}</td>
                        <td style={{ padding: '12px 16px', fontSize: '13px' }}>
                          <span className={`pill ${member.active !== false ? 'pill-green' : 'pill-red'}`} style={{ padding: '3px 8px', fontSize: '11px' }}>
                            {member.active !== false ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: '13px' }}>
                          <button className="btn-ghost" style={{ padding: '4px 8px', fontSize: '12px' }} onClick={() => handleRemoveTeamMember(member.id)}>
                            Deactivate
                          </button>
                        </td>
                      </tr>
                    ))}
                    {teamMembers.length === 0 && (
                      <tr><td colSpan={5} style={{ padding: '24px 16px', textAlign: 'center', fontSize: '13px', color: 'var(--tx-3)' }}>No team members found</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* NOTIFICATIONS SECTION */}
          <div className={`settings-section ${activeSection === 'notifications' ? 'active' : ''}`}>
            <h2 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '20px', color: 'var(--tx-1)' }}>Notification Preferences</h2>
            <div className="card" style={{ padding: '20px' }}>
              {[
                { key: 'emailNotifications', label: 'Email Notifications', desc: 'Receive important updates via email' },
                { key: 'requestUpdates', label: 'Request Updates', desc: 'Get notified about request changes' },
                { key: 'taskAssignments', label: 'Task Assignments', desc: 'Notifications when assigned tasks' },
                { key: 'clientMessages', label: 'Client Messages', desc: 'New messages from clients' },
                { key: 'weeklyDigest', label: 'Weekly Digest', desc: 'Summary email every week' },
                { key: 'systemAlerts', label: 'System Alerts', desc: 'Critical system notifications' },
                { key: 'marketingUpdates', label: 'Marketing Updates', desc: 'News about features and updates' },
              ].map(item => (
                <div key={item.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--tx-1)', marginBottom: '2px' }}>{item.label}</div>
                    <div style={{ fontSize: '12px', color: 'var(--tx-3)' }}>{item.desc}</div>
                  </div>
                  <div onClick={() => handleToggleNotification(item.key)} style={{ position: 'relative', width: '36px', height: '20px', flexShrink: 0, cursor: 'pointer', marginLeft: '16px' }}>
                    <div style={{ position: 'absolute', inset: 0, borderRadius: '10px', backgroundColor: notifications[item.key] ? 'var(--accent)' : 'var(--bg-overlay)', transition: 'background 0.2s' }} />
                    <div style={{ position: 'absolute', top: '2px', left: notifications[item.key] ? '18px' : '2px', width: '16px', height: '16px', borderRadius: '50%', backgroundColor: 'var(--tx-1)', transition: 'left 0.2s' }} />
                  </div>
                </div>
              ))}
            </div>
            {/* Push Notifications */}
            <PushNotificationCard />
          </div>

          {/* BILLING SECTION */}
          <div className={`settings-section ${activeSection === 'billing' ? 'active' : ''}`}>
            <h2 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '20px', color: 'var(--tx-1)' }}>Billing & Plan</h2>
            <div className="card" style={{ padding: '20px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '20px' }}>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--tx-1)', marginBottom: '4px' }}>Agency Pro</h3>
                  <p style={{ fontSize: '14px', color: 'var(--tx-2)' }}>$299/month</p>
                </div>
                <span className="pill pill-green" style={{ padding: '4px 10px', fontSize: '11px' }}>Active</span>
              </div>
              <div style={{ marginBottom: '20px' }}>
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '12px' }}>
                    <span style={{ color: 'var(--tx-2)' }}>Team Members</span>
                    <span style={{ color: 'var(--tx-1)', fontWeight: '600' }}>{memberCount}/20</span>
                  </div>
                  <div style={{ height: '4px', backgroundColor: 'var(--bg-elevated)', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', backgroundColor: memberCount > 15 ? 'var(--yellow)' : 'var(--green)', width: `${Math.min(100, (memberCount / 20) * 100)}%` }} />
                  </div>
                </div>
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '12px' }}>
                    <span style={{ color: 'var(--tx-2)' }}>Integrations</span>
                    <span style={{ color: 'var(--tx-1)', fontWeight: '600' }}>{connectedCount}/12</span>
                  </div>
                  <div style={{ height: '4px', backgroundColor: 'var(--bg-elevated)', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', backgroundColor: 'var(--blue)', width: `${Math.min(100, (connectedCount / 12) * 100)}%` }} />
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn-primary" onClick={() => toast.info('Stripe billing integration coming soon')}>Upgrade Plan</button>
                <button className="btn-ghost" onClick={() => toast.info('Stripe billing integration coming soon')}>Manage Payment Method</button>
              </div>
            </div>
            <div>
              <h3 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--tx-1)', marginBottom: '12px' }}>Billing History</h3>
              <div className="card" style={{ padding: 20 }}>
                <p style={{ fontSize: '13px', color: 'var(--tx-3)', textAlign: 'center' }}>
                  Billing history will appear here once Stripe is connected via the <span style={{ color: 'var(--blue)', cursor: 'pointer' }} onClick={() => navigate('/integrations')}>Integrations</span> page.
                </p>
              </div>
            </div>
          </div>

          {/* INTEGRATIONS SECTION */}
          <div className={`settings-section ${activeSection === 'integrations' ? 'active' : ''}`}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--tx-1)' }}>Integrations</h2>
              <a href="/integrations" style={{ fontSize: '12px', color: 'var(--blue)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}>
                Manage all <ChevronRight size={14} />
              </a>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {integrations.length > 0 ? integrations.map(int => {
                const meta = integrationMeta[int.provider] || { name: int.provider, icon: '🔌' };
                return (
                  <div key={int.provider} className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                      <div style={{ fontSize: '24px' }}>{meta.icon}</div>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--tx-1)' }}>{meta.name}</div>
                        <div style={{ fontSize: '12px', color: 'var(--tx-3)', marginTop: '2px' }}>
                          {int.status === 'connected' ? `Connected ${int.connected_at ? new Date(int.connected_at).toLocaleDateString() : ''}` : 'Disconnected'}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className={`pill ${int.status === 'connected' ? 'pill-green' : 'pill-red'}`} style={{ padding: '3px 8px', fontSize: '11px' }}>
                        {int.status === 'connected' ? 'Connected' : 'Disconnected'}
                      </span>
                      <button className="btn-ghost" style={{ padding: '4px 8px', fontSize: '12px' }} onClick={handleConfigureIntegration}>Configure</button>
                    </div>
                  </div>
                );
              }) : (
                <div className="card" style={{ padding: 20, textAlign: 'center' }}>
                  <p style={{ fontSize: '13px', color: 'var(--tx-3)' }}>
                    No integrations connected yet. <span style={{ color: 'var(--blue)', cursor: 'pointer' }} onClick={() => navigate('/integrations')}>Set up integrations</span>
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* SECURITY SECTION */}
          <div className={`settings-section ${activeSection === 'security' ? 'active' : ''}`}>
            <h2 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '20px', color: 'var(--tx-1)' }}>Security</h2>

            {/* Change Password */}
            <div className="card" style={{ padding: '20px', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--tx-1)', marginBottom: '16px' }}>Change Password</h3>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--tx-2)', display: 'block', marginBottom: '6px' }}>Current Password</label>
                <input className="input-field" type="password" value={security.currentPassword} onChange={e => setSecurity({ ...security, currentPassword: e.target.value })} />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--tx-2)', display: 'block', marginBottom: '6px' }}>New Password</label>
                <input className="input-field" type="password" value={security.newPassword} onChange={e => setSecurity({ ...security, newPassword: e.target.value })} />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--tx-2)', display: 'block', marginBottom: '6px' }}>Confirm New Password</label>
                <input className="input-field" type="password" value={security.confirmPassword} onChange={e => setSecurity({ ...security, confirmPassword: e.target.value })} />
              </div>
              <button className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }} onClick={handleUpdatePassword}>
                <Check size={16} /> Update Password
              </button>
            </div>

            {/* Two-Factor Authentication */}
            <div className="card" style={{ padding: '20px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--tx-1)', marginBottom: '4px' }}>Two-Factor Authentication</h3>
                  <p style={{ fontSize: '12px', color: 'var(--tx-3)' }}>
                    {security.twoFactorEnabled
                      ? 'TOTP authenticator app is active on your account. Your account is protected.'
                      : 'Add an extra layer of security. Use any authenticator app (Google Authenticator, Authy).'}
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, marginLeft: 16 }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, padding: '4px 10px', borderRadius: 5,
                    background: security.twoFactorEnabled ? '#22c55e18' : 'var(--bg-overlay)',
                    color: security.twoFactorEnabled ? '#22c55e' : 'var(--tx-3)' }}>
                    {security.twoFactorEnabled ? 'Active' : 'Not Set Up'}
                  </span>
                  {security.twoFactorEnabled ? (
                    <button
                      className="btn-ghost btn-sm"
                      style={{ color: 'var(--red)', borderColor: 'var(--red)', fontSize: '12px' }}
                      onClick={async () => {
                        if (!window.confirm('Are you sure you want to disable two-factor authentication? This will make your account less secure.')) return;
                        try {
                          await axh().delete(`${API}/auth/otp/disable`);
                          setSecurity(prev => ({ ...prev, twoFactorEnabled: false }));
                          toast.success('Two-factor authentication disabled');
                        } catch (err) {
                          toast.error(err.response?.data?.detail || 'Failed to disable 2FA');
                        }
                      }}
                    >
                      Disable
                    </button>
                  ) : (
                    <button
                      className="btn-primary btn-sm"
                      style={{ fontSize: '12px' }}
                      onClick={() => navigate('/setup-otp')}
                    >
                      Set Up 2FA
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Active Sessions */}
            <div>
              <h3 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--tx-1)', marginBottom: '12px' }}>Active Sessions</h3>
              {sessionsLoading ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 30 }}>
                  <Loader2 size={18} className="spin" style={{ color: 'var(--tx-3)' }} />
                </div>
              ) : sessions.length > 0 ? (
                <div className="card" style={{ overflow: 'hidden' }}>
                  <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: 'var(--tx-2)' }}>Browser</th>
                        <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: 'var(--tx-2)' }}>Platform</th>
                        <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: 'var(--tx-2)' }}>IP</th>
                        <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: 'var(--tx-2)' }}>Last Active</th>
                        <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: 'var(--tx-2)' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sessions.map((session, idx) => (
                        <tr key={session.id} style={{ borderBottom: idx < sessions.length - 1 ? '1px solid var(--border)' : 'none' }}>
                          <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--tx-1)' }}>
                            {session.browser} {session.current && <span style={{ fontSize: '11px', color: 'var(--green)', marginLeft: '4px' }}>(Current)</span>}
                          </td>
                          <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--tx-1)' }}>{session.platform}</td>
                          <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--tx-2)' }}>{session.ip}</td>
                          <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--tx-2)' }}>{formatTimeAgo(session.last_active)}</td>
                          <td style={{ padding: '12px 16px', fontSize: '13px' }}>
                            {!session.current && (
                              <button className="btn-ghost" style={{ padding: '4px 8px', fontSize: '12px', color: 'var(--tx-3)' }} onClick={() => handleSignOutSession(session.id)}>
                                Sign Out
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="card" style={{ padding: 20, textAlign: 'center' }}>
                  <p style={{ fontSize: '13px', color: 'var(--tx-3)' }}>No active sessions recorded yet. Sessions are tracked from your next login.</p>
                </div>
              )}

              <button className="btn-ghost" style={{ marginTop: '12px', color: 'var(--red)', borderColor: 'var(--red)' }} onClick={handleSignOutAllDevices}>
                <LogOut size={14} style={{ display: 'inline-block', marginRight: '6px' }} />
                Sign Out All Devices
              </button>
            </div>
          </div>

          {/* APPEARANCE / DISPLAY & LANGUAGE SECTION */}
          <div className={`settings-section ${activeSection === 'appearance' ? 'active' : ''}`}>
            <h2 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '20px', color: 'var(--tx-1)' }}>Display &amp; Language</h2>
            <div className="card" style={{ padding: '20px', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--tx-1)', marginBottom: '4px' }}>Theme</h3>
              <p style={{ fontSize: '12px', color: 'var(--tx-3)', margin: '0 0 14px' }}>Switch instantly — no reload.</p>
              <div style={{ display: 'flex', gap: '8px' }}>
                {[
                  { id: 'dark',  label: 'Dark',  desc: 'Burgundy on near-black' },
                  { id: 'light', label: 'Light', desc: 'Clean and neutral' },
                ].map(opt => {
                  const active = appearance.theme === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        const u = { ...appearance, theme: opt.id };
                        setAppearance(u);
                        savePrefs('appearance', u);
                        document.documentElement.setAttribute('data-theme', opt.id);
                        localStorage.setItem('redops-theme', opt.id);
                      }}
                      style={{
                        flex: 1, padding: '12px 14px', borderRadius: 10, cursor: 'pointer',
                        background: active ? 'var(--accent-soft)' : 'var(--bg-elevated)',
                        border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                        textAlign: 'left',
                      }}
                    >
                      <div style={{ fontSize: 13, fontWeight: 700, color: active ? 'var(--accent)' : 'var(--tx-1)' }}>{opt.label}</div>
                      <div style={{ fontSize: 11, color: 'var(--tx-3)', marginTop: 2 }}>{opt.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Language */}
            <div className="card" style={{ padding: '20px', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--tx-1)', marginBottom: '4px' }}>Language</h3>
              <p style={{ fontSize: '12px', color: 'var(--tx-3)', margin: '0 0 12px' }}>Used for UI labels and dates across the app.</p>
              <select
                value={typeof window !== 'undefined' ? (localStorage.getItem('language') || 'en') : 'en'}
                onChange={async e => {
                  const lang = e.target.value;
                  localStorage.setItem('language', lang);
                  try {
                    const i18n = (await import('../i18n/i18n')).default;
                    if (i18n?.changeLanguage) await i18n.changeLanguage(lang);
                  } catch { /* i18n optional */ }
                  toast.success('Language updated');
                }}
                className="input-field"
                style={{ width: '100%', maxWidth: 280 }}
              >
                <option value="en">English</option>
                <option value="es">Español</option>
                <option value="pt">Português</option>
              </select>
            </div>
            <div className="card" style={{ padding: '20px', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--tx-1)', marginBottom: '12px' }}>Accent Color</h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                {accentColors.map(color => (
                  <div key={color.name} onClick={() => handleAccentColorChange(color.name)} style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: color.hex, cursor: 'pointer', border: appearance.accentColor === color.name ? '2px solid #fff' : '2px solid transparent', boxShadow: appearance.accentColor === color.name ? '0 0 0 2px var(--border)' : 'none', transition: 'border 0.2s' }} />
                ))}
              </div>
            </div>
            <div className="card" style={{ padding: '20px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--tx-1)', marginBottom: '2px' }}>Compact Mode</div>
                  <div style={{ fontSize: '12px', color: 'var(--tx-3)' }}>Reduce spacing and text size</div>
                </div>
                <div onClick={() => { const u = { ...appearance, compactMode: !appearance.compactMode }; setAppearance(u); savePrefs('appearance', u); }} style={{ position: 'relative', width: '36px', height: '20px', cursor: 'pointer' }}>
                  <div style={{ position: 'absolute', inset: 0, borderRadius: '10px', backgroundColor: appearance.compactMode ? 'var(--accent)' : 'var(--bg-overlay)', transition: 'background 0.2s' }} />
                  <div style={{ position: 'absolute', top: '2px', left: appearance.compactMode ? '18px' : '2px', width: '16px', height: '16px', borderRadius: '50%', backgroundColor: 'var(--tx-1)', transition: 'left 0.2s' }} />
                </div>
              </div>
            </div>
            <div className="card" style={{ padding: '20px', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--tx-1)', marginBottom: '12px' }}>Sidebar Position</h3>
              <div style={{ display: 'flex', gap: '12px' }}>
                {['left', 'right'].map(pos => (
                  <label key={pos} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                    <input type="radio" name="sidebarPos" value={pos} checked={appearance.sidebarPosition === pos} onChange={e => { const u = { ...appearance, sidebarPosition: e.target.value }; setAppearance(u); savePrefs('appearance', u); }} style={{ cursor: 'pointer' }} />
                    <span style={{ fontSize: '13px', color: 'var(--tx-1)', textTransform: 'capitalize' }}>{pos}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="card" style={{ padding: '20px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--tx-1)', marginBottom: '12px' }}>Font Size</h3>
              <div style={{ display: 'flex', gap: '12px' }}>
                {['normal', 'compact', 'comfortable'].map(size => (
                  <label key={size} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                    <input type="radio" name="fontSize" value={size} checked={appearance.fontSize === size} onChange={e => { const u = { ...appearance, fontSize: e.target.value }; setAppearance(u); savePrefs('appearance', u); }} style={{ cursor: 'pointer' }} />
                    <span style={{ fontSize: '13px', color: 'var(--tx-1)', textTransform: 'capitalize' }}>{size}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* ── Chat Customization ── */}
            <div style={{ marginTop: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--tx-1)', marginBottom: 16 }}>Chat Customization</h3>

              {/* Bubble Color */}
              <div className="card" style={{ padding: 20, marginBottom: 16 }}>
                <h4 style={{ fontSize: 14, fontWeight: 600, color: 'var(--tx-1)', marginBottom: 8 }}>Sent Bubble Color</h4>
                <p style={{ fontSize: 12, color: 'var(--tx-3)', marginBottom: 12 }}>Choose the background color for your sent messages.</p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {[
                    { label: 'Red', value: '#c92a3e' },
                    { label: 'Blue', value: '#3b82f6' },
                    { label: 'Purple', value: '#8b5cf6' },
                    { label: 'Green', value: '#059669' },
                    { label: 'Orange', value: '#ea580c' },
                    { label: 'Pink', value: '#ec4899' },
                    { label: 'Teal', value: '#0891b2' },
                    { label: 'Dark', value: '#374151' },
                  ].map(c => {
                    const current = localStorage.getItem('redops-chat-bubble-color') || '#c92a3e';
                    return (
                      <div key={c.value} onClick={() => { localStorage.setItem('redops-chat-bubble-color', c.value); setAppearance(p => ({ ...p, _tick: Date.now() })); }}
                        style={{
                          width: 36, height: 36, borderRadius: 12, background: c.value, cursor: 'pointer',
                          border: current === c.value ? '2px solid #fff' : '2px solid transparent',
                          boxShadow: current === c.value ? `0 0 0 2px ${c.value}` : 'none',
                          transition: 'all 0.2s',
                        }}
                        title={c.label}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Chat Background */}
              <div className="card" style={{ padding: 20 }}>
                <h4 style={{ fontSize: 14, fontWeight: 600, color: 'var(--tx-1)', marginBottom: 8 }}>Chat Background</h4>
                <p style={{ fontSize: 12, color: 'var(--tx-3)', marginBottom: 12 }}>Set a background for your conversation view.</p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {[
                    { label: 'Default', value: 'default', bg: 'transparent', border: '1px dashed var(--border)' },
                    { label: 'Dark Navy', value: '#0a0e1a', bg: '#0a0e1a' },
                    { label: 'Charcoal', value: '#1a1a2e', bg: '#1a1a2e' },
                    { label: 'Midnight', value: '#0f172a', bg: '#0f172a' },
                    { label: 'Warm Dark', value: '#1c1917', bg: '#1c1917' },
                    { label: 'Gradient 1', value: 'linear-gradient(135deg, #0a0e1a 0%, #1a1a2e 100%)', bg: 'linear-gradient(135deg, #0a0e1a 0%, #1a1a2e 100%)' },
                    { label: 'Gradient 2', value: 'linear-gradient(135deg, #1a1a2e 0%, #0f172a 50%, #1e1b4b 100%)', bg: 'linear-gradient(135deg, #1a1a2e 0%, #0f172a 50%, #1e1b4b 100%)' },
                    { label: 'Gradient 3', value: 'linear-gradient(180deg, #0c1220 0%, #1a0a0a 100%)', bg: 'linear-gradient(180deg, #0c1220 0%, #1a0a0a 100%)' },
                  ].map(c => {
                    const current = localStorage.getItem('redops-chat-bg') || 'default';
                    return (
                      <div key={c.value} onClick={() => { localStorage.setItem('redops-chat-bg', c.value); setAppearance(p => ({ ...p, _tick: Date.now() })); }}
                        style={{
                          width: 48, height: 36, borderRadius: 10, background: c.bg, cursor: 'pointer',
                          border: current === c.value ? '2px solid var(--accent)' : (c.border || '1px solid var(--border)'),
                          transition: 'all 0.2s',
                        }}
                        title={c.label}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="modal-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowInviteModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ padding: '20px', maxWidth: '400px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--tx-1)' }}>Add Team Member</h3>
              <button onClick={() => setShowInviteModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx-3)' }}><X size={20} /></button>
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--tx-2)', display: 'block', marginBottom: '6px' }}>Full Name</label>
              <input className="input-field" type="text" placeholder="John Doe" value={inviteForm.name} onChange={e => setInviteForm({ ...inviteForm, name: e.target.value })} />
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--tx-2)', display: 'block', marginBottom: '6px' }}>Email Address</label>
              <input className="input-field" type="email" placeholder="user@example.com" value={inviteForm.email} onChange={e => setInviteForm({ ...inviteForm, email: e.target.value })} />
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--tx-2)', display: 'block', marginBottom: '6px' }}>Temporary Password</label>
              <input className="input-field" type="text" placeholder="TempPass123!" value={inviteForm.password} onChange={e => setInviteForm({ ...inviteForm, password: e.target.value })} />
              <p style={{ fontSize: '11px', color: 'var(--tx-3)', marginTop: 4 }}>User will be required to change on first login</p>
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--tx-2)', display: 'block', marginBottom: '6px' }}>Role</label>
              <select className="input-field" value={inviteForm.role} onChange={e => setInviteForm({ ...inviteForm, role: e.target.value })}>
                <option>Administrator</option><option>Operator</option><option>Standard User</option>
              </select>
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--tx-2)', display: 'block', marginBottom: '6px' }}>Account Type</label>
              <select className="input-field" value={inviteForm.account_type} onChange={e => setInviteForm({ ...inviteForm, account_type: e.target.value })}>
                <option>Internal Staff</option><option>Partner</option><option>Media Client</option><option>Vendor/Freelancer</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn-primary" style={{ flex: 1 }} onClick={handleSendInvite}>Create User</button>
              <button className="btn-ghost" onClick={() => setShowInviteModal(false)} style={{ flex: 1 }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Account Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="modal-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowDeleteConfirm(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ padding: '20px', maxWidth: '400px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--red)' }}>Delete Account</h3>
              <button onClick={() => setShowDeleteConfirm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx-3)' }}><X size={20} /></button>
            </div>
            <div style={{ marginBottom: '20px' }}>
              <p style={{ fontSize: '14px', color: 'var(--tx-2)', marginBottom: '12px' }}>Are you sure you want to delete your account? This action is permanent and cannot be undone.</p>
              <p style={{ fontSize: '13px', color: 'var(--tx-3)' }}>All your data, including team memberships, settings, and integrations will be permanently deleted.</p>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn-ghost" style={{ flex: 1, color: 'var(--red)', borderColor: 'var(--red)' }} onClick={confirmDeleteAccount}>Delete Account</button>
              <button className="btn-primary" style={{ flex: 1 }} onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
