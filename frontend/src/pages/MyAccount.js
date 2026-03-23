import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { User, Shield, Key, Camera, Mail, Phone, FileText, Save, Loader2 } from 'lucide-react';

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

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'security', label: 'Security', icon: Key },
    { id: 'account', label: 'Account', icon: Shield },
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
    </div>
  );
}
