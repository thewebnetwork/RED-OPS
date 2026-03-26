import React, { useState, useRef } from 'react';
import {
  User, Settings as SettingsIcon, Users, Bell, CreditCard, Plug, Shield, Palette,
  Save, Plus, X, Check, Download, LogOut, ChevronRight, Trash2,
  Mail, Phone, Info
} from 'lucide-react';
import { toast } from 'sonner';

// ── Mock Data ──
const MOCK_TEAM = [
  { id: 1, name: 'Alex Rivera', role: 'Administrator', email: 'alex@red-ops.io', status: 'Active' },
  { id: 2, name: 'Sarah Chen', role: 'Operator', email: 'sarah@red-ops.io', status: 'Active' },
  { id: 3, name: 'Michael Ross', role: 'Operator', email: 'michael@red-ops.io', status: 'Away' },
  { id: 4, name: 'Jessica Lee', role: 'Standard User', email: 'jessica@client.com', status: 'Active' },
];

const MOCK_INVOICES = [
  { id: 'INV-2024-001', date: '2024-03-01', amount: '$299.00', status: 'Paid' },
  { id: 'INV-2024-002', date: '2024-02-01', amount: '$299.00', status: 'Paid' },
  { id: 'INV-2024-003', date: '2024-01-01', amount: '$299.00', status: 'Paid' },
];

const MOCK_SESSIONS = [
  { id: 1, browser: 'Chrome', platform: 'macOS', ip: '192.168.1.1', last_active: 'Now', current: true },
  { id: 2, browser: 'Safari', platform: 'iOS', ip: '192.168.1.45', last_active: '2h ago', current: false },
];

const MOCK_INTEGRATIONS = [
  { id: 'slack', name: 'Slack', icon: '💬', status: 'connected', desc: 'Sync notifications and requests to Slack channels.' },
  { id: 'openai', name: 'OpenAI', icon: '🤖', status: 'connected', desc: 'Power AI assistants and content generation.' },
  { id: 'stripe', name: 'Stripe', icon: '💳', status: 'not_connected', desc: 'Manage payments and subscriptions.' },
  { id: 'zapier', name: 'Zapier', icon: '⚡', status: 'not_connected', desc: 'Automate workflows with 5000+ apps.' },
];

// ── Components ──

function SectionHeader({ title, description }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--tx-1)', margin: '0 0 6px' }}>{title}</h2>
      <p style={{ fontSize: 13, color: 'var(--tx-3)', margin: 0 }}>{description}</p>
    </div>
  );
}

function SettingsCard({ children, title, padding = 24 }) {
  return (
    <div className="interaction-card" style={{ padding: 0, marginBottom: 24, overflow: 'hidden' }}>
      {title && (
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', background: 'var(--bg-card)' }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx-1)', margin: 0 }}>{title}</h3>
        </div>
      )}
      <div style={{ padding }}>{children}</div>
    </div>
  );
}

function ToggleRow({ label, description, checked, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ flex: 1, paddingRight: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--tx-1)', marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 12, color: 'var(--tx-3)' }}>{description}</div>
      </div>
      <button 
        onClick={() => onChange(!checked)}
        style={{ 
          width: 36, height: 20, borderRadius: 10, position: 'relative', cursor: 'pointer',
          background: checked ? 'var(--accent)' : 'var(--bg-overlay)', border: 'none', transition: 'all 0.2s'
        }}
      >
        <div style={{ 
          width: 14, height: 14, borderRadius: '50%', background: '#fff',
          position: 'absolute', top: 3, left: checked ? 19 : 3, transition: 'all 0.2s'
        }} />
      </button>
    </div>
  );
}

