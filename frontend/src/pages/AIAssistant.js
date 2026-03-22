import React from 'react';
import { Sparkles, Zap, FileText, BarChart2, MessageSquare, Clock } from 'lucide-react';

const PLANNED_FEATURES = [
  {
    icon: FileText,
    color: '#3b82f6',
    title: 'AI Brief Generator',
    desc: 'Generate polished creative briefs from a one-line prompt. Tailored to client, service, and goals.',
  },
  {
    icon: BarChart2,
    color: '#22c55e',
    title: 'Monthly Report Writer',
    desc: 'Auto-draft performance summaries from your ad data, request stats, and SLA records.',
  },
  {
    icon: MessageSquare,
    color: '#a855f7',
    title: 'Client Status Summary',
    desc: 'One-click snapshot of any client — open requests, overdue items, last activity.',
  },
  {
    icon: Zap,
    color: '#f59e0b',
    title: 'Deadline Risk Alerts',
    desc: 'AI flags at-risk requests before they breach SLA, so you can act early.',
  },
];

export default function AIAssistant() {
  return (
    <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 24px' }}>

      {/* Icon */}
      <div style={{ width: 72, height: 72, borderRadius: 18, background: 'linear-gradient(135deg,#c92a3e,#a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24, boxShadow: '0 0 40px #c92a3e30' }}>
        <Sparkles size={36} color="#fff" />
      </div>

      {/* Heading */}
      <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--tx-1)', margin: 0, letterSpacing: '-0.02em' }}>
        AI Assistant
      </h1>
      <p style={{ marginTop: 10, fontSize: 15, color: 'var(--tx-2)', maxWidth: 420, textAlign: 'center', lineHeight: 1.6 }}>
        Your intelligent co-pilot for Red Ops — briefs, reports, status summaries, and more. Launching soon.
      </p>

      {/* Coming soon badge */}
      <div style={{ marginTop: 20, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 20, background: '#f59e0b18', border: '1px solid #f59e0b40', color: '#f59e0b', fontSize: 12, fontWeight: 700, letterSpacing: '0.04em' }}>
        <Clock size={13} />
        COMING SOON
      </div>

      {/* Feature cards */}
      <div style={{ marginTop: 48, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16, width: '100%', maxWidth: 780 }}>
        {PLANNED_FEATURES.map(({ icon: Icon, color, title, desc }) => (
          <div key={title} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 18px' }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: color + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
              <Icon size={18} color={color} />
            </div>
            <p style={{ margin: '0 0 6px', fontSize: 14, fontWeight: 700, color: 'var(--tx-1)' }}>{title}</p>
            <p style={{ margin: 0, fontSize: 12.5, color: 'var(--tx-2)', lineHeight: 1.55 }}>{desc}</p>
          </div>
        ))}
      </div>

      {/* Footer note */}
      <p style={{ marginTop: 40, fontSize: 12, color: 'var(--tx-3)', textAlign: 'center' }}>
        We'll notify you as soon as AI Assistant goes live. In the meantime, all core workflows are fully operational.
      </p>
    </div>
  );
}
