/**
 * Client Onboarding Checklists — Admin View
 *
 * Table of all clients with onboarding progress.
 * Click a client to see the full checklist with toggleable steps.
 */
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import axios from 'axios';
import {
  ClipboardCheck, CheckCircle2, Circle, Clock, X, Loader2, ChevronRight, AlertCircle,
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const tok = () => localStorage.getItem('token');
const ax = () => axios.create({ headers: { Authorization: `Bearer ${tok()}` } });

function ProgressBar({ pct }) {
  const color = pct >= 100 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#ef4444';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 5, background: 'var(--bg-elevated)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3, transition: 'width .3s' }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 600, color, minWidth: 32, textAlign: 'right' }}>{pct}%</span>
    </div>
  );
}

function ChecklistDetail({ checklist, onClose, onStepToggle }) {
  if (!checklist) return null;
  const steps = checklist.steps || [];

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 99 }} />
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 480,
        background: 'var(--card)', borderLeft: '1px solid var(--border)', zIndex: 100,
        display: 'flex', flexDirection: 'column',
        animation: 'slideRight .15s ease both', boxShadow: '-8px 0 30px rgba(0,0,0,.2)',
      }}>
        {/* Header */}
        <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Onboarding Checklist</span>
            <button onClick={onClose} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 5, cursor: 'pointer', color: 'var(--tx-3)', padding: '3px 6px', display: 'flex' }}>
              <X size={13} />
            </button>
          </div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--tx-1)', margin: 0 }}>{checklist.client_name}</h3>
          <div style={{ marginTop: 10 }}>
            <ProgressBar pct={checklist.completion_pct || 0} />
          </div>
          <div style={{ fontSize: 11, color: 'var(--tx-3)', marginTop: 6 }}>
            {checklist.completed_steps}/{checklist.total_steps} steps completed
            {checklist.status === 'completed' && <span style={{ color: '#22c55e', fontWeight: 600, marginLeft: 8 }}>Complete</span>}
          </div>
        </div>

        {/* Steps */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {steps.map((step, idx) => {
            const isDone = step.completed;
            const isOverdue = !isDone && idx < 3 && checklist.completion_pct < 50;
            return (
              <div key={step.id} style={{
                display: 'flex', gap: 12, padding: '12px 0',
                borderBottom: idx < steps.length - 1 ? '1px solid var(--border)' : 'none',
              }}>
                <button
                  onClick={() => onStepToggle(checklist.id, step.id, !isDone)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0, color: isDone ? '#22c55e' : isOverdue ? '#ef4444' : 'var(--tx-3)' }}
                >
                  {isDone ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                </button>
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontSize: 13, fontWeight: 500,
                    color: isDone ? 'var(--tx-3)' : 'var(--tx-1)',
                    textDecoration: isDone ? 'line-through' : 'none',
                  }}>
                    {step.title}
                    {isOverdue && <AlertCircle size={12} style={{ color: '#ef4444', marginLeft: 6, verticalAlign: 'middle' }} />}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--tx-3)', marginTop: 2 }}>{step.description}</div>
                  {isDone && step.completed_by && (
                    <div style={{ fontSize: 10, color: 'var(--tx-3)', marginTop: 4 }}>
                      Completed by {step.completed_by} {step.completed_at ? `on ${new Date(step.completed_at).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}` : ''}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

export default function Onboarding() {
  const [checklists, setChecklists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  const fetchChecklists = async () => {
    try {
      const res = await ax().get(`${API}/onboarding`);
      setChecklists(res.data || []);
    } catch (err) {
      console.error('Failed to fetch onboarding checklists:', err);
      toast.error('Failed to load onboarding data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchChecklists(); }, []);

  const handleStepToggle = async (checklistId, stepId, completed) => {
    try {
      await ax().patch(`${API}/onboarding/${checklistId}/step/${stepId}`, { completed });
      // Refresh the list and update selected
      const res = await ax().get(`${API}/onboarding`);
      const updated = res.data || [];
      setChecklists(updated);
      if (selected) {
        setSelected(updated.find(c => c.id === selected.id) || null);
      }
    } catch (err) {
      toast.error('Failed to update step');
    }
  };

  if (loading) {
    return (
      <div className="page-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
        <Loader2 size={24} className="spin" style={{ color: 'var(--tx-3)' }} />
      </div>
    );
  }

  return (
    <div className="page-content">
      {/* Header */}
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <ClipboardCheck size={24} style={{ color: 'var(--red)' }} />
            <h1 style={{ fontSize: 20, fontWeight: 700 }}>Client Onboarding</h1>
          </div>
          <p style={{ fontSize: 13, color: 'var(--tx-2)' }}>Track new client setup progress</p>
        </div>
      </div>

      {checklists.length === 0 ? (
        <div className="card" style={{ padding: '48px 20px', textAlign: 'center', marginTop: 20 }}>
          <ClipboardCheck size={40} style={{ color: 'var(--tx-3)', marginBottom: 10 }} />
          <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--tx-1)', marginBottom: 4 }}>No onboarding checklists yet</h3>
          <p style={{ fontSize: 13, color: 'var(--tx-3)' }}>Checklists are automatically created when new client accounts are added.</p>
        </div>
      ) : (
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', marginTop: 16 }}>
          <table className="data-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Client</th>
                <th>Progress</th>
                <th>Status</th>
                <th>Created</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {checklists.map(cl => {
                const pct = cl.completion_pct || 0;
                const isComplete = cl.status === 'completed';
                return (
                  <tr key={cl.id} onClick={() => setSelected(cl)} style={{ cursor: 'pointer' }}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 30, height: 30, borderRadius: 7, background: 'var(--red-bg, #c92a3e18)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: 'var(--red)', flexShrink: 0 }}>
                          {cl.client_name?.charAt(0) || '?'}
                        </div>
                        <span style={{ fontWeight: 600, fontSize: 13 }}>{cl.client_name}</span>
                      </div>
                    </td>
                    <td style={{ width: 180 }}>
                      <ProgressBar pct={pct} />
                    </td>
                    <td>
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4,
                        background: isComplete ? '#22c55e18' : '#f59e0b18',
                        color: isComplete ? '#22c55e' : '#f59e0b',
                      }}>
                        {isComplete ? 'Complete' : `${cl.completed_steps}/${cl.total_steps}`}
                      </span>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--tx-3)' }}>
                      {cl.created_at ? new Date(cl.created_at).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <ChevronRight size={14} style={{ color: 'var(--tx-3)' }} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail Drawer */}
      {selected && (
        <ChecklistDetail
          checklist={selected}
          onClose={() => setSelected(null)}
          onStepToggle={handleStepToggle}
        />
      )}
    </div>
  );
}
