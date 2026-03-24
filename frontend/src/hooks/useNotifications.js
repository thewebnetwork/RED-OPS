import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export function useNotifications() {
  const { isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const eventSourceRef = useRef(null);
  const sseActiveRef = useRef(false);

  const fetchNotifications = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      setLoading(true);
      const res = await axios.get(`${API}/notifications`);
      setNotifications(res.data);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  const fetchUnreadCount = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const res = await axios.get(`${API}/notifications/unread-count`);
      setUnreadCount(res.data.unread_count);
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  }, [isAuthenticated]);

  // SSE connection with polling fallback
  useEffect(() => {
    if (!isAuthenticated) return;

    const token = localStorage.getItem('token');
    if (!token) return;

    // Try SSE connection
    let es;
    try {
      es = new EventSource(`${API}/notifications/stream?token=${encodeURIComponent(token)}`);
      eventSourceRef.current = es;

      es.addEventListener('notification', (e) => {
        try {
          const notification = JSON.parse(e.data);
          setNotifications(prev => [notification, ...prev].slice(0, 50));
          setUnreadCount(prev => prev + 1);
        } catch { /* ignore parse errors */ }
      });

      es.addEventListener('connected', () => {
        sseActiveRef.current = true;
      });

      es.onerror = () => {
        sseActiveRef.current = false;
        es.close();
        eventSourceRef.current = null;
      };
    } catch {
      sseActiveRef.current = false;
    }

    // Fetch initial count
    fetchUnreadCount();

    // Polling fallback — slower interval if SSE active
    const interval = setInterval(() => {
      fetchUnreadCount();
    }, sseActiveRef.current ? 120000 : 30000);

    return () => {
      clearInterval(interval);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      sseActiveRef.current = false;
    };
  }, [isAuthenticated, fetchUnreadCount]);

  const markAsRead = async (notificationId) => {
    try {
      await axios.patch(`${API}/notifications/${notificationId}/read`);
      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await axios.patch(`${API}/notifications/read-all`);
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  return {
    notifications,
    unreadCount,
    loading,
    fetchNotifications,
    markAsRead,
    markAllAsRead
  };
}
