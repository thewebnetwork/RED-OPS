import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
function RatingStatsCard({ stats, title, t }) {
  const displayTitle = title || t('ratings.title');
  
  if (!stats || stats.total_ratings === 0) {
    return (
      <Card className="border-slate-200">
        <CardContent className="p-6 text-center">
          <div className="flex gap-1 justify-center mb-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star key={star} size={24} className="fill-gray-200 text-gray-200" />
            ))}
          </div>
          <p className="text-slate-500">{t('common.noResults')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-slate-200" data-testid="rating-stats-card">
      <CardHeader className="border-b border-slate-100 pb-4">
        <CardTitle className="flex items-center gap-2 text-base">
          <Star size={18} className="text-yellow-500 fill-yellow-500" />
          {displayTitle}
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
              {stats.total_ratings} {stats.total_ratings === 1 ? t('ratings.review') : t('ratings.reviews')}
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
            <div className="text-xs text-slate-500">{t('dashboard.delivered')}</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-slate-900">{stats.total_ratings}</div>
            <div className="text-xs text-slate-500">{t('dashboard.totalReviews')}</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-slate-900">
              {stats.total_delivered > 0 ? Math.round((stats.total_ratings / stats.total_delivered) * 100) : 0}%
            </div>
            <div className="text-xs text-slate-500">{t('ratings.responseRate')}</div>
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

function OrderCard({ order, showPickButton, onPick, t }) {
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
            <Badge className={statusConfig[order.status]?.class}>{t(`orders.status.${order.status.toLowerCase().replace(' ', '')}`) || order.status}</Badge>
            <Badge className={priorityConfig[order.priority]}>{t(`orders.priority_levels.${order.priority.toLowerCase()}`) || order.priority}</Badge>
            {isBreaching && (
              <Badge className="bg-red-100 text-red-700">
                <AlertTriangle size={12} className="mr-1" />
                {t('dashboard.slaBreach')}
              </Badge>
            )}
          </div>
          <h3 className="font-medium text-slate-900 mt-2 truncate">{order.title}</h3>
          <p className="text-sm text-slate-500 mt-1">{order.category}</p>
          <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
            <span>{t('orders.requester')}: {order.requester_name}</span>
            <span>{t('orders.dueDate')}: {format(new Date(order.sla_deadline), 'MMM d, yyyy')}</span>
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
            {t('orders.pickOrder')}
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
  const { t } = useTranslation();
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
      toast.error(t('errors.generic'));
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
          <h1 className="text-2xl font-bold text-slate-900">{t('dashboard.title')} - Admin</h1>
          <p className="text-slate-500 mt-1">{t('dashboard.overview')}</p>
        </div>
        <Link to="/users">
          <Button variant="outline">{t('users.manageUsers')}</Button>
        </Link>
      </div>

      {/* Rating Stats for Admin (if they have any) */}
      {ratingStats && ratingStats.total_delivered > 0 && (
        <RatingStatsCard stats={ratingStats} title={t('ratings.yourRatings')} t={t} />
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <KPICard label={t('orders.status.open')} value={stats.open_count} icon={Inbox} color="bg-blue-500" />
        <KPICard label={t('orders.status.inProgress')} value={stats.in_progress_count} icon={Clock} color="bg-amber-500" />
        <KPICard label={t('dashboard.pendingReview')} value={stats.pending_count} icon={AlertCircle} color="bg-purple-500" />
        <KPICard label={t('orders.status.delivered')} value={stats.delivered_count} icon={CheckCircle2} color="bg-green-500" />
        <KPICard label={t('dashboard.slaBreach')} value={stats.sla_breaching_count} icon={AlertTriangle} color="bg-red-500" />
      </div>

      <Card className="border-slate-200">
        <CardHeader className="border-b border-slate-100 pb-4">
          <div className="flex items-center justify-between">
            <CardTitle>{t('dashboard.recentOrders')}</CardTitle>
            <Link to="/orders" className="text-sm text-rose-600 hover:text-rose-700 flex items-center gap-1">
              {t('dashboard.viewAll')} <ArrowRight size={14} />
            </Link>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          <div className="space-y-3">
            {recentOrders.map(order => (
              <OrderCard key={order.id} order={order} t={t} />
            ))}
            {recentOrders.length === 0 && (
              <p className="text-center text-slate-500 py-8">{t('common.noResults')}</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Editor Dashboard
function EditorDashboard() {
  const { t } = useTranslation();
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
      toast.error(t('errors.generic'));
    } finally {
      setLoading(false);
    }
  };

  const handlePickOrder = async (orderId) => {
    try {
      await axios.post(`${API}/orders/${orderId}/pick`);
      toast.success(t('success.orderPicked'));
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || t('errors.generic'));
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{t('dashboard.title')} - Editor</h1>
        <p className="text-slate-500 mt-1">{t('dashboard.manageOrders')}</p>
      </div>

      {/* Rating Stats Card - Google Review Style */}
      <RatingStatsCard stats={ratingStats} title={t('ratings.yourRatings')} t={t} />

      {/* KPI Summary */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KPICard label={t('dashboard.newOrders')} value={dashboard.new_orders.length} icon={Inbox} color="bg-blue-500" />
        <KPICard label={t('orders.status.inProgress')} value={dashboard.in_progress.length} icon={Clock} color="bg-amber-500" />
        <KPICard label={t('dashboard.sentForReview')} value={dashboard.pending_review.length} icon={Send} color="bg-purple-500" />
        <KPICard label={t('dashboard.cameBack')} value={dashboard.responded.length} icon={RotateCcw} color="bg-indigo-500" />
        <KPICard label={t('orders.status.delivered')} value={dashboard.delivered.length} icon={CheckCircle2} color="bg-green-500" />
        <KPICard label={t('dashboard.slaBreach')} value={dashboard.sla_breaching.length} icon={AlertTriangle} color="bg-red-500" />
      </div>

      {/* SLA Breaching Alert */}
      {dashboard.sla_breaching.length > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-red-700 flex items-center gap-2">
              <AlertTriangle size={20} />
              {t('dashboard.slaBreach')} ({dashboard.sla_breaching.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {dashboard.sla_breaching.map(order => (
              <OrderCard key={order.id} order={order} t={t} />
            ))}
          </CardContent>
        </Card>
      )}

      {/* New Orders Pool */}
      <Card className="border-slate-200">
        <CardHeader className="border-b border-slate-100 pb-4">
          <CardTitle className="flex items-center gap-2">
            <Inbox size={20} className="text-blue-500" />
            {t('dashboard.newOrders')} - {t('dashboard.pickFromPool')} ({dashboard.new_orders.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          {dashboard.new_orders.map(order => (
            <OrderCard 
              key={order.id} 
              order={order} 
              showPickButton 
              onPick={handlePickOrder}
              t={t}
            />
          ))}
          {dashboard.new_orders.length === 0 && (
            <p className="text-center text-slate-500 py-8">{t('dashboard.noNewOrders')}</p>
          )}
        </CardContent>
      </Card>

      {/* Orders Responded (Came Back) */}
      {dashboard.responded.length > 0 && (
        <Card className="border-indigo-200 bg-indigo-50">
          <CardHeader className="border-b border-indigo-100 pb-4">
            <CardTitle className="flex items-center gap-2 text-indigo-700">
              <RotateCcw size={20} />
              {t('dashboard.ordersResponded')} ({dashboard.responded.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            {dashboard.responded.map(order => (
              <OrderCard key={order.id} order={order} t={t} />
            ))}
          </CardContent>
        </Card>
      )}

      {/* In Progress */}
      <Card className="border-slate-200">
        <CardHeader className="border-b border-slate-100 pb-4">
          <CardTitle className="flex items-center gap-2">
            <Clock size={20} className="text-amber-500" />
            {t('dashboard.ordersWorkingOn')} ({dashboard.in_progress.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          {dashboard.in_progress.map(order => (
            <OrderCard key={order.id} order={order} t={t} />
          ))}
          {dashboard.in_progress.length === 0 && (
            <p className="text-center text-slate-500 py-8">{t('dashboard.noOrdersInProgress')}</p>
          )}
        </CardContent>
      </Card>

      {/* Pending Review */}
      <Card className="border-slate-200">
        <CardHeader className="border-b border-slate-100 pb-4">
          <CardTitle className="flex items-center gap-2">
            <Send size={20} className="text-purple-500" />
            {t('dashboard.sentForReview')} ({dashboard.pending_review.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          {dashboard.pending_review.map(order => (
            <OrderCard key={order.id} order={order} t={t} />
          ))}
          {dashboard.pending_review.length === 0 && (
            <p className="text-center text-slate-500 py-8">{t('dashboard.noPendingReview')}</p>
          )}
        </CardContent>
      </Card>

      {/* Recently Delivered */}
      <Card className="border-slate-200">
        <CardHeader className="border-b border-slate-100 pb-4">
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 size={20} className="text-green-500" />
            {t('dashboard.recentlyDelivered')} ({dashboard.delivered.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          {dashboard.delivered.slice(0, 5).map(order => (
            <OrderCard key={order.id} order={order} t={t} />
          ))}
          {dashboard.delivered.length === 0 && (
            <p className="text-center text-slate-500 py-8">{t('dashboard.noDelivered')}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Requester Dashboard
function RequesterDashboard() {
  const { t } = useTranslation();
  const [dashboard, setDashboard] = useState({
    open_orders: [],
    in_progress: [],
    needs_review: [],
    delivered: []
  });
  const [ratingStats, setRatingStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [dashboardRes, ratingsRes] = await Promise.all([
        axios.get(`${API}/dashboard/requester`),
        axios.get(`${API}/ratings/my-stats`).catch(() => ({ data: null }))
      ]);
      setDashboard(dashboardRes.data);
      setRatingStats(ratingsRes.data);
    } catch (error) {
      toast.error(t('errors.generic'));
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
          <h1 className="text-2xl font-bold text-slate-900">{t('dashboard.myOrders')}</h1>
          <p className="text-slate-500 mt-1">{t('dashboard.trackRequests')}</p>
        </div>
        <Link to="/orders/new">
          <Button className="bg-rose-600 hover:bg-rose-700" data-testid="create-order-btn">
            <Plus size={18} className="mr-2" />
            {t('dashboard.newRequest')}
          </Button>
        </Link>
      </div>

      {/* Rating Stats for Requester (if they also resolve orders) */}
      {ratingStats && ratingStats.total_delivered > 0 && (
        <RatingStatsCard stats={ratingStats} title={t('ratings.yourRatings')} t={t} />
      )}

      {/* KPI Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard label={t('orders.status.open')} value={dashboard.open_orders.length} icon={Inbox} color="bg-blue-500" />
        <KPICard label={t('orders.status.inProgress')} value={dashboard.in_progress.length} icon={Clock} color="bg-amber-500" />
        <KPICard label={t('dashboard.needsReview')} value={dashboard.needs_review.length} icon={AlertCircle} color="bg-purple-500" />
        <KPICard label={t('orders.status.delivered')} value={dashboard.delivered.length} icon={CheckCircle2} color="bg-green-500" />
      </div>

      {/* Needs Review Alert */}
      {dashboard.needs_review.length > 0 && (
        <Card className="border-purple-200 bg-purple-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-purple-700 flex items-center gap-2">
              <AlertCircle size={20} />
              {t('dashboard.needsReview')} ({dashboard.needs_review.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {dashboard.needs_review.map(order => (
              <OrderCard key={order.id} order={order} t={t} />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Open Orders */}
      <Card className="border-slate-200">
        <CardHeader className="border-b border-slate-100 pb-4">
          <CardTitle className="flex items-center gap-2">
            <Inbox size={20} className="text-blue-500" />
            {t('dashboard.openOrders')} ({dashboard.open_orders.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          {dashboard.open_orders.map(order => (
            <OrderCard key={order.id} order={order} t={t} />
          ))}
          {dashboard.open_orders.length === 0 && (
            <p className="text-center text-slate-500 py-8">{t('dashboard.noOpenOrders')}</p>
          )}
        </CardContent>
      </Card>

      {/* In Progress */}
      <Card className="border-slate-200">
        <CardHeader className="border-b border-slate-100 pb-4">
          <CardTitle className="flex items-center gap-2">
            <Clock size={20} className="text-amber-500" />
            {t('orders.status.inProgress')} ({dashboard.in_progress.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          {dashboard.in_progress.map(order => (
            <OrderCard key={order.id} order={order} t={t} />
          ))}
          {dashboard.in_progress.length === 0 && (
            <p className="text-center text-slate-500 py-8">{t('dashboard.noOrdersInProgress')}</p>
          )}
        </CardContent>
      </Card>

      {/* Delivered */}
      <Card className="border-slate-200">
        <CardHeader className="border-b border-slate-100 pb-4">
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 size={20} className="text-green-500" />
            {t('orders.status.delivered')} ({dashboard.delivered.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          {dashboard.delivered.slice(0, 5).map(order => (
            <OrderCard key={order.id} order={order} t={t} />
          ))}
          {dashboard.delivered.length === 0 && (
            <p className="text-center text-slate-500 py-8">{t('dashboard.noDelivered')}</p>
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
