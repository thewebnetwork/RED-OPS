import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import {
  Bell,
  Inbox,
  Clock,
  Send,
  CheckCircle2,
  MessageSquare,
  FileText,
  CheckCheck
} from 'lucide-react';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { formatDistanceToNow } from 'date-fns';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const notificationIcons = {
  'new_order': Inbox,
  'order_picked': Clock,
  'review_needed': Send,
  'order_responded': MessageSquare,
  'order_delivered': CheckCircle2,
  'new_message': MessageSquare,
  'status_change': FileText,
};

const notificationColors = {
  'new_order': 'text-blue-600',
  'order_picked': 'text-amber-600',
  'review_needed': 'text-purple-600',
  'order_responded': 'text-indigo-600',
  'order_delivered': 'text-green-600',
  'new_message': 'text-slate-600',
  'status_change': 'text-rose-600',
};

export default function NotificationDropdown() {
  const { isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const [notifRes, countRes] = await Promise.all([
        axios.get(`${API}/notifications`),
        axios.get(`${API}/notifications/unread-count`)
      ]);
      setNotifications(notifRes.data.slice(0, 10));
      setUnreadCount(countRes.data.count);
    } catch (error) {
      console.error('Failed to fetch notifications');
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const markAsRead = async (notificationId) => {
    try {
      await axios.patch(`${API}/notifications/${notificationId}/read`);
      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Failed to mark as read');
    }
  };

  const markAllAsRead = async () => {
    try {
      await axios.patch(`${API}/notifications/read-all`);
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to mark all as read');
    }
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button 
          className="relative p-2 text-slate-600 hover:bg-slate-100 rounded-lg"
          data-testid="notifications-btn"
        >
          <Bell size={20} />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-rose-600 text-white text-xs font-bold rounded-full flex items-center justify-center animate-pulse">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-96 p-0">
        {/* Header */}
        <div className="p-3 border-b border-slate-100 flex items-center justify-between">
          <p className="font-semibold text-sm">Notifications</p>
          {unreadCount > 0 && (
            <button 
              onClick={markAllAsRead}
              className="text-xs text-rose-600 hover:text-rose-700 flex items-center gap-1"
            >
              <CheckCheck size={14} />
              Mark all read
            </button>
          )}
        </div>
        
        {/* Notifications List */}
        <div className="max-h-96 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="p-6 text-center">
              <Bell size={32} className="mx-auto text-slate-300 mb-2" />
              <p className="text-sm text-slate-500">No notifications yet</p>
            </div>
          ) : (
            notifications.map(notification => {
              const Icon = notificationIcons[notification.type] || Bell;
              const colorClass = notificationColors[notification.type] || 'text-slate-600';
              
              return (
                <div 
                  key={notification.id}
                  className={`p-3 border-b border-slate-50 hover:bg-slate-50 transition-colors ${
                    !notification.is_read ? 'bg-rose-50/50' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0 ${colorClass}`}>
                      <Icon size={14} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${!notification.is_read ? 'font-medium text-slate-900' : 'text-slate-700'}`}>
                        {notification.title}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{notification.message}</p>
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className="text-xs text-slate-400">
                          {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                        </span>
                        {notification.related_order_id && (
                          <Link 
                            to={`/orders/${notification.related_order_id}`}
                            onClick={() => {
                              markAsRead(notification.id);
                              setOpen(false);
                            }}
                            className="text-xs text-rose-600 hover:text-rose-700 font-medium"
                          >
                            View →
                          </Link>
                        )}
                      </div>
                    </div>
                    {!notification.is_read && (
                      <div className="w-2 h-2 rounded-full bg-rose-500 shrink-0 mt-1" />
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
        
        {/* Footer */}
        {notifications.length > 0 && (
          <div className="p-2 border-t border-slate-100">
            <Link 
              to="/notifications"
              onClick={() => setOpen(false)}
              className="block text-center text-sm text-rose-600 hover:text-rose-700 py-2 hover:bg-slate-50 rounded"
            >
              View all notifications
            </Link>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
