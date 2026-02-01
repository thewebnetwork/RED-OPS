import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { 
  Clock, 
  Plus, 
  Edit2, 
  Trash2,
  AlertTriangle,
  CheckCircle,
  Users,
  Shield,
  Bell,
  RefreshCw,
  CheckCheck,
  XCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function SLA() {
  const [slaDefinitions, setSlaDefinitions] = useState([]);
  const [slaAlerts, setSlaAlerts] = useState([]);
  const [slaStats, setSlaStats] = useState(null);
  const [roles, setRoles] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('definitions');
  
  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSla, setEditingSla] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    response_time_hours: 4,
    resolution_time_hours: 24,
    priority: 'Normal',
    applies_to_type: 'role', // 'role' or 'team'
    applies_to_id: ''
  });
  
  // Unsaved changes tracking
  const [hasFormChanges, setHasFormChanges] = useState(false);
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);
  const initialFormRef = useRef(null);

  useEffect(() => {
    fetchData();
  }, []);

  // Track form changes
  useEffect(() => {
    if (initialFormRef.current && dialogOpen) {
      const changed = JSON.stringify(formData) !== JSON.stringify(initialFormRef.current);
      setHasFormChanges(changed);
    }
  }, [formData, dialogOpen]);

  // Browser beforeunload warning
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasFormChanges && dialogOpen) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes.';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasFormChanges, dialogOpen]);

  const handleDialogClose = (open) => {
    if (!open) {
      // Check for changes directly
      const hasChanges = initialFormRef.current && 
        JSON.stringify(formData) !== JSON.stringify(initialFormRef.current);
      if (hasChanges) {
        setShowUnsavedWarning(true);
        return;
      }
    }
    setDialogOpen(open);
    if (!open) resetForm();
  };

  const confirmCloseDialog = () => {
    setShowUnsavedWarning(false);
    setDialogOpen(false);
    resetForm();
  };

  const fetchData = async () => {
    try {
      const [slaRes, rolesRes, teamsRes, alertsRes, statsRes] = await Promise.all([
        axios.get(`${API}/sla`).catch(() => ({ data: [] })),
        axios.get(`${API}/roles`),
        axios.get(`${API}/teams`),
        axios.get(`${API}/sla-alerts`).catch(() => ({ data: [] })),
        axios.get(`${API}/sla-alerts/statistics`).catch(() => ({ data: null }))
      ]);
      
      setSlaDefinitions(slaRes.data || []);
      setRoles(rolesRes.data || []);
      setTeams(teamsRes.data || []);
      setSlaAlerts(alertsRes.data || []);
      setSlaStats(statsRes.data);
    } catch (error) {
      console.error('Failed to fetch data');
      setSlaDefinitions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAcknowledgeAlert = async (alertId) => {
    try {
      await axios.post(`${API}/sla-alerts/${alertId}/acknowledge`);
      setSlaAlerts(prev => prev.map(a => 
        a.id === alertId ? { ...a, acknowledged: true } : a
      ));
      toast.success('Alert acknowledged');
    } catch (error) {
      toast.error('Failed to acknowledge alert');
    }
  };

  const handleRefreshAlerts = async () => {
    try {
      const [alertsRes, statsRes] = await Promise.all([
        axios.get(`${API}/sla-alerts`),
        axios.get(`${API}/sla-alerts/statistics`)
      ]);
      setSlaAlerts(alertsRes.data || []);
      setSlaStats(statsRes.data);
      toast.success('Alerts refreshed');
    } catch (error) {
      toast.error('Failed to refresh alerts');
    }
  };

  const handleTriggerSlaCheck = async () => {
    try {
      const res = await axios.post(`${API}/sla-check`);
      toast.success(`SLA check complete: ${res.data.breached} breaches, ${res.data.warnings} warnings`);
      handleRefreshAlerts();
    } catch (error) {
      toast.error('Failed to trigger SLA check');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      response_time_hours: 4,
      resolution_time_hours: 24,
      priority: 'Normal',
      applies_to_type: 'role',
      applies_to_id: ''
    });
    setEditingSla(null);
    initialFormRef.current = null;
    setHasFormChanges(false);
  };

  const handleOpenDialog = (sla = null) => {
    let initialData;
    if (sla) {
      setEditingSla(sla);
      initialData = {
        name: sla.name,
        description: sla.description || '',
        response_time_hours: sla.response_time_hours,
        resolution_time_hours: sla.resolution_time_hours,
        priority: sla.priority,
        applies_to_type: sla.applies_to_type,
        applies_to_id: sla.applies_to_id
      };
      setFormData(initialData);
    } else {
      initialData = {
        name: '',
        description: '',
        response_time_hours: 4,
        resolution_time_hours: 24,
        priority: 'Normal',
        applies_to_type: 'role',
        applies_to_id: ''
      };
      setEditingSla(null);
      setFormData(initialData);
    }
    initialFormRef.current = initialData;
    setHasFormChanges(false);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.applies_to_id) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      const appliesTo = formData.applies_to_type === 'role' 
        ? roles.find(r => r.id === formData.applies_to_id)
        : teams.find(t => t.id === formData.applies_to_id);

      if (editingSla) {
        // Update existing
        setSlaDefinitions(prev => prev.map(sla => 
          sla.id === editingSla.id 
            ? { 
                ...sla, 
                ...formData, 
                applies_to_name: appliesTo?.name || 'Unknown',
                updated_at: new Date().toISOString() 
              } 
            : sla
        ));
        toast.success('SLA updated');
      } else {
        // Create new
        const newSla = {
          id: `sla-${Date.now()}`,
          ...formData,
          applies_to_name: appliesTo?.name || 'Unknown',
          is_active: true,
          created_at: new Date().toISOString()
        };
        setSlaDefinitions(prev => [newSla, ...prev]);
        toast.success('SLA created');
      }
      
      setHasFormChanges(false);
      initialFormRef.current = null;
      setDialogOpen(false);
      resetForm();
    } catch (error) {
      toast.error('Failed to save SLA');
    }
  };

  const handleDelete = async (slaId) => {
    if (!window.confirm('Are you sure you want to delete this SLA?')) return;
    
    try {
      setSlaDefinitions(prev => prev.filter(sla => sla.id !== slaId));
      toast.success('SLA deleted');
    } catch (error) {
      toast.error('Failed to delete SLA');
    }
  };

  const handleToggleActive = async (slaId) => {
    setSlaDefinitions(prev => prev.map(sla => 
      sla.id === slaId ? { ...sla, is_active: !sla.is_active } : sla
    ));
    toast.success('SLA status updated');
  };

  const formatHours = (hours) => {
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
  };

  const priorityColors = {
    'Urgent': 'bg-red-100 text-red-700',
    'High': 'bg-orange-100 text-orange-700',
    'Normal': 'bg-blue-100 text-blue-700',
    'Low': 'bg-slate-100 text-slate-600'
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-rose-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in" data-testid="sla-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">SLA Management</h1>
          <p className="text-slate-500 mt-1">Define, monitor, and manage Service Level Agreements</p>
        </div>
      </div>

      {/* Stats Cards */}
      {slaStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">On Track</p>
                  <p className="text-2xl font-bold text-green-600">{slaStats.orders?.on_track || 0}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">At Risk</p>
                  <p className="text-2xl font-bold text-amber-600">{slaStats.orders?.at_risk || 0}</p>
                </div>
                <Clock className="h-8 w-8 text-amber-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Breached</p>
                  <p className="text-2xl font-bold text-red-600">{slaStats.orders?.breached || 0}</p>
                </div>
                <XCircle className="h-8 w-8 text-red-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Unacknowledged Alerts</p>
                  <p className="text-2xl font-bold text-slate-700">{slaStats.alerts?.unacknowledged || 0}</p>
                </div>
                <Bell className="h-8 w-8 text-slate-400" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="definitions">SLA Definitions</TabsTrigger>
          <TabsTrigger value="alerts">
            Alerts
            {slaAlerts.filter(a => !a.acknowledged).length > 0 && (
              <Badge className="ml-2 bg-red-500 text-white">{slaAlerts.filter(a => !a.acknowledged).length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="definitions" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={dialogOpen} onOpenChange={handleDialogClose}>
              <DialogTrigger asChild>
                <Button className="bg-rose-600 hover:bg-rose-700" onClick={() => handleOpenDialog()} data-testid="create-sla-btn">
                  <Plus size={16} className="mr-2" />
                  Create SLA
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>{editingSla ? 'Edit SLA' : 'Create SLA'}</DialogTitle>
                  <DialogDescription>
                    Define response and resolution time targets
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div>
                    <Label>SLA Name *</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="e.g., Premium Support SLA"
                      className="mt-1.5"
                  data-testid="sla-name-input"
                />
              </div>

              <div>
                <Label>Description</Label>
                <Input
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Brief description of this SLA"
                  className="mt-1.5"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Response Time (hours) *</Label>
                  <Input
                    type="number"
                    min="1"
                    value={formData.response_time_hours}
                    onChange={(e) => setFormData(prev => ({ ...prev, response_time_hours: parseInt(e.target.value) || 1 }))}
                    className="mt-1.5"
                    data-testid="response-time-input"
                  />
                  <p className="text-xs text-slate-500 mt-1">First response target</p>
                </div>
                <div>
                  <Label>Resolution Time (hours) *</Label>
                  <Input
                    type="number"
                    min="1"
                    value={formData.resolution_time_hours}
                    onChange={(e) => setFormData(prev => ({ ...prev, resolution_time_hours: parseInt(e.target.value) || 1 }))}
                    className="mt-1.5"
                    data-testid="resolution-time-input"
                  />
                  <p className="text-xs text-slate-500 mt-1">Full resolution target</p>
                </div>
              </div>

              <div>
                <Label>Priority Level</Label>
                <Select 
                  value={formData.priority} 
                  onValueChange={(val) => setFormData(prev => ({ ...prev, priority: val }))}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Urgent">Urgent</SelectItem>
                    <SelectItem value="High">High</SelectItem>
                    <SelectItem value="Normal">Normal</SelectItem>
                    <SelectItem value="Low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Applies To *</Label>
                <div className="grid grid-cols-2 gap-4 mt-1.5">
                  <Select 
                    value={formData.applies_to_type} 
                    onValueChange={(val) => setFormData(prev => ({ ...prev, applies_to_type: val, applies_to_id: '' }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="role">
                        <div className="flex items-center gap-2">
                          <Shield size={14} />
                          Role
                        </div>
                      </SelectItem>
                      <SelectItem value="team">
                        <div className="flex items-center gap-2">
                          <Users size={14} />
                          Team
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>

                  <Select 
                    value={formData.applies_to_id} 
                    onValueChange={(val) => setFormData(prev => ({ ...prev, applies_to_id: val }))}
                  >
                    <SelectTrigger data-testid="applies-to-select">
                      <SelectValue placeholder={`Select ${formData.applies_to_type}`} />
                    </SelectTrigger>
                    <SelectContent>
                      {formData.applies_to_type === 'role' ? (
                        roles.map(role => (
                          <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>
                        ))
                      ) : (
                        teams.map(team => (
                          <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={() => handleDialogClose(false)} className="flex-1">
                  Cancel
                </Button>
                <Button 
                  onClick={handleSave}
                  className="flex-1 bg-rose-600 hover:bg-rose-700"
                  disabled={!formData.name || !formData.applies_to_id}
                  data-testid="save-sla-btn"
                >
                  {editingSla ? 'Update SLA' : 'Create SLA'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* SLA Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {slaDefinitions.length === 0 ? (
          <Card className="col-span-full border-slate-200">
            <CardContent className="p-12 text-center text-slate-500">
              <Clock size={48} className="mx-auto text-slate-300 mb-3" />
              <p>No SLAs defined yet</p>
              <p className="text-sm mt-1">Create your first SLA to define response time targets</p>
            </CardContent>
          </Card>
        ) : (
          slaDefinitions.map(sla => (
            <Card 
              key={sla.id} 
              className={`border-slate-200 ${!sla.is_active ? 'opacity-60' : ''}`}
              data-testid={`sla-card-${sla.id}`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{sla.name}</CardTitle>
                    {sla.description && (
                      <p className="text-sm text-slate-500 mt-1">{sla.description}</p>
                    )}
                  </div>
                  <Badge className={sla.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}>
                    {sla.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Time Targets */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <p className="text-xs text-slate-500 mb-1">Response Time</p>
                    <p className="text-xl font-bold text-slate-900">{formatHours(sla.response_time_hours)}</p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <p className="text-xs text-slate-500 mb-1">Resolution Time</p>
                    <p className="text-xl font-bold text-slate-900">{formatHours(sla.resolution_time_hours)}</p>
                  </div>
                </div>

                {/* Priority & Assignment */}
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className={priorityColors[sla.priority]}>{sla.priority}</Badge>
                  <Badge className="bg-slate-100 text-slate-600">
                    {sla.applies_to_type === 'role' ? <Shield size={12} className="mr-1" /> : <Users size={12} className="mr-1" />}
                    {sla.applies_to_name}
                  </Badge>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <span className="text-xs text-slate-400">
                    Created {format(new Date(sla.created_at), 'MMM d, yyyy')}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => handleToggleActive(sla.id)}
                      className={sla.is_active ? 'text-amber-500 hover:text-amber-700' : 'text-green-500 hover:text-green-700'}
                    >
                      {sla.is_active ? <AlertTriangle size={16} /> : <CheckCircle size={16} />}
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => handleOpenDialog(sla)}
                    >
                      <Edit2 size={16} />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      onClick={() => handleDelete(sla.id)}
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">SLA Alerts</CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleRefreshAlerts}>
                  <RefreshCw size={16} className="mr-2" />
                  Refresh
                </Button>
                <Button variant="outline" size="sm" onClick={handleTriggerSlaCheck}>
                  <Clock size={16} className="mr-2" />
                  Check Now
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {slaAlerts.length === 0 ? (
                <div className="p-12 text-center text-slate-500">
                  <Bell size={48} className="mx-auto text-slate-300 mb-3" />
                  <p>No SLA alerts</p>
                  <p className="text-sm mt-1">All orders are within SLA targets</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {slaAlerts.map(alert => (
                    <div 
                      key={alert.id} 
                      className={`p-4 rounded-lg border ${
                        alert.alert_type === 'breach' 
                          ? 'bg-red-50 border-red-200' 
                          : 'bg-amber-50 border-amber-200'
                      } ${alert.acknowledged ? 'opacity-60' : ''}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          {alert.alert_type === 'breach' ? (
                            <XCircle className="h-5 w-5 text-red-500 mt-0.5" />
                          ) : (
                            <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5" />
                          )}
                          <div>
                            <p className="font-medium text-slate-900">
                              {alert.alert_type === 'breach' ? 'SLA Breached' : 'SLA Warning'} - {alert.order_code}
                            </p>
                            <p className="text-sm text-slate-600 mt-1">
                              Deadline: {format(new Date(alert.sla_deadline), 'MMM d, yyyy h:mm a')}
                            </p>
                            <p className="text-xs text-slate-500 mt-1">
                              Triggered: {format(new Date(alert.triggered_at), 'MMM d, yyyy h:mm a')}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {alert.acknowledged ? (
                            <Badge className="bg-slate-100 text-slate-600">
                              <CheckCheck size={12} className="mr-1" />
                              Acknowledged
                            </Badge>
                          ) : (
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => handleAcknowledgeAlert(alert.id)}
                            >
                              Acknowledge
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Unsaved Changes Warning Dialog */}
      <AlertDialog open={showUnsavedWarning} onOpenChange={setShowUnsavedWarning}>
        <AlertDialogContent data-testid="unsaved-changes-dialog" className="z-[100]">
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. Save before leaving?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowUnsavedWarning(false)} data-testid="stay-btn">
              Stay
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmCloseDialog}
              className="bg-slate-600 hover:bg-slate-700"
              data-testid="leave-btn"
            >
              Leave without saving
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
