import { Sparkles, Zap, MessageSquare, BarChart2, Wand2, Brain } from 'lucide-react';

const PLANNED = [
  { icon: MessageSquare, label: 'AI Chat', desc: 'Ask questions about tasks, projects, and performance' },
  { icon: Wand2, label: 'Brief Generator', desc: 'Auto-generate creative briefs from order details' },
  { icon: BarChart2, label: 'Smart Insights', desc: 'AI-powered analytics and trend detection' },
  { icon: Brain, label: 'Workflow Suggestions', desc: 'Intelligent recommendations to optimize your processes' },
];

export default function AIAssistant() {
  return (
    <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)', padding: '32px 28px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>

      <div style={{
        width: 72, height: 72, borderRadius: 18,
        background: 'linear-gradient(135deg, rgba(201,42,62,0.15), rgba(168,85,247,0.15))',
        display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20,
      }}>
        <Sparkles size={32} style={{ color: '#a855f7' }} />
      </div>

      <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--tx-1)', margin: '0 0 8px', textAlign: 'center' }}>
        AI Assistant
      </h1>

      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '6px 14px', borderRadius: 20,
        background: 'var(--color-purple-soft)',
        marginBottom: 12,
      }}>
        <Zap size={13} color="var(--purple)" />
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--purple)' }}>Coming soon</span>
      </div>

      <p style={{ fontSize: 14, color: 'var(--tx-3)', margin: '0 0 36px', textAlign: 'center', maxWidth: 420, lineHeight: 1.6 }}>
        AI features for writing briefs, summarizing projects, and surfacing insights — in progress.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14, width: '100%', maxWidth: 560 }}>
        {PLANNED.map(({ icon: Icon, label, desc }) => (
          <div key={label} style={{
            background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12,
            padding: '18px 16px', opacity: 0.6,
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: 9,
              background: 'var(--bg-elevated)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10,
            }}>
              <Icon size={18} color="var(--tx-3)" />
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--tx-1)', marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 12, color: 'var(--tx-3)', lineHeight: 1.4 }}>{desc}</div>
          </div>
        ))}
      </div>

    </div>
  );
}
