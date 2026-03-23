import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
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
      toast.error("Failed To Fetch Pool");
    } finally {
      setLoading(false);
    }
  };

  const handlePickRequest = async () => {
    if (!requestToPick) return;
    try {
      await axios.post(`${API}/orders/${requestToPick.id}/pick`);
      toast.success('Request picked successfully');
      setPickDialogOpen(false);
      setRequestToPick(null);
      fetchPools();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed To Pick");
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
    if (!enteredAt) return "Just Added";
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
                {request.category_name || "General"}
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
                {"In Pool"}: {formatTimeInPool(request.pool_entered_at)}
              </span>
              <span>{"Priority"}: {request.priority || "Normal"}</span>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Link to={`/requests/${request.id}`}>
              <Button variant="outline" size="sm">
                <Eye size={14} className="mr-1" />
                {"View"}
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
                {"Pick"}
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
          {"Title"}
        </h1>
        <p className="mt-1">
          {isPartner && "Partner Description"}
          {isVendor && "Vendor Description"}
          {(isAdmin || isOperator) && "Admin Description"}
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2" size={18} />
          <Input
            placeholder={'Search requests...'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
            data-testid="pool-search"
          />
        </div>
        <Select value={specialtyFilter} onValueChange={setSpecialtyFilter}>
          <SelectTrigger className="w-[200px]" data-testid="specialty-filter">
            <Filter size={16} className="mr-2" />
            <SelectValue placeholder={"Filter By Specialty"} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{"All Specialties"}</SelectItem>
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
              {"Pool1 Partners"}
              <Badge variant="secondary" className="ml-1">{pool1Requests.length}</Badge>
            </TabsTrigger>
          )}
          {canViewPool2 && (
            <TabsTrigger value="pool2" className="flex items-center gap-2" data-testid="pool2-tab">
              <Briefcase size={16} />
              {"Pool2 Vendors"}
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
                  <span className="font-medium">{"Partner Pool"}</span>
                  <span className="text-sm ">
                    {"Partner Pool Description"}
                  </span>
                </div>
              </CardContent>
            </Card>

            {filterRequests(pool1Requests).length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Layers size={48} className="mx-auto mb-4 text-slate-300" />
                  <p style={{ color: "var(--tx-3)" }}>{'No requests in Pool 1'}</p>
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
                  <span className="font-medium">{"Vendor Pool"}</span>
                  <span className="text-sm ">
                    {"Vendor Pool Description"}
                  </span>
                </div>
              </CardContent>
            </Card>

            {filterRequests(pool2Requests).length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Layers size={48} className="mx-auto mb-4 text-slate-300" />
                  <p style={{ color: "var(--tx-3)" }}>{'No requests in Pool 2'}</p>
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
            <AlertDialogTitle>{'Pick this request?'}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('ribbon.pickConfirmation', { code: requestToPick?.order_code, title: requestToPick?.title })}
              <br /><br />
              {'You will be responsible for completing this request.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{"Cancel"}</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handlePickRequest}
              className="bg-red-700 hover:bg-red-800"
            >
              <Hand size={16} className="mr-2" />
              {"Confirm Pick"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
