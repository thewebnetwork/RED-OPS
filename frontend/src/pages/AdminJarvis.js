import { useState, useRef, useEffect, useCallback } from 'react';
import { Sparkles, Send, Loader2, RotateCcw, Wrench, ShieldAlert } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const tok = () => localStorage.getItem('token');

const SUGGESTIONS = [
  "What were my biggest expenses this month?",
  "Summarize Taryn's activity this week",
  "Draft 3 Meta ad hooks for a Calgary realtor targeting first-time buyers — use the RRM voice",
  "What's my finance summary for Q1?",
];

export default function AdminJarvis() {
  const [access, setAccess] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [convId] = useState(() => crypto.randomUUID());
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API}/jarvis/can-access`, { headers: { Authorization: `Bearer ${tok()}` } });
        if (res.ok) setAccess(await res.json());
        else setAccess({ allowed: false });
      } catch { setAccess({ allowed: false }); }
    })();
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading]);

  const sendMessage = useCallback(async (text) => {
    const question = text || input.trim();
    if (!question || loading) return;
    setInput('');

    const userMsg = { role: 'user', content: question };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setLoading(true);

    setMessages(prev => [...prev, { role: 'assistant', content: '', tools: [], streaming: true }]);

    try {
      const resp = await fetch(`${API}/jarvis/chat`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tok()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: updated.map(m => ({ role: m.role, content: m.content })), conversation_id: convId }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.detail || err.error?.message || `HTTP ${resp.status}`);
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullText = '';
      let toolsUsed = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const ev = JSON.parse(line.slice(6));
            if (ev.type === 'text') {
              fullText += ev.content;
              setMessages(prev => { const c = [...prev]; c[c.length - 1] = { ...c[c.length - 1], content: fullText }; return c; });
            } else if (ev.type === 'tool_use') {
              toolsUsed.push({ name: ev.tool, status: 'running' });
              setMessages(prev => { const c = [...prev]; c[c.length - 1] = { ...c[c.length - 1], tools: [...toolsUsed] }; return c; });
            } else if (ev.type === 'tool_result') {
              const last = toolsUsed[toolsUsed.length - 1];
              if (last) last.status = 'done';
              setMessages(prev => { const c = [...prev]; c[c.length - 1] = { ...c[c.length - 1], tools: [...toolsUsed] }; return c; });
            } else if (ev.type === 'error') {
              throw new Error(ev.message);
            }
          } catch (e) { if (e.message && !e.message.includes('JSON')) throw e; }
        }
      }
      setMessages(prev => { const c = [...prev]; c[c.length - 1] = { ...c[c.length - 1], streaming: false }; return c; });
    } catch (e) {
      setMessages(prev => {
        const c = [...prev];
        const last = c[c.length - 1];
        if (last?.role === 'assistant') c[c.length - 1] = { role: 'assistant', content: '', error: e.message, streaming: false };
        else c.push({ role: 'assistant', content: '', error: e.message, streaming: false });
        return c;
      });
    } finally { setLoading(false); inputRef.current?.focus(); }
  }, [input, messages, loading, convId]);

  const handleKeyDown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } };

  if (access === null) return <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem', color: 'var(--tx-3)' }}><Loader2 size={20} className="spin" /></div>;

  if (!access.allowed) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'var(--tx-3)', gap: 12 }}>
      <ShieldAlert size={32} />
      <p style={{ fontSize: '0.9rem' }}>Jarvis access is not available for your account.</p>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', maxHeight: 'calc(100vh - 60px)', background: '#1C1C1C' }}>
      {/* Header */}
      <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Sparkles size={18} style={{ color: '#A2182C' }} />
          <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--tx-1)', letterSpacing: '0.02em' }}>JARVIS</span>
          {access.scope === 'scoped_matt' && <span style={{ fontSize: '0.65rem', padding: '2px 6px', borderRadius: 4, background: '#f59e0b18', color: '#f59e0b', fontWeight: 600 }}>FINANCE</span>}
        </div>
        <button onClick={() => { setMessages([]); setInput(''); }} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 10px', color: 'var(--tx-2)', cursor: 'pointer', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 4 }}>
          <RotateCcw size={12} /> New
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', WebkitOverflowScrolling: 'touch' }}>
        {messages.length === 0 && (
          <div style={{ maxWidth: 560, margin: '48px auto', textAlign: 'center' }}>
            <Sparkles size={28} style={{ color: '#A2182C', marginBottom: 12 }} />
            <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--tx-1)', marginBottom: 6 }}>What can I help with?</h2>
            <p style={{ color: 'var(--tx-3)', fontSize: '0.8rem', marginBottom: 20 }}>Finance, clients, tasks, projects, strategy, copy — ask anything.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8 }}>
              {SUGGESTIONS.map((q, i) => (
                <button key={i} onClick={() => sendMessage(q)} style={{
                  padding: '10px 12px', textAlign: 'left', background: 'var(--bg-card)', border: '1px solid var(--border)',
                  borderRadius: 10, color: 'var(--tx-1)', fontSize: '0.8rem', cursor: 'pointer', lineHeight: 1.4,
                }}>{q}</button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: 10 }}>
            <div style={{
              maxWidth: '80%', padding: '10px 14px', borderRadius: 12, fontSize: '0.875rem', lineHeight: 1.6,
              ...(m.role === 'user'
                ? { background: '#A2182C', color: '#fff', borderBottomRightRadius: 3 }
                : { background: 'var(--bg-card)', color: 'var(--tx-1)', borderBottomLeftRadius: 3, border: '1px solid var(--border)' }),
            }}>
              {m.tools?.length > 0 && (
                <div style={{ marginBottom: 6 }}>
                  {m.tools.map((t, ti) => (
                    <div key={ti} style={{ fontSize: '0.7rem', color: '#97662D', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                      <Wrench size={10} /> {t.name.replace(/_/g, ' ')} {t.status === 'running' ? '...' : '✓'}
                    </div>
                  ))}
                </div>
              )}
              {m.error ? (
                <div style={{ color: '#ef4444' }}>
                  {m.error}
                  <button onClick={() => sendMessage(messages[i - 1]?.content)} style={{ marginLeft: 8, textDecoration: 'underline', cursor: 'pointer', background: 'none', border: 'none', color: 'inherit', fontSize: 'inherit' }}>Retry</button>
                </div>
              ) : (
                <div style={{ whiteSpace: 'pre-wrap' }}>{m.content}{m.streaming && <span style={{ animation: 'blink 1s step-end infinite' }}>|</span>}</div>
              )}
            </div>
          </div>
        ))}

        {loading && messages[messages.length - 1]?.role !== 'assistant' && (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', color: 'var(--tx-3)', fontSize: '0.8rem', padding: 6 }}>
            <Loader2 size={14} className="spin" /> Thinking...
          </div>
        )}
      </div>

      {/* Input */}
      <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', background: 'var(--bg-card)', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 8, maxWidth: 720, margin: '0 auto' }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Jarvis..."
            rows={1}
            style={{
              flex: 1, resize: 'none', padding: '10px 14px', fontSize: '16px',
              background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 10,
              color: 'var(--tx-1)', outline: 'none', lineHeight: 1.5,
              minHeight: 44,
            }}
          />
          <button onClick={() => sendMessage()} disabled={loading || !input.trim()} style={{
            background: '#A2182C', border: 'none', borderRadius: 10, padding: '0 16px',
            cursor: loading ? 'not-allowed' : 'pointer', color: '#fff',
            opacity: loading || !input.trim() ? 0.5 : 1, display: 'flex', alignItems: 'center',
            minWidth: 44, justifyContent: 'center',
          }}>
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
