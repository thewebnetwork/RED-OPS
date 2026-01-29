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
  
  // Get translated status and priority
  const statusKey = order.status.toLowerCase().replace(/\s+/g, '');
  const priorityKey = order.priority.toLowerCase();
  const translatedStatus = t(`orders.status.${statusKey}`);
  const translatedPriority = t(`orders.priority_levels.${priorityKey}`);
  
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
            <Badge className={statusConfig[order.status]?.class}>{translatedStatus !== `orders.status.${statusKey}` ? translatedStatus : order.status}</Badge>
            <Badge className={priorityConfig[order.priority]}>{translatedPriority !== `orders.priority_levels.${priorityKey}` ? translatedPriority : order.priority}</Badge>
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
    delivered_count: 0
  });
  const [slaStats, setSlaStats] = useState({
    on_track: 0,
    at_risk: 0,
    breached: 0,
    unacknowledged: 0
  });
  const [myWork, setMyWork] = useState({
    working_on: [],
    delivered: [],
    my_submitted_count: 0
  });
  const [ratingStats, setRatingStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [statsRes, myWorkRes, ratingsRes, slaStatsRes] = await Promise.all([
        axios.get(`${API}/dashboard/stats`),
        axios.get(`${API}/dashboard/my-work`),
        axios.get(`${API}/ratings/my-stats`).catch(() => ({ data: null })),
        axios.get(`${API}/sla-policies/monitoring/stats`).catch(() => ({ data: { orders: {}, escalations: {} } }))
      ]);
      setStats(statsRes.data);
      setMyWork(myWorkRes.data);
      setRatingStats(ratingsRes.data);
      setSlaStats({
        on_track: slaStatsRes.data?.orders?.on_track || 0,
        at_risk: slaStatsRes.data?.orders?.at_risk || 0,
        breached: slaStatsRes.data?.orders?.breached || 0,
        unacknowledged: slaStatsRes.data?.escalations?.unacknowledged || 0
      });
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
      </div>

      {/* Rating Stats for Admin (if they have any) */}
      {ratingStats && ratingStats.total_delivered > 0 && (
        <RatingStatsCard stats={ratingStats} title={t('ratings.yourRatings')} t={t} />
      )}

      {/* Order Status KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <KPICard label={t('orders.status.open')} value={stats.open_count} icon={Inbox} color="bg-blue-500" />
        <KPICard label={t('orders.status.inProgress')} value={stats.in_progress_count} icon={Clock} color="bg-amber-500" />
        <KPICard label={t('dashboard.pendingReview')} value={stats.pending_count} icon={AlertCircle} color="bg-purple-500" />
        <KPICard label={t('orders.status.delivered')} value={stats.delivered_count} icon={CheckCircle2} color="bg-green-500" />
        <Link to="/my-tickets">
          <KPICard label="My Submitted Tickets" value={myWork.my_submitted_count} icon={Send} color="bg-indigo-500" />
        </Link>
      </div>

      {/* SLA Status KPIs - Linked to SLA Module */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-slate-900">{t('dashboard.slaStatus')}</h2>
          <Link to="/sla-policies" className="text-sm text-rose-600 hover:text-rose-700 flex items-center gap-1">
            {t('dashboard.viewAll')} <ArrowRight size={14} />
          </Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link to="/sla-policies?tab=monitoring&status=on_track">
            <KPICard 
              label={t('dashboard.onTrack')} 
              value={slaStats.on_track} 
              icon={CheckCircle2} 
              color="bg-emerald-500" 
            />
          </Link>
          <Link to="/sla-policies?tab=monitoring&status=at_risk">
            <KPICard 
              label={t('dashboard.atRisk')} 
              value={slaStats.at_risk} 
              icon={Clock} 
              color="bg-amber-500" 
            />
          </Link>
          <Link to="/sla-policies?tab=monitoring&status=breached">
            <KPICard 
              label={t('dashboard.breached')} 
              value={slaStats.breached} 
              icon={AlertTriangle} 
              color="bg-red-500" 
            />
          </Link>
          <Link to="/sla-policies?tab=history">
            <KPICard 
              label={t('dashboard.unacknowledged')} 
              value={slaStats.unacknowledged} 
              icon={AlertCircle} 
              color="bg-orange-500" 
            />
          </Link>
        </div>
      </div>

      {/* Tickets I'm Working On */}
      <Card className="border-slate-200">
        <CardHeader className="border-b border-slate-100 pb-4">
          <CardTitle className="flex items-center gap-2">
            <Clock size={20} className="text-amber-500" />
            {t('dashboard.ticketsWorkingOn')} ({myWork.working_on.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="space-y-3">
            {myWork.working_on.map(order => (
              <OrderCard key={order.id} order={order} t={t} />
            ))}
            {myWork.working_on.length === 0 && (
              <p className="text-center text-slate-500 py-8">{t('dashboard.noOrdersInProgress')}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tickets Delivered */}
      <Card className="border-slate-200">
        <CardHeader className="border-b border-slate-100 pb-4">
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 size={20} className="text-green-500" />
            {t('dashboard.ticketsDelivered')} ({myWork.delivered.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="space-y-3">
            {myWork.delivered.slice(0, 10).map(order => (
              <OrderCard key={order.id} order={order} t={t} />
            ))}
            {myWork.delivered.length === 0 && (
              <p className="text-center text-slate-500 py-8">{t('dashboard.noDelivered')}</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Editor Dashboard (for Operators, Partners, Vendors, Internal Staff)
function EditorDashboard() {
  const { t } = useTranslation();
  const [myWork, setMyWork] = useState({
    working_on: [],
    delivered: [],
    my_submitted_count: 0
  });
  const [ratingStats, setRatingStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [myWorkRes, ratingsRes] = await Promise.all([
        axios.get(`${API}/dashboard/my-work`),
        axios.get(`${API}/ratings/my-stats`).catch(() => ({ data: null }))
      ]);
      setMyWork(myWorkRes.data);
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
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{t('dashboard.title')}</h1>
        <p className="text-slate-500 mt-1">Your work overview</p>
      </div>

      {/* Rating Stats Card - Google Review Style */}
      <RatingStatsCard stats={ratingStats} title={t('ratings.yourRatings')} t={t} />

      {/* KPI Summary */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <KPICard label={t('dashboard.ticketsWorkingOn')} value={myWork.working_on.length} icon={Clock} color="bg-amber-500" />
        <KPICard label={t('dashboard.ticketsDelivered')} value={myWork.delivered.length} icon={CheckCircle2} color="bg-green-500" />
        <Link to="/my-tickets">
          <KPICard label={t('dashboard.mySubmittedTickets')} value={myWork.my_submitted_count} icon={Send} color="bg-indigo-500" />
        </Link>
      </div>

      {/* Tickets I'm Working On */}
      <Card className="border-slate-200">
        <CardHeader className="border-b border-slate-100 pb-4">
          <CardTitle className="flex items-center gap-2">
            <Clock size={20} className="text-amber-500" />
            {t('dashboard.ticketsWorkingOn')} ({myWork.working_on.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          {myWork.working_on.map(order => (
            <OrderCard key={order.id} order={order} t={t} />
          ))}
          {myWork.working_on.length === 0 && (
            <p className="text-center text-slate-500 py-8">{t('dashboard.noOrdersInProgress')}</p>
          )}
        </CardContent>
      </Card>

      {/* Tickets Delivered */}
      <Card className="border-slate-200">
        <CardHeader className="border-b border-slate-100 pb-4">
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 size={20} className="text-green-500" />
            {t('dashboard.ticketsDelivered')} ({myWork.delivered.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          {myWork.delivered.slice(0, 10).map(order => (
            <OrderCard key={order.id} order={order} t={t} />
          ))}
          {myWork.delivered.length === 0 && (
            <p className="text-center text-slate-500 py-8">{t('dashboard.noDelivered')}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Requester Dashboard (Standard User)
function RequesterDashboard() {
  const { t } = useTranslation();
  const [myWork, setMyWork] = useState({
    working_on: [],
    delivered: [],
    my_submitted_count: 0
  });
  const [ratingStats, setRatingStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [myWorkRes, ratingsRes] = await Promise.all([
        axios.get(`${API}/dashboard/my-work`),
        axios.get(`${API}/ratings/my-stats`).catch(() => ({ data: null }))
      ]);
      setMyWork(myWorkRes.data);
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
          <h1 className="text-2xl font-bold text-slate-900">{t('dashboard.title')}</h1>
          <p className="text-slate-500 mt-1">Your work overview</p>
        </div>
      </div>

      {/* Rating Stats for Requester (if they also resolve orders) */}
      {ratingStats && ratingStats.total_delivered > 0 && (
        <RatingStatsCard stats={ratingStats} title={t('ratings.yourRatings')} t={t} />
      )}

      {/* KPI Summary */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <KPICard label="Tickets I'm Working On" value={myWork.working_on.length} icon={Clock} color="bg-amber-500" />
        <KPICard label="Tickets Delivered" value={myWork.delivered.length} icon={CheckCircle2} color="bg-green-500" />
        <Link to="/my-tickets">
          <KPICard label="My Submitted Tickets" value={myWork.my_submitted_count} icon={Send} color="bg-indigo-500" />
        </Link>
      </div>

      {/* Tickets I'm Working On */}
      <Card className="border-slate-200">
        <CardHeader className="border-b border-slate-100 pb-4">
          <CardTitle className="flex items-center gap-2">
            <Clock size={20} className="text-amber-500" />
            Tickets I&apos;m Working On ({myWork.working_on.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          {myWork.working_on.map(order => (
            <OrderCard key={order.id} order={order} t={t} />
          ))}
          {myWork.working_on.length === 0 && (
            <p className="text-center text-slate-500 py-8">No tickets currently assigned to you</p>
          )}
        </CardContent>
      </Card>

      {/* Tickets Delivered */}
      <Card className="border-slate-200">
        <CardHeader className="border-b border-slate-100 pb-4">
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 size={20} className="text-green-500" />
            Tickets Delivered ({myWork.delivered.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          {myWork.delivered.slice(0, 10).map(order => (
            <OrderCard key={order.id} order={order} t={t} />
          ))}
          {myWork.delivered.length === 0 && (
            <p className="text-center text-slate-500 py-8">No delivered tickets yet</p>
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

  // Check for admin roles (supports both old and new role names)
  const isAdmin = user.role === 'Administrator' || user.role === 'Admin';
  // Check for editor/privileged user roles
  const isEditor = user.role === 'Privileged User' || user.role === 'Editor';
  // Check for requester/standard user roles
  const isRequester = user.role === 'Standard User' || user.role === 'Requester';

  return (
    <div className="animate-fade-in" data-testid="dashboard-page">
      {isAdmin && <AdminDashboard />}
      {isEditor && <EditorDashboard />}
      {isRequester && <RequesterDashboard />}
    </div>
  );
}
