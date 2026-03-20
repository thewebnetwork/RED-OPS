import { useState, useEffect } from 'react';
import {
  BookOpen, Plus, Search, ChevronRight, FileText,
  Layers, Star, Users, Code, X, Loader2, Edit3, Save
} from 'lucide-react';

// ── Built-in RRG SOPs ──
const BUILTIN_DOCS = [
  {
    id: 'sop-001', category: 'Playbooks', title: 'How to Onboard a New RRM Client',
    content: `# RRM Client Onboarding SOP\n\n## Overview\nThis is the 16-step process for onboarding a new Red Ribbon Media client from signed deal to live campaigns.\n\n## Pre-Onboarding (Before Kickoff Call)\n1. Send welcome email with kickoff call booking link\n2. Share intake form (ICP, goals, market, brand assets)\n3. Create GHL sub-account\n\n## Kickoff Call\n4. Review intake form responses\n5. Align on 90-day goal (usually: 10-15 booked appointments/mo)\n6. Set expectations on timeline (7-14 days to live)\n\n## GHL Setup\n7. Configure pipeline: New Lead → Contacted → Booked → Showed → Closed\n8. Set up ISA automation workflow\n9. Connect client's Facebook Ad Account + Business Manager\n\n## Meta Ads Setup\n10. Install and verify pixel\n11. Collect ad creative assets (photos, video, bio)\n12. Draft first campaign (lead gen objective, $20-50/day budget)\n13. Client reviews and approves\n\n## Launch\n14. Campaign goes live\n15. Monitor for first 72 hours (CTR, CPL, lead quality)\n16. Week 1 performance review call\n\n## Notes\n- Always CC client on any GHL setup emails\n- Default budget: $20/day for first 2 weeks, scale based on CPL\n- ISA follow-up: contact within 5 minutes of lead coming in`,
    tags: ['onboarding', 'rrm', 'ghl', 'meta'],
    author: 'G',
    pinned: true,
  },
  {
    id: 'sop-002', category: 'Playbooks', title: 'Monthly Client Delivery Workflow',
    content: `# Monthly Client Delivery Workflow\n\n## Week 1\n- Review previous month ad performance\n- Identify top 3 creative winners\n- Kill bottom 20% of ad sets by CPL\n\n## Week 2\n- Launch new creative tests (3-5 new variations)\n- Review ISA follow-up conversion rate\n- GHL audit: any leads slipping through?\n\n## Week 3\n- Mid-month check-in with client (15 min)\n- Adjust budget allocation based on performance\n- Creative refresh if CTR declining\n\n## Week 4\n- Month-end performance report\n- Book next month strategy call\n- Upsell opportunity review: ready for Scale plan?\n\n## KPIs to Hit\n- CPL: under $25 for real estate\n- Show rate: 50%+\n- Cost per booked call: under $80\n- Monthly booked appointments: 10-15`,
    tags: ['delivery', 'monthly', 'reporting'],
    author: 'G',
    pinned: false,
  },
  {
    id: 'sop-003', category: 'Templates', title: 'Client Monthly Report Template',
    content: `# [Client Name] — Monthly Performance Report\n**Month:** [Month Year]\n**Account Manager:** [Name]\n\n---\n\n## Summary\n[2-3 sentence plain-language summary of the month]\n\n## Key Numbers\n| Metric | This Month | Last Month | Target |\n|---|---|---|---|\n| Leads Generated | | | |\n| Appointments Booked | | | |\n| Show Rate | | | 50%+ |\n| Cost Per Lead | | | <$25 |\n| Cost Per Booked Call | | | <$80 |\n| Total Ad Spend | | | |\n\n## What Worked\n- [Top performing creative]\n- [Best audience segment]\n\n## What We're Testing Next Month\n- [Test 1]\n- [Test 2]\n\n## Next Steps\n- [Action 1]\n- [Action 2]`,
    tags: ['template', 'reporting', 'client'],
    author: 'G',
    pinned: false,
  },
  {
    id: 'sop-004', category: 'Reference', title: 'RRM ICP Definition',
    content: `# RRM Ideal Client Profile (ICP)\n\n## Primary ICP: Canadian Real Estate Agent\n- **Experience:** 2+ years, full-time agent\n- **Volume:** $5M–$30M GCI per year (up to $60M for Scale clients)\n- **Location:** Calgary, Edmonton, Vancouver, Toronto, Ottawa\n- **Pain point:** Inconsistent lead flow, over-reliant on referrals\n- **Goal:** 10-20 new buyer/seller leads per month, on autopilot\n- **Budget:** Can commit $500–$2,000/mo in ad spend\n- **Tech-savvy:** Comfortable with phone follow-up, not afraid of CRM\n\n## Secondary ICP: Small Real Estate Team (2-5 agents)\n- Team lead managing junior agents\n- Wants a system that generates and pre-qualifies leads for the team\n- Higher budget ($2K–$5K/mo ad spend)\n\n## Who We Do NOT Work With\n- Part-time agents (not enough urgency)\n- Anyone unwilling to follow up leads within 5 minutes\n- Agents with no ad budget (minimum $500/mo)\n- Agents in the US (not licensed for cross-border compliance yet)`,
    tags: ['icp', 'targeting', 'reference'],
    author: 'G',
    pinned: false,
  },
  {
    id: 'sop-005', category: 'Reference', title: 'CASL Compliance Rules',
    content: `# CASL Compliance for RRM Campaigns\n\n## What is CASL?\nCanada's Anti-Spam Legislation. Applies to all commercial electronic messages (CEM) sent to Canadians.\n\n## Key Rules for Meta Ads\n- Meta ads themselves are NOT subject to CASL (they're paid placements, not messages)\n- The LANDING PAGE and follow-up messages ARE subject to CASL\n\n## Compliant Lead Capture\n- Lead form must clearly state what the lead is signing up for\n- Implied consent: sufficient for real estate leads who fill out a form requesting info\n- Express consent preferred for email marketing sequences\n\n## ISA Follow-Up Compliance\n- First contact: call or text within 5 minutes (fine — responding to an inquiry)\n- Email sequences: must include unsubscribe option in every email\n- SMS: must have opt-out mechanism (reply STOP)\n\n## Records to Keep\n- Screenshot of lead form/landing page at time of capture\n- Date/time of consent\n- What was promised in exchange for lead info\n\n## When in Doubt\n- Default to express consent\n- Always include unsubscribe in emails\n- Never purchase or use third-party lists`,
    tags: ['legal', 'casl', 'compliance', 'canada'],
    author: 'G',
    pinned: false,
  },
  {
    id: 'sop-006', category: 'Training', title: 'New Team Member Onboarding',
    content: `# New Team Member Onboarding\n\n## Day 1\n- [ ] Get Red Ops access (request from admin)\n- [ ] Get GHL access (sub-account viewer)\n- [ ] Join Slack workspace\n- [ ] Read RRM Master Knowledge Base\n- [ ] Shadow one client delivery call\n\n## Week 1\n- [ ] Complete all platform walkthroughs (Meta Ads Manager, GHL, Nextcloud)\n- [ ] Review 3 past client reports\n- [ ] Understand the 16-step onboarding process\n- [ ] Understand ISA workflow from lead to booked call\n\n## Week 2\n- [ ] Take on first task (supervised)\n- [ ] Submit first deliverable for review\n- [ ] 1:1 check-in with manager\n\n## Tools Access Checklist\n- [ ] Red Ops (ops portal)\n- [ ] GHL (CRM, automations)\n- [ ] Meta Business Manager (ads)\n- [ ] Nextcloud (file storage)\n- [ ] Slack (team comms)\n- [ ] Google Workspace (docs, email)`,
    tags: ['training', 'onboarding', 'team'],
    author: 'G',
    pinned: false,
  },
];

