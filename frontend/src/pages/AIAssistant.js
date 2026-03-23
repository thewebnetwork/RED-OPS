import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Sparkles, FileText, BarChart2, Users, Clock, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const headers = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });

/* Quick actions the AI assistant can run */
const ACTIONS = [
  { id: 'overdue', icon: AlertTriangle, color: '#ef4444', label: 'Overdue Tasks', desc: 'Find tasks past their due date' },
  { id: 'workload', icon: Users, color: '#3b82f6', label: 'Team Workload', desc: 'See who has capacity right now' },
  { id: 'recent', icon: Clock, color: '#f59e0b', label: 'Recent Activity', desc: 'Last 24 hours across the platform' },
  { id: 'summary', icon: BarChart2, color: '#22c55e', label: 'Quick Summary', desc: 'Key numbers at a glance' },
];

export default function AIAssistant() {
  const [activeAction, setActiveAction] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const runAction = async (actionId) => {
    setActiveAction(actionId);
    setLoading(true);
    setResult(null);

    try {
      if (actionId === 'overdue') {
        const res = await axios.get(`${API}/tasks?status=in_progress`, headers());
        const tasks = res.data?.tasks || res.data || [];
        const now = new Date();
        const overdue = tasks.filter(t => t.due_date && new Date(t.due_date) < now);
        setResult({
          title: 'Overdue Tasks',
          count: overdue.length,
          items: overdue.slice(0, 10).map(t => ({
            label: t.title || t.name,
            detail: `Due ${new Date(t.due_date).toLocaleDateString()}`,
            status: 'overdue'
          })),
          empty: 'No overdue tasks — you\'re on track.'
        });
      }

      if (actionId === 'workload') {
        const [usersRes, tasksRes] = await Promise.all([
          axios.get(`${API}/users`, headers()),
          axios.get(`${API}/tasks`, headers()),
        ]);
        const users = usersRes.data || [];
        const tasks = tasksRes.data?.tasks || tasksRes.data || [];
        const activeTasks = tasks.filter(t => t.status !== 'completed' && t.status !== 'cancelled');
        const workload = users.filter(u => u.active !== false).map(u => {
          const count = activeTasks.filter(t => t.assigned_to === u.id).length;
          return { label: u.name, detail: `${count} active task${count !== 1 ? 's' : ''}`, count };
        }).sort((a, b) => b.count - a.count);
        setResult({
          title: 'Team Workload',
          count: workload.length,
          items: workload,
          empty: 'No team members found.'
        });
      }

      if (actionId === 'recent') {
        const res = await axios.get(`${API}/tasks?sort=-created_at&limit=10`, headers());
        const tasks = res.data?.tasks || res.data || [];
        const recent = tasks.slice(0, 10);
        setResult({
          title: 'Recent Activity',
          count: recent.length,
          items: recent.map(t => ({
            label: t.title || t.name || 'Untitled task',
            detail: `${t.status} · Created ${new Date(t.created_at).toLocaleDateString()}`
          })),
          empty: 'No recent activity yet.'
        });
      }

      if (actionId === 'summary') {
        const [tasksRes, usersRes] = await Promise.all([
          axios.get(`${API}/tasks`, headers()),
          axios.get(`${API}/users`, headers()),
        ]);
        const tasks = tasksRes.data?.tasks || tasksRes.data || [];
        const users = usersRes.data || [];
        const completed = tasks.filter(t => t.status === 'completed').length;
        const inProgress = tasks.filter(t => t.status === 'in_progress').length;
        const pending = tasks.filter(t => t.status === 'pending' || t.status === 'open').length;
        const activeUsers = users.filter(u => u.active !== false).length;

        setResult({
          title: 'Platform Summary',
          stats: [
            { label: 'Total Tasks', value: tasks.length, icon: FileText },
            { label: 'In Progress', value: inProgress, icon: Clock },
            { label: 'Completed', value: completed, icon: CheckCircle },
            { label: 'Pending', value: pending, icon: AlertTriangle },
            { label: 'Active Users', value: activeUsers, icon: Users },
          ]
        });
      }
    } catch (err) {
      toast.error('Failed to load data');
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)', padding: '32px 28px' }}>

      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg,#c92a3e,#a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Sparkles size={20} color="#fff" />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--tx-1)', margin: 0 }}>AI Assistant</h1>
        </div>
        <p style={{ fontSize: 14, color: 'var(--tx-2)', margin: 0 }}>
          Quick insights from your Red Ops data. Click an action to get started.
        </p>
      </div>

      {/* Action cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14, marginBottom: 32 }}>
        {ACTIONS.map(({ id, icon: Icon, color, label, desc }) => (
          <button
            key={id}
            onClick={() => runAction(id)}
            style={{
              background: activeAction === id ? `${color}15` : 'var(--card)',
              border: `1px solid ${activeAction === id ? color : 'var(--border)'}`,
              borderRadius: 12,
              padding: '18px 16px',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.2s',
            }}
          >
            <div style={{ width: 36, height: 36, borderRadius: 9, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
              <Icon size={18} color={color} />
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--tx-1)', marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 12, color: 'var(--tx-3)', lineHeight: 1.4 }}>{desc}</div>
          </button>
        ))}
      </div>

      {/* Results area */}
      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 32, justifyContent: 'center', color: 'var(--tx-3)' }}>
          <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
          <span>Analyzing...</span>
        </div>
      )}

      {result && !loading && (
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: '24px 20px' }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--tx-1)', margin: '0 0 16px' }}>{result.title}</h2>

          {/* Stats view (for summary) */}
          {result.stats && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12 }}>
              {result.stats.map(({ label, value, icon: SIcon }) => (
                <div key={label} style={{ background: 'var(--bg)', borderRadius: 10, padding: '16px 14px', border: '1px solid var(--border)' }}>
                  <SIcon size={16} color="var(--tx-3)" style={{ marginBottom: 6 }} />
                  <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--tx-1)' }}>{value}</div>
                  <div style={{ fontSize: 12, color: 'var(--tx-3)', marginTop: 2 }}>{label}</div>
                </div>
              ))}
            </div>
          )}

          {/* List view */}
          {result.items && result.items.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {result.items.map((item, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 14, color: 'var(--tx-1)', fontWeight: 500 }}>{item.label}</span>
                  <span style={{ fontSize: 12, color: item.status === 'overdue' ? 'var(--red)' : 'var(--tx-3)' }}>{item.detail}</span>
                </div>
              ))}
            </div>
          )}

          {/* Empty state */}
          {result.items && result.items.length === 0 && result.empty && (
            <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--tx-3)', fontSize: 14 }}>
              <CheckCircle size={24} style={{ marginBottom: 8, opacity: 0.5 }} />
              <p style={{ margin: 0 }}>{result.empty}</p>
            </div>
          )}
        </div>
      )}

      {/* Empty state before any action */}
      {!result && !loading && (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--tx-3)' }}>
          <Sparkles size={32} style={{ opacity: 0.3, marginBottom: 12 }} />
          <p style={{ fontSize: 14, margin: 0 }}>Select an action above to get instant insights</p>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
