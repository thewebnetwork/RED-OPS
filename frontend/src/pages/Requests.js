import React, { useState, useMemo } from 'react';
import {
  Plus, Search, X, AlertCircle, ArrowUp, Minus, ArrowDown,
  MessageSquare, Clock, Filter, LayoutGrid, List,
  CheckCircle2, AlertTriangle, Eye, ChevronRight,
  User, Calendar, Info, Send
} from 'lucide-react';
import { toast } from 'sonner';

// ── Constants ──
const STAGES = [
  'Submitted',
  'Assigned',
  'In Progress',
  'Pending Review',
  'Revision',
  'Delivered',
  'Closed'
];

const STAGE_COLORS = {
  Submitted: '#3b82f6',
  Assigned: '#a855f7',
  'In Progress': '#f59e0b',
  'Pending Review': '#ec4899',
  Revision: '#ef4444',
  Delivered: '#22c55e',
  Closed: '#64748b',
};

const PRIORITY_COLORS = {
  urgent: '#ef4444',
  high: '#f97316',
  medium: '#3b82f6',
  low: '#64748b',
};

const PRIORITY_ICONS = {
  urgent: AlertCircle,
  high: ArrowUp,
  medium: Minus,
  low: ArrowDown,
};

// ── Mock Data ──
const INITIAL_MOCK_DATA = [
  {
    id: 'REQ-001',
    title: 'Q1 Facebook Ad Creative Set',
    client: 'Acme Corp',
    service: 'Ad Creative',
    priority: 'high',
    assignee: 'Alex Rivera',
    created_at: '2024-03-20T10:00:00Z',
    due_date: '2024-03-25T17:00:00Z',
    stage: 'In Progress',
    description: 'Create 5 variations of Facebook ads for the new product launch.'
  },
  {
    id: 'REQ-002',
    title: 'Brand Identity Refresh',
    client: 'Global Tech',
    service: 'Branding',
    priority: 'medium',
    assignee: 'Sarah Chen',
    created_at: '2024-03-18T09:00:00Z',
    due_date: '2024-03-28T18:00:00Z',
    stage: 'Assigned',
    description: 'Update the primary logo and color palette for the 2024 rebranding.'
  },
  {
    id: 'REQ-003',
    title: 'Product Review Video Edit',
    client: 'Vortex Inc',
    service: 'Video Editing',
    priority: 'urgent',
    assignee: 'Michael Ross',
    created_at: '2024-03-22T14:30:00Z',
    due_date: '2024-03-24T12:00:00Z',
    stage: 'Revision',
    description: 'Final edits for the product review video. Add subtitles and color grading.'
  },
  {
    id: 'REQ-004',
    title: 'Website SEO Audit',
    client: 'Starlight Media',
    service: 'SEO',
    priority: 'low',
    assignee: null,
    created_at: '2024-03-24T11:00:00Z',
    due_date: '2024-03-30T17:00:00Z',
    stage: 'Submitted',
    description: 'Complete SEO audit for the main website and identify key areas for improvement.'
  },
  {
    id: 'REQ-005',
    title: 'Instagram Content Calendar',
    client: 'Urban Style',
    service: 'Social Media',
    priority: 'medium',
    assignee: 'Jessica Lee',
    created_at: '2024-03-21T16:00:00Z',
    due_date: '2024-03-26T17:00:00Z',
    stage: 'Pending Review',
    description: 'Draft the Instagram content calendar for April 2024.'
  },
  {
    id: 'REQ-006',
    title: 'Email Campaign Setup',
    client: 'Growth Pro',
    service: 'Email Marketing',
    priority: 'high',
    assignee: 'David Kim',
    created_at: '2024-03-19T10:00:00Z',
    due_date: '2024-03-22T17:00:00Z',
    stage: 'Delivered',
    description: 'Set up the automated email drip campaign for new newsletter subscribers.'
  },
  {
    id: 'REQ-007',
    title: 'Landing Page Copywriting',
    client: 'Nexus Labs',
    service: 'Copywriting',
    priority: 'low',
    assignee: 'Emma Wilson',
    created_at: '2024-03-15T12:00:00Z',
    due_date: '2024-03-18T17:00:00Z',
    stage: 'Closed',
    description: 'Write copy for the new SaaS product landing page.'
  },
  {
    id: 'REQ-008',
    title: 'Logo Animation',
    client: 'Pixel Perfect',
    service: 'Motion Graphics',
    priority: 'medium',
    assignee: 'Brian O Connor',
    created_at: '2024-03-23T09:00:00Z',
    due_date: '2024-03-27T17:00:00Z',
    stage: 'In Progress',
    description: 'Animate the new company logo for video intros.'
  },
  {
    id: 'REQ-009',
    title: 'Market Research Report',
    client: 'Fortune 500',
    service: 'Strategy',
    priority: 'high',
    assignee: null,
    created_at: '2024-03-24T08:30:00Z',
    due_date: '2024-04-05T17:00:00Z',
    stage: 'Submitted',
    description: 'Conduct comprehensive market research on the AI hardware sector.'
  },
  {
    id: 'REQ-010',
    title: 'YouTube Scriptwriting',
    client: 'Creator Hub',
    service: 'Scriptwriting',
    priority: 'medium',
    assignee: 'Liam Smith',
    created_at: '2024-03-20T11:00:00Z',
    due_date: '2024-03-22T14:00:00Z',
    stage: 'Delivered',
    description: 'Write the script for the "10 AI Tools You Need in 2024" video.'
  },
  {
    id: 'REQ-011',
    title: 'Podcast Audio Mastering',
    client: 'Sound Wave',
    service: 'Audio Editing',
    priority: 'low',
    assignee: 'Ryan Brown',
    created_at: '2024-03-22T15:00:00Z',
    due_date: '2024-03-25T12:00:00Z',
    stage: 'Assigned',
    description: 'Master the audio for the latest podcast episode, ensuring clear levels throughout.'
  },
  {
    id: 'REQ-012',
    title: 'B2B Sales Presentation',
    client: 'Iron Works',
    service: 'Pitch Deck',
    priority: 'urgent',
    assignee: 'Olivia Garcia',
    created_at: '2024-03-23T16:30:00Z',
    due_date: '2024-03-24T10:00:00Z',
    stage: 'Pending Review',
    description: 'Finalize the B2B sales presentation for the upcoming investor meeting.'
  }
];