const CATEGORIES = ['All', 'Playbooks', 'Templates', 'Reference', 'Training'];
const CAT_ICONS = { Playbooks: BookOpen, Templates: FileText, Reference: Star, Training: Users, All: Layers };
const CAT_COLORS = { Playbooks: '#3b82f6', Templates: '#a855f7', Reference: '#f59e0b', Training: '#10b981', All: '#6b7280' };

function DocViewer({ doc, onEdit, onClose }) {
  const lines = (doc.content || '').split('\n');

  // Simple markdown-like renderer
  const renderLine = (line, i) => {
    if (line.startsWith('# ')) return <h1 key={i} style={{ fontSize: 18, fontWeight: 800, color: 'var(--tx-1)', margin: '0 0 12px', letterSpacing: '-.02em' }}>{line.slice(2)}</h1>;
    if (line.startsWith('## ')) return <h2 key={i} style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx-1)', margin: '20px 0 8px', borderBottom: '1px solid var(--border)', paddingBottom: 6 }}>{line.slice(3)}</h2>;
    if (line.startsWith('### ')) return <h3 key={i} style={{ fontSize: 13, fontWeight: 700, color: 'var(--tx-2)', margin: '14px 0 6px' }}>{line.slice(4)}</h3>;
    if (line.startsWith('- [ ] ')) return <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0', fontSize: 13, color: 'var(--tx-2)' }}><input type="checkbox" style={{ accentColor: 'var(--red)' }} /><span>{line.slice(6)}</span></div>;
    if (line.startsWith('- ')) return <div key={i} style={{ padding: '2px 0 2px 14px', fontSize: 13, color: 'var(--tx-2)', position: 'relative' }}><span style={{ position: 'absolute', left: 4, color: 'var(--tx-3)' }}>·</span>{line.slice(2)}</div>;
    if (line.startsWith('|') && line.includes('|')) {
      const cells = line.split('|').filter(c => c.trim());
      const isHeader = i < lines.length - 1 && lines[i + 1].startsWith('|---');
      const isSeparator = line.includes('---');
      if (isSeparator) return null;
      return (
        <div key={i} style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: isHeader ? 'var(--bg-overlay)' : 'transparent' }}>
          {cells.map((cell, ci) => (
            <div key={ci} style={{ flex: 1, padding: '6px 8px', fontSize: 12, color: isHeader ? 'var(--tx-3)' : 'var(--tx-2)', fontWeight: isHeader ? 600 : 400, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cell.trim()}</div>
          ))}
        </div>
      );
    }
    if (line === '---') return <hr key={i} style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '16px 0' }} />;
    if (!line.trim()) return <div key={i} style={{ height: 8 }} />;
    return <p key={i} style={{ margin: '2px 0', fontSize: 13, color: 'var(--tx-2)', lineHeight: 1.6 }}>{line}</p>;
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" style={{ width: 640, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexShrink: 0 }}>
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: CAT_COLORS[doc.category] || '#6b7280', letterSpacing: '.06em', textTransform: 'uppercase' }}>{doc.category}</span>
            <h2 style={{ margin: '3px 0 0', fontSize: 16, fontWeight: 700, color: 'var(--tx-1)' }}>{doc.title}</h2>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx-3)' }}><X size={16} /></button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {lines.map((line, i) => renderLine(line, i))}
        </div>
        <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border)', display: 'flex', gap: 8, flexShrink: 0 }}>
          <div style={{ fontSize: 11, color: 'var(--tx-3)', flex: 1 }}>
            {doc.tags?.map(t => (
              <span key={t} style={{ marginRight: 6, padding: '1px 6px', background: 'var(--bg-elevated)', borderRadius: 4, fontSize: 10 }}>{t}</span>
            ))}
          </div>
          <button onClick={onClose} className="btn-ghost" style={{ padding: '6px 14px', fontSize: 12 }}>Close</button>
        </div>
      </div>
    </div>
  );
}

