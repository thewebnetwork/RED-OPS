import { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Sparkles, Send, RefreshCw, ChevronRight, Copy, Check, Loader2 } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const token = () => localStorage.getItem('token');
const get = (path) => fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token()}` } }).then(r => r.ok ? r.json() : null);
const post = (path, body) => fetch(`${API}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` }, body: JSON.stringify(body) }).then(r => r.ok ? r.json() : null);

const QUICK_PROMPTS = [
  { icon: '📊', label: 'Status summary', prompt: 'Give me a quick status summary of all open requests and where each stands.' },
  { icon: '📝', label: 'Generate brief', prompt: 'Generate a structured creative brief for a 30-second real estate video ad targeting buyers in Calgary, professional tone.' },
  { icon: '⚠️', label: 'At-risk clients', prompt: 'Which clients are at risk of churning based on recent activity and engagement?' },
  { icon: '📋', label: 'Monthly report draft', prompt: 'Draft a monthly performance report template for an RRM client.' },
  { icon: '🎯', label: 'Task priorities', prompt: 'What are the highest priority tasks I should focus on today?' },
  { icon: '🔍', label: 'CASL compliance', prompt: 'What are the CASL compliance requirements for our Meta ad campaigns?' },
];

function Message({ msg }) {
  const [copied, setCopied] = useState(false);
  const isUser = msg.role === 'user';

  const copy = () => {
    navigator.clipboard.writeText(msg.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Simple markdown bold/code rendering
  const renderContent = (text) => {
    return text.split('\n').map((line, i) => {
      if (line.startsWith('# ')) return <div key={i} style={{ fontSize: 15, fontWeight: 700, color: 'var(--tx-1)', margin: '8px 0 4px' }}>{line.slice(2)}</div>;
      if (line.startsWith('## ')) return <div key={i} style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--tx-1)', margin: '8px 0 4px' }}>{line.slice(3)}</div>;
      if (line.startsWith('- ')) return <div key={i} style={{ paddingLeft: 14, position: 'relative', fontSize: 13, lineHeight: 1.6 }}><span style={{ position: 'absolute', left: 4, color: 'var(--tx-3)' }}>·</span>{line.slice(2)}</div>;
      if (!line.trim()) return <div key={i} style={{ height: 6 }} />;
      return <p key={i} style={{ margin: '2px 0', fontSize: 13, lineHeight: 1.65 }}>{line}</p>;
    });
  };

  return (
    <div style={{ display: 'flex', gap: 10, padding: '12px 0', alignItems: 'flex-start' }}>
      {/* Avatar */}
      <div style={{
        width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
        background: isUser ? 'var(--red)' : 'linear-gradient(135deg, #7c3aed, #a855f7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12, fontWeight: 700, color: 'white',
      }}>
        {isUser ? 'Y' : <Sparkles size={13} />}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--tx-3)', marginBottom: 5 }}>
          {isUser ? 'You' : 'Red Ops AI'}
        </div>
        <div style={{ color: 'var(--tx-2)', lineHeight: 1.6 }}>
          {msg.loading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Loader2 size={14} style={{ color: 'var(--red)', animation: 'spin 1s linear infinite' }} />
              <span style={{ fontSize: 13, color: 'var(--tx-3)' }}>Thinking...</span>
            </div>
          ) : (
            renderContent(msg.content)
          )}
        </div>
        {!isUser && !msg.loading && (
          <button
            onClick={copy}
            style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx-3)', fontSize: 11, padding: 0 }}
          >
            {copied ? <Check size={11} /> : <Copy size={11} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        )}
      </div>
    </div>
  );
}

export default function AIAssistant() {
  const { user } = useAuth();
  const [messages, setMessages] = useState([
    {
      id: 0, role: 'assistant',
      content: `Hey ${user?.name?.split(' ')[0] || 'there'} — I'm your Red Ops AI assistant.\n\nI can help you with:\n- Status summaries for clients and open requests\n- Generating creative briefs from plain text descriptions\n- Monthly report drafts for clients\n- Answering questions about SOPs and playbooks\n- Flagging at-risk clients and overdue tasks\n\nWhat do you want to know?`,
    }
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = useCallback(async (text) => {
    const msg = text || input.trim();
    if (!msg || sending) return;
    setInput('');
    setSending(true);

    const userMsg = { id: Date.now(), role: 'user', content: msg };
    const loadingMsg = { id: Date.now() + 1, role: 'assistant', loading: true, content: '' };

    setMessages(prev => [...prev, userMsg, loadingMsg]);

    try {
      // Try the AI endpoint first
      const res = await post('/ai/chat', { message: msg, history: messages.slice(-10).map(m => ({ role: m.role, content: m.content })) });
      const reply = res?.response || res?.message || res?.content || await generateLocalResponse(msg);
      setMessages(prev => prev.map(m => m.id === loadingMsg.id ? { ...m, loading: false, content: reply } : m));
    } catch (e) {
      // Fallback: local contextual response
      const reply = await generateLocalResponse(msg);
      setMessages(prev => prev.map(m => m.id === loadingMsg.id ? { ...m, loading: false, content: reply } : m));
    } finally {
      setSending(false);
    }
  }, [input, sending, messages]);

  const generateLocalResponse = async (msg) => {
    const lower = msg.toLowerCase();
    if (lower.includes('brief') || lower.includes('creative')) {
      return `Here's a structured creative brief:\n\n## Creative Brief\n\n**Objective:** Lead generation for real estate services\n\n**Format:** 30-second video ad\n\n**Target Audience:** Home buyers in Calgary, aged 28-50, household income $100K+\n\n**Key Message:** "The Calgary market is moving fast — don't miss your window. Book a free strategy call today."\n\n**Tone:** Professional, confident, urgent but not pushy\n\n**Call to Action:** "Book your free consultation" — click to lead form\n\n**Assets Needed:**\n- Agent headshot or video of agent speaking to camera\n- 3-5 property photos (recent listings)\n- Logo\n\n**Notes:** Hook within first 3 seconds. Lead with the market opportunity, not features.`;
    }
    if (lower.includes('status') || lower.includes('summary')) {
      return `I'll pull a live status summary for you. Make sure your requests are up to date in the Requests section for the most accurate view.\n\nHere's what to check:\n- Open Requests: check the Command Center for unassigned items\n- At-risk clients: look for any with red health scores on the Clients page\n- Overdue tasks: Tasks view → filter by overdue\n\nWant me to generate a summary once I can access the live data?`;
    }
    if (lower.includes('casl') || lower.includes('compliance')) {
      return `## CASL Compliance Summary for RRM\n\nKey rules for Meta Ads:\n- Meta ads themselves are NOT subject to CASL (paid placements)\n- Landing pages and follow-up emails ARE subject to CASL\n\nFor lead forms:\n- Implied consent is sufficient when a prospect fills out a form requesting info\n- Express consent is preferred for ongoing email sequences\n\nFor ISA follow-up:\n- Calls and texts in immediate response to a lead inquiry are fine\n- Email sequences must include an unsubscribe option\n- SMS: must have STOP opt-out\n\nAlways keep records of consent date, form version, and what was promised.\n\nSee the full SOP in SOPs & Playbooks → Reference → CASL Compliance Rules.`;
    }
    if (lower.includes('report') || lower.includes('monthly')) {
      return `## Monthly Report Template\n\n**[Client Name] — [Month Year]**\n\nSummary: [2-3 sentence overview of the month]\n\n**Key Numbers**\n- Leads: [X] generated\n- Appointments Booked: [X]\n- Show Rate: [X]%\n- Cost Per Lead: $[X]\n- Ad Spend: $[X]\n\n**What Worked**\n- [Top creative or audience]\n\n**Next Month**\n- [Test or change]\n\nFull template available in SOPs → Templates → Client Monthly Report Template.`;
    }
    return `Got it. I can help with that. Here's what I'd suggest:\n\n1. Check the relevant section in Red Ops for live data\n2. If you're looking for a specific SOP or playbook, search in the SOPs section\n3. For client-specific questions, check the Clients page for health scores and activity\n\nIs there a specific piece of data or document you need me to find or generate?`;
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="page-fill">
      {/* Header */}
      <div style={{ padding: '14px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <div style={{ width: 32, height: 32, borderRadius: 9, background: 'linear-gradient(135deg, #7c3aed, #a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Sparkles size={15} style={{ color: 'white' }} />
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx-1)' }}>AI Assistant</div>
          <div style={{ fontSize: 11, color: 'var(--tx-3)' }}>Briefing · Reports · Status · SOPs</div>
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <span style={{ fontSize: 10, fontWeight: 600, background: 'rgba(168,85,247,.15)', color: '#a855f7', padding: '2px 7px', borderRadius: 4 }}>BETA</span>
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px' }}>
          <div style={{ maxWidth: 680, margin: '0 auto' }}>
            {messages.map(msg => <Message key={msg.id} msg={msg} />)}
            <div ref={bottomRef} />
          </div>
        </div>

        {/* Quick Prompts sidebar */}
        <div style={{ width: 200, borderLeft: '1px solid var(--border)', padding: '16px', flexShrink: 0, overflowY: 'auto' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--tx-3)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 10 }}>Quick Prompts</div>
          {QUICK_PROMPTS.map((p, i) => (
            <button
              key={i}
              onClick={() => sendMessage(p.prompt)}
              style={{
                width: '100%', padding: '8px 10px', marginBottom: 4,
                background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                borderRadius: 7, cursor: 'pointer', textAlign: 'left',
                display: 'flex', alignItems: 'center', gap: 7, transition: 'all .15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#a855f7'; e.currentTarget.style.background = 'rgba(168,85,247,.08)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg-elevated)'; }}
            >
              <span style={{ fontSize: 14 }}>{p.icon}</span>
              <span style={{ fontSize: 11.5, color: 'var(--tx-2)', fontWeight: 500, lineHeight: 1.3 }}>{p.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Input */}
      <div style={{ padding: '12px 24px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ maxWidth: 680, margin: '0 auto', display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Ask anything — status, briefs, reports, SOPs..."
            rows={1}
            className="input-field"
            style={{ flex: 1, resize: 'none', fontFamily: 'inherit', fontSize: 13, lineHeight: 1.5, minHeight: 40, maxHeight: 120, overflow: 'auto' }}
            onInput={e => { e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'; }}
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || sending}
            style={{
              width: 40, height: 40, borderRadius: 9, border: 'none', cursor: 'pointer',
              background: input.trim() && !sending ? 'var(--red)' : 'var(--bg-overlay)',
              color: input.trim() && !sending ? 'white' : 'var(--tx-3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all .15s', flexShrink: 0,
            }}
          >
            {sending ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={16} />}
          </button>
        </div>
        <div style={{ maxWidth: 680, margin: '6px auto 0', fontSize: 10.5, color: 'var(--tx-3)', textAlign: 'center' }}>
          Enter to send · Shift+Enter for new line
        </div>
      </div>
    </div>
  );
}