// ── Helpers ──
const isOverdue = (date) => new Date(date) < new Date();
const formatDate = (date) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

// ── Components ──

function PriorityBadge({ priority }) {
  const Icon = PRIORITY_ICONS[priority] || Minus;
  const color = PRIORITY_COLORS[priority] || '#64748b';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
      background: `${color}15`, color, border: `1px solid ${color}30`,
      textTransform: 'capitalize'
    }}>
      <Icon size={12} /> {priority}
    </span>
  );
}

function StagePill({ stage }) {
  const color = STAGE_COLORS[stage] || '#64748b';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 12, fontSize: 10, fontWeight: 700,
      background: `${color}15`, color, border: `1px solid ${color}30`,
      textTransform: 'uppercase', letterSpacing: '0.02em'
    }}>
      {stage}
    </span>
  );
}

function RequestCard({ request, onClick }) {
  const overdue = isOverdue(request.due_date) && !['Delivered', 'Closed'].includes(request.stage);
  
  return (
    <div
      onClick={() => onClick(request)}
      className="interaction-card"
      style={{
        padding: 14, marginBottom: 12, cursor: 'pointer',
        borderLeft: `3px solid ${PRIORITY_COLORS[request.priority]}`,
        position: 'relative'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--tx-3)', opacity: 0.7 }}>{request.id}</span>
        {overdue && (
          <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--red)', display: 'flex', alignItems: 'center', gap: 3 }}>
            <AlertTriangle size={10} /> OVERDUE
          </span>
        )}
      </div>
      <h4 style={{ fontSize: 13, fontWeight: 600, color: 'var(--tx-1)', margin: '0 0 8px', lineHeight: 1.4 }}>
        {request.title}
      </h4>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
        <span style={{ fontSize: 11, color: 'var(--tx-2)', fontWeight: 500 }}>{request.client}</span>
        <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--border)' }} />
        <span style={{ fontSize: 11, color: 'var(--tx-3)' }}>{request.service}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {request.assignee ? (
            <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff' }}>
              {request.assignee.split(' ').map(n => n[0]).join('')}
            </div>
          ) : (
            <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--bg)', border: '1px dashed var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <User size={12} style={{ color: 'var(--tx-3)' }} />
            </div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: overdue ? 'var(--red)' : 'var(--tx-3)', fontSize: 11, fontWeight: 500 }}>
          <Clock size={12} />
          {formatDate(request.due_date)}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──
