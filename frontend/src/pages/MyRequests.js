import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import {
  Inbox,
  Search,
  Eye,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Filter,
  ArrowUpRight,
  X
} from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const CANCELLABLE_STATUSES = ['New', 'Open', 'In Progress', 'Pending'];

const STATUS_CONFIG = {
  'New': { icon: Clock, class: 'bg-blue-100 text-blue-700', color: 'bg-blue-500' },
  'Open': { icon: AlertCircle, class: 'bg-amber-100 text-amber-700', color: 'bg-amber-500' },
  'In Progress': { icon: Clock, class: 'bg-purple-100 text-purple-700', color: 'bg-purple-500' },
  'Pending': { icon: Clock, class: 'bg-orange-100 text-orange-700', color: 'bg-orange-500' },
  'Delivered': { icon: CheckCircle2, class: 'bg-emerald-100 text-emerald-700', color: 'bg-emerald-500' },
  'Closed': { icon: CheckCircle2, class: 'bg-slate-100 text-slate-700', color: 'bg-slate-500' },
  'Canceled': { icon: XCircle, class: 'bg-red-100 text-red-700', color: 'bg-red-500' },
};

export default function MyRequests() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Cancel dialog state
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelNotes, setCancelNotes] = useState('');
  const [canceling, setCanceling] = useState(false);
  const [cancellationReasons, setCancellationReasons] = useState([]);

  useEffect(() => {
    fetchMyRequests();
    fetchCancellationReasons();
  }, []);

  const fetchMyRequests = async () => {
    try {
      const response = await axios.get(`${API}/orders/my-requests`);
      setOrders(response.data);
    } catch (error) {
      toast.error('Failed to fetch your requests');
    } finally {
      setLoading(false);
    }
  };

  const fetchCancellationReasons = async () => {
    try {
      const res = await axios.get(`${API}/orders/cancellation-reasons`);
      setCancellationReasons(res.data.reasons || []);
    } catch {
      setCancellationReasons(['No longer needed', 'Changed my mind', 'Found another solution', 'Other']);
    }
  };

  const openCancelDialog = (order) => {
    setCancelTarget(order);
    setCancelReason('');
    setCancelNotes('');
    setCancelDialogOpen(true);
  };

  const handleCancel = async () => {
    if (!cancelReason) {
      toast.error('Please select a cancellation reason');
      return;
    }
    if (cancelReason === 'Other' && !cancelNotes.trim()) {
      toast.error('Please add a note explaining why');
      return;
    }
    setCanceling(true);
    try {
      await axios.post(`${API}/orders/${cancelTarget.id}/cancel`, {
        reason: cancelReason,
        notes: cancelNotes.trim() || null,
      });
      toast.success('Request canceled');
      setCancelDialogOpen(false);
      setOrders(prev => prev.map(o =>
        o.id === cancelTarget.id ? { ...o, status: 'Canceled' } : o
      ));
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to cancel request');
    } finally {
      setCanceling(false);
    }
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch =
      order.order_code?.toLowerCase().includes(search.toLowerCase()) ||
      order.title?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusConfig = (status) => STATUS_CONFIG[status] || STATUS_CONFIG['New'];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#A2182C]"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in" data-testid="my-requests-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Inbox className="text-[#A2182C]" />
            {t('requests.myRequests', 'My Requests')}
          </h1>
          <p className="text-slate-500 mt-1">{t('requests.subtitle', 'View and track all your submitted requests')}</p>
        </div>
        <Link to="/services">
          <Button className="bg-[#A2182C] hover:bg-[#8B1526]">
            {t('requests.submitNew', 'Submit New Request')}
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
          <Input
            placeholder="Search by code or title..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
            data-testid="request-search"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]" data-testid="status-filter">
            <Filter size={16} className="mr-2" />
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {Object.keys(STATUS_CONFIG).map(status => (
              <SelectItem key={status} value={status}>{status}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-slate-900">{orders.length}</p>
            <p className="text-sm text-slate-500">{t('requests.totalRequests', 'Total Requests')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">
              {orders.filter(o => ['New', 'Open'].includes(o.status)).length}
            </p>
            <p className="text-sm text-slate-500">Open</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-purple-600">
              {orders.filter(o => o.status === 'In Progress').length}
            </p>
            <p className="text-sm text-slate-500">In Progress</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-emerald-600">
              {orders.filter(o => ['Delivered', 'Closed'].includes(o.status)).length}
            </p>
            <p className="text-sm text-slate-500">Completed</p>
          </CardContent>
        </Card>
      </div>

      {/* Tickets List */}
      {filteredOrders.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Inbox size={48} className="mx-auto mb-4 text-slate-300" />
            <p className="text-slate-500">
              {orders.length === 0
                ? t('requests.noRequests', 'You have not submitted any requests yet')
                : t('requests.noMatch', 'No requests match your filters')}
            </p>
            {orders.length === 0 && (
              <Link to="/services">
                <Button className="mt-4 bg-[#A2182C] hover:bg-[#8B1526]">
                  {t('requests.submitFirst', 'Submit Your First Request')}
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map(order => {
            const statusConfig = getStatusConfig(order.status);
            const StatusIcon = statusConfig.icon;
            const canCancel = CANCELLABLE_STATUSES.includes(order.status);
            return (
              <Card key={order.id} className="hover:shadow-md transition-shadow" data-testid={`request-${order.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className={`w-2 h-12 rounded-full flex-shrink-0 ${statusConfig.color}`} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-sm text-slate-500">{order.order_code}</span>
                          <Badge className={statusConfig.class}>
                            <StatusIcon size={12} className="mr-1" />
                            {order.status}
                          </Badge>
                        </div>
                        <h3 className="font-medium text-slate-900 mt-1 truncate">{order.title}</h3>
                        <p className="text-sm text-slate-500 mt-0.5">
                          {order.service_name || order.category_name || 'Request'} • Created {new Date(order.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {canCancel && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openCancelDialog(order)}
                          className="text-slate-400 hover:text-red-600 hover:bg-red-50"
                          data-testid={`cancel-request-${order.id}`}
                          title="Cancel request"
                        >
                          <X size={16} />
                        </Button>
                      )}
                      <Link to={`/orders/${order.id}`}>
                        <Button variant="outline" size="sm" data-testid={`view-request-${order.id}`}>
                          <Eye size={16} className="mr-1" />
                          View
                          <ArrowUpRight size={14} className="ml-1" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Cancel Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle size={20} className="text-red-500" />
              Cancel Request
            </DialogTitle>
            <DialogDescription>
              Cancel <span className="font-medium text-slate-900">{cancelTarget?.title}</span>. The team will be notified. This cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label className="text-sm font-medium">Reason *</Label>
              <Select value={cancelReason} onValueChange={setCancelReason}>
                <SelectTrigger className="mt-1.5" data-testid="cancel-reason-select">
                  <SelectValue placeholder="Select a reason..." />
                </SelectTrigger>
                <SelectContent>
                  {cancellationReasons.map(r => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-sm font-medium">
                Notes {cancelReason === 'Other' ? '*' : '(optional)'}
              </Label>
              <Textarea
                className="mt-1.5 resize-none"
                rows={3}
                placeholder="Add any additional context..."
                value={cancelNotes}
                onChange={(e) => setCancelNotes(e.target.value)}
                data-testid="cancel-notes"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)} disabled={canceling}>
              Keep Request
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancel}
              disabled={canceling || !cancelReason}
              data-testid="confirm-cancel-btn"
            >
              {canceling ? 'Canceling...' : 'Cancel Request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
