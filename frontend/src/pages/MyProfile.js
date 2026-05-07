import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Loader2, Save, User } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const tok = () => localStorage.getItem('token');
const ax = () => axios.create({ headers: { Authorization: `Bearer ${tok()}` } });

export default function MyProfile() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({
    display_name: '',
    skills: '',
    typical_turnaround_days: '',
    payment_method: '',
    timezone: '',
    portfolio_url: '',
    availability_state: 'available',
  });

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await ax().get(`${API}/my-profile`);
      setProfile(data);
      setForm({
        display_name: data.display_name || '',
        skills: (data.skills || []).join(', '),
        typical_turnaround_days: data.typical_turnaround_days ?? '',
        payment_method: data.payment_method || '',
        timezone: data.timezone || '',
        portfolio_url: data.portfolio_url || '',
        availability_state: data.availability_state || 'available',
      });
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to load profile');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  const handleSave = async () => {
    if (!form.display_name.trim()) {
      toast.error('Display name is required');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        display_name: form.display_name.trim(),
        skills: form.skills.split(',').map(s => s.trim()).filter(Boolean),
        typical_turnaround_days: form.typical_turnaround_days === '' ? null : Number(form.typical_turnaround_days),
        payment_method: form.payment_method || null,
        timezone: form.timezone || null,
        portfolio_url: form.portfolio_url || null,
        availability_state: form.availability_state,
      };
      await ax().patch(`${API}/my-profile`, payload);
      toast.success('Profile saved');
      fetchProfile();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save');
    } finally { setSaving(false); }
  };

  if (loading || !profile) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <Loader2 size={20} className="spin" style={{ color: 'var(--tx-3)' }} />
      </div>
    );
  }

  const lblStyle = { display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--tx-3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.04em' };
  const inpStyle = { width: '100%', padding: '8px 10px', fontSize: 13, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--tx-1)', outline: 'none', boxSizing: 'border-box' };

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)', padding: '24px 28px' }}>
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--tx-1)', margin: 0 }}>My Profile</h1>
        <p style={{ margin: '3px 0 0', fontSize: 13, color: 'var(--tx-3)' }}>Public-ish details visible to the team that assigns you briefs.</p>
      </div>

      <div className="card" style={{ padding: 24, maxWidth: 720 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22, paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
            <User size={20} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--tx-1)' }}>{profile.display_name}</h3>
            {profile.email && <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--tx-3)' }}>{profile.email}</p>}
          </div>
          <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 600 }}>Stats</div>
            <div style={{ fontSize: 12, color: 'var(--tx-2)', marginTop: 4 }}>
              <strong>{profile.total_briefs_completed ?? 0}</strong> done · <strong>{profile.current_open_briefs ?? 0}</strong> open
              {profile.avg_rating != null && <> · ★ <strong>{profile.avg_rating}</strong></>}
            </div>
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={lblStyle}>Display name *</label>
          <input style={inpStyle} value={form.display_name} onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))} />
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={lblStyle}>Skills (comma-separated)</label>
          <input style={inpStyle} value={form.skills} onChange={e => setForm(f => ({ ...f, skills: e.target.value }))} placeholder="video-editing, color, motion-graphics" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
          <div>
            <label style={lblStyle}>Typical turnaround (days)</label>
            <input style={inpStyle} type="number" min="0" value={form.typical_turnaround_days} onChange={e => setForm(f => ({ ...f, typical_turnaround_days: e.target.value }))} />
          </div>
          <div>
            <label style={lblStyle}>Timezone</label>
            <input style={inpStyle} value={form.timezone} onChange={e => setForm(f => ({ ...f, timezone: e.target.value }))} placeholder="America/Edmonton" />
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={lblStyle}>Payment method (Phase 1: text)</label>
          <input style={inpStyle} value={form.payment_method} onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))} placeholder="e.g. Wise email, PayPal, Stripe Connect link" />
        </div>

        <div style={{ marginBottom: 18 }}>
          <label style={lblStyle}>Portfolio URL</label>
          <input style={inpStyle} value={form.portfolio_url} onChange={e => setForm(f => ({ ...f, portfolio_url: e.target.value }))} placeholder="https://..." />
        </div>

        <div style={{ marginBottom: 22 }}>
          <label style={lblStyle}>Availability</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {['available', 'busy', 'unavailable'].map(opt => (
              <button key={opt} onClick={() => setForm(f => ({ ...f, availability_state: opt }))}
                style={{ flex: 1, padding: '10px 0', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', textTransform: 'capitalize',
                  background: form.availability_state === opt ? 'var(--accent)' : 'var(--bg-elevated)',
                  color: form.availability_state === opt ? '#fff' : 'var(--tx-2)',
                  border: '1px solid var(--border)' }}>
                {opt}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={handleSave} disabled={saving}
            style={{ padding: '10px 22px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', background: 'var(--accent)', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', gap: 6, opacity: saving ? 0.6 : 1 }}>
            {saving ? <Loader2 size={13} className="spin" /> : <Save size={13} />}
            Save profile
          </button>
        </div>
      </div>
    </div>
  );
}
