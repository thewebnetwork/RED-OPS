import { useState, useRef, useEffect } from 'react';
import { X, Send, Loader2, Sparkles, RotateCcw } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const tok = () => localStorage.getItem('token');

const PRESETS = [
  "What's my biggest expense category this month?",
  "How much did I spend on ad spend in the last 30 days?",
  "Am I spending more on software this month than last?",
];

const DATE_RANGES = [
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
  { label: 'YTD', days: Math.ceil((new Date() - new Date(new Date().getFullYear(), 0, 1)) / 86400000) },
  { label: '1 year', days: 365 },
];

export default function FinanceAdvisorChat({ open, onClose }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dateRange, setDateRange] = useState(90);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const sendMessage = async (text) => {
    const question = text || input.trim();
    if (!question || loading) return;
    setInput('');
    setError(null);

    const userMsg = { role: 'user', content: question };
    const history = [...messages, userMsg];
    setMessages(history);
    setLoading(true);

    try {
      const res = await fetch(`${API}/finance/advisor/chat`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tok()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          date_range_days: dateRange,
          conversation_history: messages,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || err.error?.message || 'Request failed');
      }
      const data = await res.json();
      setMessages([...history, { role: 'assistant', content: data.response, meta: { txCount: data.transactions_referenced, range: data.date_range } }]);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  if (!open) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, right: 0, bottom: 0, width: 420, maxWidth: '100vw',
      background: 'var(--bg-card)', borderLeft: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', zIndex: 100,
      boxShadow: '-4px 0 24px rgba(0,0,0,0.3)',
    }}>
      {/* Header */}
      <div style={{
        padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Sparkles size={16} style={{ color: 'var(--accent)' }} />
          <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--tx-1)' }}>Finance Advisor</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <select value={dateRange} onChange={e => setDateRange(Number(e.target.value))} style={{
            background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 4,
            color: 'var(--tx-2)', fontSize: '0.7rem', padding: '2px 4px',
          }}>
            {DATE_RANGES.map(r => <option key={r.days} value={r.days}>{r.label}</option>)}
          </select>
          <button onClick={() => { setMessages([]); setError(null); }} style={iconBtnStyle} title="New conversation">
            <RotateCcw size={14} />
          </button>
          <button onClick={onClose} style={iconBtnStyle}><X size={16} /></button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '0.75rem' }}>
        {messages.length === 0 && !loading && (
          <div style={{ padding: '1.5rem 0.5rem' }}>
            <p style={{ color: 'var(--tx-3)', fontSize: '0.8rem', marginBottom: '1rem' }}>
              Ask anything about your finances. I can see your transaction history.
            </p>
            {PRESETS.map((q, i) => (
              <button key={i} onClick={() => sendMessage(q)} style={{
                display: 'block', width: '100%', textAlign: 'left', padding: '0.5rem 0.75rem',
                marginBottom: 6, background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                borderRadius: 8, color: 'var(--tx-1)', fontSize: '0.8rem', cursor: 'pointer',
              }}>
                {q}
              </button>
            ))}
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} style={{
            display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
            marginBottom: 10,
          }}>
            <div style={{
              maxWidth: '85%', padding: '0.6rem 0.8rem', borderRadius: 10,
              fontSize: '0.85rem', lineHeight: 1.5,
              ...(m.role === 'user'
                ? { background: 'var(--accent)', color: '#fff', borderBottomRightRadius: 2 }
                : { background: 'var(--bg-elevated)', color: 'var(--tx-1)', borderBottomLeftRadius: 2 }),
            }}>
              <div style={{ whiteSpace: 'pre-wrap' }}>{m.content}</div>
              {m.meta && (
                <div style={{ fontSize: '0.65rem', marginTop: 4, opacity: 0.6 }}>
                  {m.meta.txCount} transactions analyzed
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: 'var(--tx-3)', fontSize: '0.8rem', padding: '0.5rem' }}>
            <Loader2 size={14} className="spin" /> Analyzing your finances...
          </div>
        )}

        {error && (
          <div style={{ padding: '0.5rem 0.75rem', background: '#ef444418', borderRadius: 8, color: '#ef4444', fontSize: '0.8rem', marginTop: 8 }}>
            {error}
            <button onClick={() => sendMessage(messages[messages.length - 1]?.content)} style={{ marginLeft: 8, textDecoration: 'underline', cursor: 'pointer', background: 'none', border: 'none', color: 'inherit' }}>
              Retry
            </button>
          </div>
        )}
      </div>

      {/* Input */}
      <div style={{ padding: '0.75rem', borderTop: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your finances..."
            rows={1}
            style={{
              flex: 1, resize: 'none', padding: '0.5rem 0.75rem', fontSize: '0.85rem',
              background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8,
              color: 'var(--tx-1)', outline: 'none',
            }}
          />
          <button onClick={() => sendMessage()} disabled={loading || !input.trim()} style={{
            background: 'var(--accent)', border: 'none', borderRadius: 8, padding: '0 0.75rem',
            cursor: loading ? 'not-allowed' : 'pointer', color: '#fff', opacity: loading || !input.trim() ? 0.5 : 1,
          }}>
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

const iconBtnStyle = { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx-3)', padding: 4 };
