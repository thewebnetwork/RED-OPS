import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { 
  Plus, 
  FileText, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  ArrowRight,
  TrendingUp
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const statusConfig = {
  'New': { class: 'status-new', icon: FileText },
  'In Progress': { class: 'status-in-progress', icon: Clock },
  'Needs Client Review': { class: 'status-needs-review', icon: AlertCircle },
  'Revision Requested': { class: 'status-revision', icon: AlertCircle },
  'Approved': { class: 'status-approved', icon: CheckCircle2 },
  'Delivered': { class: 'status-delivered', icon: CheckCircle2 },
  'Canceled': { class: 'status-canceled', icon: FileText },
};

const priorityConfig = {
  'Low': 'priority-low',
  'Normal': 'priority-normal',
  'High': 'priority-high',
  'Urgent': 'priority-urgent',
};

export default function Dashboard() {
  const { user, hasRole } = useAuth();
  const [stats, setStats] = useState({
    new_count: 0,
    in_progress_count: 0,
    needs_review_count: 0,
    revision_requested_count: 0,
    delivered_last_7_days: 0
  });
  const [recentOrders, setRecentOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [statsRes, ordersRes] = await Promise.all([
        axios.get(`${API}/dashboard/stats`),
        axios.get(`${API}/orders`)
      ]);
      setStats(statsRes.data);
      setRecentOrders(ordersRes.data.slice(0, 5));
    } catch (error) {
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const kpiCards = [
    { label: 'New', value: stats.new_count, color: 'bg-blue-500', icon: FileText },
    { label: 'In Progress', value: stats.in_progress_count, color: 'bg-amber-500', icon: Clock },
    { label: 'Needs Review', value: stats.needs_review_count, color: 'bg-purple-500', icon: AlertCircle },
    { label: 'Revision Requested', value: stats.revision_requested_count, color: 'bg-orange-500', icon: AlertCircle },
    { label: 'Delivered (7 days)', value: stats.delivered_last_7_days, color: 'bg-green-500', icon: TrendingUp },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-rose-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in" data-testid="dashboard-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-500 mt-1">Welcome back, {user?.name}</p>
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

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {kpiCards.map((kpi, index) => (
          <Card key={index} className="border-slate-200" data-testid={`kpi-card-${kpi.label.toLowerCase().replace(/\s+/g, '-')}`}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 ${kpi.color} rounded-lg flex items-center justify-center`}>
                  <kpi.icon size={20} className="text-white" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{kpi.value}</p>
                  <p className="text-xs text-slate-500">{kpi.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Orders */}
      <Card className="border-slate-200">
        <CardHeader className="border-b border-slate-100 pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">
              {hasRole('Editor') ? 'My Assigned Orders' : 'Recent Orders'}
            </CardTitle>
            <Link to="/orders" className="text-sm text-rose-600 hover:text-rose-700 flex items-center gap-1">
              View all
              <ArrowRight size={14} />
            </Link>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {recentOrders.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              No orders found
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {recentOrders.map(order => (
                <Link 
                  key={order.id} 
                  to={`/orders/${order.id}`}
                  className="flex items-center gap-4 p-4 hover:bg-slate-50 transition-colors"
                  data-testid={`order-row-${order.order_code}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm text-slate-500">{order.order_code}</span>
                      <Badge className={priorityConfig[order.priority]}>{order.priority}</Badge>
                    </div>
                    <p className="font-medium text-slate-900 truncate mt-1">{order.title}</p>
                    <p className="text-sm text-slate-500">{order.client_name}</p>
                  </div>
                  <div className="text-right">
                    <Badge className={statusConfig[order.status]?.class}>{order.status}</Badge>
                    {order.due_date && (
                      <p className="text-xs text-slate-500 mt-1">
                        Due: {format(new Date(order.due_date), 'MMM d, yyyy')}
                      </p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Intake Required Banner */}
      {hasRole('Admin', 'Manager') && recentOrders.some(o => o.intake_required && !o.intake_completed) && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertCircle className="text-amber-600" size={20} />
            <p className="text-sm text-amber-800">
              Some orders are waiting on client intake information
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
