import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Search, Filter, X, Inbox } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const STATUS_OPTIONS = ['Open', 'In Progress', 'Needs Client Review', 'Revision Requested', 'Delivered', 'Closed', 'Canceled'];

const QUEUE_OPTIONS = [
  { value: 'ACCOUNT_MANAGER', label: 'Account Manager' },
  { value: 'VIDEO_EDITING', label: 'Video Editing' },
  { value: 'LONG_FORM_EDITING', label: 'Long Form Editing' },
  { value: 'DESIGN', label: 'Design' },
  { value: 'COPYWRITING', label: 'Copywriting' },
  { value: 'EMAIL_MARKETING', label: 'Email Marketing' },
  { value: 'WEB_UPDATES', label: 'Web Updates' },
];

const statusColors = {
  'Open': 'bg-blue-100 text-blue-700',
  'In Progress': 'bg-amber-100 text-amber-700',
  'Needs Client Review': 'bg-purple-100 text-purple-700',
  'Revision Requested': 'bg-orange-100 text-orange-700',
  'Delivered': 'bg-green-100 text-green-700',
  'Closed': 'bg-slate-100 text-slate-700',
  'Canceled': 'bg-red-100 text-red-700',
};

const queueLabel = (key) => {
  if (!key) return '—';
  const found = QUEUE_OPTIONS.find(q => q.value === key);
  return found ? found.label : key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

export default function Orders() {
  const { t } = useTranslation();
  const location = useLocation();
  const isAllRequests = location.pathname === '/all-requests';
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: '',
    assigned_queue_key: '',
    q: ''
  });
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchOrders();
  }, [filters]);

  const fetchOrders = async () => {
    try {
      const params = new URLSearchParams();
      if (filters.status && filters.status !== 'all') params.append('status', filters.status);
      if (filters.assigned_queue_key && filters.assigned_queue_key !== 'all') params.append('assigned_queue_key', filters.assigned_queue_key);
      if (filters.q) params.append('q', filters.q);
      const res = await axios.get(`${API}/orders?${params.toString()}`);
      setOrders(res.data);
    } catch (error) {
      toast.error('Failed to load requests');
    } finally {
      setLoading(false);
    }
  };

  const clearFilters = () => setFilters({ status: '', assigned_queue_key: '', q: '' });
  const hasActiveFilters = Object.values(filters).some(v => v);

  const pageTitle = isAllRequests ? 'All Requests' : 'My Queue';

  return (
    <div className="space-y-6 animate-fade-in" data-testid="orders-page">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900" data-testid="page-title">{pageTitle}</h1>
        <p className="text-slate-500 mt-1">{orders.length} request{orders.length !== 1 ? 's' : ''}</p>
      </div>

      {/* Filters */}
      <Card className="border-slate-200">
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Search by code, title, or service..."
                value={filters.q}
                onChange={(e) => setFilters(prev => ({ ...prev, q: e.target.value }))}
                className="pl-10"
                data-testid="search-input"
              />
            </div>

            <Button variant="outline" onClick={() => setShowFilters(!showFilters)} className="lg:hidden">
              <Filter size={18} className="mr-2" />Filters
            </Button>

            <div className={`flex flex-col sm:flex-row gap-3 ${showFilters ? 'block' : 'hidden lg:flex'}`}>
              {/* Status */}
              <Select value={filters.status} onValueChange={(v) => setFilters(prev => ({ ...prev, status: v }))}>
                <SelectTrigger className="w-full sm:w-44" data-testid="status-filter">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>

              {/* Queue */}
              <Select value={filters.assigned_queue_key} onValueChange={(v) => setFilters(prev => ({ ...prev, assigned_queue_key: v }))}>
                <SelectTrigger className="w-full sm:w-44" data-testid="queue-filter">
                  <SelectValue placeholder="Queue" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Queues</SelectItem>
                  {QUEUE_OPTIONS.map(q => <SelectItem key={q.value} value={q.value}>{q.label}</SelectItem>)}
                </SelectContent>
              </Select>

              {hasActiveFilters && (
                <Button variant="ghost" onClick={clearFilters} className="text-slate-500" data-testid="clear-filters-btn">
                  <X size={16} className="mr-1" />Clear
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Requests Table */}
      <Card className="border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <div className="animate-spin h-8 w-8 border-4 border-[#A2182C] border-t-transparent rounded-full" />
            </div>
          ) : orders.length === 0 ? (
            <div className="p-12 text-center">
              <Inbox size={40} className="mx-auto text-slate-300 mb-3" />
              <p className="text-slate-500">No requests found</p>
              {hasActiveFilters && (
                <Button variant="link" onClick={clearFilters} className="mt-2 text-[#A2182C]">Clear filters</Button>
              )}
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Request</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Service</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Queue</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Client</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Assigned</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.map(order => (
                  <tr key={order.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <Link 
                        to={`/requests/${order.id}`}
                        className="hover:text-[#A2182C] transition-colors"
                        data-testid={`request-link-${order.id}`}
                      >
                        <span className="font-mono text-xs text-slate-400 block">{order.order_code}</span>
                        <span className="font-medium text-slate-900">{order.title}</span>
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      {order.service_name ? (
                        <span className="text-sm text-slate-600">{order.service_name}</span>
                      ) : (
                        <span className="text-sm text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={statusColors[order.status] || 'bg-slate-100 text-slate-700'}>
                        {order.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      {order.assigned_queue_key ? (
                        <Badge variant="outline" className="text-xs">{queueLabel(order.assigned_queue_key)}</Badge>
                      ) : (
                        <span className="text-sm text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">{order.client_name || '—'}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{order.editor_name || <span className="text-slate-400 italic">Unassigned</span>}</td>
                    <td className="px-4 py-3 text-sm text-slate-500">
                      {order.created_at ? format(new Date(order.created_at), 'MMM d, yyyy') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>
    </div>
  );
}