export default function Requests() {
  const [requests, setRequests] = useState(INITIAL_MOCK_DATA);
  const [view, setView] = useState('kanban'); // 'kanban' or 'table'
  const [search, setSearch] = useState('');
  const [priFilter, setPriFilter] = useState('all');
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [newRequest, setNewRequest] = useState({ title: '', client: '', service: '', priority: 'medium', due_date: '', description: '' });

  // Counts
  const stats = useMemo(() => {
    const total = requests.length;
    const open = requests.filter(r => !['Delivered', 'Closed'].includes(r.stage)).length;
    const overdue = requests.filter(r => isOverdue(r.due_date) && !['Delivered', 'Closed'].includes(r.stage)).length;
    return { total, open, overdue };
  }, [requests]);

  // Filtered
  const filteredRequests = useMemo(() => {
    return requests.filter(r => {
      const matchesSearch = r.title.toLowerCase().includes(search.toLowerCase()) || r.client.toLowerCase().includes(search.toLowerCase());
      const matchesPri = priFilter === 'all' || r.priority === priFilter;
      return matchesSearch && matchesPri;
    });
  }, [requests, search, priFilter]);

  // Handlers
  const handleAddRequest = () => {
    if (!newRequest.title || !newRequest.client) {
      toast.error('Title and Client are required');
      return;
    }
    const req = {
      ...newRequest,
      id: `REQ-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
      created_at: new Date().toISOString(),
      stage: 'Submitted',
      assignee: null
    };
    setRequests([req, ...requests]);
    setShowNewModal(false);
    setNewRequest({ title: '', client: '', service: '', priority: 'medium', due_date: '', description: '' });
    toast.success('Request added to pipeline');
  };

  const updateRequest = (id, updates) => {
    setRequests(requests.map(r => r.id === id ? { ...r, ...updates } : r));
    if (selectedRequest?.id === id) setSelectedRequest({ ...selectedRequest, ...updates });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)', overflow: 'hidden' }}>
      
      {/* ── Toolbar ── */}
      <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', background: 'var(--bg-card)', zIndex: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--tx-1)', margin: 0 }}>Request Pipeline</h1>
            <div style={{ display: 'flex', gap: 16, marginTop: 6 }}>
              <span style={{ fontSize: 12, color: 'var(--tx-3)' }}>{stats.total} total</span>
              <span style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>{stats.open} open</span>
              {stats.overdue > 0 && <span style={{ fontSize: 12, color: 'var(--red)', fontWeight: 600 }}>{stats.overdue} overdue</span>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ display: 'flex', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
              <button 
                onClick={() => setView('kanban')}
                style={{ padding: '8px 12px', background: view === 'kanban' ? 'var(--accent)' : 'transparent', color: view === 'kanban' ? '#fff' : 'var(--tx-3)', border: 'none', cursor: 'pointer' }}
              >
                <LayoutGrid size={16} />
              </button>
              <button 
                onClick={() => setView('table')}
                style={{ padding: '8px 12px', background: view === 'table' ? 'var(--accent)' : 'transparent', color: view === 'table' ? '#fff' : 'var(--tx-3)', border: 'none', cursor: 'pointer' }}
              >
                <List size={16} />
              </button>
            </div>
            <button className="btn-primary" onClick={() => setShowNewModal(true)}>
              <Plus size={16} /> New Request
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, maxWidth: 400 }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--tx-3)' }} />
            <input 
              className="input-field"
              placeholder="Search requests or clients..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: 38, background: 'var(--bg)' }}
            />
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {['all', 'urgent', 'high', 'medium', 'low'].map(p => (
              <button
                key={p}
                onClick={() => setPriFilter(p)}
                style={{
                  padding: '6px 14px', borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                  border: '1px solid var(--border)',
                  background: priFilter === p ? 'var(--card)' : 'transparent',
                  color: priFilter === p ? 'var(--tx-1)' : 'var(--tx-3)',
                  textTransform: 'uppercase', transition: 'all 0.2s'
                }}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div style={{ flex: 1, overflow: 'auto', padding: view === 'kanban' ? '20px 24px' : 24 }}>
        {view === 'kanban' ? (
          <div style={{ display: 'flex', gap: 20, height: '100%', minWidth: 'fit-content' }}>
            {STAGES.map(stage => (
              <div key={stage} style={{ width: 280, display: 'flex', flexDirection: 'column', height: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, padding: '0 4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: STAGE_COLORS[stage] }} />
                    <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--tx-1)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {stage}
                    </h3>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--tx-3)', background: 'var(--bg-card)', padding: '2px 8px', borderRadius: 10, border: '1px solid var(--border)' }}>
                    {filteredRequests.filter(r => r.stage === stage).length}
                  </span>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', paddingRight: 4 }}>
                  {filteredRequests.filter(r => r.stage === stage).map(req => (
                    <RequestCard key={req.id} request={req} onClick={setSelectedRequest} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="interaction-card" style={{ padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-card)' }}>
                  <th style={{ textAlign: 'left', padding: '14px 20px', fontSize: 11, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase' }}>ID</th>
                  <th style={{ textAlign: 'left', padding: '14px 20px', fontSize: 11, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase' }}>Request</th>
                  <th style={{ textAlign: 'left', padding: '14px 20px', fontSize: 11, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase' }}>Client</th>
                  <th style={{ textAlign: 'left', padding: '14px 20px', fontSize: 11, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase' }}>Stage</th>
                  <th style={{ textAlign: 'left', padding: '14px 20px', fontSize: 11, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase' }}>Priority</th>
                  <th style={{ textAlign: 'left', padding: '14px 20px', fontSize: 11, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase' }}>Due</th>
                </tr>
              </thead>
              <tbody>
                {filteredRequests.map(req => (
                  <tr 
                    key={req.id} 
                    onClick={() => setSelectedRequest(req)}
                    style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.1s' }}
                    className="table-row-hover"
                  >
                    <td style={{ padding: '14px 20px', fontSize: 12, color: 'var(--tx-3)', fontVariantNumeric: 'tabular-nums' }}>{req.id}</td>
                    <td style={{ padding: '14px 20px' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--tx-1)' }}>{req.title}</div>
                      <div style={{ fontSize: 11, color: 'var(--tx-3)', marginTop: 2 }}>{req.service}</div>
                    </td>
                    <td style={{ padding: '14px 20px', fontSize: 12, color: 'var(--tx-2)' }}>{req.client}</td>
                    <td style={{ padding: '14px 20px' }}><StagePill stage={req.stage} /></td>
                    <td style={{ padding: '14px 20px' }}><PriorityBadge priority={req.priority} /></td>
                    <td style={{ padding: '14px 20px', fontSize: 12, color: isOverdue(req.due_date) ? 'var(--red)' : 'var(--tx-3)', fontWeight: 500 }}>
                      {formatDate(req.due_date)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── New Request Modal ── */}
      {showNewModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div 
            className="interaction-card" 
            style={{ width: '100%', maxWidth: 500, padding: 32, animation: 'scaleIn 0.2s ease' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--tx-1)', margin: 0 }}>New Service Request</h2>
              <button onClick={() => setShowNewModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx-3)' }}>
                <X size={20} />
              </button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase', marginBottom: 6 }}>Request Title</label>
                <input 
                  className="input-field" 
                  placeholder="e.g. Q4 Facebook Campaign Creatives"
                  value={newRequest.title}
                  onChange={(e) => setNewRequest({ ...newRequest, title: e.target.value })}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase', marginBottom: 6 }}>Client</label>
                  <input 
                    className="input-field" 
                    placeholder="Client name"
                    value={newRequest.client}
                    onChange={(e) => setNewRequest({ ...newRequest, client: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase', marginBottom: 6 }}>Service</label>
                  <input 
                    className="input-field" 
                    placeholder="e.g. Ad Creative"
                    value={newRequest.service}
                    onChange={(e) => setNewRequest({ ...newRequest, service: e.target.value })}
                  />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase', marginBottom: 6 }}>Priority</label>
                  <select 
                    className="input-field"
                    value={newRequest.priority}
                    onChange={(e) => setNewRequest({ ...newRequest, priority: e.target.value })}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase', marginBottom: 6 }}>Due Date</label>
                  <input 
                    type="date"
                    className="input-field"
                    value={newRequest.due_date}
                    onChange={(e) => setNewRequest({ ...newRequest, due_date: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase', marginBottom: 6 }}>Description</label>
                <textarea 
                  className="input-field" 
                  rows={4}
                  placeholder="Provide any relevant details or requirements..."
                  value={newRequest.description}
                  onChange={(e) => setNewRequest({ ...newRequest, description: e.target.value })}
                />
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
                <button className="btn-ghost" style={{ flex: 1 }} onClick={() => setShowNewModal(false)}>Cancel</button>
                <button className="btn-primary" style={{ flex: 1 }} onClick={handleAddRequest}>Submit Request</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Detail Panel ── */}
      {selectedRequest && (
        <div 
          style={{ position: 'fixed', inset: 0, zIndex: 900, display: 'flex', justifyContent: 'flex-end' }}
        >
          <div 
            style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', cursor: 'pointer' }}
            onClick={() => setSelectedRequest(null)}
          />
          <div 
            className="interaction-card"
            style={{ 
              width: '100%', maxWidth: 450, height: '100%', borderRadius: 0, borderTop: 'none', borderBottom: 'none', borderRight: 'none',
              padding: 0, zIndex: 901, animation: 'slideRight 0.3s ease both', display: 'flex', flexDirection: 'column'
            }}
          >
            {/* Panel Header */}
            <div style={{ padding: '24px 28px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--tx-3)' }}>{selectedRequest.id}</span>
                  <StagePill stage={selectedRequest.stage} />
                </div>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--tx-1)', margin: 0, lineHeight: 1.4 }}>{selectedRequest.title}</h2>
              </div>
              <button onClick={() => setSelectedRequest(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx-3)' }}>
                <X size={20} />
              </button>
            </div>

            {/* Panel Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 32 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase', marginBottom: 8, letterSpacing: '0.04em' }}>Pipeline Stage</label>
                  <select 
                    className="input-field"
                    value={selectedRequest.stage}
                    onChange={(e) => updateRequest(selectedRequest.id, { stage: e.target.value })}
                    style={{ fontSize: 12, fontWeight: 600 }}
                  >
                    {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase', marginBottom: 8, letterSpacing: '0.04em' }}>Priority</label>
                  <select 
                    className="input-field"
                    value={selectedRequest.priority}
                    onChange={(e) => updateRequest(selectedRequest.id, { priority: e.target.value })}
                    style={{ fontSize: 12, fontWeight: 600 }}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>

              <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, marginBottom: 32 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--tx-3)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>
                      <User size={12} /> Client
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--tx-1)' }}>{selectedRequest.client}</div>
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--tx-3)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>
                      <Info size={12} /> Service
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--tx-1)' }}>{selectedRequest.service}</div>
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--tx-3)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>
                      <Calendar size={12} /> Created
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--tx-2)' }}>{formatDate(selectedRequest.created_at)}</div>
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--tx-3)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>
                      <Clock size={12} /> Deadline
                    </div>
                    <div style={{ fontSize: 12, color: isOverdue(selectedRequest.due_date) ? 'var(--red)' : 'var(--tx-2)', fontWeight: 600 }}>
                      {formatDate(selectedRequest.due_date)}
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: 32 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase', marginBottom: 8, letterSpacing: '0.04em' }}>Description</label>
                <p style={{ fontSize: 13, color: 'var(--tx-2)', lineHeight: 1.6, margin: 0 }}>
                  {selectedRequest.description}
                </p>
              </div>

              {/* Activity Feed Mock */}
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 28 }}>
                <h3 style={{ fontSize: 12, fontWeight: 700, color: 'var(--tx-1)', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <MessageSquare size={14} /> Activity Feed
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgb(59, 130, 246)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0 }}>AR</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--tx-1)' }}>Alex Rivera</span>
                        <span style={{ fontSize: 10, color: 'var(--tx-3)' }}>2h ago</span>
                      </div>
                      <p style={{ fontSize: 12, color: 'var(--tx-2)', margin: 0, lineHeight: 1.5, background: 'var(--bg)', padding: '8px 12px', borderRadius: '0 10px 10px 10px' }}>
                        I've started working on the brief. Will have the first draft by tomorrow EOD.
                      </p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--bg-card)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <User size={14} style={{ color: 'var(--tx-3)' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--tx-1)' }}>System</span>
                        <span style={{ fontSize: 10, color: 'var(--tx-3)' }}>4h ago</span>
                      </div>
                      <p style={{ fontSize: 11, color: 'var(--tx-3)', fontStyle: 'italic', margin: 0 }}>
                        Stage changed from <span style={{ fontWeight: 600 }}>Submitted</span> to <span style={{ fontWeight: 600 }}>Assigned</span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Panel Footer (Comment Input) */}
            <div style={{ padding: '20px 28px', borderTop: '1px solid var(--border)', background: 'var(--bg-card)' }}>
              <div style={{ display: 'flex', gap: 10, position: 'relative' }}>
                <input 
                  className="input-field" 
                  placeholder="Post a comment..."
                  style={{ borderRadius: 24, paddingLeft: 16, paddingRight: 48 }}
                />
                <button 
                  style={{ 
                    position: 'absolute', right: 4, top: 4, bottom: 4, width: 32, height: 32, borderRadius: '50%', 
                    background: 'var(--accent)', color: '#fff', border: 'none', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}
                >
                  <Send size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      <style jsx>{`
        input:-webkit-autofill,
        input:-webkit-autofill:hover,
        input:-webkit-autofill:focus {
          -webkit-text-fill-color: var(--tx-1);
          -webkit-box-shadow: 0 0 0px 1000px var(--bg) inset;
          transition: background-color 5000s ease-in-out 0s;
        }
      `}</style>
    </div>
  );
}
