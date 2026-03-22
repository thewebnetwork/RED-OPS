import React, { useState } from 'react';
import {
  Bell,
  X,
  FileText,
  CheckSquare,
  MessageSquare,
  AlertCircle,
  DollarSign,
  CheckCircle2,
  User,
  Settings,
  ChevronRight,
} from 'lucide-react';

const mockNotifications = [
  {
    id: 1,
    type: 'request',
    title: 'New request from Riverside Realty',
    description: 'They submitted a design project request',
    timestamp: '5 mins ago',
    isRead: false,
    icon: FileText,
    color: 'var(--blue)',
  },
  {
    id: 2,
    type: 'task',
    title: 'Task assigned: April Creative Brief',
    description: 'You have been assigned a new task',
    timestamp: '12 mins ago',
    isRead: false,
    icon: CheckSquare,
    color: 'var(--purple)',
  },
  {
    id: 3,
    type: 'comment',
    title: 'Jordan Kim left a comment on RRG-000003',
    description: 'Added feedback to your Social Media Pack request',
    timestamp: '1 hour ago',
    isRead: false,
    icon: MessageSquare,
    color: 'var(--green)',
  },
  {
    id: 4,
    type: 'update',
    title: 'Dani K. Rebrand Package is 90% complete',
    description: 'Your project is almost finished',
    timestamp: '2 hours ago',
    isRead: true,
    icon: CheckCircle2,
    color: 'var(--green)',
  },
  {
    id: 5,
    type: 'invoice',
    title: 'Invoice #1042 is due in 3 days',
    description: 'Payment reminder for your monthly invoice',
    timestamp: '3 hours ago',
    isRead: true,
    icon: DollarSign,
    color: 'var(--yellow)',
  },
  {
    id: 6,
    type: 'delivered',
    title: 'Thompson RE campaign delivered',
    description: 'Your campaign has been completed and delivered',
    timestamp: 'Yesterday',
    isRead: true,
    icon: CheckCircle2,
    color: 'var(--green)',
  },
  {
    id: 7,
    type: 'alert',
    title: 'System maintenance scheduled',
    description: 'Platform maintenance on Sunday, 2am - 4am EST',
    timestamp: '2 days ago',
    isRead: true,
    icon: AlertCircle,
    color: 'var(--red)',
  },
  {
    id: 8,
    type: 'message',
    title: 'New message from support team',
    description: 'Response to your help ticket #3847',
    timestamp: '3 days ago',
    isRead: true,
    icon: MessageSquare,
    color: 'var(--blue)',
  },
];

function Notifications() {
  const [notifications, setNotifications] = useState(mockNotifications);
  const [activeTab, setActiveTab] = useState('all');

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const filteredNotifications = notifications.filter((n) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'unread') return !n.isRead;
    if (activeTab === 'mentions')
      return ['comment', 'message'].includes(n.type);
    if (activeTab === 'system')
      return ['alert', 'invoice', 'update'].includes(n.type);
    return true;
  });

  const handleDismiss = (id) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
  };

  const handleMarkAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  const groupByDate = (notifs) => {
    const today = notifs.filter((n) =>
      n.timestamp.includes('mins ago') || n.timestamp.includes('hour')
    );
    const yesterday = notifs.filter((n) => n.timestamp.includes('Yesterday'));
    const thisWeek = notifs.filter(
      (n) =>
        !n.timestamp.includes('mins ago') &&
        !n.timestamp.includes('hour') &&
        !n.timestamp.includes('Yesterday') &&
        !n.timestamp.includes('days ago')
    );
    const older = notifs.filter((n) => n.timestamp.includes('days ago'));

    return { today, yesterday, thisWeek, older };
  };

  return (
    <div className="page-content">
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Notifications</h1>
          <p style={styles.subtitle}>
            {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up!'}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="btn btn-ghost btn-sm"
            style={styles.markAllBtn}
          >
            Mark all read
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div style={styles.tabsContainer}>
        {['all', 'unread', 'mentions', 'system'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              ...styles.tab,
              ...(activeTab === tab ? styles.tabActive : styles.tabInactive),
            }}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Notifications List */}
      {filteredNotifications.length === 0 ? (
        <div className="empty-state">
          <Bell size={48} style={{ color: 'var(--tx-3)', marginBottom: '12px' }} />
          <p style={{ color: 'var(--tx-2)', marginTop: '12px' }}>
            {activeTab === 'all'
              ? 'No notifications yet'
              : `No ${activeTab} notifications`}
          </p>
        </div>
      ) : (
        <div style={styles.notificationsList}>
          {filteredNotifications.map((notification) => {
            const Icon = notification.icon;
            return (
              <div
                key={notification.id}
                style={{
                  ...styles.notificationItem,
                  ...(notification.isRead
                    ? styles.notificationRead
                    : styles.notificationUnread),
                }}
              >
                <div style={styles.notificationContent}>
                  <div style={styles.notificationDot}>
                    <div
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: notification.color,
                      }}
                    />
                  </div>

                  <div style={styles.notificationText}>
                    <div style={styles.notificationTitleRow}>
                      <p
                        style={{
                          ...styles.notificationTitle,
                          fontWeight: notification.isRead ? '500' : '600',
                        }}
                      >
                        {notification.title}
                      </p>
                      {!notification.isRead && (
                        <button
                          onClick={() => handleDismiss(notification.id)}
                          style={styles.dismissBtn}
                          title="Dismiss"
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>
                    <p style={styles.notificationDescription}>
                      {notification.description}
                    </p>
                    <p style={styles.notificationTime}>{notification.timestamp}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const styles = {
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '32px',
  },
  title: {
    fontSize: '22px',
    fontWeight: '600',
    color: 'var(--tx-1)',
    margin: '0 0 8px 0',
  },
  subtitle: {
    fontSize: '14px',
    color: 'var(--tx-2)',
    margin: '0',
  },
  markAllBtn: {
    fontSize: '12px',
  },
  tabsContainer: {
    display: 'flex',
    gap: '0',
    borderBottom: '1px solid var(--border)',
    marginBottom: '24px',
  },
  tab: {
    padding: '12px 16px',
    fontSize: '13px',
    fontWeight: '500',
    border: 'none',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    borderBottom: '2px solid transparent',
    transition: 'all 0.2s',
    color: 'var(--tx-2)',
  },
  tabActive: {
    color: 'var(--tx-1)',
    borderBottomColor: 'var(--red)',
  },
  tabInactive: {
    color: 'var(--tx-2)',
  },
  notificationsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  notificationItem: {
    padding: '16px',
    borderRadius: '8px',
    border: '1px solid var(--border)',
    transition: 'all 0.2s',
  },
  notificationRead: {
    backgroundColor: 'var(--bg)',
  },
  notificationUnread: {
    backgroundColor: 'var(--bg-elevated)',
  },
  notificationContent: {
    display: 'flex',
    gap: '12px',
  },
  notificationDot: {
    display: 'flex',
    alignItems: 'flex-start',
    paddingTop: '2px',
    flexShrink: 0,
  },
  notificationText: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  notificationTitleRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '8px',
  },
  notificationTitle: {
    fontSize: '14px',
    color: 'var(--tx-1)',
    margin: '0',
  },
  notificationDescription: {
    fontSize: '13px',
    color: 'var(--tx-2)',
    margin: '0',
  },
  notificationTime: {
    fontSize: '12px',
    color: 'var(--tx-3)',
    margin: '0',
  },
  dismissBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--tx-3)',
    cursor: 'pointer',
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'color 0.2s',
  },
};

export default Notifications;
