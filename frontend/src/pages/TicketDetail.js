import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
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
  'Open':    { background: '#3b82f618', color: '#3b82f6' },
  'Waiting': { background: '#f59e0b18', color: '#f59e0b' },
  'Closed':  { background: '#60606020', color: '#606060' },
};

const TICKET_STATUSES = ["Open", "Waiting", "Closed"];

export default function TicketDetail() {
  const { ticketId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
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
        axios.geticketId,
        axios.geticketId
      ]);
      setTicket(ticketRes.data);
      setMessages(messagesRes.data);
    } catch (error) {
      toast.error("Failed To Load");
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
      const messagesRes = await axios.geticketId;
      setMessages(messagesRes.data);
    } catch (error) {
      toast.error("Failed To Send Message");
    } finally {
      setSendingMessage(false);
    }
  };

  const handleStatusChange = async (newStatus) => {
    try {
      await axios.patch(`${API}/tickets/${ticketId}?status=${newStatus}`);
      toast.success("Status Updated");
      fetchTicketData();
    } catch (error) {
      toast.error("Failed To Update Status");
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
          Back to Tickets
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <span className="font-mono text-sm">{ticket.ticket_code}</span>
            <span style={{ ...statusColors[ticket.status], fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 5 }}>{ticket.status}</span>
          </div>
          <h1 className="text-xl font-bold mt-1">{ticket.subject}</h1>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Messages */}
        <div className="lg:col-span-2">
          <Card className="var(--border)">
            <CardHeader className="border-b pb-4">
              <CardTitle className="text-lg">Messages</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="h-96 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 ? (
                  <div className="text-center py-8">
                    No messages yet
                  </div>
                ) : (
                  messages.map(msg => (
                    <div 
                      key={msg.id}
                      className={`flex ${msg.author_user_id === user?.id ? 'justify-end' : 'justify-start'}`}
                    >
                      <div style={{ maxWidth: '80%', background: msg.author_user_id === user?.id ? '#c92a3e18' : 'var(--bg-elevated)', borderRadius: 10, padding: 16 }}>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-medium text-sm">{msg.author_name}</span>
                          <Badge variant="outline" className="text-xs">{msg.author_role}</Badge>
                        </div>
                        <p style={{ fontSize: 13, whiteSpace: "pre-wrap", color: "var(--tx-1)" }}>{msg.message_body}</p>
                        <p className="text-xs mt-2">
                          {format(new Date(msg.created_at), 'MMM d, yyyy h:mm a')}
                        </p>
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>
              
              {/* Message Composer */}
              <form onSubmit={handleSendMessage} className="border-t p-4">
                <div className="flex gap-3">
                  <Textarea
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type your message here..."
                    className="flex-1 min-h-[60px] resize-none"
                    data-testid="ticket-message-input"
                  />
                  <Button 
                    type="submit" 
                    className="bg-[var(--accent)] hover:bg-[var(--accent-hover)]"
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
          <Card className="var(--border)">
            <CardHeader className="border-b pb-4">
              <CardTitle className="text-base">Ticket Details</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              {/* Status */}
              <div>
                <Label className="text-xs">Status</Label>
                <Select value={ticket.status} onValueChange={handleStatusChange}>
                  <SelectTrigger className="mt-1.5" data-testid="ticket-status-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TICKET_STATUSES.map(s => (
                      <SelectItem key={s} value={s}>{s.toLowerCase()}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Owner */}
              <div>
                <Label className="text-xs">Owner</Label>
                <div className="flex items-center gap-2 mt-1.5">
                  <User size={16} className="" />
                  <span className="font-medium">{ticket.owner_name}</span>
                </div>
              </div>

              {/* Client */}
              {ticket.client_name && (
                <div>
                  <Label className="text-xs">Client</Label>
                  <p className="font-medium mt-1.5">{ticket.client_name}</p>
                </div>
              )}

              {/* Related Order */}
              {ticket.related_order_code && (
                <div>
                  <Label className="text-xs">Related Order</Label>
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
                <Label className="text-xs">Created</Label>
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
