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
  AlertTriangle,
  Inbox,
  Send,
  RotateCcw,
  Star
} from 'lucide-react';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Reusable Rating Stats Card Component (Google Review Style)
function RatingStatsCard({ stats, title = "Your Ratings" }) {
  if (!stats || stats.total_ratings === 0) {
    return (
      <Card className="border-slate-200">
        <CardContent className="p-6 text-center">
          <div className="flex gap-1 justify-center mb-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star key={star} size={24} className="fill-gray-200 text-gray-200" />
            ))}
          </div>
          <p className="text-slate-500">No ratings yet</p>
          <p className="text-xs text-slate-400 mt-1">Complete orders to receive ratings</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-slate-200" data-testid="rating-stats-card">
      <CardHeader className="border-b border-slate-100 pb-4">
        <CardTitle className="flex items-center gap-2 text-base">
          <Star size={18} className="text-yellow-500 fill-yellow-500" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <div className="flex items-start gap-6">
          {/* Left: Big Number & Stars */}
          <div className="text-center">
            <div className="text-5xl font-bold text-slate-900">{stats.average_rating.toFixed(1)}</div>
            <div className="mt-2 flex gap-0.5 justify-center">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  size={24}
                  className={
                    star <= Math.round(stats.average_rating)
                      ? 'fill-yellow-400 text-yellow-400'
                      : 'fill-gray-200 text-gray-200'
                  }
                />
              ))}
            </div>
            <div className="text-sm text-slate-500 mt-1">
              {stats.total_ratings} {stats.total_ratings === 1 ? 'review' : 'reviews'}
            </div>
          </div>

          {/* Right: Distribution Bars */}
          <div className="flex-1 space-y-1.5">
            {[5, 4, 3, 2, 1].map((stars) => {
              const count = stats.rating_distribution[stars] || 0;
              const maxCount = Math.max(...Object.values(stats.rating_distribution), 1);
              const percentage = (count / maxCount) * 100;
              
              return (
                <div key={stars} className="flex items-center gap-2 text-sm">
                  <span className="w-3 text-slate-600">{stars}</span>
                  <Star size={12} className="fill-yellow-400 text-yellow-400" />
                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-yellow-400 rounded-full transition-all duration-500"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <span className="w-6 text-right text-slate-500 text-xs">{count}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Stats Footer */}
        <div className="mt-6 pt-4 border-t border-slate-100 flex justify-center gap-8">
          <div className="text-center">
            <div className="text-2xl font-bold text-slate-900">{stats.total_delivered}</div>
            <div className="text-xs text-slate-500">Orders Delivered</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-slate-900">{stats.total_ratings}</div>
            <div className="text-xs text-slate-500">Ratings Received</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-slate-900">
              {stats.total_delivered > 0 ? Math.round((stats.total_ratings / stats.total_delivered) * 100) : 0}%
            </div>
            <div className="text-xs text-slate-500">Response Rate</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const statusConfig = {
  'Open': { class: 'bg-blue-100 text-blue-700', icon: Inbox },
  'In Progress': { class: 'bg-amber-100 text-amber-700', icon: Clock },
  'Pending': { class: 'bg-purple-100 text-purple-700', icon: AlertCircle },
  'Delivered': { class: 'bg-green-100 text-green-700', icon: CheckCircle2 },
};

const priorityConfig = {
  'Low': 'bg-slate-100 text-slate-600',
  'Normal': 'bg-blue-100 text-blue-600',
  'High': 'bg-orange-100 text-orange-600',
  'Urgent': 'bg-red-100 text-red-600',
};

function OrderCard({ order, showPickButton, onPick }) {
  const isBreaching = order.is_sla_breached;
  
  return (
    <Link 
      to={`/orders/${order.id}`}
      className={`block p-4 rounded-lg border transition-all hover:shadow-md ${
        isBreaching ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white hover:border-rose-200'
      }`}
      data-testid={`order-card-${order.order_code}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs text-slate-500">{order.order_code}</span>
            <Badge className={statusConfig[order.status]?.class}>{order.status}</Badge>
            <Badge className={priorityConfig[order.priority]}>{order.priority}</Badge>
            {isBreaching && (
              <Badge className="bg-red-100 text-red-700">
                <AlertTriangle size={12} className="mr-1" />
                SLA Breach
              </Badge>
            )}
          </div>
          <h3 className="font-medium text-slate-900 mt-2 truncate">{order.title}</h3>
          <p className="text-sm text-slate-500 mt-1">{order.category}</p>
          <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
            <span>By: {order.requester_name}</span>
            <span>Due: {format(new Date(order.sla_deadline), 'MMM d, yyyy')}</span>
          </div>
        </div>
        {showPickButton && (
          <Button 
            size="sm" 
            className="bg-rose-600 hover:bg-rose-700 shrink-0"
            onClick={(e) => {
              e.preventDefault();
              onPick(order.id);
            }}
            data-testid={`pick-order-${order.order_code}`}
          >
            Pick Order
          </Button>
        )}
      </div>
    </Link>
  );
}

function KPICard({ label, value, icon: Icon, color, onClick }) {
  return (
    <Card 
      className={`border-slate-200 cursor-pointer hover:shadow-md transition-shadow ${onClick ? 'hover:border-rose-200' : ''}`}
      onClick={onClick}
      data-testid={`kpi-${label.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 ${color} rounded-lg flex items-center justify-center`}>
            <Icon size={20} className="text-white" />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900">{value}</p>
            <p className="text-xs text-slate-500">{label}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Admin Dashboard
function AdminDashboard() {
  const [stats, setStats] = useState({
    open_count: 0,
    in_progress_count: 0,
    pending_count: 0,
    delivered_count: 0,
    sla_breaching_count: 0
  });
  const [recentOrders, setRecentOrders] = useState([]);
  const [ratingStats, setRatingStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [statsRes, ordersRes, ratingsRes] = await Promise.all([
        axios.get(`${API}/dashboard/stats`),
        axios.get(`${API}/orders`),
        axios.get(`${API}/ratings/my-stats`).catch(() => ({ data: null }))
      ]);
      setStats(statsRes.data);
      setRecentOrders(ordersRes.data.slice(0, 10));
      setRatingStats(ratingsRes.data);
    } catch (error) {
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Admin Dashboard</h1>
          <p className="text-slate-500 mt-1">Overview of all orders</p>
        </div>
        <Link to="/users">
          <Button variant="outline">Manage Users</Button>
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <KPICard label="Open" value={stats.open_count} icon={Inbox} color="bg-blue-500" />
        <KPICard label="In Progress" value={stats.in_progress_count} icon={Clock} color="bg-amber-500" />
        <KPICard label="Pending Review" value={stats.pending_count} icon={AlertCircle} color="bg-purple-500" />
        <KPICard label="Delivered" value={stats.delivered_count} icon={CheckCircle2} color="bg-green-500" />
        <KPICard label="SLA Breaching" value={stats.sla_breaching_count} icon={AlertTriangle} color="bg-red-500" />
      </div>

      <Card className="border-slate-200">
        <CardHeader className="border-b border-slate-100 pb-4">
          <div className="flex items-center justify-between">
            <CardTitle>Recent Orders</CardTitle>
            <Link to="/orders" className="text-sm text-rose-600 hover:text-rose-700 flex items-center gap-1">
              View all <ArrowRight size={14} />
            </Link>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          <div className="space-y-3">
            {recentOrders.map(order => (
              <OrderCard key={order.id} order={order} />
            ))}
            {recentOrders.length === 0 && (
              <p className="text-center text-slate-500 py-8">No orders yet</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Editor Dashboard
function EditorDashboard() {
  const [dashboard, setDashboard] = useState({
    new_orders: [],
    in_progress: [],
    pending_review: [],
    responded: [],
    delivered: [],
    sla_breaching: []
  });
  const [ratingStats, setRatingStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [dashboardRes, ratingsRes] = await Promise.all([
        axios.get(`${API}/dashboard/editor`),
        axios.get(`${API}/ratings/my-stats`).catch(() => ({ data: null }))
      ]);
      setDashboard(dashboardRes.data);
      setRatingStats(ratingsRes.data);
    } catch (error) {
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handlePickOrder = async (orderId) => {
    try {
      await axios.post(`${API}/orders/${orderId}/pick`);
      toast.success('Order picked successfully!');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to pick order');
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Editor Dashboard</h1>
        <p className="text-slate-500 mt-1">Manage your video editing orders</p>
      </div>

      {/* Rating Stats Card - Google Review Style */}
      {ratingStats && (
        <div className="bg-white rounded-xl border border-slate-200 p-6" data-testid="rating-stats-card">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Your Ratings</h3>
          <div className="flex items-start gap-6">
            {/* Left: Big Number & Stars */}
            <div className="text-center">
              <div className="text-5xl font-bold text-slate-900">{ratingStats.average_rating.toFixed(1)}</div>
              <div className="mt-2 flex gap-0.5 justify-center">
                {[1, 2, 3, 4, 5].map((star) => (
                  <svg
                    key={star}
                    className={`w-6 h-6 ${
                      star <= Math.round(ratingStats.average_rating)
                        ? 'fill-yellow-400 text-yellow-400'
                        : 'fill-gray-200 text-gray-200'
                    }`}
                    viewBox="0 0 20 20"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <div className="text-sm text-slate-500 mt-1">
                {ratingStats.total_ratings} {ratingStats.total_ratings === 1 ? 'review' : 'reviews'}
              </div>
            </div>

            {/* Right: Distribution Bars */}
            <div className="flex-1 space-y-1.5">
              {[5, 4, 3, 2, 1].map((stars) => {
                const count = ratingStats.rating_distribution[stars] || 0;
                const maxCount = Math.max(...Object.values(ratingStats.rating_distribution), 1);
                const percentage = (count / maxCount) * 100;
                
                return (
                  <div key={stars} className="flex items-center gap-2 text-sm">
                    <span className="w-3 text-slate-600">{stars}</span>
                    <svg className="w-3 h-3 fill-yellow-400 text-yellow-400" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-yellow-400 rounded-full transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <span className="w-6 text-right text-slate-500 text-xs">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Stats Footer */}
          <div className="mt-6 pt-4 border-t border-slate-100 flex justify-center gap-8">
            <div className="text-center">
              <div className="text-2xl font-bold text-slate-900">{ratingStats.total_delivered}</div>
              <div className="text-xs text-slate-500">Orders Delivered</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-slate-900">{ratingStats.total_ratings}</div>
              <div className="text-xs text-slate-500">Ratings Received</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-slate-900">
                {ratingStats.total_delivered > 0 ? Math.round((ratingStats.total_ratings / ratingStats.total_delivered) * 100) : 0}%
              </div>
              <div className="text-xs text-slate-500">Response Rate</div>
            </div>
          </div>
        </div>
      )}

      {/* KPI Summary */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KPICard label="New Orders" value={dashboard.new_orders.length} icon={Inbox} color="bg-blue-500" />
        <KPICard label="In Progress" value={dashboard.in_progress.length} icon={Clock} color="bg-amber-500" />
        <KPICard label="Sent for Review" value={dashboard.pending_review.length} icon={Send} color="bg-purple-500" />
        <KPICard label="Came Back" value={dashboard.responded.length} icon={RotateCcw} color="bg-indigo-500" />
        <KPICard label="Delivered" value={dashboard.delivered.length} icon={CheckCircle2} color="bg-green-500" />
        <KPICard label="SLA Breaching" value={dashboard.sla_breaching.length} icon={AlertTriangle} color="bg-red-500" />
      </div>

      {/* SLA Breaching Alert */}
      {dashboard.sla_breaching.length > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-red-700 flex items-center gap-2">
              <AlertTriangle size={20} />
              SLA Breaching Orders ({dashboard.sla_breaching.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {dashboard.sla_breaching.map(order => (
              <OrderCard key={order.id} order={order} />
            ))}
          </CardContent>
        </Card>
      )}

      {/* New Orders Pool */}
      <Card className="border-slate-200">
        <CardHeader className="border-b border-slate-100 pb-4">
          <CardTitle className="flex items-center gap-2">
            <Inbox size={20} className="text-blue-500" />
            New Orders - Pick from Pool ({dashboard.new_orders.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          {dashboard.new_orders.map(order => (
            <OrderCard 
              key={order.id} 
              order={order} 
              showPickButton 
              onPick={handlePickOrder}
            />
          ))}
          {dashboard.new_orders.length === 0 && (
            <p className="text-center text-slate-500 py-8">No new orders available</p>
          )}
        </CardContent>
      </Card>

      {/* Orders Responded (Came Back) */}
      {dashboard.responded.length > 0 && (
        <Card className="border-indigo-200 bg-indigo-50">
          <CardHeader className="border-b border-indigo-100 pb-4">
            <CardTitle className="flex items-center gap-2 text-indigo-700">
              <RotateCcw size={20} />
              Orders Responded - Needs Your Attention ({dashboard.responded.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            {dashboard.responded.map(order => (
              <OrderCard key={order.id} order={order} />
            ))}
          </CardContent>
        </Card>
      )}

      {/* In Progress */}
      <Card className="border-slate-200">
        <CardHeader className="border-b border-slate-100 pb-4">
          <CardTitle className="flex items-center gap-2">
            <Clock size={20} className="text-amber-500" />
            Orders I'm Working On ({dashboard.in_progress.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          {dashboard.in_progress.map(order => (
            <OrderCard key={order.id} order={order} />
          ))}
          {dashboard.in_progress.length === 0 && (
            <p className="text-center text-slate-500 py-8">No orders in progress</p>
          )}
        </CardContent>
      </Card>

      {/* Pending Review */}
      <Card className="border-slate-200">
        <CardHeader className="border-b border-slate-100 pb-4">
          <CardTitle className="flex items-center gap-2">
            <Send size={20} className="text-purple-500" />
            Sent for Review ({dashboard.pending_review.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          {dashboard.pending_review.map(order => (
            <OrderCard key={order.id} order={order} />
          ))}
          {dashboard.pending_review.length === 0 && (
            <p className="text-center text-slate-500 py-8">No orders pending review</p>
          )}
        </CardContent>
      </Card>

      {/* Recently Delivered */}
      <Card className="border-slate-200">
        <CardHeader className="border-b border-slate-100 pb-4">
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 size={20} className="text-green-500" />
            Recently Delivered ({dashboard.delivered.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          {dashboard.delivered.slice(0, 5).map(order => (
            <OrderCard key={order.id} order={order} />
          ))}
          {dashboard.delivered.length === 0 && (
            <p className="text-center text-slate-500 py-8">No delivered orders yet</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Requester Dashboard
function RequesterDashboard() {
  const [dashboard, setDashboard] = useState({
    open_orders: [],
    in_progress: [],
    needs_review: [],
    delivered: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const res = await axios.get(`${API}/dashboard/requester`);
      setDashboard(res.data);
    } catch (error) {
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Orders</h1>
          <p className="text-slate-500 mt-1">Track your video editing requests</p>
        </div>
        <Link to="/orders/new">
          <Button className="bg-rose-600 hover:bg-rose-700" data-testid="create-order-btn">
            <Plus size={18} className="mr-2" />
            New Request
          </Button>
        </Link>
      </div>

      {/* KPI Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard label="Open" value={dashboard.open_orders.length} icon={Inbox} color="bg-blue-500" />
        <KPICard label="In Progress" value={dashboard.in_progress.length} icon={Clock} color="bg-amber-500" />
        <KPICard label="Needs My Review" value={dashboard.needs_review.length} icon={AlertCircle} color="bg-purple-500" />
        <KPICard label="Delivered" value={dashboard.delivered.length} icon={CheckCircle2} color="bg-green-500" />
      </div>

      {/* Needs Review Alert */}
      {dashboard.needs_review.length > 0 && (
        <Card className="border-purple-200 bg-purple-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-purple-700 flex items-center gap-2">
              <AlertCircle size={20} />
              Needs Your Review ({dashboard.needs_review.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {dashboard.needs_review.map(order => (
              <OrderCard key={order.id} order={order} />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Open Orders */}
      <Card className="border-slate-200">
        <CardHeader className="border-b border-slate-100 pb-4">
          <CardTitle className="flex items-center gap-2">
            <Inbox size={20} className="text-blue-500" />
            Open Orders ({dashboard.open_orders.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          {dashboard.open_orders.map(order => (
            <OrderCard key={order.id} order={order} />
          ))}
          {dashboard.open_orders.length === 0 && (
            <p className="text-center text-slate-500 py-8">No open orders</p>
          )}
        </CardContent>
      </Card>

      {/* In Progress */}
      <Card className="border-slate-200">
        <CardHeader className="border-b border-slate-100 pb-4">
          <CardTitle className="flex items-center gap-2">
            <Clock size={20} className="text-amber-500" />
            In Progress ({dashboard.in_progress.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          {dashboard.in_progress.map(order => (
            <OrderCard key={order.id} order={order} />
          ))}
          {dashboard.in_progress.length === 0 && (
            <p className="text-center text-slate-500 py-8">No orders in progress</p>
          )}
        </CardContent>
      </Card>

      {/* Delivered */}
      <Card className="border-slate-200">
        <CardHeader className="border-b border-slate-100 pb-4">
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 size={20} className="text-green-500" />
            Delivered ({dashboard.delivered.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          {dashboard.delivered.slice(0, 5).map(order => (
            <OrderCard key={order.id} order={order} />
          ))}
          {dashboard.delivered.length === 0 && (
            <p className="text-center text-slate-500 py-8">No delivered orders yet</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin h-8 w-8 border-4 border-rose-600 border-t-transparent rounded-full" />
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();

  if (!user) return <LoadingSpinner />;

  return (
    <div className="animate-fade-in" data-testid="dashboard-page">
      {user.role === 'Admin' && <AdminDashboard />}
      {user.role === 'Editor' && <EditorDashboard />}
      {user.role === 'Requester' && <RequesterDashboard />}
    </div>
  );
}
