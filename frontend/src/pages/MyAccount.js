import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { User, Shield, Key, Camera, Mail, Phone, FileText, Save, Loader2, Users, Plus, X, CheckCircle2, UserX } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const labelStyle = { fontSize: 11, fontWeight: 600, color: 'var(--tx-3)', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' };

export default function MyAccount() {
  const { user, refreshUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('profile');
  const [avatarPreview, setAvatarPreview] = useState(null);
  const fileInputRef = useRef(null);

  const [profileData, setProfileData] = useState({ name: '', email: '', phone: '', bio: '' });
  const [passwordData, setPasswordData] = useState({ current_password: '', new_password: '', confirm_password: '' });

  useEffect(() => {
    if (user) {
      setProfileData({ name: user.name || '', email: user.email || '', phone: user.phone || '', bio: user.bio || '' });
      if (user.avatar) setAvatarPreview(user.avatar);
    }
  }, [user]);

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error('Image must be under 2MB'); return; }
    const reader = new FileReader();
    reader.onloadend = () => setAvatarPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = { name: profileData.name, email: profileData.email, bio: profileData.bio || '', phone: profileData.phone || '' };
      if (avatarPreview && avatarPreview !== user?.avatar) payload.avatar = avatarPreview;
      await axios.patch(`${API}/auth/profile`, payload, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      await refreshUser();
      toast.success('Profile updated');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update profile');
    } finally { setLoading(false); }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (passwordData.new_password !== passwordData.confirm_password) { toast.error('Passwords do not match'); return; }
    if (passwordData.new_password.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    setLoading(true);
    try {
      await axios.post(`${API}/auth/change-password`, {
        current_password: passwordData.current_password,
        new_password: passwordData.new_password,
      }, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      toast.success('Password changed');
      setPasswordData({ current_password: '', new_password: '', confirm_password: '' });
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to change password');
    } finally { setLoading(false); }
  };

  const getInitials = (name) => name ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'U';

  if (!user) return null;

  const isClient = user?.account_type === 'Media Client' || user?.role === 'Media Client';

  // Workspace state (client sub-users)
  const [teamMembers, setTeamMembers] = useState([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({ name: '', email: '' });
  const [inviting, setInviting] = useState(false);

  const fetchTeam = async () => {
    setTeamLoading(true);
    try {
      const r = await axios.get(`${API}/users/my-team`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      setTeamMembers(r.data || []);
    } catch { /* ignore for non-clients */ }
    finally { setTeamLoading(false); }
  };

  useEffect(() => { if (isClient && tab === 'workspace') fetchTeam(); }, [tab]); // eslint-disable-line

  const handleInvite = async (e) => {
    e.preventDefault();
    if (!inviteForm.name || !inviteForm.email) { toast.error('Name and email required'); return; }
    setInviting(true);
    try {
      await axios.post(`${API}/users/invite-sub-user`, inviteForm, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      toast.success(`Invite sent to ${inviteForm.email}`);
      setInviteForm({ name: '', email: '' });
      setShowInvite(false);
      fetchTeam();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to send invite');
    } finally { setInviting(false); }
  };

  const handleRevoke = async (memberId, memberName) => {
    if (!window.confirm(`Remove ${memberName} from your workspace? They will lose portal access.`)) return;
    try {
      await axios.delete(`${API}/users/${memberId}/revoke-access`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      toast.success(`${memberName} removed`);
      fetchTeam();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to revoke access');
    }
  };

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'security', label: 'Security', icon: Key },
    { id: 'account', label: 'Account', icon: Shield },
    ...(isClient ? [{ id: 'workspace', label: 'Workspace', icon: Users }] : []),
  ];

  return (
    <div className="page-content" style={{ maxWidth: 640, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--tx-1)', letterSpacing: '-.04em', marginBottom: 4 }}>My Account</h1>
        <p style={{ fontSize: 13, color: 'var(--tx-3)', margin: 0 }}>Manage your profile and security settings</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 24, borderBottom: '1px solid var(--border)' }}>
        {tabs.map(t => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', background: 'none', border: 'none', borderBottom: `2px solid ${active ? 'var(--red)' : 'transparent'}`, cursor: 'pointer', color: active ? 'var(--tx-1)' : 'var(--tx-3)', fontSize: 13, fontWeight: active ? 600 : 500, transition: 'all .12s', marginBottom: -1 }}>
              <Icon size={14} /> {t.label}
            </button>
          );
        })}
      </div>

      {/* Profile Tab */}
      {tab === 'profile' && (
        <form onSubmit={handleProfileUpdate}>
          <div className="card" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 4px', color: 'var(--tx-1)' }}>Profile Information</h3>
            <p style={{ fontSize: 12, color: 'var(--tx-3)', margin: '0 0 20px' }}>Update your personal details</p>

            {/* Avatar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
              <div style={{ position: 'relative' }}>
                {avatarPreview ? (
                  <img src={avatarPreview} alt="Profile" style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--border)' }} />
                ) : (
                  <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--red)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700, color: '#fff', border: '2px solid var(--border)' }}>
                    {getInitials(user.name)}
                  </div>
                )}
                <button type="button" onClick={() => fileInputRef.current?.click()}
                  style={{ position: 'absolute', bottom: -2, right: -2, width: 28, height: 28, borderRadius: '50%', background: 'var(--red)', border: '2px solid var(--bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff' }}>
                  <Camera size={12} />
                </button>
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--tx-1)' }}>{user.name}</div>
                <div style={{ fontSize: 12, color: 'var(--tx-3)' }}>{user.email}</div>
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarChange} style={{ display: 'none' }} />
            </div>

            {/* Fields */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={labelStyle}>Full Name</label>
                <input className="input-field" value={profileData.name} onChange={e => setProfileData(p => ({ ...p, name: e.target.value }))} placeholder="Your full name" />
              </div>
              <div>
                <label style={labelStyle}>Email Address</label>
                <input className="input-field" type="email" value={profileData.email} onChange={e => setProfileData(p => ({ ...p, email: e.target.value }))} placeholder="your@email.com" />
              </div>
              <div>
                <label style={labelStyle}>Phone Number</label>
                <input className="input-field" type="tel" value={profileData.phone} onChange={e => setProfileData(p => ({ ...p, phone: e.target.value }))} placeholder="+1 (555) 000-0000" />
              </div>
              <div>
                <label style={labelStyle}>Bio</label>
                <textarea className="input-field" rows={3} maxLength={300} value={profileData.bio} onChange={e => setProfileData(p => ({ ...p, bio: e.target.value }))} placeholder="Tell us a bit about yourself..." />
                <div style={{ fontSize: 11, color: 'var(--tx-3)', textAlign: 'right', marginTop: 4 }}>{(profileData.bio || '').length}/300</div>
              </div>
              <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%', justifyContent: 'center', gap: 6 }}>
                {loading ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Saving...</> : <><Save size={13} /> Save Changes</>}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Security Tab */}
      {tab === 'security' && (
        <form onSubmit={handlePasswordChange}>
          <div className="card" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 4px', color: 'var(--tx-1)' }}>Change Password</h3>
            <p style={{ fontSize: 12, color: 'var(--tx-3)', margin: '0 0 20px' }}>Keep your account secure with a strong password</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={labelStyle}>Current Password</label>
                <input className="input-field" type="password" value={passwordData.current_password} onChange={e => setPasswordData(p => ({ ...p, current_password: e.target.value }))} placeholder="••••••••" />
              </div>
              <div>
                <label style={labelStyle}>New Password</label>
                <input className="input-field" type="password" value={passwordData.new_password} onChange={e => setPasswordData(p => ({ ...p, new_password: e.target.value }))} placeholder="Min 8 characters" />
              </div>
              <div>
                <label style={labelStyle}>Confirm New Password</label>
                <input className="input-field" type="password" value={passwordData.confirm_password} onChange={e => setPasswordData(p => ({ ...p, confirm_password: e.target.value }))} placeholder="Repeat new password" />
              </div>
              <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%', justifyContent: 'center', gap: 6 }}>
                {loading ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Updating...</> : <><Key size={13} /> Update Password</>}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Account Tab */}
      {tab === 'account' && (
        <div className="card" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 4px', color: 'var(--tx-1)' }}>Account Details</h3>
          <p style={{ fontSize: 12, color: 'var(--tx-3)', margin: '0 0 20px' }}>Your account type and information</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { label: 'Name', value: user.name || '—' },
              { label: 'Email', value: user.email || '—' },
              { label: 'Role', value: user.role || '—' },
              { label: 'Account Type', value: user.account_type || '—' },
              ...(user.subscription_plan_name ? [{ label: 'Plan', value: user.subscription_plan_name }] : []),
              ...(user.specialty ? [{ label: 'Specialty', value: user.specialty }] : []),
              ...(user.team ? [{ label: 'Team', value: user.team }] : []),
            ].map(row => (
              <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 13, color: 'var(--tx-3)' }}>{row.label}</span>
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--tx-1)' }}>{row.value}</span>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 20, padding: '10px 12px', background: 'var(--bg-elevated)', borderRadius: 8, fontSize: 11, color: 'var(--tx-3)' }}>
            Account ID: <span style={{ fontFamily: 'monospace' }}>{user.id}</span>
          </div>
        </div>
      )}

      {/* ── Workspace Tab (Media Clients only) ── */}
      {tab === 'workspace' && isClient && (
        <div>
          <div className="card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 4px', color: 'var(--tx-1)' }}>Team Members</h3>
                <p style={{ fontSize: 12, color: 'var(--tx-3)', margin: 0 }}>Manage who has access to your workspace</p>
              </div>
              <button onClick={() => setShowInvite(true)} className="btn-primary btn-sm" style={{ gap: 5 }}>
                <Plus size={13} /> Invite Member
              </button>
            </div>

            {teamLoading ? (
              <div style={{ textAlign: 'center', padding: 32 }}><Loader2 size={20} className="spin" style={{ color: 'var(--tx-3)' }} /></div>
            ) : teamMembers.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 16px' }}>
                <Users size={28} style={{ color: 'var(--tx-3)', opacity: 0.4, marginBottom: 8 }} />
                <p style={{ fontSize: 13, color: 'var(--tx-3)', margin: 0 }}>No team members yet. Invite someone to collaborate.</p>
              </div>
            ) : (
              <div style={{ overflow: 'hidden', borderRadius: 8, border: '1px solid var(--border)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <th style={{ padding: '8px 12px', fontSize: 11, fontWeight: 600, color: 'var(--tx-3)', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '.05em' }}>Name</th>
                      <th style={{ padding: '8px 12px', fontSize: 11, fontWeight: 600, color: 'var(--tx-3)', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '.05em' }}>Email</th>
                      <th style={{ padding: '8px 12px', fontSize: 11, fontWeight: 600, color: 'var(--tx-3)', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '.05em' }}>Status</th>
                      <th style={{ padding: '8px 12px', fontSize: 11, fontWeight: 600, color: 'var(--tx-3)', textAlign: 'right', textTransform: 'uppercase', letterSpacing: '.05em' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teamMembers.map(m => (
                      <tr key={m.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 500, color: 'var(--tx-1)' }}>{m.name}</td>
                        <td style={{ padding: '10px 12px', fontSize: 13, color: 'var(--tx-2)' }}>{m.email}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          <span className={`pill ${m.active !== false ? 'pill-green' : 'pill-red'}`}>
                            {m.active !== false ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                          {m.active !== false && (
                            <button onClick={() => handleRevoke(m.id, m.name)} className="btn-ghost btn-xs" style={{ color: '#ef4444', borderColor: '#ef444440', gap: 4 }}>
                              <UserX size={11} /> Revoke
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Invite Modal */}
          {showInvite && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 12, padding: 24, width: 400, maxWidth: '90%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--tx-1)' }}>Invite Team Member</h3>
                  <button onClick={() => setShowInvite(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx-3)', padding: 4 }}><X size={18} /></button>
                </div>
                <form onSubmit={handleInvite} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--tx-2)', display: 'block', marginBottom: 4 }}>Full Name</label>
                    <input className="input-field" value={inviteForm.name} onChange={e => setInviteForm(p => ({ ...p, name: e.target.value }))} placeholder="Jane Smith" />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--tx-2)', display: 'block', marginBottom: 4 }}>Email Address</label>
                    <input className="input-field" type="email" value={inviteForm.email} onChange={e => setInviteForm(p => ({ ...p, email: e.target.value }))} placeholder="jane@example.com" />
                  </div>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8 }}>
                    <button type="button" onClick={() => setShowInvite(false)} className="btn-ghost">Cancel</button>
                    <button type="submit" className="btn-primary" disabled={inviting} style={{ gap: 5 }}>
                      {inviting ? <Loader2 size={14} className="spin" /> : <CheckCircle2 size={14} />}
                      {inviting ? 'Sending...' : 'Send Invite'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
