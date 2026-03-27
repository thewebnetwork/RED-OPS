import React, { useState, useEffect } from 'react';
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

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const iconMap = {
  request: FileText,
  task: CheckSquare,
  comment: MessageSquare,
  update: CheckCircle2,
  invoice: DollarSign,
  delivered: CheckCircle2,
  alert: AlertCircle,
  message: MessageSquare,
};

const colorMap = {
  request: 'var(--blue)',
  task: 'var(--purple)',
  comment: 'var(--green)',
  update: 'var(--green)',
  invoice: 'var(--yellow)',
  delivered: 'var(--green)',
  alert: 'var(--red)',
  message: 'var(--blue)',
};

function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [activeTab, setActiveTab] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API}/notifications`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          setNotifications([]);
        } else {
          throw new Error('Failed to fetch notifications');
        }
      } else {
        const data = await response.json();
        const normalized = (Array.isArray(data) ? data : []).map((n) => ({
          ...n,
          icon: iconMap[n.type] || MessageSquare,
          color: colorMap[n.type] || 'var(--blue)',
        }));
        setNotifications(normalized);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (id) => {
    try {
      const token = localStorage.getItem('token');
      await fetch(`${API}/notifications/${id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ is_read: true }),
      });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
    } catch (error) {
      console.error('Error marking notification as read:', error);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
    }
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const filteredNotifications = notifications.filter((n) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'unread') return !n.is_read;
    if (activeTab === 'mentions')
      return ['comment', 'message'].includes(n.type);
    if (activeTab === 'system')
      return ['alert', 'invoice', 'update'].includes(n.type);
    return true;
  });

  const handleMarkAllRead = async () => {
    try {
      const token = localStorage.getItem('token');
      const unreadIds = notifications
        .filter((n) => !n.is_read)
        .map((n) => n.id);

      for (const id of unreadIds) {
        await fetch(`${API}/notifications/${id}`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ is_read: true }),
        });
      }
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch (error) {
      console.error('Error marking all as read:', error);
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    }
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

  if (loading) {
    return (
      <div className="page-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '300px' }}>
        <div className="spinner-ring" />
      </div>
    );
  }

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
                  ...(notification.is_read
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
                          fontWeight: notification.is_read ? '500' : '600',
                        }}
                      >
                        {notification.title}
                      </p>
                      {!notification.is_read && (
                        <button
                          onClick={() => handleMarkAsRead(notification.id)}
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
