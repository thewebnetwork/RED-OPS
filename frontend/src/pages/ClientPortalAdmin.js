import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Users, Edit3, Plus, Trash2, Save, Calendar, User, TrendingUp } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const tok = () => localStorage.getItem('token');
const headers = () => ({ Authorization: `Bearer ${tok()}`, 'Content-Type': 'application/json' });

export default function ClientPortalAdmin() {
  const [clients, setClients] = useState([]);
  const [selected, setSelected] = useState(null);
  const [portalData, setPortalData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    status_phase: 'onboarding',
    status_message: '',
    launched_at: '',
    appointments_this_week: 0,
    appointments_this_month: 0,
    appointments_total: 0,
  });
  const [appointments, setAppointments] = useState([]);
  const [newAppt, setNewAppt] = useState({ appointment_date: '', lead_name: '', lead_type: 'buyer', notes: '' });

  const fetchClients = useCallback(async () => {
    try {
      const res = await fetch(`${API}/client-portal/clients`, { headers: headers() });
      if (res.ok) setClients(await res.json());
    } catch (e) { toast.error('Failed to load clients'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchClients(); }, [fetchClients]);

  const selectClient = async (client) => {
    setSelected(client);
    if (!client.has_portal_data) {
      setPortalData(null);
      setForm({ status_phase: 'onboarding', status_message: '', launched_at: '', appointments_this_week: 0, appointments_this_month: 0, appointments_total: 0 });
      setAppointments([]);
      return;
    }
    try {
      const res = await fetch(`${API}/client-portal/data/${client.id}`, { headers: headers() });
      if (res.ok) {
        const d = await res.json();
        setPortalData(d);
        setForm({
          status_phase: d.status_phase || 'onboarding',
          status_message: d.status_message || '',
          launched_at: d.launched_at ? d.launched_at.split('T')[0] : '',
          appointments_this_week: d.performance?.appointments_this_week || 0,
          appointments_this_month: d.performance?.appointments_this_month || 0,
          appointments_total: d.performance?.appointments_total || 0,
        });
        setAppointments(d.upcoming_appointments || []);
      }
    } catch (e) { toast.error('Failed to load portal data'); }
  };

  const createPortalData = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API}/client-portal/data`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ user_id: selected.id, status_phase: 'onboarding', status_message: 'Portal data created.' }),
      });
      if (res.ok) {
        toast.success('Portal data created');
        await fetchClients();
        const updated = { ...selected, has_portal_data: true };
        setSelected(updated);
        await selectClient(updated);
      } else {
        const err = await res.json();
        toast.error(err.detail || err.error?.message || 'Failed to create');
      }
    } catch (e) { toast.error('Failed to create portal data'); }
    finally { setSaving(false); }
  };

  const savePortalData = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API}/client-portal/data/${selected.id}`, {
        method: 'PATCH',
        headers: headers(),
        body: JSON.stringify({
          status_phase: form.status_phase,
          status_message: form.status_message,
          launched_at: form.launched_at || null,
          performance: {
            appointments_this_week: parseInt(form.appointments_this_week) || 0,
            appointments_this_month: parseInt(form.appointments_this_month) || 0,
            appointments_total: parseInt(form.appointments_total) || 0,
          },
          upcoming_appointments: appointments,
        }),
      });
      if (res.ok) {
        const d = await res.json();
        setPortalData(d);
        toast.success('Saved');
      } else {
        const err = await res.json();
        toast.error(err.detail || err.error?.message || 'Failed to save');
      }
    } catch (e) { toast.error('Failed to save'); }
    finally { setSaving(false); }
  };

  const addAppointment = () => {
    if (!newAppt.appointment_date || !newAppt.lead_name) { toast.error('Date and lead name required'); return; }
    setAppointments([...appointments, { ...newAppt }]);
    setNewAppt({ appointment_date: '', lead_name: '', lead_type: 'buyer', notes: '' });
  };

  const removeAppointment = (idx) => setAppointments(appointments.filter((_, i) => i !== idx));

  if (loading) return <div style={{ padding: '2rem', color: 'var(--tx-2)' }}>Loading clients...</div>;

  return (
    <div style={{ padding: '1.5rem', maxWidth: 1200 }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--tx-1)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: 8 }}>
        <Users size={24} /> Client Portal Admin
      </h1>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '1.5rem', alignItems: 'start' }}>
        {/* Client list */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)', fontSize: '0.8rem', color: 'var(--tx-2)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Media Clients ({clients.length})
          </div>
          {clients.map(c => (
            <div key={c.id} onClick={() => selectClient(c)} style={{
              padding: '0.75rem 1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
              borderBottom: '1px solid var(--border)',
              background: selected?.id === c.id ? 'var(--bg-elevated)' : 'transparent',
            }}>
              <User size={16} style={{ color: 'var(--tx-3)' }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.875rem', color: 'var(--tx-1)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--tx-3)' }}>{c.email}</div>
              </div>
              <span style={{
                fontSize: '0.65rem', padding: '2px 6px', borderRadius: 4, fontWeight: 600,
                background: c.has_portal_data ? 'var(--green)' : 'var(--border)',
                color: c.has_portal_data ? '#fff' : 'var(--tx-3)',
              }}>
                {c.has_portal_data ? 'ACTIVE' : 'NONE'}
              </span>
            </div>
          ))}
          {clients.length === 0 && <div style={{ padding: '1rem', color: 'var(--tx-3)', fontSize: '0.875rem' }}>No Media Client users found.</div>}
        </div>

        {/* Editor */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '1.25rem' }}>
          {!selected ? (
            <div style={{ color: 'var(--tx-3)', textAlign: 'center', padding: '3rem 0' }}>Select a client to manage their portal data.</div>
          ) : !selected.has_portal_data ? (
            <div style={{ textAlign: 'center', padding: '3rem 0' }}>
              <p style={{ color: 'var(--tx-2)', marginBottom: '1rem' }}>No portal data for <strong style={{ color: 'var(--tx-1)' }}>{selected.name}</strong>.</p>
              <button onClick={createPortalData} disabled={saving} style={{
                background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, padding: '0.6rem 1.5rem',
                cursor: 'pointer', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6,
              }}>
                <Plus size={16} /> Create Portal Data
              </button>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--tx-1)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Edit3 size={18} /> {selected.name}
                </h2>
                <button onClick={savePortalData} disabled={saving} style={{
                  background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, padding: '0.5rem 1.2rem',
                  cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem',
                }}>
                  <Save size={14} /> {saving ? 'Saving...' : 'Save'}
                </button>
              </div>

              {/* Status */}
              <fieldset style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '1rem', marginBottom: '1rem' }}>
                <legend style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--tx-2)', textTransform: 'uppercase', padding: '0 0.5rem' }}>Status</legend>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={labelStyle}>Phase</label>
                    <select value={form.status_phase} onChange={e => setForm({ ...form, status_phase: e.target.value })} style={inputStyle}>
                      <option value="onboarding">Onboarding</option>
                      <option value="active">Active</option>
                      <option value="renewing">Renewing</option>
                      <option value="offboarded">Offboarded</option>
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Launched At</label>
                    <input type="date" value={form.launched_at} onChange={e => setForm({ ...form, launched_at: e.target.value })} style={inputStyle} />
                  </div>
                </div>
                <div style={{ marginTop: '0.75rem' }}>
                  <label style={labelStyle}>Status Message (shown to client)</label>
                  <input value={form.status_message} onChange={e => setForm({ ...form, status_message: e.target.value })} placeholder="e.g. Onboarding week 1 — account setup in progress." style={inputStyle} />
                </div>
                {portalData?.days_since_launch != null && (
                  <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--tx-3)' }}>
                    Days since launch: <strong style={{ color: 'var(--tx-1)' }}>{portalData.days_since_launch}</strong>
                  </div>
                )}
              </fieldset>

              {/* Performance */}
              <fieldset style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '1rem', marginBottom: '1rem' }}>
                <legend style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--tx-2)', textTransform: 'uppercase', padding: '0 0.5rem' }}>
                  <TrendingUp size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />Performance
                </legend>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={labelStyle}>This Week</label>
                    <input type="number" min={0} value={form.appointments_this_week} onChange={e => setForm({ ...form, appointments_this_week: e.target.value })} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>This Month</label>
                    <input type="number" min={0} value={form.appointments_this_month} onChange={e => setForm({ ...form, appointments_this_month: e.target.value })} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Total</label>
                    <input type="number" min={0} value={form.appointments_total} onChange={e => setForm({ ...form, appointments_total: e.target.value })} style={inputStyle} />
                  </div>
                </div>
              </fieldset>

              {/* Upcoming Appointments */}
              <fieldset style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '1rem' }}>
                <legend style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--tx-2)', textTransform: 'uppercase', padding: '0 0.5rem' }}>
                  <Calendar size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />Upcoming Appointments
                </legend>
                {appointments.map((a, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0.4rem 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--tx-2)', minWidth: 90 }}>{a.appointment_date?.split('T')[0]}</span>
                    <span style={{ fontSize: '0.85rem', color: 'var(--tx-1)', flex: 1 }}>{a.lead_name}</span>
                    <span style={{ fontSize: '0.7rem', padding: '1px 6px', borderRadius: 4, background: a.lead_type === 'seller' ? '#a855f715' : '#3b82f615', color: a.lead_type === 'seller' ? '#a855f7' : '#3b82f6' }}>{a.lead_type}</span>
                    <button onClick={() => removeAppointment(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx-3)' }}><Trash2 size={14} /></button>
                  </div>
                ))}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto auto', gap: 6, marginTop: '0.75rem', alignItems: 'end' }}>
                  <div>
                    <label style={labelStyle}>Date</label>
                    <input type="date" value={newAppt.appointment_date} onChange={e => setNewAppt({ ...newAppt, appointment_date: e.target.value })} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Lead Name</label>
                    <input value={newAppt.lead_name} onChange={e => setNewAppt({ ...newAppt, lead_name: e.target.value })} placeholder="Name" style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Type</label>
                    <select value={newAppt.lead_type} onChange={e => setNewAppt({ ...newAppt, lead_type: e.target.value })} style={inputStyle}>
                      <option value="buyer">Buyer</option>
                      <option value="seller">Seller</option>
                    </select>
                  </div>
                  <button onClick={addAppointment} style={{
                    background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 6, padding: '0.45rem 0.75rem',
                    cursor: 'pointer', color: 'var(--tx-1)', fontSize: '0.8rem', fontWeight: 600, marginBottom: 1,
                  }}>
                    <Plus size={14} />
                  </button>
                </div>
              </fieldset>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const labelStyle = { display: 'block', fontSize: '0.7rem', fontWeight: 600, color: 'var(--tx-3)', marginBottom: 3, textTransform: 'uppercase' };
const inputStyle = { width: '100%', padding: '0.45rem 0.6rem', fontSize: '0.85rem', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--tx-1)', outline: 'none' };
