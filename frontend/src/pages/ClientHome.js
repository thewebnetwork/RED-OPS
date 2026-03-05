import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { 
  ArrowRight, 
  FileText, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  Plus,
  ChevronRight,
  User
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function ClientHome() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [recentRequests, setRecentRequests] = useState([]);
  const [stats, setStats] = useState({ active: 0, completed: 0, pending: 0 });
  const [accountManager, setAccountManager] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch user's recent requests and slice client-side to 5
      const res = await axios.get(`${API}/orders/my-requests`);
      const allRequests = res.data;
      const requests = allRequests.slice(0, 5);
      setRecentRequests(requests);
      
      // Calculate stats from all requests
      const active = allRequests.filter(r => ['Open', 'In Progress'].includes(r.status)).length;
      const completed = allRequests.filter(r => ['Delivered', 'Closed'].includes(r.status)).length;
      const pending = allRequests.filter(r => r.status === 'Pending').length;
      setStats({ active, completed, pending });
      
      // Fetch account manager
      try {
        const amRes = await axios.get(`${API}/tasks/account-manager/${user?.id}`);
        setAccountManager(amRes.data?.account_manager || null);
      } catch { /* no AM assigned */ }
    } catch (error) {
      console.error('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Open': return 'bg-blue-100 text-blue-700';
      case 'In Progress': return 'bg-amber-100 text-amber-700';
      case 'Pending': return 'bg-slate-100 text-slate-700';
      case 'Delivered': return 'bg-emerald-100 text-emerald-700';
      case 'Closed': return 'bg-slate-100 text-slate-600';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin h-8 w-8 border-4 border-[#A2182C] border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in" data-testid="client-home-page">
      {/* Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {t('clientHome.welcome', 'Welcome back')}, {user?.name?.split(' ')[0]}!
          </h1>
          <p className="text-slate-500 mt-1">
            {t('clientHome.subtitle', "Here's what's happening with your requests")}
          </p>
        </div>
        <Link to="/services">
          <Button className="bg-[#A2182C] hover:bg-[#8B1526]" data-testid="new-request-btn">
            <Plus size={18} className="mr-2" />
            {t('clientHome.newRequest', 'New Request')}
          </Button>
        </Link>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Clock size={20} className="text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{stats.active}</p>
                <p className="text-xs text-slate-500">{t('clientHome.activeRequests', 'Active')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 rounded-lg">
                <CheckCircle2 size={20} className="text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{stats.completed}</p>
                <p className="text-xs text-slate-500">{t('clientHome.completed', 'Completed')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <AlertCircle size={20} className="text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{stats.pending}</p>
                <p className="text-xs text-slate-500">{t('clientHome.needsAttention', 'Needs Attention')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Requests */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText size={18} className="text-[#A2182C]" />
              {t('clientHome.recentRequests', 'Recent Requests')}
            </CardTitle>
            <Link to="/my-requests">
              <Button variant="ghost" size="sm" className="text-[#A2182C]">
                {t('clientHome.viewAll', 'View All')}
                <ChevronRight size={16} className="ml-1" />
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {recentRequests.length === 0 ? (
            <div className="text-center py-8">
              <FileText size={40} className="mx-auto text-slate-300 mb-3" />
              <p className="text-slate-500 mb-4">{t('clientHome.noRequests', "You haven't submitted any requests yet")}</p>
              <Link to="/services">
                <Button className="bg-[#A2182C] hover:bg-[#8B1526]">
                  {t('clientHome.submitFirst', 'Submit Your First Request')}
                  <ArrowRight size={16} className="ml-2" />
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {recentRequests.map((request) => (
                <Link 
                  key={request.id}
                  to={`/requests/${request.id}`}
                  className="block"
                >
                  <div className="flex items-center justify-between p-3 rounded-lg border border-slate-100 hover:border-[#A2182C]/30 hover:bg-slate-50 transition-all group">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-slate-400">{request.order_code}</span>
                        <Badge className={getStatusColor(request.status)}>
                          {t(`requests.status.${request.status.toLowerCase().replace(' ', '')}`, request.status)}
                        </Badge>
                      </div>
                      <p className="font-medium text-slate-900 truncate mt-1 group-hover:text-[#A2182C] transition-colors">
                        {request.title}
                      </p>
                    </div>
                    <div className="text-right ml-4">
                      <p className="text-xs text-slate-400">{formatDate(request.created_at)}</p>
                      <ChevronRight size={16} className="text-slate-300 group-hover:text-[#A2182C] transition-colors ml-auto mt-1" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link to="/services" className="block">
          <Card className="hover:shadow-md hover:border-[#A2182C]/30 transition-all cursor-pointer group h-full">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="p-3 bg-[#A2182C]/10 rounded-xl group-hover:bg-[#A2182C] transition-colors">
                <Plus size={24} className="text-[#A2182C] group-hover:text-white transition-colors" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 group-hover:text-[#A2182C] transition-colors">
                  {t('clientHome.browseServices', 'Browse Services')}
                </h3>
                <p className="text-sm text-slate-500">
                  {t('clientHome.browseServicesDesc', 'See all available services')}
                </p>
              </div>
              <ArrowRight size={20} className="text-slate-300 group-hover:text-[#A2182C] ml-auto transition-colors" />
            </CardContent>
          </Card>
        </Link>
        
        <Link to="/my-account" className="block">
          <Card className="hover:shadow-md hover:border-[#A2182C]/30 transition-all cursor-pointer group h-full">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="p-3 bg-slate-100 rounded-xl group-hover:bg-[#A2182C] transition-colors">
                <FileText size={24} className="text-slate-600 group-hover:text-white transition-colors" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 group-hover:text-[#A2182C] transition-colors">
                  {t('clientHome.manageAccount', 'Manage Account')}
                </h3>
                <p className="text-sm text-slate-500">
                  {t('clientHome.manageAccountDesc', 'Profile, plan & billing')}
                </p>
              </div>
              <ArrowRight size={20} className="text-slate-300 group-hover:text-[#A2182C] ml-auto transition-colors" />
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
