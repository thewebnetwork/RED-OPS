import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { 
  ArrowLeft,
  Send,
  Link as LinkIcon,
  User
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const statusColors = {
  'Open': 'bg-blue-100 text-blue-700',
  'Waiting': 'bg-amber-100 text-amber-700',
  'Closed': 'bg-slate-100 text-slate-500',
};

const TICKET_STATUSES = ["Open", "Waiting", "Closed"];

export default function TicketDetail() {
  const { ticketId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useTranslation();
  const messagesEndRef = useRef(null);
  
  const [ticket, setTicket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);

  useEffect(() => {
    fetchTicketData();
  }, [ticketId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchTicketData = async () => {
    try {
      const [ticketRes, messagesRes] = await Promise.all([
        axios.get(`${API}/tickets/${ticketId}`),
        axios.get(`${API}/tickets/${ticketId}/messages`)
      ]);
      setTicket(ticketRes.data);
      setMessages(messagesRes.data);
    } catch (error) {
      toast.error(t('errors.failedToLoad'));
      navigate('/tickets');
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    setSendingMessage(true);
    try {
      await axios.post(`${API}/tickets/${ticketId}/messages`, {
        message_body: newMessage.trim()
      });
      setNewMessage('');
      const messagesRes = await axios.get(`${API}/tickets/${ticketId}/messages`);
      setMessages(messagesRes.data);
    } catch (error) {
      toast.error(t('tickets.failedToSendMessage'));
    } finally {
      setSendingMessage(false);
    }
  };

  const handleStatusChange = async (newStatus) => {
    try {
      await axios.patch(`${API}/tickets/${ticketId}?status=${newStatus}`);
      toast.success(t('tickets.statusUpdated'));
      fetchTicketData();
    } catch (error) {
      toast.error(t('tickets.failedToUpdateStatus'));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-rose-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!ticket) return null;

  return (
    <div className="space-y-6 animate-fade-in" data-testid="ticket-detail-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <Button variant="ghost" onClick={() => navigate('/tickets')} className="w-fit">
          <ArrowLeft size={18} className="mr-2" />
          {t('tickets.backToTickets')}
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <span className="font-mono text-sm text-slate-500">{ticket.ticket_code}</span>
            <Badge className={statusColors[ticket.status]}>{ticket.status}</Badge>
          </div>
          <h1 className="text-xl font-bold text-slate-900 mt-1">{ticket.subject}</h1>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Messages */}
        <div className="lg:col-span-2">
          <Card className="border-slate-200">
            <CardHeader className="border-b border-slate-100 pb-4">
              <CardTitle className="text-lg">{t('tickets.messages')}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="h-96 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 ? (
                  <div className="text-center text-slate-500 py-8">
                    {t('tickets.noMessagesYet')}
                  </div>
                ) : (
                  messages.map(msg => (
                    <div 
                      key={msg.id}
                      className={`flex ${msg.author_user_id === user?.id ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`max-w-[80%] ${msg.author_user_id === user?.id ? 'bg-rose-50' : 'bg-slate-100'} rounded-lg p-4`}>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-medium text-sm">{msg.author_name}</span>
                          <Badge variant="outline" className="text-xs">{msg.author_role}</Badge>
                        </div>
                        <p className="text-sm text-slate-700 whitespace-pre-wrap">{msg.message_body}</p>
                        <p className="text-xs text-slate-400 mt-2">
                          {format(new Date(msg.created_at), 'MMM d, yyyy h:mm a')}
                        </p>
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>
              
              {/* Message Composer */}
              <form onSubmit={handleSendMessage} className="border-t border-slate-100 p-4">
                <div className="flex gap-3">
                  <Textarea
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder={t('tickets.typeYourMessage')}
                    className="flex-1 min-h-[60px] resize-none"
                    data-testid="ticket-message-input"
                  />
                  <Button 
                    type="submit" 
                    className="bg-rose-600 hover:bg-rose-700"
                    disabled={sendingMessage || !newMessage.trim()}
                    data-testid="send-ticket-message-btn"
                  >
                    <Send size={18} />
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card className="border-slate-200">
            <CardHeader className="border-b border-slate-100 pb-4">
              <CardTitle className="text-base">{t('tickets.ticketDetails')}</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              {/* Status */}
              <div>
                <Label className="text-xs text-slate-500">{t('common.status')}</Label>
                <Select value={ticket.status} onValueChange={handleStatusChange}>
                  <SelectTrigger className="mt-1.5" data-testid="ticket-status-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TICKET_STATUSES.map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Owner */}
              <div>
                <Label className="text-xs text-slate-500">{t('tickets.owner')}</Label>
                <div className="flex items-center gap-2 mt-1.5">
                  <User size={16} className="text-slate-400" />
                  <span className="font-medium">{ticket.owner_name}</span>
                </div>
              </div>

              {/* Client */}
              {ticket.client_name && (
                <div>
                  <Label className="text-xs text-slate-500">{t('tickets.client')}</Label>
                  <p className="font-medium mt-1.5">{ticket.client_name}</p>
                </div>
              )}

              {/* Related Order */}
              {ticket.related_order_code && (
                <div>
                  <Label className="text-xs text-slate-500">Related Order</Label>
                  <Link 
                    to={`/orders/${ticket.related_order_id}`}
                    className="flex items-center gap-2 mt-1.5 text-rose-600 hover:text-rose-700"
                  >
                    <LinkIcon size={14} />
                    {ticket.related_order_code}
                  </Link>
                </div>
              )}

              {/* Created */}
              <div>
                <Label className="text-xs text-slate-500">Created</Label>
                <p className="font-medium mt-1.5">
                  {format(new Date(ticket.created_at), 'MMM d, yyyy h:mm a')}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
