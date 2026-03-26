import React, { useState, useEffect } from 'react';
import {
  Bell, X, FileText, CheckSquare, MessageSquare, AlertCircle,
  DollarSign, User,
  Info, BellOff
} from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const MOCK_NOTIFICATIONS = [
  { id: '1', type: 'request', title: 'New Request Submitted', description: 'Your request "Q2 Brand Assets" has been successfully submitted.', timestamp: '2m ago', is_read: false },
  { id: '2', type: 'message', title: 'Sarah Chen mentioned you', description: '"@Alex can you take a look at the revised logo options?"', timestamp: '15m ago', is_read: false },
  { id: '3', type: 'update', title: 'Status Update: SEO Audit', description: 'Your "SEO Audit - Main Site" project is now in Pending Review.', timestamp: '1h ago', is_read: false },
  { id: '4', type: 'alert', title: 'Security Alert', description: 'New login detected from Safari on macOS (San Francisco, CA).', timestamp: '3h ago', is_read: true },
  { id: '5', type: 'invoice', title: 'Invoice Paid', description: 'Payment for invoice INV-2024-001 has been processed.', timestamp: 'Yesterday', is_read: true },
  { id: '6', type: 'task', title: 'New Task Assigned', description: 'You have been assigned to "Review Facebook Ad Copy".', timestamp: 'Yesterday', is_read: true },
  { id: '7', type: 'delivered', title: 'Delivery Ready', description: 'The final files for "Newsletter Layout" are ready for download.', timestamp: '2 days ago', is_read: true },
];

const iconMap = {
  request: { icon: FileText, color: '#3b82f6' },
  message: { icon: MessageSquare, color: '#22c55e' },
  update: { icon: Info, color: '#3b82f6' },
  alert: { icon: AlertCircle, color: '#f43f5e' },
};

// ── Components ──

function NotificationCard({ notification, onRead, onDismiss }) {
  const meta = iconMap[notification.type] || { icon: Bell, color: 'var(--tx-3)' };
  const Icon = meta.icon;

  return (
    <div 
      className={`notif-card ${notification.is_read ? 'read' : 'unread'}`}
      onClick={() => !notification.is_read && onRead(notification.id)}
    >
      <div className="notif-icon" style={{ background: `${meta.color}15` }}>
        <Icon size={18} style={{ color: meta.color }} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <h4 style={{ fontSize: 14, fontWeight: notification.is_read ? 600 : 700, color: 'var(--tx-1)', margin: 0 }}>{notification.title}</h4>
          <span style={{ fontSize: 11, color: 'var(--tx-3)', fontWeight: 500 }}>{notification.timestamp}</span>
        </div>
        <p style={{ fontSize: 13, color: 'var(--tx-2)', margin: 0, lineHeight: 1.5 }}>{notification.description}</p>
      </div>

      <button 
        onClick={(e) => { e.stopPropagation(); onDismiss(notification.id); }}
        style={{ padding: 4, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx-3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <X size={14} />
      </button>
    </div>
  );
}

// ── Main Page ──

function Notifications() {
  const [notifs, setNotifs] = useState(MOCK_NOTIFICATIONS);
  const [activeTab, setActiveTab] = useState('all');
  const [loading, setLoading] = useState(false);

  const unreadCount = notifs.filter(n => !n.is_read).length;

  const filteredNotifs = notifs.filter(n => {
    if (activeTab === 'all') return true;
    if (activeTab === 'unread') return !n.is_read;
    if (activeTab === 'mentions') return n.type === 'message';
    if (activeTab === 'system') return ['alert', 'invoice', 'update'].includes(n.type);
    return true;
  });

  const handleMarkAsRead = (id) => {
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  const handleDismiss = (id) => {
    // Stage-verified explicit removal from local state
    setNotifs(prev => prev.filter(n => n.id !== id));
    toast.success('Notification cleared');
  };

  const handleMarkAllRead = () => {
    setNotifs(prev => prev.map(n => ({ ...n, is_read: true })));
    toast.success('All notifications marked as read');
  };

  return (
    <div className="page-content" style={{ padding: '32px 40px', maxWidth: 800, margin: '0 auto' }}>
      
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--tx-1)', margin: '0 0 6px', letterSpacing: '-0.04em' }}>Notifications</h1>
          <p style={{ fontSize: 14, color: 'var(--tx-3)', margin: 0 }}>
            {unreadCount > 0 ? `You have ${unreadCount} unread update${unreadCount === 1 ? '' : 's'}.` : 'All caught up!'}
          </p>
        </div>
        {unreadCount > 0 && (
          <button onClick={handleMarkAllRead} className="btn-ghost" style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>
            Mark all as read
          </button>
        )}
      </div>

      {/* ── Filters ── */}
      <div style={{ display: 'flex', gap: 24, borderBottom: '1px solid var(--border)', marginBottom: 24 }}>
        {['all', 'unread', 'mentions', 'system'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '12px 4px', fontSize: 14, fontWeight: 600, border: 'none', background: 'none', cursor: 'pointer',
              color: activeTab === tab ? 'var(--tx-1)' : 'var(--tx-3)',
              borderBottom: `2px solid ${activeTab === tab ? 'var(--accent)' : 'transparent'}`,
              transition: 'all 0.2s', textTransform: 'capitalize'
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ── List ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {filteredNotifs.length > 0 ? (
          filteredNotifs.map(n => (
            <NotificationCard 
              key={n.id} 
              notification={n} 
              onRead={handleMarkAsRead} 
              onDismiss={handleDismiss} 
            />
          ))
        ) : (
          <div style={{ padding: '64px 0', textAlign: 'center' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--bg-card)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <BellOff size={24} style={{ color: 'var(--tx-3)' }} />
            </div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--tx-1)', margin: '0 0 8px' }}>
              {activeTab === 'all' ? 'No Notifications' : `No ${activeTab} notifications`}
            </h3>
            <p style={{ fontSize: 14, color: 'var(--tx-3)', maxWidth: 300, margin: '0 auto' }}>
              When you receive updates about your requests or mentions, they will appear here.
            </p>
          </div>
        )}
      </div>

    </div>
  );
}

export default Notifications;
