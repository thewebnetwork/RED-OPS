import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { 
  TrendingUp,
  TrendingDown,
  Clock, 
  CheckCircle2, 
  AlertCircle,
  AlertTriangle,
  Inbox,
  Send,
  Eye,
  MessageSquare,
  BarChart3,
  PieChart,
  Activity,
  Target,
  Users,
  Layers,
  ArrowRight,
  RefreshCw,
  Calendar
} from 'lucide-react';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart as RechartsPieChart,
  Pie,
  Cell
} from 'recharts';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// ============== CONSTANTS ==============

const STATUS_COLORS = {
  open: '#3B82F6',
  in_progress: '#F59E0B',
  pending: '#8B5CF6',
  delivered: '#10B981',
  closed: '#6B7280'
};

const SLA_COLORS = {
  on_track: '#10B981',
  at_risk: '#F59E0B',
  breached: '#EF4444'
};

const POOL_COLORS = {
  pool1: '#6366F1',
  pool2: '#EC4899'
};

const statusConfig = {
  'Open': { class: 'bg-blue-100 text-blue-700', icon: Inbox },
  'In Progress': { class: 'bg-amber-100 text-amber-700', icon: Clock },
  'Pending': { class: 'bg-purple-100 text-purple-700', icon: AlertCircle },
  'Delivered': { class: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  'Closed': { class: 'bg-slate-100 text-slate-700', icon: CheckCircle2 },
};

const priorityConfig = {
  'Low': 'bg-slate-100 text-slate-600',
  'Normal': 'bg-blue-100 text-blue-600',
  'High': 'bg-orange-100 text-orange-600',
  'Urgent': 'bg-red-100 text-red-600',
};

// ============== ANIMATED KPI CARD ==============

function AnimatedKPICard({ 
  label, 
  value, 
  previousValue, 
  icon: Icon, 
  color, 
  onClick,
  trend,
  suffix = ''
}) {
  const [displayValue, setDisplayValue] = useState(0);
  
  useEffect(() => {
    // Animate the number
    const duration = 800;
    const start = displayValue;
    const end = value;
    const startTime = Date.now();
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function for smooth animation
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      const current = Math.round(start + (end - start) * easeOutQuart);
      
      setDisplayValue(current);
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    requestAnimationFrame(animate);
  }, [value]);
  
  const trendValue = previousValue !== undefined ? value - previousValue : null;
  const trendPercent = previousValue && previousValue > 0 
    ? Math.round(((value - previousValue) / previousValue) * 100) 
    : null;
  
  return (
    <Card 
      className={`border-slate-200 cursor-pointer hover:shadow-lg transition-all duration-300 hover:scale-[1.02] ${onClick ? 'hover:border-rose-200' : ''}`}
      onClick={onClick}
      data-testid={`kpi-${label.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 ${color} rounded-xl flex items-center justify-center shadow-lg transition-transform duration-300 hover:rotate-6`}>
              <Icon size={24} className="text-white" />
            </div>
            <div>
              <p className="text-3xl font-bold text-slate-900 tabular-nums">
                {displayValue}{suffix}
              </p>
              <p className="text-sm text-slate-500">{label}</p>
            </div>
          </div>
          {trendValue !== null && trendValue !== 0 && (
            <div className={`flex items-center gap-1 text-sm ${trendValue > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {trendValue > 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
              <span>{trendPercent > 0 ? '+' : ''}{trendPercent}%</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ============== TICKET LIST ITEM ==============

function TicketListItem({ ticket, showWaitingReason, t }) {
  const isBreaching = ticket.is_sla_breached;
  const StatusIcon = statusConfig[ticket.status]?.icon || Inbox;
  
  return (
    <Link 
      to={`/orders/${ticket.id}`}
      className={`block p-4 rounded-lg border transition-all duration-200 hover:shadow-md ${
        isBreaching ? 'border-red-300 bg-red-50/50' : 'border-slate-200 bg-white hover:border-rose-200'
      }`}
      data-testid={`ticket-${ticket.order_code}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
              {ticket.order_code}
            </span>
            <Badge className={statusConfig[ticket.status]?.class}>
              <StatusIcon size={12} className="mr-1" />
              {ticket.status}
            </Badge>
            <Badge className={priorityConfig[ticket.priority]}>
              {ticket.priority}
            </Badge>
            {isBreaching && (
              <Badge className="bg-red-100 text-red-700 animate-pulse">
                <AlertTriangle size={12} className="mr-1" />
                SLA Breach
              </Badge>
            )}
            {showWaitingReason && ticket.waiting_reason && (
              <Badge className="bg-amber-100 text-amber-700">
                <MessageSquare size={12} className="mr-1" />
                {ticket.waiting_reason === 'unread_message' ? 'Unread Message' : 'Needs Response'}
              </Badge>
            )}
          </div>
          <h3 className="font-medium text-slate-900 mt-2 truncate">{ticket.title}</h3>
          <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
            {ticket.category_l1_name && <span>{ticket.category_l1_name}</span>}
            <span>Due: {format(new Date(ticket.sla_deadline), 'MMM d, h:mm a')}</span>
          </div>
        </div>
        <ArrowRight size={16} className="text-slate-400 mt-2" />
      </div>
    </Link>
  );
}

// ============== TICKET LIST SECTION ==============

function TicketListSection({ title, icon: Icon, iconColor, tickets, showWaitingReason, emptyMessage, t, viewAllLink, viewAllRoute }) {
  // Support both viewAllLink (legacy) and viewAllRoute (new)
  const linkTo = viewAllRoute || viewAllLink;
  
  return (
    <Card className="border-slate-200">
      <CardHeader className="border-b border-slate-100 pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Icon size={20} className={iconColor} />
            {title} ({tickets.length})
          </CardTitle>
          {linkTo && tickets.length > 0 && (
            <Link to={linkTo} className="text-sm text-rose-600 hover:text-rose-700 flex items-center gap-1">
              View All <ArrowRight size={14} />
            </Link>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-4">
        <div className="space-y-3 max-h-[400px] overflow-y-auto">
          {tickets.slice(0, 10).map(ticket => (
            <TicketListItem 
              key={ticket.id} 
              ticket={ticket} 
              showWaitingReason={showWaitingReason}
              t={t} 
            />
          ))}
          {tickets.length === 0 && (
            <div className="text-center py-12 text-slate-500">
              <Icon size={40} className="mx-auto mb-3 opacity-30" />
              <p>{emptyMessage}</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ============== CHARTS ==============

function StatusAreaChart({ data, title, t }) {
  return (
    <Card className="border-slate-200">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Activity size={18} className="text-blue-500" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="colorOpen" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={STATUS_COLORS.open} stopOpacity={0.8}/>
                <stop offset="95%" stopColor={STATUS_COLORS.open} stopOpacity={0.1}/>
              </linearGradient>
              <linearGradient id="colorInProgress" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={STATUS_COLORS.in_progress} stopOpacity={0.8}/>
                <stop offset="95%" stopColor={STATUS_COLORS.in_progress} stopOpacity={0.1}/>
              </linearGradient>
              <linearGradient id="colorPending" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={STATUS_COLORS.pending} stopOpacity={0.8}/>
                <stop offset="95%" stopColor={STATUS_COLORS.pending} stopOpacity={0.1}/>
              </linearGradient>
              <linearGradient id="colorDelivered" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={STATUS_COLORS.delivered} stopOpacity={0.8}/>
                <stop offset="95%" stopColor={STATUS_COLORS.delivered} stopOpacity={0.1}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
            <XAxis 
              dataKey="date" 
              tick={{ fontSize: 11, fill: '#64748B' }}
              tickFormatter={(val) => format(new Date(val), 'MMM d')}
            />
            <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'white', 
                border: '1px solid #E2E8F0',
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
              }}
              labelFormatter={(val) => format(new Date(val), 'MMM d, yyyy')}
            />
            <Legend />
            <Area type="monotone" dataKey="open" name={t('chartLabels.open')} stroke={STATUS_COLORS.open} fillOpacity={1} fill="url(#colorOpen)" animationDuration={1500} />
            <Area type="monotone" dataKey="in_progress" name={t('chartLabels.inProgress')} stroke={STATUS_COLORS.in_progress} fillOpacity={1} fill="url(#colorInProgress)" animationDuration={1500} />
            <Area type="monotone" dataKey="pending" name={t('chartLabels.pending')} stroke={STATUS_COLORS.pending} fillOpacity={1} fill="url(#colorPending)" animationDuration={1500} />
            <Area type="monotone" dataKey="delivered" name={t('chartLabels.delivered')} stroke={STATUS_COLORS.delivered} fillOpacity={1} fill="url(#colorDelivered)" animationDuration={1500} />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

function CategoryBarChart({ data, title }) {
  return (
    <Card className="border-slate-200">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <BarChart3 size={18} className="text-indigo-500" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={data} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
            <XAxis type="number" tick={{ fontSize: 11, fill: '#64748B' }} />
            <YAxis 
              dataKey="category" 
              type="category" 
              width={120}
              tick={{ fontSize: 11, fill: '#64748B' }}
              tickFormatter={(val) => val?.length > 15 ? val.slice(0, 15) + '...' : val}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'white', 
                border: '1px solid #E2E8F0',
                borderRadius: '8px'
              }}
            />
            <Bar 
              dataKey="count" 
              fill="#6366F1" 
              radius={[0, 4, 4, 0]}
              animationDuration={1500}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

function SLATrendChart({ data, title, t }) {
  return (
    <Card className="border-slate-200">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Target size={18} className="text-emerald-500" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
            <XAxis 
              dataKey="date" 
              tick={{ fontSize: 11, fill: '#64748B' }}
              tickFormatter={(val) => format(new Date(val), 'MMM d')}
            />
            <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'white', 
                border: '1px solid #E2E8F0',
                borderRadius: '8px'
              }}
              labelFormatter={(val) => format(new Date(val), 'MMM d, yyyy')}
            />
            <Legend />
            <Line 
              type="monotone" 
              dataKey="on_track" 
              name={t('chartLabels.onTrack')}
              stroke={SLA_COLORS.on_track} 
              strokeWidth={2}
              dot={false}
              animationDuration={1500}
            />
            <Line 
              type="monotone" 
              dataKey="at_risk" 
              name={t('chartLabels.atRisk')}
              stroke={SLA_COLORS.at_risk} 
              strokeWidth={2}
              dot={false}
              animationDuration={1500}
            />
            <Line 
              type="monotone" 
              dataKey="breached" 
              name={t('chartLabels.breached')}
              stroke={SLA_COLORS.breached} 
              strokeWidth={2}
              dot={false}
              animationDuration={1500}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

function PoolRoutingChart({ data, title }) {
  if (!data || !data.pool1) return null;
  
  const chartData = [
    { name: 'Pool 1 Pickups', value: data.pool1.picked, fill: POOL_COLORS.pool1 },
    { name: 'Pool 2 Assignments', value: data.pool2.picked, fill: POOL_COLORS.pool2 },
    { name: 'Expired to Pool 2', value: data.expired_pool1_to_pool2, fill: '#F59E0B' }
  ];
  
  return (
    <Card className="border-slate-200">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Layers size={18} className="text-pink-500" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <ResponsiveContainer width="100%" height={200}>
            <RechartsPieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={70}
                paddingAngle={2}
                dataKey="value"
                animationDuration={1500}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip />
            </RechartsPieChart>
          </ResponsiveContainer>
          <div className="flex flex-col justify-center space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: POOL_COLORS.pool1 }} />
              <span className="text-sm">Pool 1: {data.pool1.picked} picked</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: POOL_COLORS.pool2 }} />
              <span className="text-sm">Pool 2: {data.pool2.picked} assigned</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-amber-500" />
              <span className="text-sm">Expired P1→P2: {data.expired_pool1_to_pool2}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============== LOADING SPINNER ==============

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin h-8 w-8 border-4 border-rose-600 border-t-transparent rounded-full" />
    </div>
  );
}

// ============== ADMIN DASHBOARD ==============

function AdminDashboard({ metrics, ticketLists, chartData, loading, onRefresh, t }) {
  if (loading) return <LoadingSpinner />;
  
  return (
    <div className="space-y-6" data-testid="admin-dashboard">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('dashboard.title')} - {t('adminDashboard')}</h1>
          <p className="text-slate-500 mt-1">{t('dashboardLabels.completeVisibility')}</p>
        </div>
        <Button variant="outline" size="sm" onClick={onRefresh} className="gap-2">
          <RefreshCw size={14} />
          {t('common.refresh')}
        </Button>
      </div>

      {/* KPI Cards - Status (Clickable) */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Link to="/orders?status=Open">
          <AnimatedKPICard label={t('dashboardLabels.open')} value={metrics.kpi.open} icon={Inbox} color="bg-blue-500" />
        </Link>
        <Link to="/orders?status=In Progress">
          <AnimatedKPICard label={t('dashboardLabels.inProgress')} value={metrics.kpi.in_progress} icon={Clock} color="bg-amber-500" />
        </Link>
        <Link to="/orders?status=Pending Review">
          <AnimatedKPICard label={t('dashboardLabels.pendingReview')} value={metrics.kpi.pending_review} icon={AlertCircle} color="bg-purple-500" />
        </Link>
        <Link to="/orders?status=Delivered">
          <AnimatedKPICard label={t('dashboardLabels.delivered')} value={metrics.kpi.delivered} icon={CheckCircle2} color="bg-emerald-500" />
        </Link>
        <Link to="/orders?status=Closed">
          <AnimatedKPICard label={t('dashboardLabels.closed')} value={metrics.kpi.closed} icon={CheckCircle2} color="bg-slate-500" />
        </Link>
      </div>

      {/* SLA Status (Clickable) */}
      <div>
        <h2 className="text-lg font-semibold text-slate-900 mb-3 flex items-center gap-2">
          <Target size={18} />
          {t('slaStatus')}
        </h2>
        <div className="grid grid-cols-3 gap-4">
          <Link to="/sla-policies?tab=monitoring&status=on_track">
            <AnimatedKPICard label={t('dashboardLabels.onTrack')} value={metrics.sla.on_track} icon={CheckCircle2} color="bg-emerald-500" />
          </Link>
          <Link to="/sla-policies?tab=monitoring&status=at_risk">
            <AnimatedKPICard label={t('dashboardLabels.atRisk')} value={metrics.sla.at_risk} icon={Clock} color="bg-amber-500" />
          </Link>
          <Link to="/sla-policies?tab=monitoring&status=breached">
            <AnimatedKPICard label={t('dashboardLabels.breached')} value={metrics.sla.breached} icon={AlertTriangle} color="bg-red-500" />
          </Link>
        </div>
      </div>

      {/* Pool Analytics (Clickable) */}
      {metrics.pool && (
        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-3 flex items-center gap-2">
            <Layers size={18} />
            {t('poolStatus')}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Link to="/ribbon-board?pool=1">
              <AnimatedKPICard label={t('dashboardLabels.pool1Available')} value={metrics.pool.pool1_available} icon={Layers} color="bg-indigo-500" />
            </Link>
            <Link to="/ribbon-board?pool=2">
              <AnimatedKPICard label={t('dashboardLabels.pool2Available')} value={metrics.pool.pool2_available} icon={Layers} color="bg-pink-500" />
            </Link>
            <Link to="/reports?metric=pool_pickups">
              <AnimatedKPICard label={t('dashboardLabels.pool1Pickups30d')} value={metrics.pool.pool1_pickups_30d} icon={TrendingUp} color="bg-indigo-500" />
            </Link>
            <Link to="/reports?metric=avg_pick_time">
              <AnimatedKPICard label={t('dashboardLabels.avgPickTimeP1')} value={metrics.pool.avg_time_to_pick_pool1_hours} suffix="h" icon={Clock} color="bg-indigo-500" />
            </Link>
          </div>
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {chartData.statusVolume && (
          <StatusAreaChart data={chartData.statusVolume} title={t('dashboardLabels.ticketVolumeByStatus')} t={t} />
        )}
        {chartData.categoryVolume && (
          <CategoryBarChart data={chartData.categoryVolume} title={t('dashboardLabels.topCategories')} />
        )}
        {chartData.slaTrend && (
          <SLATrendChart data={chartData.slaTrend} title={t('dashboardLabels.slaTrend')} t={t} />
        )}
        {chartData.poolRouting && (
          <PoolRoutingChart data={chartData.poolRouting} title={t('dashboardLabels.poolRouting')} />
        )}
      </div>

      {/* Ticket Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TicketListSection 
          title={t('dashboardLabels.ticketsWaitingAction')}
          icon={AlertCircle}
          iconColor="text-amber-500"
          tickets={ticketLists.waitingOnMe}
          showWaitingReason={true}
          emptyMessage={t('dashboardLabels.noTicketsWaiting')}
          t={t}
        />
        <TicketListSection 
          title={t('dashboardLabels.recentlyDelivered7d')}
          icon={CheckCircle2}
          iconColor="text-emerald-500"
          tickets={ticketLists.recentlyDelivered}
          emptyMessage={t('dashboardLabels.noDeliveries7d')}
          t={t}
          viewAllLink="/orders?status=Delivered"
        />
      </div>
    </div>
  );
}

// ============== OPERATOR DASHBOARD ==============

function OperatorDashboard({ metrics, ticketLists, chartData, loading, onRefresh, t }) {
  if (loading) return <LoadingSpinner />;
  
  return (
    <div className="space-y-6" data-testid="operator-dashboard">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('dashboard.title')}</h1>
          <p className="text-slate-500 mt-1">{t('dashboardLabels.yourWorkOverview')}</p>
        </div>
        <Button variant="outline" size="sm" onClick={onRefresh} className="gap-2">
          <RefreshCw size={14} />
          {t('common.refresh')}
        </Button>
      </div>

      {/* Workload KPIs (Clickable) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Link to="/my-tickets?filter=working_on">
          <AnimatedKPICard label={t('dashboardLabels.workingOn')} value={metrics.workload.tickets_working_on} icon={Clock} color="bg-amber-500" />
        </Link>
        <Link to="/my-tickets?filter=waiting_on_me">
          <AnimatedKPICard label={t('dashboardLabels.waitingOnMe')} value={metrics.workload.tickets_waiting_on_me} icon={AlertCircle} color="bg-red-500" />
        </Link>
        <Link to="/my-tickets?filter=pending_review">
          <AnimatedKPICard label={t('dashboardLabels.pendingReview')} value={metrics.workload.tickets_pending_review} icon={Eye} color="bg-purple-500" />
        </Link>
        <Link to="/my-tickets?filter=recently_delivered">
          <AnimatedKPICard label={t('dashboardLabels.delivered7d')} value={metrics.workload.recently_delivered_7d} icon={CheckCircle2} color="bg-emerald-500" />
        </Link>
      </div>

      {/* Pool Opportunities */}
      {(metrics.can_see_pool1 || metrics.can_see_pool2) && metrics.pool && (
        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-3 flex items-center gap-2">
            <Layers size={18} />
            {t('dashboardLabels.availableOpportunities')}
          </h2>
          <div className="grid grid-cols-2 gap-4">
            {metrics.can_see_pool1 && (
              <Link to="/ribbon?pool=1">
                <AnimatedKPICard label={t('dashboardLabels.pool1Opportunities')} value={metrics.pool.pool1_available} icon={Layers} color="bg-indigo-500" />
              </Link>
            )}
            {metrics.can_see_pool2 && (
              <Link to="/ribbon?pool=2">
                <AnimatedKPICard label={t('dashboardLabels.pool2Opportunities')} value={metrics.pool.pool2_available} icon={Layers} color="bg-pink-500" />
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Ticket Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TicketListSection 
          title={t('dashboardLabels.ticketsWorkingOn')}
          icon={Clock}
          iconColor="text-amber-500"
          tickets={ticketLists.workingOn}
          emptyMessage={t('dashboardLabels.noTicketsInProgress')}
          t={t}
        />
        <TicketListSection 
          title={t('dashboardLabels.ticketsWaitingOnMe')}
          icon={AlertCircle}
          iconColor="text-red-500"
          tickets={ticketLists.waitingOnMe}
          showWaitingReason={true}
          emptyMessage={t('dashboardLabels.noTicketsNeedAction')}
          t={t}
        />
      </div>

      {/* Recently Delivered */}
      <TicketListSection 
        title={t('dashboardLabels.recentlyDelivered7d')}
        icon={CheckCircle2}
        iconColor="text-emerald-500"
        tickets={ticketLists.recentlyDelivered}
        emptyMessage={t('dashboardLabels.noDeliveries7d')}
        t={t}
        viewAllLink="/my-tickets"
      />
    </div>
  );
}

// ============== PARTNER DASHBOARD ==============

function PartnerDashboard({ metrics, ticketLists, chartData, loading, onRefresh, t }) {
  if (loading) return <LoadingSpinner />;
  
  return (
    <div className="space-y-6" data-testid="partner-dashboard">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('dashboard.title')}</h1>
          <p className="text-slate-500 mt-1">{t('dashboardLabels.partnerPool1Access')}</p>
        </div>
        <Button variant="outline" size="sm" onClick={onRefresh} className="gap-2">
          <RefreshCw size={14} />
          {t('common.refresh')}
        </Button>
      </div>

      {/* Workload KPIs (Clickable) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Link to="/my-tickets?filter=working_on">
          <AnimatedKPICard label={t('dashboardLabels.workingOn')} value={metrics.workload.tickets_working_on} icon={Clock} color="bg-amber-500" />
        </Link>
        <Link to="/my-tickets?filter=waiting_on_me">
          <AnimatedKPICard label={t('dashboardLabels.waitingOnMe')} value={metrics.workload.tickets_waiting_on_me} icon={AlertCircle} color="bg-red-500" />
        </Link>
        <Link to="/my-tickets?filter=pending_review">
          <AnimatedKPICard label={t('dashboardLabels.pendingReview')} value={metrics.workload.tickets_pending_review} icon={Eye} color="bg-purple-500" />
        </Link>
        <Link to="/my-tickets?filter=recently_delivered">
          <AnimatedKPICard label={t('dashboardLabels.delivered7d')} value={metrics.workload.recently_delivered_7d} icon={CheckCircle2} color="bg-emerald-500" />
        </Link>
      </div>

      {/* Pool 1 Opportunities (Clickable) */}
      {metrics.pool && (
        <Link to="/ribbon-board?pool=1">
          <Card className="border-indigo-200 bg-indigo-50/50 hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-indigo-500 rounded-xl flex items-center justify-center">
                    <Layers size={28} className="text-white" />
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-indigo-900">{metrics.pool.pool1_available}</p>
                    <p className="text-indigo-700">{t('dashboardLabels.pool1OpportunitiesAvailable')}</p>
                  </div>
                </div>
                <Button className="bg-indigo-600 hover:bg-indigo-700 gap-2">
                  {t('dashboardLabels.viewRibbon')} <ArrowRight size={16} />
                </Button>
              </div>
            </CardContent>
          </Card>
        </Link>
      )}

      {/* Ticket Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TicketListSection 
          title={t('dashboardLabels.ticketsWorkingOn')}
          icon={Clock}
          iconColor="text-amber-500"
          tickets={ticketLists.workingOn}
          emptyMessage={t('dashboardLabels.noTicketsInProgress')}
          t={t}
        />
        <TicketListSection 
          title={t('dashboardLabels.ticketsWaitingOnMe')}
          icon={AlertCircle}
          iconColor="text-red-500"
          tickets={ticketLists.waitingOnMe}
          showWaitingReason={true}
          emptyMessage={t('dashboardLabels.noTicketsNeedAction')}
          t={t}
        />
      </div>
    </div>
  );
}

// ============== VENDOR DASHBOARD ==============

function VendorDashboard({ metrics, ticketLists, chartData, loading, onRefresh, t }) {
  if (loading) return <LoadingSpinner />;
  
  return (
    <div className="space-y-6" data-testid="vendor-dashboard">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('dashboard.title')}</h1>
          <p className="text-slate-500 mt-1">{t('dashboardLabels.vendorPool2Access')}</p>
        </div>
        <Button variant="outline" size="sm" onClick={onRefresh} className="gap-2">
          <RefreshCw size={14} />
          {t('common.refresh')}
        </Button>
      </div>

      {/* Workload KPIs (Clickable) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Link to="/my-tickets?filter=working_on">
          <AnimatedKPICard label={t('dashboardLabels.workingOn')} value={metrics.workload.tickets_working_on} icon={Clock} color="bg-amber-500" />
        </Link>
        <Link to="/my-tickets?filter=waiting_on_me">
          <AnimatedKPICard label={t('dashboardLabels.waitingOnMe')} value={metrics.workload.tickets_waiting_on_me} icon={AlertCircle} color="bg-red-500" />
        </Link>
        <Link to="/my-tickets?filter=pending_review">
          <AnimatedKPICard label={t('dashboardLabels.pendingReview')} value={metrics.workload.tickets_pending_review} icon={Eye} color="bg-purple-500" />
        </Link>
        <Link to="/my-tickets?filter=recently_delivered">
          <AnimatedKPICard label={t('dashboardLabels.delivered7d')} value={metrics.workload.recently_delivered_7d} icon={CheckCircle2} color="bg-emerald-500" />
        </Link>
      </div>

      {/* Pool 2 Opportunities (Clickable) */}
      {metrics.pool && (
        <Link to="/ribbon-board?pool=2">
          <Card className="border-pink-200 bg-pink-50/50 hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-pink-500 rounded-xl flex items-center justify-center">
                    <Layers size={28} className="text-white" />
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-pink-900">{metrics.pool.pool2_available}</p>
                    <p className="text-pink-700">{t('dashboardLabels.pool2OpportunitiesAvailable')}</p>
                  </div>
                </div>
                <Button className="bg-pink-600 hover:bg-pink-700 gap-2">
                  {t('dashboardLabels.viewOpportunities')} <ArrowRight size={16} />
                </Button>
              </div>
            </CardContent>
          </Card>
        </Link>
      )}

      {/* Ticket Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TicketListSection 
          title={t('dashboardLabels.ticketsWorkingOn')}
          icon={Clock}
          iconColor="text-amber-500"
          tickets={ticketLists.workingOn}
          emptyMessage={t('dashboardLabels.noTicketsInProgress')}
          t={t}
          viewAllRoute="/my-tickets?filter=working_on"
        />
        <TicketListSection 
          title={t('dashboardLabels.ticketsWaitingOnMe')}
          icon={AlertCircle}
          iconColor="text-red-500"
          tickets={ticketLists.waitingOnMe}
          showWaitingReason={true}
          emptyMessage={t('dashboardLabels.noTicketsNeedAction')}
          t={t}
          viewAllRoute="/my-tickets?filter=waiting_on_me"
        />
      </div>
    </div>
  );
}

// ============== MEDIA CLIENT DASHBOARD ==============

function MediaClientDashboard({ metrics, ticketLists, loading, onRefresh, t }) {
  if (loading) return <LoadingSpinner />;
  
  return (
    <div className="space-y-6" data-testid="media-client-dashboard">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('dashboard.title')}</h1>
          <p className="text-slate-500 mt-1">{t('dashboardLabels.yourSubmittedTickets')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onRefresh} className="gap-2">
            <RefreshCw size={14} />
            {t('common.refresh')}
          </Button>
          <Link to="/submit">
            <Button size="sm" className="bg-rose-600 hover:bg-rose-700 gap-2">
              <Send size={14} />
              {t('buttons.newRequest')}
            </Button>
          </Link>
        </div>
      </div>

      {/* My Ticket KPIs (Clickable - routes to my-tickets for Media Clients) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Link to="/my-tickets?status=Open">
          <AnimatedKPICard label={t('dashboardLabels.open')} value={metrics.kpi.open} icon={Inbox} color="bg-blue-500" />
        </Link>
        <Link to="/my-tickets?status=In Progress">
          <AnimatedKPICard label={t('dashboardLabels.inProgress')} value={metrics.kpi.in_progress} icon={Clock} color="bg-amber-500" />
        </Link>
        <Link to="/my-tickets?status=Pending Review">
          <AnimatedKPICard label={t('dashboardLabels.pendingReview')} value={metrics.kpi.pending_review} icon={Eye} color="bg-purple-500" />
        </Link>
        <Link to="/my-tickets?status=Delivered">
          <AnimatedKPICard label={t('dashboardLabels.delivered')} value={metrics.kpi.delivered} icon={CheckCircle2} color="bg-emerald-500" />
        </Link>
      </div>

      {/* SLA Overview (Non-clickable for Media Clients - they don't have SLA access) */}
      <div className="grid grid-cols-3 gap-4">
        <AnimatedKPICard label={t('dashboardLabels.onTrack')} value={metrics.sla.on_track} icon={CheckCircle2} color="bg-emerald-500" />
        <AnimatedKPICard label={t('dashboardLabels.atRisk')} value={metrics.sla.at_risk} icon={Clock} color="bg-amber-500" />
        <AnimatedKPICard label={t('dashboardLabels.breached')} value={metrics.sla.breached} icon={AlertTriangle} color="bg-red-500" />
      </div>

      {/* Tickets Needing Your Review */}
      {ticketLists.pendingReview.length > 0 && (
        <Link to="/my-tickets?filter=pending_review">
          <Card className="border-purple-200 bg-purple-50/50 hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader className="pb-2">
              <CardTitle className="text-purple-900 flex items-center gap-2">
                <Eye size={20} />
                {t('dashboardLabels.ticketsPendingReview')} ({ticketLists.pendingReview.length})
              </CardTitle>
              <CardDescription className="text-purple-700">
                {t('dashboardLabels.ticketsPendingReviewDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {ticketLists.pendingReview.slice(0, 3).map(ticket => (
                  <TicketListItem key={ticket.id} ticket={ticket} t={t} />
                ))}
                {ticketLists.pendingReview.length > 3 && (
                  <p className="text-sm text-purple-600 text-center pt-2">
                    {t('dashboardLabels.moreTicketsPending', { count: ticketLists.pendingReview.length - 3 })}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </Link>
      )}

      {/* Active Tickets */}
      <TicketListSection 
        title={t('dashboardLabels.activeTickets')}
        icon={Clock}
        iconColor="text-amber-500"
        tickets={ticketLists.workingOn}
        emptyMessage={t('dashboardLabels.noActiveTickets')}
        t={t}
        viewAllLink="/my-tickets"
      />

      {/* Recently Delivered */}
      <TicketListSection 
        title={t('dashboardLabels.recentlyDelivered7d')}
        icon={CheckCircle2}
        iconColor="text-emerald-500"
        tickets={ticketLists.recentlyDelivered}
        emptyMessage={t('dashboardLabels.noDeliveries7d')}
        t={t}
        viewAllLink="/my-tickets?status=Delivered"
      />
    </div>
  );
}

// ============== DYNAMIC WIDGET RENDERER ==============

// Click-through routes for KPI cards based on metric type
const getKPIClickRoute = (metricKey, userRole, accountType) => {
  // Route mappings for different metrics
  const routes = {
    // Ticket status KPIs → filtered orders/tickets
    'open': '/orders?status=Open',
    'in_progress': '/orders?status=In Progress',
    'pending_review': '/orders?status=Pending Review',
    'delivered': '/orders?status=Delivered',
    'closed': '/orders?status=Closed',
    // SLA status KPIs → SLA filtered view
    'sla_on_track': '/orders?sla=on_track',
    'sla_at_risk': '/orders?sla=at_risk',
    'sla_breached': '/orders?sla=breached',
    // Workload KPIs
    'working_on': '/my-tickets?filter=working_on',
    'waiting_on_me': '/my-tickets?filter=waiting_on_me',
    // Pool KPIs
    'pool1_available': '/ribbon-board?pool=1',
    'pool2_available': '/ribbon-board?pool=2',
    'pool_pickups': '/reports?metric=pool_pickups',
    'avg_pick_time': '/reports?metric=avg_pick_time'
  };
  
  // Media clients get restricted routing
  if (accountType === 'Media Client') {
    const mediaClientRoutes = {
      'open': '/my-tickets?status=Open',
      'in_progress': '/my-tickets?status=In Progress',
      'pending_review': '/my-tickets?status=Pending Review',
      'delivered': '/my-tickets?status=Delivered',
      'closed': '/my-tickets?status=Closed',
      'working_on': '/my-tickets',
      'waiting_on_me': '/my-tickets?filter=waiting_on_me'
    };
    return mediaClientRoutes[metricKey] || '/my-tickets';
  }
  
  // Non-admins may have restricted access to /orders
  if (userRole !== 'Administrator') {
    // Redirect to my-tickets instead of /orders for non-admins
    const nonAdminRoutes = {
      'open': '/my-tickets?status=Open',
      'in_progress': '/my-tickets?status=In Progress',
      'pending_review': '/my-tickets?status=Pending Review',
      'delivered': '/my-tickets?status=Delivered',
      'closed': '/my-tickets?status=Closed'
    };
    return nonAdminRoutes[metricKey] || routes[metricKey] || null;
  }
  
  return routes[metricKey] || null;
};

// Check if a widget is pool-related
const isPoolWidget = (widget) => {
  const poolMetrics = ['pool1_available', 'pool2_available', 'pool_pickups', 'avg_pick_time'];
  const poolListTypes = ['pool1_tickets', 'pool2_tickets'];
  
  if (widget.widget_type === 'kpi_card') {
    return poolMetrics.includes(widget.config?.metric);
  }
  if (widget.widget_type === 'ticket_list') {
    return poolListTypes.includes(widget.config?.list_type);
  }
  return false;
};

function DynamicDashboard({ dashboardConfig, metrics, ticketLists, chartData, loading, onRefresh, t, user }) {
  const navigate = useNavigate();
  const allWidgets = dashboardConfig?.widgets || [];
  
  // Filter out pool widgets if user can't pick or has no pool access
  const widgets = allWidgets.filter(widget => {
    if (!isPoolWidget(widget)) return true;
    // Hide pool widgets if can_pick is false or pool_access is "none"
    if (user?.can_pick === false || user?.pool_access === 'none') return false;
    return true;
  });
  
  // Handle KPI card click
  const handleKPIClick = (metricKey) => {
    const route = getKPIClickRoute(metricKey, user?.role, user?.account_type);
    if (route) {
      navigate(route);
    } else {
      toast.info('This view is not available');
    }
  };
  
  // Group widgets by size for responsive layout
  const renderWidget = (widget) => {
    const { widget_type, title, config, size } = widget;
    const sizeClass = size === 'large' ? 'md:col-span-2' : size === 'small' ? '' : 'md:col-span-1';
    
    switch (widget_type) {
      case 'kpi_card':
        const metricKey = config?.metric;
        const value = metricKey === 'open' ? metrics?.kpi?.open :
                      metricKey === 'in_progress' ? metrics?.kpi?.in_progress :
                      metricKey === 'pending_review' ? metrics?.kpi?.pending_review :
                      metricKey === 'delivered' ? metrics?.kpi?.delivered :
                      metricKey === 'closed' ? metrics?.kpi?.closed :
                      metricKey === 'sla_on_track' ? metrics?.sla?.on_track :
                      metricKey === 'sla_at_risk' ? metrics?.sla?.at_risk :
                      metricKey === 'sla_breached' ? metrics?.sla?.breached :
                      metricKey === 'working_on' ? metrics?.workload?.tickets_working_on :
                      metricKey === 'waiting_on_me' ? metrics?.workload?.tickets_waiting_on_me : 0;
        
        const IconComponent = config?.icon === 'Inbox' ? Inbox :
                              config?.icon === 'Clock' ? Clock :
                              config?.icon === 'AlertCircle' ? AlertCircle :
                              config?.icon === 'CheckCircle2' ? CheckCircle2 :
                              config?.icon === 'Target' ? Target :
                              config?.icon === 'AlertTriangle' ? AlertTriangle :
                              config?.icon === 'Activity' ? Activity : BarChart3;
        
        return (
          <AnimatedKPICard
            key={widget.id}
            label={title}
            value={value || 0}
            icon={IconComponent}
            color={config?.color || 'bg-blue-500'}
            onClick={() => handleKPIClick(metricKey)}
          />
        );
      
      case 'ticket_list':
        const listType = config?.list_type;
        const tickets = listType === 'working_on' ? ticketLists.workingOn :
                        listType === 'waiting_on_me' ? ticketLists.waitingOnMe :
                        listType === 'pending_review' ? ticketLists.pendingReview :
                        listType === 'recently_delivered' ? ticketLists.recentlyDelivered : [];
        
        // Determine route for the "View All" link based on list type
        const listRoute = listType === 'recently_delivered' ? '/my-tickets?filter=recently_delivered' :
                          listType === 'waiting_on_me' ? '/my-tickets?filter=waiting_on_me' :
                          listType === 'pending_review' ? '/my-tickets?filter=pending_review' :
                          '/my-tickets';
        
        return (
          <div key={widget.id} className={sizeClass}>
            <TicketListSection
              title={title}
              icon={listType === 'recently_delivered' ? CheckCircle2 : 
                    listType === 'waiting_on_me' ? Clock : Inbox}
              iconColor={listType === 'recently_delivered' ? 'text-emerald-500' : 
                         listType === 'waiting_on_me' ? 'text-amber-500' : 'text-blue-500'}
              tickets={tickets}
              emptyMessage={`No ${title.toLowerCase()}`}
              t={t}
              viewAllRoute={listRoute}
            />
          </div>
        );
      
      case 'chart':
        const chartType = config?.chart_type;
        if (chartType === 'ticket_volume_status' && chartData.statusVolume) {
          return (
            <Card key={widget.id} className={`${sizeClass} col-span-full md:col-span-1 cursor-pointer hover:shadow-md transition-shadow`}
                  onClick={() => navigate('/reports?chart=ticket_volume&range=30')}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 size={18} className="text-blue-500" />
                  {title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData.statusVolume}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#9CA3AF" />
                      <YAxis tick={{ fontSize: 11 }} stroke="#9CA3AF" />
                      <Tooltip />
                      <Bar dataKey="open" stackId="a" fill={STATUS_COLORS.open} name="Open" />
                      <Bar dataKey="in_progress" stackId="a" fill={STATUS_COLORS.in_progress} name="In Progress" />
                      <Bar dataKey="pending" stackId="a" fill={STATUS_COLORS.pending} name="Pending" />
                      <Bar dataKey="delivered" stackId="a" fill={STATUS_COLORS.delivered} name="Delivered" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          );
        }
        return null;
      
      default:
        return null;
    }
  };
  
  // Separate KPI cards from other widgets
  const kpiWidgets = widgets.filter(w => w.widget_type === 'kpi_card');
  const otherWidgets = widgets.filter(w => w.widget_type !== 'kpi_card');
  
  return (
    <div className="space-y-6" data-testid="dynamic-dashboard">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('dashboard.title')}</h1>
          <p className="text-slate-500 text-sm">{dashboardConfig?.name || 'Dashboard'}</p>
        </div>
        <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading}>
          <RefreshCw size={16} className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
          {t('common.refresh')}
        </Button>
      </div>
      
      {/* KPI Cards Grid */}
      {kpiWidgets.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {kpiWidgets.map(renderWidget)}
        </div>
      )}
      
      {/* Other Widgets */}
      <div className="grid md:grid-cols-2 gap-6">
        {otherWidgets.map(renderWidget)}
      </div>
      
      {/* If no widgets configured, show a message */}
      {widgets.length === 0 && (
        <Card className="p-8 text-center">
          <p className="text-slate-500">No widgets configured for this dashboard.</p>
          <p className="text-slate-400 text-sm mt-2">Contact your administrator to set up your dashboard.</p>
        </Card>
      )}
    </div>
  );
}

// ============== MAIN DASHBOARD COMPONENT ==============

export default function Dashboard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState(null);
  const [dashboardConfig, setDashboardConfig] = useState(null);
  const [useCustomDashboard, setUseCustomDashboard] = useState(false);
  const [ticketLists, setTicketLists] = useState({
    workingOn: [],
    waitingOnMe: [],
    pendingReview: [],
    recentlyDelivered: []
  });
  const [chartData, setChartData] = useState({
    statusVolume: null,
    categoryVolume: null,
    slaTrend: null,
    poolRouting: null
  });

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // Fetch user's assigned dashboard configuration FIRST
      const dashboardRes = await axios.get(`${API}/dashboards/user-dashboard`);
      if (dashboardRes.data.dashboard && dashboardRes.data.assigned) {
        setDashboardConfig(dashboardRes.data.dashboard);
        setUseCustomDashboard(true);
      } else {
        setUseCustomDashboard(false);
      }
      
      // Fetch main metrics
      const metricsRes = await axios.get(`${API}/dashboard/v2/metrics`);
      setMetrics(metricsRes.data);
      
      // Fetch ticket lists
      const [workingOnRes, waitingOnMeRes, pendingReviewRes, recentlyDeliveredRes] = await Promise.all([
        axios.get(`${API}/dashboard/v2/tickets/working-on`),
        axios.get(`${API}/dashboard/v2/tickets/waiting-on-me`),
        axios.get(`${API}/dashboard/v2/tickets/pending-review`),
        axios.get(`${API}/dashboard/v2/tickets/recently-delivered`)
      ]);
      
      setTicketLists({
        workingOn: workingOnRes.data.tickets || [],
        waitingOnMe: waitingOnMeRes.data.tickets || [],
        pendingReview: pendingReviewRes.data.tickets || [],
        recentlyDelivered: recentlyDeliveredRes.data.tickets || []
      });
      
      // Fetch chart data (only for admin and some roles)
      if (metricsRes.data.role_type === 'admin') {
        const [statusVolumeRes, categoryVolumeRes, poolRoutingRes] = await Promise.all([
          axios.get(`${API}/dashboard/v2/charts/ticket-volume-by-status?days=30`),
          axios.get(`${API}/dashboard/v2/charts/ticket-volume-by-category?days=30`),
          axios.get(`${API}/dashboard/v2/charts/pool-routing?days=30`)
        ]);
        
        // Transform SLA trend data from metrics
        const slaTrend = metricsRes.data.trends_30d?.sla?.on_track?.map((item, idx) => ({
          date: item.date,
          on_track: item.value,
          at_risk: metricsRes.data.trends_30d?.sla?.at_risk?.[idx]?.value || 0,
          breached: metricsRes.data.trends_30d?.sla?.breached?.[idx]?.value || 0
        })) || [];
        
        setChartData({
          statusVolume: statusVolumeRes.data.data || [],
          categoryVolume: categoryVolumeRes.data.data || [],
          slaTrend: slaTrend,
          poolRouting: poolRoutingRes.data.data || null
        });
      }
    } catch (error) {
      console.error('Dashboard fetch error:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  if (!user) return <LoadingSpinner />;

  // Determine which dashboard to show based on role_type from metrics
  const roleType = metrics?.role_type || 'operator';

  return (
    <div className="animate-fade-in" data-testid="dashboard-page">
      {/* Use custom dashboard if user has one assigned */}
      {useCustomDashboard && dashboardConfig ? (
        <DynamicDashboard
          dashboardConfig={dashboardConfig}
          metrics={metrics}
          ticketLists={ticketLists}
          chartData={chartData}
          loading={loading}
          onRefresh={fetchDashboardData}
          t={t}
          user={user}
        />
      ) : (
        <>
          {/* Fall back to role-based dashboards */}
          {roleType === 'admin' && (
            <AdminDashboard 
              metrics={metrics}
              ticketLists={ticketLists}
              chartData={chartData}
              loading={loading}
              onRefresh={fetchDashboardData}
              t={t}
            />
          )}
          {roleType === 'operator' && (
            <OperatorDashboard 
              metrics={metrics}
              ticketLists={ticketLists}
              chartData={chartData}
              loading={loading}
              onRefresh={fetchDashboardData}
              t={t}
            />
          )}
          {roleType === 'partner' && (
            <PartnerDashboard 
              metrics={metrics}
              ticketLists={ticketLists}
              chartData={chartData}
              loading={loading}
              onRefresh={fetchDashboardData}
              t={t}
            />
          )}
          {roleType === 'vendor' && (
            <VendorDashboard 
              metrics={metrics}
              ticketLists={ticketLists}
              chartData={chartData}
              loading={loading}
              onRefresh={fetchDashboardData}
              t={t}
            />
          )}
          {roleType === 'media_client' && (
            <MediaClientDashboard 
              metrics={metrics}
              ticketLists={ticketLists}
              loading={loading}
              onRefresh={fetchDashboardData}
              t={t}
            />
          )}
        </>
      )}
    </div>
  );
}
