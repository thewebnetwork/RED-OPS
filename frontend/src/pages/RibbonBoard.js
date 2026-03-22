import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';
import { 
  Layers,
  Search,
  Eye,
  Clock,
  CheckCircle2,
  Users,
  Briefcase,
  ArrowRight,
  Hand,
  Timer,
  Filter
} from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function RibbonBoard() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [pool1Requests, setPool1Requests] = useState([]);
  const [pool2Requests, setPool2Requests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [specialtyFilter, setSpecialtyFilter] = useState('all');
  const [specialties, setSpecialties] = useState([]);
  const [pickDialogOpen, setPickDialogOpen] = useState(false);
  const [requestToPick, setRequestToPick] = useState(null);

  const isAdmin = user?.role === 'Administrator';
  const isOperator = user?.role === 'Operator';
  const isPartner = user?.account_type === 'Partner';
  const isVendor = user?.account_type === 'Vendor/Freelancer';

  // Determine which pools user can see
  const canViewPool1 = isAdmin || isOperator || isPartner;
  const canViewPool2 = isAdmin || isOperator || isVendor;
  const canPickFromPool1 = isPartner;
  const canPickFromPool2 = isVendor;

  useEffect(() => {
    fetchPools();
    fetchSpecialties();
  }, []);

  const fetchSpecialties = async () => {
    try {
      const response = await axios.get(`${API}/specialties`);
      setSpecialties(response.data);
    } catch (error) {
      console.error('Failed to fetch specialties');
    }
  };

  const fetchPools = async () => {
    try {
      const [pool1Res, pool2Res] = await Promise.all([
        canViewPool1 ? axios.get(`${API}/orders/pool/1`) : Promise.resolve({ data: [] }),
        canViewPool2 ? axios.get(`${API}/orders/pool/2`) : Promise.resolve({ data: [] })
      ]);
      setPool1Requests(pool1Res.data);
      setPool2Requests(pool2Res.data);
    } catch (error) {
      toast.error(t('ribbon.failedToFetchPool'));
    } finally {
      setLoading(false);
    }
  };

  const handlePickRequest = async () => {
    if (!requestToPick) return;
    try {
      await axios.post(`${API}/orders/${requestToPick.id}/pick`);
      toast.success(t('ribbon.requestPickedSuccess', 'Request picked successfully'));
      setPickDialogOpen(false);
      setRequestToPick(null);
      fetchPools();
    } catch (error) {
      toast.error(error.response?.data?.detail || t('ribbon.failedToPick'));
    }
  };

  const filterRequests = (requests) => {
    return requests.filter(request => {
      const matchesSearch = 
        request.order_code?.toLowerCase().includes(search.toLowerCase()) ||
        request.title?.toLowerCase().includes(search.toLowerCase());
      const matchesSpecialty = specialtyFilter === 'all' || request.specialty_id === specialtyFilter;
      return matchesSearch && matchesSpecialty;
    });
  };

  const formatTimeInPool = (enteredAt) => {
    if (!enteredAt) return t('ribbon.justAdded');
    const diff = Date.now() - new Date(enteredAt).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}d ${hours % 24}h`;
    }
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const PoolRequestCard = ({ request, canPick, poolNumber }) => (
    <Card className="hover:shadow-md transition-shadow border-l-4 border-l-[#A2182C]" data-testid={`pool-request-${request.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-sm">{request.order_code}</span>
              <Badge variant="outline" className="text-xs">
                {request.category_name || t('ribbon.general')}
              </Badge>
              {request.specialty_name && (
                <Badge style={{ background: "#a855f718", color: "#a855f7", fontSize: 11, padding: "2px 7px", borderRadius: 4 }}>
                  <Briefcase size={10} className="mr-1" />
                  {request.specialty_name}
                </Badge>
              )}
            </div>
            <h3 className="font-medium mt-2 line-clamp-2">{request.title}</h3>
            <div className="flex items-center gap-4 mt-2 text-sm">
              <span className="flex items-center gap-1">
                <Timer size={14} />
                {t('ribbon.inPool')}: {formatTimeInPool(request.pool_entered_at)}
              </span>
              <span>{t('ribbon.priority')}: {request.priority || t('ribbon.normal')}</span>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Link to={`/requests/${request.id}`}>
              <Button variant="outline" size="sm">
                <Eye size={14} className="mr-1" />
                {t('common.view')}
              </Button>
            </Link>
            {canPick && (
              <Button 
                size="sm" 
                className="bg-red-700 hover:bg-red-800"
                onClick={() => {
                  setRequestToPick(request);
                  setPickDialogOpen(true);
                }}
                data-testid={`pick-request-${request.id}`}
              >
                <Hand size={14} className="mr-1" />
                {t('ribbon.pick')}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#A2182C]"></div>
      </div>
    );
  }

  // Determine default tab based on user role
  const defaultTab = canViewPool1 ? 'pool1' : 'pool2';

  return (
    <div className="space-y-6 animate-fade-in" data-testid="ribbon-board-page">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Layers className="text-[#A2182C]" />
          {t('ribbon.title')}
        </h1>
        <p className="mt-1">
          {isPartner && t('ribbon.partnerDescription')}
          {isVendor && t('ribbon.vendorDescription')}
          {(isAdmin || isOperator) && t('ribbon.adminDescription')}
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2" size={18} />
          <Input
            placeholder={t('ribbon.searchRequests', 'Search requests...')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
            data-testid="pool-search"
          />
        </div>
        <Select value={specialtyFilter} onValueChange={setSpecialtyFilter}>
          <SelectTrigger className="w-[200px]" data-testid="specialty-filter">
            <Filter size={16} className="mr-2" />
            <SelectValue placeholder={t('ribbon.filterBySpecialty')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('ribbon.allSpecialties')}</SelectItem>
            {specialties.map(s => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Pool Tabs */}
      <Tabs defaultValue={defaultTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          {canViewPool1 && (
            <TabsTrigger value="pool1" className="flex items-center gap-2" data-testid="pool1-tab">
              <Users size={16} />
              {t('ribbon.pool1Partners')}
              <Badge variant="secondary" className="ml-1">{pool1Requests.length}</Badge>
            </TabsTrigger>
          )}
          {canViewPool2 && (
            <TabsTrigger value="pool2" className="flex items-center gap-2" data-testid="pool2-tab">
              <Briefcase size={16} />
              {t('ribbon.pool2Vendors')}
              <Badge variant="secondary" className="ml-1">{pool2Requests.length}</Badge>
            </TabsTrigger>
          )}
        </TabsList>

        {/* Pool 1 - Partners */}
        {canViewPool1 && (
          <TabsContent value="pool1" className="mt-6">
            <Card className="mb-4" style={{ background: "#a855f715", border: "1px solid #a855f730" }}>
              <CardContent className="py-3 px-4">
                <div className="flex items-center gap-2">
                  <Users size={18} />
                  <span className="font-medium">{t('ribbon.partnerPool')}</span>
                  <span className="text-sm ">
                    {t('ribbon.partnerPoolDescription')}
                  </span>
                </div>
              </CardContent>
            </Card>

            {filterRequests(pool1Requests).length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Layers size={48} className="mx-auto mb-4 text-slate-300" />
                  <p style={{ color: "var(--tx-3)" }}>{t('ribbon.noRequestsPool1', 'No requests in Pool 1')}</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {filterRequests(pool1Requests).map(request => (
                  <PoolRequestCard 
                    key={request.id} 
                    request={request} 
                    canPick={canPickFromPool1}
                    poolNumber={1}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        )}

        {/* Pool 2 - Vendors */}
        {canViewPool2 && (
          <TabsContent value="pool2" className="mt-6">
            <Card className="mb-4" style={{ background: "#22c55e12", border: "1px solid #22c55e25" }}>
              <CardContent className="py-3 px-4">
                <div className="flex items-center gap-2">
                  <Briefcase size={18} />
                  <span className="font-medium">{t('ribbon.vendorPool')}</span>
                  <span className="text-sm ">
                    {t('ribbon.vendorPoolDescription')}
                  </span>
                </div>
              </CardContent>
            </Card>

            {filterRequests(pool2Requests).length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Layers size={48} className="mx-auto mb-4 text-slate-300" />
                  <p style={{ color: "var(--tx-3)" }}>{t('ribbon.noRequestsPool2', 'No requests in Pool 2')}</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {filterRequests(pool2Requests).map(request => (
                  <PoolRequestCard 
                    key={request.id} 
                    request={request} 
                    canPick={canPickFromPool2}
                    poolNumber={2}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        )}
      </Tabs>

      {/* Pick Confirmation Dialog */}
      <AlertDialog open={pickDialogOpen} onOpenChange={setPickDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('ribbon.pickThisRequest', 'Pick this request?')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('ribbon.pickConfirmation', { code: requestToPick?.order_code, title: requestToPick?.title })}
              <br /><br />
              {t('ribbon.pickResponsibility', 'You will be responsible for completing this request.')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handlePickRequest}
              className="bg-red-700 hover:bg-red-800"
            >
              <Hand size={16} className="mr-2" />
              {t('ribbon.confirmPick')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
