import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Sparkles, FileText, BarChart2, Users, Clock, AlertTriangle, CheckCircle, Loader2, Send, MessageSquare, Wand2 } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const headers = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });

/* Quick actions */
const ACTIONS = [
  { id: 'chat', icon: MessageSquare, color: '#a855f7', label: 'AI Chat', desc: 'Ask anything about your work' },
  { id: 'brief', icon: Wand2, color: '#3b82f6', label: 'Generate Brief', desc: 'AI creative brief from an order' },
  { id: 'overdue', icon: AlertTriangle, color: '#ef4444', label: 'Overdue Tasks', desc: 'Find tasks past their due date' },
  { id: 'workload', icon: Users, color: '#3b82f6', label: 'Team Workload', desc: 'See who has capacity right now' },
  { id: 'recent', icon: Clock, color: '#f59e0b', label: 'Recent Activity', desc: 'Last 24 hours across the platform' },
  { id: 'summary', icon: BarChart2, color: '#22c55e', label: 'Quick Summary', desc: 'Key numbers at a glance' },
];

export default function AIAssistant() {
  const [activeAction, setActiveAction] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  // Chat state
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const chatEndRef = useRef(null);

  // Brief state
  const [briefOrderId, setBriefOrderId] = useState('');
  const [briefResult, setBriefResult] = useState(null);
  const [briefLoading, setBriefLoading] = useState(false);
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleChat = async () => {
    if (!chatInput.trim() || streaming) return;

    const userMsg = { role: 'user', content: chatInput };
    const updatedMessages = [...chatMessages, userMsg];
    setChatMessages(updatedMessages);
    setChatInput('');
    setStreaming(true);

    try {
      const res = await fetch(`${API}/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ messages: updatedMessages }),
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let content = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);
          if (data === '[DONE]') break;
          try {
            const parsed = JSON.parse(data);
            if (parsed.error) { toast.error(parsed.error); break; }
            if (parsed.content) {
              content += parsed.content;
              setChatMessages(prev => {
                const msgs = [...prev];
                if (msgs[msgs.length - 1]?.role === 'assistant') {
                  msgs[msgs.length - 1] = { role: 'assistant', content };
                } else {
                  msgs.push({ role: 'assistant', content });
                }
                return msgs;
              });
            }
          } catch { /* ignore parse errors */ }
        }
      }
    } catch (err) {
      toast.error('Chat failed — is OpenAI connected in Integrations?');
    } finally {
      setStreaming(false);
    }
  };

  const handleBrief = async () => {
    if (!briefOrderId) { toast.error('Select an order first'); return; }
    setBriefLoading(true);
    setBriefResult(null);
    try {
      const res = await axios.post(`${API}/ai/generate-brief`, { order_id: briefOrderId }, headers());
      setBriefResult(res.data.brief);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Brief generation failed');
    } finally { setBriefLoading(false); }
  };

  const runAction = async (actionId) => {
    setActiveAction(actionId);

    if (actionId === 'chat' || actionId === 'brief') {
      setResult(null);
      if (actionId === 'brief' && orders.length === 0) {
        try {
          const res = await axios.get(`${API}/orders?limit=20&sort=-created_at`, headers());
          setOrders(res.data?.orders || res.data || []);
        } catch { /* ignore */ }
      }
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      if (actionId === 'overdue') {
        const res = await axios.get(`${API}/tasks?status=in_progress`, headers());
        const tasks = res.data?.tasks || res.data || [];
        const now = new Date();
        const overdue = tasks.filter(t => t.due_date && new Date(t.due_date) < now);
        setResult({
          title: 'Overdue Tasks', count: overdue.length,
          items: overdue.slice(0, 10).map(t => ({ label: t.title || t.name, detail: `Due ${new Date(t.due_date).toLocaleDateString()}`, status: 'overdue' })),
          empty: "No overdue tasks — you're on track.",
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
        setResult({ title: 'Team Workload', count: workload.length, items: workload, empty: 'No team members found.' });
      }

      if (actionId === 'recent') {
        const res = await axios.get(`${API}/tasks?sort=-created_at&limit=10`, headers());
        const tasks = res.data?.tasks || res.data || [];
        setResult({
          title: 'Recent Activity', count: tasks.length,
          items: tasks.slice(0, 10).map(t => ({ label: t.title || t.name || 'Untitled task', detail: `${t.status} · Created ${new Date(t.created_at).toLocaleDateString()}` })),
          empty: 'No recent activity yet.',
        });
      }

      if (actionId === 'summary') {
        const [tasksRes, usersRes] = await Promise.all([
          axios.get(`${API}/tasks`, headers()),
          axios.get(`${API}/users`, headers()),
        ]);
        const tasks = tasksRes.data?.tasks || tasksRes.data || [];
        const users = usersRes.data || [];
        setResult({
          title: 'Platform Summary',
          stats: [
            { label: 'Total Tasks', value: tasks.length, icon: FileText },
            { label: 'In Progress', value: tasks.filter(t => t.status === 'in_progress').length, icon: Clock },
            { label: 'Completed', value: tasks.filter(t => t.status === 'completed').length, icon: CheckCircle },
            { label: 'Pending', value: tasks.filter(t => t.status === 'pending' || t.status === 'open').length, icon: AlertTriangle },
            { label: 'Active Users', value: users.filter(u => u.active !== false).length, icon: Users },
          ],
        });
      }
    } catch { toast.error('Failed to load data'); setResult(null); }
    finally { setLoading(false); }
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
          Chat with AI, generate briefs, or get quick insights from your data.
        </p>
      </div>

      {/* Action cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14, marginBottom: 32 }}>
        {ACTIONS.map(({ id, icon: Icon, color, label, desc }) => (
          <button key={id} onClick={() => runAction(id)}
            style={{
              background: activeAction === id ? `${color}15` : 'var(--card)',
              border: `1px solid ${activeAction === id ? color : 'var(--border)'}`,
              borderRadius: 12, padding: '18px 16px', cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s',
            }}>
            <div style={{ width: 36, height: 36, borderRadius: 9, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
              <Icon size={18} color={color} />
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--tx-1)', marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 12, color: 'var(--tx-3)', lineHeight: 1.4 }}>{desc}</div>
          </button>
        ))}
      </div>

      {/* ── AI CHAT ───────────────────────────────────────── */}
      {activeAction === 'chat' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: 500 }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx-1)', margin: 0 }}>Chat with AI</h2>
            <p style={{ fontSize: 11, color: 'var(--tx-3)', margin: '2px 0 0' }}>Powered by OpenAI. Ask about tasks, projects, or get advice.</p>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12, minHeight: 250 }}>
            {chatMessages.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--tx-3)' }}>
                <MessageSquare size={28} style={{ opacity: 0.3, marginBottom: 8 }} />
                <p style={{ margin: 0, fontSize: 13 }}>Start a conversation...</p>
              </div>
            )}
            {chatMessages.map((msg, i) => (
              <div key={i} style={{
                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '80%', padding: '10px 14px', borderRadius: 12,
                background: msg.role === 'user' ? 'var(--red)' : 'var(--bg-elevated)',
                color: msg.role === 'user' ? '#fff' : 'var(--tx-1)',
                fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap',
              }}>
                {msg.content}
              </div>
            ))}
            {streaming && chatMessages[chatMessages.length - 1]?.role !== 'assistant' && (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', color: 'var(--tx-3)', fontSize: 12 }}>
                <Loader2 size={14} className="spin" /> Thinking...
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div style={{ padding: '12px 18px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
            <input
              className="input-field"
              placeholder="Ask me anything..."
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleChat()}
              disabled={streaming}
              style={{ flex: 1 }}
            />
            <button onClick={handleChat} disabled={streaming || !chatInput.trim()}
              style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: 'var(--red)', color: '#fff', cursor: streaming ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 600, opacity: streaming || !chatInput.trim() ? 0.5 : 1 }}>
              <Send size={14} /> Send
            </button>
          </div>
        </div>
      )}

      {/* ── BRIEF GENERATOR ───────────────────────────────── */}
      {activeAction === 'brief' && (
        <div className="card" style={{ padding: 24 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx-1)', margin: '0 0 4px' }}>Generate Creative Brief</h2>
          <p style={{ fontSize: 12, color: 'var(--tx-3)', margin: '0 0 16px' }}>Select an order and AI will generate a structured brief from its details.</p>

          <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
            <select value={briefOrderId} onChange={e => setBriefOrderId(e.target.value)}
              style={{ flex: 1, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--tx-1)', fontSize: 13 }}>
              <option value="">Select an order...</option>
              {orders.map(o => (
                <option key={o.id} value={o.id}>{o.order_code} — {o.title}</option>
              ))}
            </select>
            <button onClick={handleBrief} disabled={briefLoading || !briefOrderId}
              style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: 'var(--red)', color: '#fff', cursor: briefLoading ? 'wait' : 'pointer', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, opacity: briefLoading || !briefOrderId ? 0.5 : 1 }}>
              {briefLoading ? <Loader2 size={14} className="spin" /> : <Wand2 size={14} />} Generate
            </button>
          </div>

          {briefResult && (
            <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '18px 20px', whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.7, color: 'var(--tx-1)' }}>
              {briefResult}
            </div>
          )}
        </div>
      )}

      {/* ── CLASSIC RESULTS ───────────────────────────────── */}
      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 32, justifyContent: 'center', color: 'var(--tx-3)' }}>
          <Loader2 size={20} className="spin" />
          <span>Analyzing...</span>
        </div>
      )}

      {result && !loading && (
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: '24px 20px' }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--tx-1)', margin: '0 0 16px' }}>{result.title}</h2>

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

          {result.items && result.items.length === 0 && result.empty && (
            <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--tx-3)', fontSize: 14 }}>
              <CheckCircle size={24} style={{ marginBottom: 8, opacity: 0.5 }} />
              <p style={{ margin: 0 }}>{result.empty}</p>
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {!result && !loading && activeAction !== 'chat' && activeAction !== 'brief' && (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--tx-3)' }}>
          <Sparkles size={32} style={{ opacity: 0.3, marginBottom: 12 }} />
          <p style={{ fontSize: 14, margin: 0 }}>Select an action above to get started</p>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
