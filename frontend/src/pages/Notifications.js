import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { 
  Bell,
  CheckCheck,
  Inbox,
  Clock,
  Send,
  CheckCircle2,
  MessageSquare,
  FileText,
  X
} from 'lucide-react';
import { toast } from 'sonner';
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
  'new_order': 'bg-blue-100 text-blue-600',
  'order_picked': 'bg-amber-100 text-amber-600',
  'review_needed': 'bg-purple-100 text-purple-600',
  'order_responded': 'bg-indigo-100 text-indigo-600',
  'order_delivered': 'bg-green-100 text-green-600',
  'new_message': 'bg-slate-100 text-slate-600',
  'status_change': 'bg-rose-100 text-rose-600',
};

export default function Notifications() {
  const { isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isAuthenticated) {
      fetchNotifications();
    }
  }, [isAuthenticated]);

  const fetchNotifications = async () => {
    try {
      const res = await axios.get(`${API}/notifications`);
      setNotifications(res.data);
    } catch (error) {
      toast.error('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId) => {
    try {
      await axios.patch(`${API}/notifications/${notificationId}/read`);
      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
      );
    } catch (error) {
      console.error('Failed to mark as read');
    }
  };

  const markAllAsRead = async () => {
    try {
      await axios.patch(`${API}/notifications/read-all`);
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      toast.success('All notifications marked as read');
    } catch (error) {
      toast.error('Failed to mark all as read');
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-rose-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl mx-auto" data-testid="notifications-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Notifications</h1>
          <p className="text-slate-500 mt-1">
            {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up!'}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button 
            variant="outline" 
            onClick={markAllAsRead}
            data-testid="mark-all-read-btn"
          >
            <CheckCheck size={18} className="mr-2" />
            Mark all as read
          </Button>
        )}
      </div>

      {notifications.length === 0 ? (
        <Card className="border-slate-200">
          <CardContent className="p-12 text-center">
            <Bell size={48} className="mx-auto text-slate-300 mb-4" />
            <p className="text-slate-500">No notifications yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {notifications.map(notification => {
            const Icon = notificationIcons[notification.type] || Bell;
            const colorClass = notificationColors[notification.type] || 'bg-slate-100 text-slate-600';
            
            return (
              <Card 
                key={notification.id}
                className={`border-slate-200 transition-all ${!notification.is_read ? 'bg-rose-50/50 border-rose-200' : ''}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${colorClass}`}>
                      <Icon size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className={`font-medium ${!notification.is_read ? 'text-slate-900' : 'text-slate-700'}`}>
                            {notification.title}
                          </p>
                          <p className="text-sm text-slate-500 mt-0.5">{notification.message}</p>
                        </div>
                        {!notification.is_read && (
                          <button
                            onClick={() => markAsRead(notification.id)}
                            className="p-1 text-slate-400 hover:text-slate-600"
                            title="Mark as read"
                          >
                            <X size={16} />
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-2">
                        <span className="text-xs text-slate-400">
                          {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                        </span>
                        {notification.related_order_id && (
                          <Link 
                            to={`/orders/${notification.related_order_id}`}
                            className="text-xs text-rose-600 hover:text-rose-700 font-medium"
                            onClick={() => markAsRead(notification.id)}
                          >
                            View Order →
                          </Link>
                        )}
                      </div>
                    </div>
                    {!notification.is_read && (
                      <div className="w-2 h-2 rounded-full bg-rose-500 shrink-0 mt-2" />
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