// ── Main Page ──
export default function Settings() {
  const [activeTab, setActiveTab] = useState('profile');
  const fileInputRef = useRef(null);
  const [showInviteModal, setShowInviteModal] = useState(false);

  // States
  const [profile, setProfile] = useState({ firstName: 'Alex', lastName: 'Rivera', email: 'alex@red-ops.io', role: 'Administrator', phone: '+1 (555) 0123', bio: 'Strategic operations lead at RED-OPS. Focused on high-velocity delivery and platform excellence.' });
  const [account, setAccount] = useState({ timezone: 'America/New_York', language: 'English', dateFormat: 'MM/DD/YYYY' });
  const [appearance, setAppearance] = useState({ theme: 'dark', accent: 'red', compact: false, sidebar: 'left', font: 'normal' });
  const [notifications, setNotifications] = useState({ email: true, push: true, requests: true, mentions: true, billing: false });

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'account', label: 'Account', icon: Globe },
    { id: 'team', label: 'Team & Roles', icon: Users },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'billing', label: 'Billing', icon: CreditCard },
    { id: 'integrations', label: 'Integrations', icon: Plug },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'appearance', label: 'Appearance', icon: Palette },
  ];

  const handleSave = () => {
    toast.success('Settings updated successfully');
  };

  return (
    <div style={{ display: 'flex', height: '100%', background: 'var(--bg)', overflow: 'hidden' }}>
      
      {/* ── Sidebar ── */}
      <div style={{ width: 240, borderRight: '1px solid var(--border)', background: 'var(--bg-card)', padding: '24px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        <h3 style={{ fontSize: 11, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '0 12px', marginBottom: 12 }}>Settings</h3>
        {tabs.map(tab => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8,
                background: active ? 'var(--bg)' : 'transparent',
                color: active ? 'var(--accent)' : 'var(--tx-2)',
                border: active ? '1px solid var(--border)' : '1px solid transparent',
                cursor: 'pointer', fontSize: 13, fontWeight: active ? 600 : 500,
                textAlign: 'left', transition: 'all 0.15s'
              }}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── Content ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '40px 60px' }}>
        <div style={{ maxWidth: 800 }}>
          
          {/* PROFILE SECTION */}
          {activeTab === 'profile' && (
            <div>
              <SectionHeader title="Profile" description="Manage your personal information and how others see you on the platform." />
              <SettingsCard>
                <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 32 }}>
                  <div style={{ position: 'relative' }}>
                    <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 700, color: '#fff' }}>
                      {profile.firstName[0]}{profile.lastName[0]}
                    </div>
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      style={{ position: 'absolute', bottom: 0, right: 0, width: 28, height: 28, borderRadius: '50%', background: 'var(--bg-card)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--tx-2)' }}
                    >
                      <Plus size={14} />
                    </button>
                    <input ref={fileInputRef} type="file" style={{ display: 'none' }} />
                  </div>
                  <div>
                    <h4 style={{ fontSize: 16, fontWeight: 700, color: 'var(--tx-1)', margin: '0 0 4px' }}>{profile.firstName} {profile.lastName}</h4>
                    <p style={{ fontSize: 13, color: 'var(--tx-3)', margin: 0 }}>{profile.role} · {profile.email}</p>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase', marginBottom: 6 }}>First Name</label>
                    <input className="input-field" value={profile.firstName} onChange={e => setProfile({...profile, firstName: e.target.value})} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase', marginBottom: 6 }}>Last Name</label>
                    <input className="input-field" value={profile.lastName} onChange={e => setProfile({...profile, lastName: e.target.value})} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase', marginBottom: 6 }}>Email</label>
                    <input className="input-field" value={profile.email} disabled style={{ opacity: 0.6 }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase', marginBottom: 6 }}>Phone</label>
                    <input className="input-field" value={profile.phone} onChange={e => setProfile({...profile, phone: e.target.value})} />
                  </div>
                </div>
                <div style={{ marginBottom: 24 }}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase', marginBottom: 6 }}>Bio</label>
                  <textarea className="input-field" rows={4} value={profile.bio} onChange={e => setProfile({...profile, bio: e.target.value})} />
                </div>
                <button className="btn-primary" onClick={handleSave}>Save Profile</button>
              </SettingsCard>
            </div>
          )}

          {/* ACCOUNT SECTION */}
          {activeTab === 'account' && (
            <div>
              <SectionHeader title="Account" description="Configure your locale settings and regional preferences." />
              <SettingsCard title="Localization">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase', marginBottom: 6 }}>Timezone</label>
                    <select className="input-field" value={account.timezone} onChange={e => setAccount({...account, timezone: e.target.value})}>
                      <option>America/New_York</option>
                      <option>Europe/London</option>
                      <option>Asia/Tokyo</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase', marginBottom: 6 }}>Language</label>
                    <select className="input-field" value={account.language} onChange={e => setAccount({...account, language: e.target.value})}>
                      <option>English</option>
                      <option>Spanish</option>
                      <option>French</option>
                    </select>
                  </div>
                </div>
                <div style={{ marginBottom: 24 }}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase', marginBottom: 6 }}>Date Format</label>
                  <select className="input-field" value={account.dateFormat} onChange={e => setAccount({...account, dateFormat: e.target.value})}>
                    <option>MM/DD/YYYY</option>
                    <option>DD/MM/YYYY</option>
                    <option>YYYY-MM-DD</option>
                  </select>
                </div>
                <button className="btn-primary" onClick={handleSave}>Save Changes</button>
              </SettingsCard>

              <SettingsCard title="Danger Zone" padding={0}>
                <div style={{ padding: 24 }}>
                  <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--red)', margin: '0 0 8px' }}>Delete Account</h4>
                  <p style={{ fontSize: 13, color: 'var(--tx-3)', margin: '0 0 16px' }}>Once you delete your account, there is no going back. Please be certain.</p>
                  <button className="btn-ghost" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>Delete Account</button>
                </div>
              </SettingsCard>
            </div>
          )}

          {/* TEAM SECTION */}
          {activeTab === 'team' && (
            <div>
              <SectionHeader title="Team & Roles" description="Manage your organization's members and their permission levels." />
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
                <button className="btn-primary" onClick={() => setShowInviteModal(true)}>
                  <Plus size={16} /> Invite Member
                </button>
              </div>
              <SettingsCard padding={0}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)' }}>
                      <th style={{ textAlign: 'left', padding: '12px 20px', fontSize: 11, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase' }}>Member</th>
                      <th style={{ textAlign: 'left', padding: '12px 20px', fontSize: 11, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase' }}>Role</th>
                      <th style={{ textAlign: 'left', padding: '12px 20px', fontSize: 11, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase' }}>Status</th>
                      <th style={{ textAlign: 'right', padding: '12px 20px', fontSize: 11, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {MOCK_TEAM.map(member => (
                      <tr key={member.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '14px 20px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--bg)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: 'var(--tx-1)' }}>
                              {member.name.split(' ').map(n=>n[0]).join('')}
                            </div>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--tx-1)' }}>{member.name}</div>
                              <div style={{ fontSize: 11, color: 'var(--tx-3)' }}>{member.email}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '14px 20px', fontSize: 12, color: 'var(--tx-2)' }}>{member.role}</td>
                        <td style={{ padding: '14px 20px' }}>
                          <span style={{ fontSize: 10, fontWeight: 700, color: member.status === 'Active' ? 'var(--green)' : 'var(--tx-3)', background: member.status === 'Active' ? 'var(--green)15' : 'var(--bg)', padding: '2px 8px', borderRadius: 10, border: '1px solid currentColor' }}>
                            {member.status}
                          </span>
                        </td>
                        <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                          <button className="btn-ghost btn-sm">Manage</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </SettingsCard>
            </div>
          )}

          {/* NOTIFICATIONS SECTION */}
          {activeTab === 'notifications' && (
            <div>
              <SectionHeader title="Notifications" description="Choose how and when you want to be notified of updates." />
              <SettingsCard title="System Notifications">
                <ToggleRow label="Email Notifications" description="Receive primary updates and alerts via your registered email address." checked={notifications.email} onChange={v => setNotifications({...notifications, email: v})} />
                <ToggleRow label="Push Notifications" description="Get real-time browser notifications for urgent activity." checked={notifications.push} onChange={v => setNotifications({...notifications, push: v})} />
              </SettingsCard>
              <SettingsCard title="Activity Alerts">
                <ToggleRow label="Request Updates" description="Notify me when a request I am involved in is updated." checked={notifications.requests} onChange={v => setNotifications({...notifications, requests: v})} />
                <ToggleRow label="Mentions & Comments" description="Notify me when someone mentions me in a conversation." checked={notifications.mentions} onChange={v => setNotifications({...notifications, mentions: v})} />
                <ToggleRow label="Billing & Subscription" description="Critical alerts regarding invoices and payment methods." checked={notifications.billing} onChange={v => setNotifications({...notifications, billing: v})} />
              </SettingsCard>
            </div>
          )}

          {/* BILLING SECTION */}
          {activeTab === 'billing' && (
            <div>
              <SectionHeader title="Billing" description="Manage your subscription plan, payment methods, and invoice history." />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
                <SettingsCard title="Current Plan">
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--tx-1)', marginBottom: 4 }}>Agency Pro</div>
                    <div style={{ fontSize: 13, color: 'var(--tx-3)' }}>Renewing on April 1, 2024</div>
                  </div>
                  <div style={{ color: 'var(--green)', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 20 }}>
                    <CheckCircle2 size={14} /> Subscription Active
                  </div>
                  <button className="btn-primary">Change Plan</button>
                </SettingsCard>
                <SettingsCard title="Usage">
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
                      <span style={{ color: 'var(--tx-3)', fontWeight: 600 }}>Team Members</span>
                      <span style={{ color: 'var(--tx-1)', fontWeight: 700 }}>8 / 20</span>
                    </div>
                    <div style={{ height: 6, background: 'var(--bg)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ width: '40%', height: '100%', background: 'var(--accent)' }} />
                    </div>
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
                      <span style={{ color: 'var(--tx-3)', fontWeight: 600 }}>Requests / Mo</span>
                      <span style={{ color: 'var(--tx-1)', fontWeight: 700 }}>142 / 500</span>
                    </div>
                    <div style={{ height: 6, background: 'var(--bg)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ width: '28%', height: '100%', background: 'var(--blue)' }} />
                    </div>
                  </div>
                </SettingsCard>
              </div>

              <SettingsCard title="Recent Invoices" padding={0}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <th style={{ textAlign: 'left', padding: '12px 20px', fontSize: 11, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase' }}>Invoice</th>
                      <th style={{ textAlign: 'left', padding: '12px 20px', fontSize: 11, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase' }}>Date</th>
                      <th style={{ textAlign: 'left', padding: '12px 20px', fontSize: 11, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase' }}>Amount</th>
                      <th style={{ textAlign: 'right', padding: '12px 20px', fontSize: 11, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {MOCK_INVOICES.map(inv => (
                      <tr key={inv.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '14px 20px', fontSize: 12, fontWeight: 600, color: 'var(--tx-1)' }}>{inv.id}</td>
                        <td style={{ padding: '14px 20px', fontSize: 12, color: 'var(--tx-3)' }}>{inv.date}</td>
                        <td style={{ padding: '14px 20px', fontSize: 12, color: 'var(--tx-2)' }}>{inv.amount}</td>
                        <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--green)', background: 'var(--green)15', padding: '2px 8px', borderRadius: 10, border: '1px solid currentColor' }}>
                            {inv.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </SettingsCard>
            </div>
          )}

          {/* INTEGRATIONS SECTION */}
          {activeTab === 'integrations' && (
            <div>
              <SectionHeader title="Integrations" description="Connect RED-OPS with your favorite tools to automate your workflow." />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                {MOCK_INTEGRATIONS.map(int => (
                  <SettingsCard key={int.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                      <div style={{ fontSize: 32 }}>{int.icon}</div>
                      <span style={{ 
                        fontSize: 10, fontWeight: 700, 
                        color: int.status === 'connected' ? 'var(--green)' : 'var(--tx-3)',
                        background: int.status === 'connected' ? 'var(--green)15' : 'var(--bg)',
                        padding: '2px 8px', borderRadius: 10, border: '1px solid currentColor',
                        textTransform: 'uppercase'
                      }}>
                        {int.status.replace('_', ' ')}
                      </span>
                    </div>
                    <h4 style={{ fontSize: 15, fontWeight: 700, color: 'var(--tx-1)', margin: '0 0 4px' }}>{int.name}</h4>
                    <p style={{ fontSize: 12, color: 'var(--tx-3)', margin: '0 0 20px', lineHeight: 1.5 }}>{int.desc}</p>
                    <button className={int.status === 'connected' ? "btn-ghost" : "btn-primary"} style={{ width: '100%' }}>
                      {int.status === 'connected' ? 'Configure' : 'Connect'}
                    </button>
                  </SettingsCard>
                ))}
              </div>
            </div>
          )}

          {/* SECURITY SECTION */}
          {activeTab === 'security' && (
            <div>
              <SectionHeader title="Security" description="Passwords, two-factor authentication, and session management." />
              
              <SettingsCard title="Change Password">
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase', marginBottom: 6 }}>Current Password</label>
                  <input className="input-field" type="password" />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase', marginBottom: 6 }}>New Password</label>
                    <input className="input-field" type="password" />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase', marginBottom: 6 }}>Confirm New Password</label>
                    <input className="input-field" type="password" />
                  </div>
                </div>
                <button className="btn-primary">Update Password</button>
              </SettingsCard>

              <SettingsCard title="Two-Factor Authentication">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ flex: 1, paddingRight: 40 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--tx-1)', marginBottom: 4 }}>Two-Factor Authentication (2FA)</div>
                    <p style={{ fontSize: 12, color: 'var(--tx-3)', margin: 0 }}>Protect your account with an extra layer of security via authenticator app.</p>
                  </div>
                  <button className="btn-ghost">Setup 2FA</button>
                </div>
              </SettingsCard>

              <SettingsCard title="Active Sessions" padding={0}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)' }}>
                      <th style={{ textAlign: 'left', padding: '12px 20px', fontSize: 11, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase' }}>Browser</th>
                      <th style={{ textAlign: 'left', padding: '12px 20px', fontSize: 11, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase' }}>Device</th>
                      <th style={{ textAlign: 'left', padding: '12px 20px', fontSize: 11, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase' }}>IP</th>
                      <th style={{ textAlign: 'right', padding: '12px 20px', fontSize: 11, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {MOCK_SESSIONS.map(session => (
                      <tr key={session.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '14px 20px' }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--tx-1)' }}>
                            {session.browser} {session.current && <span style={{ color: 'var(--green)', fontSize: 11, fontWeight: 700 }}>(Current)</span>}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--tx-3)' }}>{session.last_active}</div>
                        </td>
                        <td style={{ padding: '14px 20px', fontSize: 12, color: 'var(--tx-2)' }}>{session.platform}</td>
                        <td style={{ padding: '14px 20px', fontSize: 12, color: 'var(--tx-3)' }}>{session.ip}</td>
                        <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                          {!session.current && <button className="btn-ghost btn-sm">Sign Out</button>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)', textAlign: 'center' }}>
                  <button className="btn-ghost" style={{ fontSize: 12, color: 'var(--red)', borderColor: 'transparent' }} onClick={() => toast.info('Signed out from all other devices')}>
                    <LogOut size={14} style={{ marginRight: 6 }} /> Sign out all other devices
                  </button>
                </div>
              </SettingsCard>
            </div>
          )}

          {/* APPEARANCE SECTION */}
          {activeTab === 'appearance' && (
            <div>
              <SectionHeader title="Appearance" description="Customize how RED-OPS looks on your device." />
              
              <SettingsCard title="Visual Theme">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                  {[
                    { id: 'dark', label: 'Dark Mode', icon: Moon, desc: 'Operator-grade dark interface' },
                    { id: 'light', label: 'Light Mode', icon: Sun, desc: 'High-contrast light interface' },
                  ].map(theme => (
                    <div 
                      key={theme.id}
                      onClick={() => setAppearance({...appearance, theme: theme.id})}
                      style={{
                        padding: 16, borderRadius: 12, border: '1px solid',
                        borderColor: appearance.theme === theme.id ? 'var(--accent)' : 'var(--border)',
                        background: appearance.theme === theme.id ? 'var(--bg)' : 'var(--bg-card)',
                        cursor: 'pointer', transition: 'all 0.2s'
                      }}
                    >
                      <theme.icon size={20} style={{ color: appearance.theme === theme.id ? 'var(--accent)' : 'var(--tx-3)', marginBottom: 12 }} />
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--tx-1)', marginBottom: 2 }}>{theme.label}</div>
                      <div style={{ fontSize: 11, color: 'var(--tx-3)' }}>{theme.desc}</div>
                    </div>
                  ))}
                </div>
              </SettingsCard>

              <SettingsCard title="Accent Color">
                <div style={{ display: 'flex', gap: 12 }}>
                  {['red', 'blue', 'green', 'purple', 'orange'].map(c => {
                    const hex = { red: 'var(--red)', blue: '#3b82f6', green: '#22c55e', purple: '#8b5cf6', orange: '#f59e0b' }[c];
                    return (
                      <button
                        key={c}
                        onClick={() => setAppearance({...appearance, accent: c})}
                        style={{
                          width: 32, height: 32, borderRadius: '50%', background: hex, border: '2px solid',
                          borderColor: appearance.accent === c ? '#fff' : 'transparent',
                          boxShadow: appearance.accent === c ? '0 0 0 2px var(--border)' : 'none',
                          cursor: 'pointer', transition: 'all 0.2s'
                        }}
                      />
                    );
                  })}
                </div>
              </SettingsCard>

              <SettingsCard title="Interface">
                <ToggleRow label="Compact Mode" description="Reduce margins and padding to show more information." checked={appearance.compact} onChange={v => setAppearance({...appearance, compact: v})} />
                <div style={{ padding: '16px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--tx-1)', marginBottom: 2 }}>Sidebar Position</div>
                    <div style={{ fontSize: 12, color: 'var(--tx-3)' }}>Choose which side the main navigation appears on.</div>
                  </div>
                  <select className="input-field" style={{ width: 120, height: 32, fontSize: 12 }} value={appearance.sidebar} onChange={e => setAppearance({...appearance, sidebar: e.target.value})}>
                    <option value="left">Left</option>
                    <option value="right">Right</option>
                  </select>
                </div>
                <div style={{ padding: '16px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--tx-1)', marginBottom: 2 }}>Font Size</div>
                    <div style={{ fontSize: 12, color: 'var(--tx-3)' }}>Scale the typography for better readability.</div>
                  </div>
                  <select className="input-field" style={{ width: 120, height: 32, fontSize: 12 }} value={appearance.font} onChange={e => setAppearance({...appearance, font: e.target.value})}>
                    <option value="compact">Compact</option>
                    <option value="normal">Normal</option>
                    <option value="large">Large</option>
                  </select>
                </div>
              </SettingsCard>

              <button className="btn-primary" onClick={handleSave}>Save Appearance</button>
            </div>
          )}

        </div>
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div className="interaction-card" style={{ width: '100%', maxWidth: 460, padding: 32, animation: 'scaleIn 0.2s ease' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--tx-1)', margin: 0 }}>Invite Team Member</h2>
              <button onClick={() => setShowInviteModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx-3)' }}>
                <X size={20} />
              </button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase', marginBottom: 6 }}>Full Name</label>
                <input className="input-field" placeholder="e.g. John Doe" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase', marginBottom: 6 }}>Email Address</label>
                <input className="input-field" type="email" placeholder="user@company.com" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase', marginBottom: 6 }}>Role</label>
                <select className="input-field">
                  <option>Administrator</option>
                  <option>Operator</option>
                  <option>Standard User</option>
                </select>
              </div>
              <div style={{ background: 'var(--bg)', padding: 16, borderRadius: 12, display: 'flex', gap: 12 }}>
                <Info size={16} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                <p style={{ margin: 0, fontSize: 12, color: 'var(--tx-3)', lineHeight: 1.5 }}>
                  The invited user will receive an email with instructions to set up their account and password.
                </p>
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
                <button className="btn-ghost" style={{ flex: 1 }} onClick={() => setShowInviteModal(false)}>Cancel</button>
                <button className="btn-primary" style={{ flex: 1 }} onClick={() => { toast.success('Invite sent!'); setShowInviteModal(false); }}>Send Invitation</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .interaction-card {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: 12px;
          transition: all 0.2s ease;
        }
        @keyframes scaleIn {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
