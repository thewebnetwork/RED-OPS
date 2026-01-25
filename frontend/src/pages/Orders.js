import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
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
  Plus, 
  Search,
  Filter,
  X
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const statusConfig = {
  'New': { class: 'status-new' },
  'In Progress': { class: 'status-in-progress' },
  'Needs Client Review': { class: 'status-needs-review' },
  'Revision Requested': { class: 'status-revision' },
  'Approved': { class: 'status-approved' },
  'Delivered': { class: 'status-delivered' },
  'Canceled': { class: 'status-canceled' },
};

const priorityConfig = {
  'Low': 'priority-low',
  'Normal': 'priority-normal',
  'High': 'priority-high',
  'Urgent': 'priority-urgent',
};

const ORDER_TYPES = ["Video Edit", "Reel Batch", "Listing Video", "Marketplace Service", "Videography Booking", "Other"];
const ORDER_STATUSES = ["New", "In Progress", "Needs Client Review", "Revision Requested", "Approved", "Delivered", "Canceled"];
const PRIORITIES = ["Low", "Normal", "High", "Urgent"];

export default function Orders() {
  const { hasRole } = useAuth();
  const [orders, setOrders] = useState([]);
  const [editors, setEditors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: '',
    type: '',
    priority: '',
    assigned_editor_id: '',
    search: ''
  });
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchOrders();
    if (hasRole('Admin', 'Manager')) {
      fetchEditors();
    }
  }, [filters]);

  const fetchOrders = async () => {
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });
      const res = await axios.get(`${API}/orders?${params.toString()}`);
      setOrders(res.data);
    } catch (error) {
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const fetchEditors = async () => {
    try {
      const res = await axios.get(`${API}/users/role/editors`);
      setEditors(res.data);
    } catch (error) {
      console.error('Failed to load editors');
    }
  };

  const clearFilters = () => {
    setFilters({
      status: '',
      type: '',
      priority: '',
      assigned_editor_id: '',
      search: ''
    });
  };

  const hasActiveFilters = Object.values(filters).some(v => v);

  return (
    <div className="space-y-6 animate-fade-in" data-testid="orders-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Orders</h1>
          <p className="text-slate-500 mt-1">{orders.length} orders found</p>
        </div>
        {hasRole('Admin', 'Manager') && (
          <Link to="/orders/new">
            <Button className="bg-rose-600 hover:bg-rose-700" data-testid="create-order-btn">
              <Plus size={18} className="mr-2" />
              Create Order
            </Button>
          </Link>
        )}
      </div>

      {/* Filters */}
      <Card className="border-slate-200">
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Search by order code or title..."
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                className="pl-10"
                data-testid="search-input"
              />
            </div>

            {/* Filter toggle for mobile */}
            <Button 
              variant="outline" 
              onClick={() => setShowFilters(!showFilters)}
              className="lg:hidden"
            >
              <Filter size={18} className="mr-2" />
              Filters
            </Button>

            {/* Filter dropdowns */}
            <div className={`flex flex-col sm:flex-row gap-3 ${showFilters ? 'block' : 'hidden lg:flex'}`}>
              <Select value={filters.status} onValueChange={(v) => setFilters(prev => ({ ...prev, status: v }))}>
                <SelectTrigger className="w-full sm:w-40" data-testid="status-filter">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {ORDER_STATUSES.map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filters.type} onValueChange={(v) => setFilters(prev => ({ ...prev, type: v }))}>
                <SelectTrigger className="w-full sm:w-40" data-testid="type-filter">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {ORDER_TYPES.map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filters.priority} onValueChange={(v) => setFilters(prev => ({ ...prev, priority: v }))}>
                <SelectTrigger className="w-full sm:w-32" data-testid="priority-filter">
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priorities</SelectItem>
                  {PRIORITIES.map(p => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {hasRole('Admin', 'Manager') && (
                <Select value={filters.assigned_editor_id} onValueChange={(v) => setFilters(prev => ({ ...prev, assigned_editor_id: v }))}>
                  <SelectTrigger className="w-full sm:w-40" data-testid="editor-filter">
                    <SelectValue placeholder="Editor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Editors</SelectItem>
                    {editors.map(e => (
                      <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {hasActiveFilters && (
                <Button variant="ghost" onClick={clearFilters} className="text-slate-500">
                  <X size={16} className="mr-1" />
                  Clear
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Orders Table */}
      <Card className="border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <div className="animate-spin h-8 w-8 border-4 border-rose-600 border-t-transparent rounded-full" />
            </div>
          ) : orders.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <p>No orders found</p>
              {hasActiveFilters && (
                <Button variant="link" onClick={clearFilters} className="mt-2 text-rose-600">
                  Clear filters
                </Button>
              )}
            </div>
          ) : (
            <table className="order-table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Client</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Priority</th>
                  <th>Assigned to</th>
                  <th>Due Date</th>
                </tr>
              </thead>
              <tbody>
                {orders.map(order => (
                  <tr key={order.id}>
                    <td>
                      <Link 
                        to={`/orders/${order.id}`}
                        className="hover:text-rose-600"
                        data-testid={`order-link-${order.order_code}`}
                      >
                        <span className="font-mono text-xs text-slate-500 block">{order.order_code}</span>
                        <span className="font-medium">{order.title}</span>
                      </Link>
                    </td>
                    <td>{order.client_name}</td>
                    <td className="text-slate-600">{order.type}</td>
                    <td>
                      <Badge className={statusConfig[order.status]?.class}>{order.status}</Badge>
                    </td>
                    <td>
                      <Badge className={priorityConfig[order.priority]}>{order.priority}</Badge>
                    </td>
                    <td>{order.assigned_editor_name}</td>
                    <td className="text-slate-600">
                      {order.due_date ? format(new Date(order.due_date), 'MMM d, yyyy') : '-'}
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
