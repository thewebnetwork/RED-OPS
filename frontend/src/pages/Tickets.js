import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog';
import { 
  Plus, 
  Search,
  MessageSquare,
  Link as LinkIcon,
  Filter
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const statusColors = {
  'Open': '',
  'Waiting': '',
  'Closed': 'bg-neutral-800',
};

const TICKET_STATUSES = ["Open", "Waiting", "Closed"];

export default function Tickets() {
  const { hasRole } = useAuth();
const [tickets, setTickets] = useState([]);
  const [clients, setClients] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    subject: '',
    client_id: '',
    related_order_id: '',
    message_body: ''
  });

  useEffect(() => {
    fetchData();
  }, [statusFilter]);

  const fetchData = async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      
      const [ticketsRes, clientsRes, ordersRes] = await Promise.all([
        axios.get(`${API}/tickets?${params.toString()}`),
        hasRole('Admin', 'Manager') ? axios.get(`${API}/clients`) : Promise.resolve({ data: [] }),
        hasRole('Admin', 'Manager') ? axios.get(`${API}/orders`) : Promise.resolve({ data: [] })
      ]);
      setTickets(ticketsRes.data);
      setClients(clientsRes.data);
      setOrders(ordersRes.data);
    } catch (error) {
      toast.error("Failed To Load");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.subject) {
      toast.error("Enter Title");
      return;
    }

    try {
      const payload = { ...formData };
      if (!payload.client_id) delete payload.client_id;
      if (!payload.related_order_id) delete payload.related_order_id;
      if (!payload.message_body) delete payload.message_body;
      
      await axios.post(`${API}/tickets`, payload);
      toast.success("Ticket Created");
      setDialogOpen(false);
      setFormData({ subject: '', client_id: '', related_order_id: '', message_body: '' });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed To Create");
    }
  };

  const handleStatusChange = async (ticketId, newStatus) => {
    try {
      await axios.patch(`${API}/tickets/${ticketId}?status=${newStatus}`);
      toast.success("Status Updated");
      fetchData();
    } catch (error) {
      toast.error("Failed To Update Status");
    }
  };

  const filteredTickets = tickets.filter(t => 
    t.subject.toLowerCase().includes(search.toLowerCase()) ||
    t.ticket_code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in" data-testid="tickets-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Support Tickets</h1>
          <p className="mt-1">{tickets.length} tickets</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[var(--accent)] hover:bg-[var(--accent-hover)]" data-testid="create-ticket-btn">
              <Plus size={18} className="mr-2" />
              Create New Ticket
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Ticket</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Subject *</Label>
                <Input
                  value={formData.subject}
                  onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
                  placeholder="Enter ticket subject"
                  className="mt-1.5"
                  data-testid="ticket-subject-input"
                />
              </div>
              {hasRole('Admin', 'Manager') && (
                <>
                  <div>
                    <Label>Client (Optional)</Label>
                    <Select
                      value={formData.client_id}
                      onValueChange={(v) => setFormData(prev => ({ ...prev, client_id: v }))}
                    >
                      <SelectTrigger className="mt-1.5">
                        <SelectValue placeholder="Select a client" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        {clients.map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Related Order (Optional)</Label>
                    <Select
                      value={formData.related_order_id}
                      onValueChange={(v) => setFormData(prev => ({ ...prev, related_order_id: v }))}
                    >
                      <SelectTrigger className="mt-1.5">
                        <SelectValue placeholder="Link to an order" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        {orders.map(o => (
                          <SelectItem key={o.id} value={o.id}>{o.order_code} - {o.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
              <div>
                <Label>Initial Message (Optional)</Label>
                <Textarea
                  value={formData.message_body}
                  onChange={(e) => setFormData(prev => ({ ...prev, message_body: e.target.value }))}
                  placeholder="Describe the issue or provide details"
                  className="mt-1.5"
                />
              </div>
              <Button type="submit" className="w-full bg-[var(--accent)] hover:bg-[var(--accent-hover)]">
                Create New Ticket
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card className="">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                placeholder="Search by ticket code or subject..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
                data-testid="search-tickets"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40" data-testid="status-filter">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {TICKET_STATUSES.map(s => (
                  <SelectItem key={s} value={s}>{s.toLowerCase()}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tickets List */}
      <Card className="overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin h-8 w-8 border-4 border-rose-600 border-t-transparent rounded-full" />
          </div>
        ) : filteredTickets.length === 0 ? (
          <CardContent className="p-12 text-center">
            {search || statusFilter ? "No Tickets Match" : "No Tickets Yet"}
          </CardContent>
        ) : (
          <div className="overflow-x-auto">
            <table className="order-table">
              <thead>
                <tr>
                  <th>Ticket</th>
                  <th>Client</th>
                  <th>Linked Order</th>
                  <th>Status</th>
                  <th>Owner</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {filteredTickets.map(ticket => (
                  <tr key={ticket.id}>
                    <td>
                      <Link 
                        to={`/tickets/${ticket.id}`}
                        className="hover:text-[var(--accent)]"
                        data-testid={`ticket-link-${ticket.ticket_code}`}
                      >
                        <span className="font-mono text-xs block">{ticket.ticket_code}</span>
                        <span className="font-medium">{ticket.subject}</span>
                      </Link>
                    </td>
                    <td>{ticket.client_name || '-'}</td>
                    <td>
                      {ticket.related_order_code ? (
                        <Link to={`/orders/${ticket.related_order_id}`} className="flex items-center gap-1 text-[var(--accent)] hover:text-[var(--accent-hover)]">
                          <LinkIcon size={12} />
                          {ticket.related_order_code}
                        </Link>
                      ) : '-'}
                    </td>
                    <td>
                      <Select value={ticket.status} onValueChange={(v) => handleStatusChange(ticket.id, v)}>
                        <SelectTrigger className="h-8 w-28">
                          <Badge className={statusColors[ticket.status]}>{ticket.status.toLowerCase()}</Badge>
                        </SelectTrigger>
                        <SelectContent>
                          {TICKET_STATUSES.map(s => (
                            <SelectItem key={s} value={s}>{s.toLowerCase()}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td>{ticket.owner_name}</td>
                    <td >
                      {format(new Date(ticket.updated_at), 'MMM d, yyyy')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