export default function SOPs() {
  const [docs, setDocs] = useState(BUILTIN_DOCS);
  const [category, setCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [viewing, setViewing] = useState(null);

  const filtered = docs.filter(d => {
    if (category !== 'All' && d.category !== category) return false;
    if (search) {
      const q = search.toLowerCase();
      return d.title.toLowerCase().includes(q) || d.content.toLowerCase().includes(q) || d.tags?.some(t => t.includes(q));
    }
    return true;
  });

  return (
    <div className="page-content" style={{ animation: 'fadeInUp .3s ease' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--tx-1)', letterSpacing: '-.02em' }}>SOPs & Playbooks</h1>
          <p style={{ margin: '4px 0 0', fontSize: 12.5, color: 'var(--tx-3)' }}>Processes, templates, and reference docs</p>
        </div>
        <div style={{ position: 'relative' }}>
          <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--tx-3)', pointerEvents: 'none' }} />
          <input className="input-field" placeholder="Search docs..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 28, width: 200, height: 34, fontSize: 12 }} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 16 }}>

        {/* Sidebar */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--tx-3)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 8 }}>Categories</div>
          {CATEGORIES.map(cat => {
            const Icon = CAT_ICONS[cat] || BookOpen;
            const count = cat === 'All' ? docs.length : docs.filter(d => d.category === cat).length;
            const active = category === cat;
            return (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', marginBottom: 2,
                  background: active ? 'rgba(201,42,62,.12)' : 'transparent',
                  border: active ? '1px solid rgba(201,42,62,.3)' : '1px solid transparent',
                  borderRadius: 7, cursor: 'pointer',
                  color: active ? 'var(--red)' : 'var(--tx-2)',
                  transition: 'all .15s',
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--bg-elevated)'; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
              >
                <Icon size={14} />
                <span style={{ flex: 1, fontSize: 12.5, fontWeight: active ? 600 : 400, textAlign: 'left' }}>{cat}</span>
                <span style={{ fontSize: 11, color: 'var(--tx-3)', background: 'var(--bg-elevated)', padding: '0 5px', borderRadius: 8 }}>{count}</span>
              </button>
            );
          })}
        </div>

        {/* Doc Grid */}
        <div>
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--tx-3)' }}>
              <BookOpen size={32} style={{ opacity: .2, marginBottom: 8 }} />
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--tx-2)' }}>No documents found</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filtered.map(doc => {
                const Icon = CAT_ICONS[doc.category] || BookOpen;
                const color = CAT_COLORS[doc.category] || '#6b7280';
                return (
                  <div
                    key={doc.id}
                    onClick={() => setViewing(doc)}
                    style={{
                      padding: '14px 16px', background: 'var(--bg-card)', border: '1px solid var(--border)',
                      borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12,
                      transition: 'all .15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = color; e.currentTarget.style.transform = 'translateX(2px)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'none'; }}
                  >
                    <div style={{ width: 36, height: 36, borderRadius: 9, background: color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon size={17} style={{ color }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--tx-1)', marginBottom: 3 }}>{doc.title}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--tx-3)' }}>
                        {doc.tags?.slice(0, 3).map(t => (
                          <span key={t} style={{ marginRight: 6, padding: '1px 5px', background: 'var(--bg-elevated)', borderRadius: 3, fontSize: 10 }}>{t}</span>
                        ))}
                      </div>
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 600, color, padding: '2px 7px', background: color + '20', borderRadius: 4 }}>{doc.category}</span>
                    <ChevronRight size={13} style={{ color: 'var(--tx-3)' }} />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {viewing && <DocViewer doc={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}
