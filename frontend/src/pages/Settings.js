import React, { useState } from 'react';
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
  Eye,
  EyeOff,
  LogOut,
  ChevronRight,
  Mail,
  Phone,
  Globe,
  Trash2,
  RefreshCw,
} from 'lucide-react';

export default function Settings() {
  const [activeSection, setActiveSection] = useState('profile');

  // Profile state
  const [profile, setProfile] = useState({
    firstName: 'Vitto',
    lastName: 'Pessanha',
    email: 'vitto@redops.io',
    role: 'Admin',
    phone: '+1 (555) 123-4567',
    bio: 'Operations lead, 5+ years in digital marketing.',
  });

  // Account state
  const [account, setAccount] = useState({
    timezone: 'America/Toronto',
    language: 'English',
    dateFormat: 'MM/DD/YYYY',
  });

  // Notifications state
  const [notifications, setNotifications] = useState({
    emailNotifications: true,
    requestUpdates: true,
    taskAssignments: true,
    clientMessages: true,
    weeklyDigest: false,
    systemAlerts: true,
    marketingUpdates: false,
  });

  // Appearance state
  const [appearance, setAppearance] = useState({
    theme: 'dark',
    accentColor: 'red',
    compactMode: false,
    sidebarPosition: 'left',
    fontSize: 'normal',
  });

  // Security state
  const [security, setSecurity] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
    twoFactorEnabled: false,
  });

  // Modal state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: '', role: 'Standard User' });

  // Team members
  const teamMembers = [
    { id: 1, name: 'Vitto Pessanha', role: 'Admin', email: 'vitto@redops.io', status: 'Active' },
    { id: 2, name: 'Taryn Pessanha', role: 'Operator', email: 'taryn@redops.io', status: 'Active' },
    { id: 3, name: 'Lucca Rossini', role: 'Operator', email: 'lucca@redops.io', status: 'Active' },
    { id: 4, name: 'Sarah Chen', role: 'Standard User', email: 'sarah@redops.io', status: 'Active' },
    { id: 5, name: 'Marcus Obi', role: 'Standard User', email: 'marcus@redops.io', status: 'Active' },
    { id: 6, name: 'Jordan Kim', role: 'Standard User', email: 'jordan@redops.io', status: 'Active' },
  ];

  // Integrations data
  const integrations = [
    { name: 'GoHighLevel (GHL)', icon: '🚀', description: 'SMS, calls, automation', connected: true },
    { name: 'Google Drive', icon: '📁', description: 'File storage & sync', connected: true },
    { name: 'Nextcloud', icon: '☁️', description: 'Private cloud storage', connected: true },
    { name: 'OpenAI', icon: '🤖', description: 'AI-powered assistance', connected: true },
    { name: 'Slack', icon: '💬', description: 'Team messaging', connected: false },
    { name: 'Microsoft Teams', icon: '🔗', description: 'Enterprise chat', connected: false },
    { name: 'Stripe', icon: '💳', description: 'Payment processing', connected: false },
    { name: 'Zapier', icon: '⚡', description: 'Workflow automation', connected: false },
    { name: 'HubSpot', icon: '📊', description: 'CRM integration', connected: false },
    { name: 'Salesforce', icon: '☁️', description: 'Enterprise CRM', connected: false },
    { name: 'Asana', icon: '✓', description: 'Project management', connected: false },
    { name: 'Monday.com', icon: '📋', description: 'Work OS platform', connected: false },
  ];

  // Invoices
  const invoices = [
    { id: 1, date: 'Mar 1, 2026', amount: '$299.00', status: 'Paid' },
    { id: 2, date: 'Feb 1, 2026', amount: '$299.00', status: 'Paid' },
    { id: 3, date: 'Jan 1, 2026', amount: '$299.00', status: 'Paid' },
  ];

  // Active sessions
  const sessions = [
    { id: 1, browser: 'Chrome', platform: 'macOS', location: 'Toronto, CA', lastActive: 'Now', current: true },
    { id: 2, browser: 'Safari', platform: 'iOS', location: 'Toronto, CA', lastActive: '2 hours ago', current: false },
  ];

  const handleToggleNotification = (key) => {
    setNotifications(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleAccentColorChange = (color) => {
    setAppearance(prev => ({ ...prev, accentColor: color }));
  };

  const getInitials = (name) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase();
  };

  const getAvatarColor = (name) => {
    const colors = {
      'Vitto': 'var(--red)',
      'Taryn': '#8b5cf6',
      'Lucca': '#06b6d4',
      'Sarah': '#ec4899',
      'Marcus': '#10b981',
      'Jordan': '#f59e0b',
    };
    return colors[name.split(' ')[0]] || 'var(--red)';
  };

  const accentColors = [
    { name: 'red', hex: 'var(--red)' },
    { name: 'blue', hex: 'var(--blue)' },
    { name: 'green', hex: 'var(--green)' },
    { name: 'purple', hex: '#8b5cf6' },
    { name: 'orange', hex: 'var(--yellow)' },
    { name: 'pink', hex: '#ec4899' },
  ];

  return (
    <div className="page-content">
      <div className="settings-layout">
        {/* Left Sidebar */}
        <div className="settings-sidebar">
          {[
            { id: 'profile', label: 'Profile', icon: User },
            { id: 'account', label: 'Account', icon: SettingsIcon },
            { id: 'team', label: 'Team & Roles', icon: Users },
            { id: 'notifications', label: 'Notifications', icon: Bell },
            { id: 'billing', label: 'Billing', icon: CreditCard },
            { id: 'integrations', label: 'Integrations', icon: Plug, badge: '7 connected' },
            { id: 'security', label: 'Security', icon: Shield },
            { id: 'appearance', label: 'Appearance', icon: Palette },
          ].map(item => {
            const IconComp = item.icon;
            return (
              <div
                key={item.id}
                className={`settings-nav-item ${activeSection === item.id ? 'active' : ''}`}
                onClick={() => setActiveSection(item.id)}
                style={{
                  backgroundColor: activeSection === item.id ? '#2a1819' : 'transparent',
                  color: activeSection === item.id ? '#e8404e' : 'var(--tx-2)',
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
                <div
                  style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--red)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '24px',
                    fontWeight: '700',
                    color: '#fff',
                    margin: '0 auto 12px',
                  }}
                >
                  G
                </div>
                <button className="btn-sm" style={{ marginBottom: '16px' }}>
                  Change Avatar
                </button>
              </div>

              {/* Form Fields */}
              <div className="card" style={{ padding: '20px' }}>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--tx-2)', display: 'block', marginBottom: '6px' }}>
                    First Name
                  </label>
                  <input
                    className="input-field"
                    type="text"
                    value={profile.firstName}
                    onChange={e => setProfile({ ...profile, firstName: e.target.value })}
                  />
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--tx-2)', display: 'block', marginBottom: '6px' }}>
                    Last Name
                  </label>
                  <input
                    className="input-field"
                    type="text"
                    value={profile.lastName}
                    onChange={e => setProfile({ ...profile, lastName: e.target.value })}
                  />
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--tx-2)', display: 'block', marginBottom: '6px' }}>
                    Email (Read-only)
                  </label>
                  <input className="input-field" type="email" value={profile.email} disabled style={{ opacity: 0.6 }} />
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--tx-2)', display: 'block', marginBottom: '6px' }}>
                    Role (Read-only)
                  </label>
                  <div className="pill" style={{ display: 'inline-block', backgroundColor: 'var(--red)', padding: '4px 10px', borderRadius: '4px', color: '#fff', fontSize: '12px' }}>
                    {profile.role}
                  </div>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--tx-2)', display: 'block', marginBottom: '6px' }}>
                    Phone
                  </label>
                  <input
                    className="input-field"
                    type="tel"
                    value={profile.phone}
                    onChange={e => setProfile({ ...profile, phone: e.target.value })}
                  />
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--tx-2)', display: 'block', marginBottom: '6px' }}>
                    Bio
                  </label>
                  <textarea
                    className="input-field"
                    value={profile.bio}
                    onChange={e => setProfile({ ...profile, bio: e.target.value })}
                    style={{ minHeight: '100px', fontFamily: 'inherit' }}
                  />
                </div>

                <button className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
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
                <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--tx-2)', display: 'block', marginBottom: '6px' }}>
                  Timezone
                </label>
                <select
                  className="input-field"
                  value={account.timezone}
                  onChange={e => setAccount({ ...account, timezone: e.target.value })}
                >
                  <option>America/Toronto</option>
                  <option>America/Vancouver</option>
                  <option>America/New_York</option>
                  <option>America/Los_Angeles</option>
                  <option>Europe/London</option>
                </select>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--tx-2)', display: 'block', marginBottom: '6px' }}>
                  Language
                </label>
                <select
                  className="input-field"
                  value={account.language}
                  onChange={e => setAccount({ ...account, language: e.target.value })}
                >
                  <option>English</option>
                  <option>French</option>
                  <option>Spanish</option>
                </select>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--tx-2)', display: 'block', marginBottom: '6px' }}>
                  Date Format
                </label>
                <select className="input-field" value={account.dateFormat} onChange={e => setAccount({ ...account, dateFormat: e.target.value })}>
                  <option>MM/DD/YYYY</option>
                  <option>DD/MM/YYYY</option>
                  <option>YYYY-MM-DD</option>
                </select>
              </div>
            </div>

            {/* Danger Zone */}
            <div className="card" style={{ padding: '20px', border: '1px solid var(--red)', backgroundColor: 'rgba(201, 42, 62, 0.05)' }}>
              <h3 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--red)', marginBottom: '12px' }}>Danger Zone</h3>
              <p style={{ fontSize: '12px', color: 'var(--tx-2)', marginBottom: '12px' }}>Deleting your account is permanent and cannot be undone.</p>
              <button className="btn-ghost" style={{ color: 'var(--red)', borderColor: 'var(--red)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Trash2 size={16} /> Delete Account
              </button>
            </div>
          </div>

          {/* TEAM & ROLES SECTION */}
          <div className={`settings-section ${activeSection === 'team' ? 'active' : ''}`}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--tx-1)' }}>Team & Roles</h2>
              <button className="btn-primary" onClick={() => setShowInviteModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Plus size={16} /> Invite Member
              </button>
            </div>

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
                          <div
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '50%',
                              backgroundColor: getAvatarColor(member.name),
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '12px',
                              fontWeight: '700',
                              color: '#fff',
                              flexShrink: 0,
                            }}
                          >
                            {getInitials(member.name)}
                          </div>
                          {member.name}
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--tx-1)' }}>{member.role}</td>
                      <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--tx-2)' }}>{member.email}</td>
                      <td style={{ padding: '12px 16px', fontSize: '13px' }}>
                        <span className="pill pill-green" style={{ padding: '3px 8px', fontSize: '11px' }}>
                          {member.status}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '13px' }}>
                        <button className="btn-ghost" style={{ padding: '4px 8px', fontSize: '12px' }}>
                          Manage
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
                <div
                  key={item.key}
                  className="toggle-row"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 0',
                    borderBottom: '1px solid var(--border)',
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--tx-1)', marginBottom: '2px' }}>
                      {item.label}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--tx-3)' }}>
                      {item.desc}
                    </div>
                  </div>
                  <div
                    className="toggle-switch"
                    onClick={() => handleToggleNotification(item.key)}
                    style={{
                      position: 'relative',
                      width: '36px',
                      height: '20px',
                      flexShrink: 0,
                      cursor: 'pointer',
                      marginLeft: '16px',
                    }}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        borderRadius: '10px',
                        backgroundColor: notifications[item.key] ? 'var(--red)' : 'var(--bg-overlay)',
                        transition: 'background 0.2s',
                      }}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        top: '2px',
                        left: notifications[item.key] ? '18px' : '2px',
                        width: '16px',
                        height: '16px',
                        borderRadius: '50%',
                        backgroundColor: '#fff',
                        transition: 'left 0.2s',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* BILLING SECTION */}
          <div className={`settings-section ${activeSection === 'billing' ? 'active' : ''}`}>
            <h2 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '20px', color: 'var(--tx-1)' }}>Billing & Plan</h2>

            {/* Current Plan */}
            <div className="card" style={{ padding: '20px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '20px' }}>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--tx-1)', marginBottom: '4px' }}>Agency Pro</h3>
                  <p style={{ fontSize: '14px', color: 'var(--tx-2)' }}>$299/month</p>
                </div>
                <span className="pill pill-green" style={{ padding: '4px 10px', fontSize: '11px' }}>
                  Active
                </span>
              </div>

              {/* Usage Stats */}
              <div style={{ marginBottom: '20px' }}>
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '12px' }}>
                    <span style={{ color: 'var(--tx-2)' }}>Team Members</span>
                    <span style={{ color: 'var(--tx-1)', fontWeight: '600' }}>12/20</span>
                  </div>
                  <div style={{ height: '4px', backgroundColor: 'var(--bg-elevated)', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', backgroundColor: 'var(--green)', width: '60%' }} />
                  </div>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '12px' }}>
                    <span style={{ color: 'var(--tx-2)' }}>API Requests</span>
                    <span style={{ color: 'var(--tx-1)', fontWeight: '600' }}>847/1000</span>
                  </div>
                  <div style={{ height: '4px', backgroundColor: 'var(--bg-elevated)', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', backgroundColor: 'var(--yellow)', width: '85%' }} />
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '12px' }}>
                    <span style={{ color: 'var(--tx-2)' }}>Storage</span>
                    <span style={{ color: 'var(--tx-1)', fontWeight: '600' }}>15GB/50GB</span>
                  </div>
                  <div style={{ height: '4px', backgroundColor: 'var(--bg-elevated)', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', backgroundColor: 'var(--blue)', width: '30%' }} />
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn-primary">Upgrade Plan</button>
                <button className="btn-ghost">Manage Payment Method</button>
              </div>
            </div>

            {/* Recent Invoices */}
            <div>
              <h3 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--tx-1)', marginBottom: '12px' }}>Recent Invoices</h3>
              <div className="card" style={{ overflow: 'hidden' }}>
                <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: 'var(--tx-2)' }}>Date</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: 'var(--tx-2)' }}>Amount</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: 'var(--tx-2)' }}>Status</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: 'var(--tx-2)' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((inv, idx) => (
                      <tr key={inv.id} style={{ borderBottom: idx < invoices.length - 1 ? '1px solid var(--border)' : 'none' }}>
                        <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--tx-1)' }}>{inv.date}</td>
                        <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--tx-1)' }}>{inv.amount}</td>
                        <td style={{ padding: '12px 16px', fontSize: '13px' }}>
                          <span className="pill pill-green" style={{ padding: '3px 8px', fontSize: '11px' }}>
                            {inv.status}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--blue)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Download size={14} /> Download
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* INTEGRATIONS SECTION */}
          <div className={`settings-section ${activeSection === 'integrations' ? 'active' : ''}`}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--tx-1)' }}>Integrations</h2>
              <a href="/integrations" style={{ fontSize: '12px', color: 'var(--blue)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}>
                View all <ChevronRight size={14} />
              </a>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {integrations.map(int => (
                <div
                  key={int.name}
                  className="card"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '16px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                    <div style={{ fontSize: '24px' }}>{int.icon}</div>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--tx-1)' }}>{int.name}</div>
                      <div style={{ fontSize: '12px', color: 'var(--tx-3)', marginTop: '2px' }}>{int.description}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {int.connected && (
                      <span className="pill pill-green" style={{ padding: '3px 8px', fontSize: '11px' }}>
                        Connected
                      </span>
                    )}
                    {int.connected && (
                      <button className="btn-ghost" style={{ padding: '4px 8px', fontSize: '12px' }}>
                        Configure
                      </button>
                    )}
                    {!int.connected && (
                      <button className="btn-primary" style={{ padding: '4px 8px', fontSize: '12px' }}>
                        Connect
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* SECURITY SECTION */}
          <div className={`settings-section ${activeSection === 'security' ? 'active' : ''}`}>
            <h2 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '20px', color: 'var(--tx-1)' }}>Security</h2>

            {/* Change Password */}
            <div className="card" style={{ padding: '20px', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--tx-1)', marginBottom: '16px' }}>Change Password</h3>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--tx-2)', display: 'block', marginBottom: '6px' }}>
                  Current Password
                </label>
                <input
                  className="input-field"
                  type="password"
                  value={security.currentPassword}
                  onChange={e => setSecurity({ ...security, currentPassword: e.target.value })}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--tx-2)', display: 'block', marginBottom: '6px' }}>
                  New Password
                </label>
                <input
                  className="input-field"
                  type="password"
                  value={security.newPassword}
                  onChange={e => setSecurity({ ...security, newPassword: e.target.value })}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--tx-2)', display: 'block', marginBottom: '6px' }}>
                  Confirm New Password
                </label>
                <input
                  className="input-field"
                  type="password"
                  value={security.confirmPassword}
                  onChange={e => setSecurity({ ...security, confirmPassword: e.target.value })}
                />
              </div>

              <button className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Check size={16} /> Update Password
              </button>
            </div>

            {/* Two-Factor Authentication */}
            <div className="card" style={{ padding: '20px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--tx-1)', marginBottom: '4px' }}>
                    Two-Factor Authentication
                  </h3>
                  <p style={{ fontSize: '12px', color: 'var(--tx-3)' }}>Currently {security.twoFactorEnabled ? 'enabled' : 'disabled'}</p>
                </div>
                <div
                  onClick={() => setSecurity({ ...security, twoFactorEnabled: !security.twoFactorEnabled })}
                  style={{
                    position: 'relative',
                    width: '36px',
                    height: '20px',
                    flexShrink: 0,
                    cursor: 'pointer',
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      borderRadius: '10px',
                      backgroundColor: security.twoFactorEnabled ? 'var(--red)' : 'var(--bg-overlay)',
                      transition: 'background 0.2s',
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      top: '2px',
                      left: security.twoFactorEnabled ? '18px' : '2px',
                      width: '16px',
                      height: '16px',
                      borderRadius: '50%',
                      backgroundColor: '#fff',
                      transition: 'left 0.2s',
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Active Sessions */}
            <div>
              <h3 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--tx-1)', marginBottom: '12px' }}>Active Sessions</h3>
              <div className="card" style={{ overflow: 'hidden' }}>
                <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: 'var(--tx-2)' }}>Browser</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: 'var(--tx-2)' }}>Platform</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: 'var(--tx-2)' }}>Location</th>
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
                        <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--tx-2)' }}>{session.location}</td>
                        <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--tx-2)' }}>{session.lastActive}</td>
                        <td style={{ padding: '12px 16px', fontSize: '13px' }}>
                          <button className="btn-ghost" style={{ padding: '4px 8px', fontSize: '12px', color: 'var(--tx-3)' }}>
                            Sign Out
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <button className="btn-ghost" style={{ marginTop: '12px', color: 'var(--red)', borderColor: 'var(--red)' }}>
                <LogOut size={14} style={{ display: 'inline-block', marginRight: '6px' }} />
                Sign Out All Devices
              </button>
            </div>
          </div>

          {/* APPEARANCE SECTION */}
          <div className={`settings-section ${activeSection === 'appearance' ? 'active' : ''}`}>
            <h2 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '20px', color: 'var(--tx-1)' }}>Appearance</h2>

            {/* Theme Selection */}
            <div className="card" style={{ padding: '20px', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--tx-1)', marginBottom: '12px' }}>Theme</h3>
              <div style={{ display: 'flex', gap: '12px' }}>
                {['dark', 'light'].map(theme => (
                  <label key={theme} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="theme"
                      value={theme}
                      checked={appearance.theme === theme}
                      onChange={e => setAppearance({ ...appearance, theme: e.target.value })}
                      style={{ cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: '13px', color: 'var(--tx-1)', textTransform: 'capitalize' }}>{theme}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Accent Color */}
            <div className="card" style={{ padding: '20px', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--tx-1)', marginBottom: '12px' }}>Accent Color</h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                {accentColors.map(color => (
                  <div
                    key={color.name}
                    onClick={() => handleAccentColorChange(color.name)}
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      backgroundColor: color.hex,
                      cursor: 'pointer',
                      border: appearance.accentColor === color.name ? '2px solid #fff' : '2px solid transparent',
                      boxShadow: appearance.accentColor === color.name ? '0 0 0 2px var(--border)' : 'none',
                      transition: 'border 0.2s',
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Compact Mode */}
            <div className="card" style={{ padding: '20px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--tx-1)', marginBottom: '2px' }}>Compact Mode</div>
                  <div style={{ fontSize: '12px', color: 'var(--tx-3)' }}>Reduce spacing and text size</div>
                </div>
                <div
                  onClick={() => setAppearance({ ...appearance, compactMode: !appearance.compactMode })}
                  style={{
                    position: 'relative',
                    width: '36px',
                    height: '20px',
                    cursor: 'pointer',
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      borderRadius: '10px',
                      backgroundColor: appearance.compactMode ? 'var(--red)' : 'var(--bg-overlay)',
                      transition: 'background 0.2s',
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      top: '2px',
                      left: appearance.compactMode ? '18px' : '2px',
                      width: '16px',
                      height: '16px',
                      borderRadius: '50%',
                      backgroundColor: '#fff',
                      transition: 'left 0.2s',
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Sidebar Position */}
            <div className="card" style={{ padding: '20px', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--tx-1)', marginBottom: '12px' }}>Sidebar Position</h3>
              <div style={{ display: 'flex', gap: '12px' }}>
                {['left', 'right'].map(pos => (
                  <label key={pos} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="sidebarPos"
                      value={pos}
                      checked={appearance.sidebarPosition === pos}
                      onChange={e => setAppearance({ ...appearance, sidebarPosition: e.target.value })}
                      style={{ cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: '13px', color: 'var(--tx-1)', textTransform: 'capitalize' }}>{pos}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Font Size */}
            <div className="card" style={{ padding: '20px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--tx-1)', marginBottom: '12px' }}>Font Size</h3>
              <div style={{ display: 'flex', gap: '12px' }}>
                {['normal', 'compact', 'comfortable'].map(size => (
                  <label key={size} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="fontSize"
                      value={size}
                      checked={appearance.fontSize === size}
                      onChange={e => setAppearance({ ...appearance, fontSize: e.target.value })}
                      style={{ cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: '13px', color: 'var(--tx-1)', textTransform: 'capitalize' }}>{size}</span>
                  </label>
                ))}
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
              <h3 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--tx-1)' }}>Invite Team Member</h3>
              <button onClick={() => setShowInviteModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx-3)' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--tx-2)', display: 'block', marginBottom: '6px' }}>
                Email Address
              </label>
              <input
                className="input-field"
                type="email"
                placeholder="user@example.com"
                value={inviteForm.email}
                onChange={e => setInviteForm({ ...inviteForm, email: e.target.value })}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--tx-2)', display: 'block', marginBottom: '6px' }}>
                Role
              </label>
              <select
                className="input-field"
                value={inviteForm.role}
                onChange={e => setInviteForm({ ...inviteForm, role: e.target.value })}
              >
                <option>Admin</option>
                <option>Operator</option>
                <option>Standard User</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn-primary" style={{ flex: 1 }}>
                Send Invite
              </button>
              <button className="btn-ghost" onClick={() => setShowInviteModal(false)} style={{ flex: 1 }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
