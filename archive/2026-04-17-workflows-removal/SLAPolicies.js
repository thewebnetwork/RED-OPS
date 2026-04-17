import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { 
  Plus, Shield, Clock, AlertTriangle, Bell, Users, 
  ChevronDown, ChevronRight, Trash2, Edit, Check, X,
  Play, History, Eye, RefreshCw, Target, Layers, FileCode
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Switch } from '../components/ui/switch';
import { Checkbox } from '../components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../components/ui/sheet';
import { Separator } from '../components/ui/separator';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function SLAPolicies() {
const [searchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") || 'policies';
  const [activeTab, setActiveTab] = useState(initialTab);
  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Monitoring data
  const [monitoringStats, setMonitoringStats] = useState(null);
  const [atRiskOrders, setAtRiskOrders] = useState([]);
  const [breachedOrders, setBreachedOrders] = useState([]);
  const [escalationHistory, setEscalationHistory] = useState([]);
  
  // Reference data
  const [roles, setRoles] = useState([]);
  const [teams, setTeams] = useState([]);
  const [specialties, setSpecialties] = useState([]);
  const [accessTiers, setAccessTiers] = useState([]);
  
  // Dialog states
  const [showPolicyDialog, setShowPolicyDialog] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState(null);
  const [showHistorySheet, setShowHistorySheet] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);

  const fetchPolicies = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/sla-policies`);
      setPolicies(res.data);
    } catch (error) {
      console.error('Failed to fetch policies');
    }
  }, []);

  const fetchMonitoringData = useCallback(async () => {
    try {
      const [statsRes, atRiskRes, breachedRes, historyRes] = await Promise.all([
        axios.get(`${API}/sla-policies/monitoring/stats`),
        axios.get(`${API}/sla-policies/monitoring/at-risk`),
        axios.get(`${API}/sla-policies/monitoring/breached`),
        axios.get(`${API}/sla-policies/monitoring/history?limit=50`)
      ]);
      setMonitoringStats(statsRes.data);
      setAtRiskOrders(atRiskRes.data);
      setBreachedOrders(breachedRes.data);
      setEscalationHistory(historyRes.data);
    } catch (error) {
      console.error('Failed to fetch monitoring data');
    }
  }, []);

  const fetchReferenceData = useCallback(async () => {
    try {
      const [rolesRes, teamsRes, specialtiesRes, tiersRes] = await Promise.all([
        axios.get(`${API}/roles`),
        axios.get(`${API}/teams`),
        axios.get(`${API}/specialties`),
        axios.get(`${API}/access-tiers`)
      ]);
      setRoles(rolesRes.data);
      setTeams(teamsRes.data);
      setSpecialties(specialtiesRes.data);
      setAccessTiers(tiersRes.data);
    } catch (error) {
      console.error('Failed to fetch reference data');
    }
  }, []);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchPolicies(), fetchMonitoringData(), fetchReferenceData()]);
      setLoading(false);
    };
    loadData();
  }, [fetchPolicies, fetchMonitoringData, fetchReferenceData]);

  const handleDeletePolicy = async (policyId) => {
    toast('Delete this SLA policy? This cannot be undone.', {
      action: {
        label: 'Delete',
        onClick: async () => {
          try {
            await axios.delete(`${API}/sla-policies/${policyId}`);
            toast.success('Policy deleted');
            fetchPolicies();
          } catch (error) {
            toast.error('Failed to delete policy');
          }
        },
      },
      cancel: { label: 'Cancel' },
    });
  };

  const handleAcknowledge = async (escalationId) => {
    try {
      await axios.post(`${API}/sla-policies/monitoring/history/${escalationId}/acknowledge`);
      toast.success('Escalation acknowledged');
      fetchMonitoringData();
    } catch (error) {
      toast.error('Failed to acknowledge');
    }
  };

  const handleTriggerCheck = async () => {
    try {
      const res = await axios.post(`${API}/sla-policies/check`);
      toast.success(`Policy check completed: ${res.data.escalations_created || 0} escalations`);
      fetchMonitoringData();
    } catch (error) {
      toast.error('Failed to trigger check');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="sla-policies-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">SLA & Escalation Policies</h1>
          <p className="text-sm mt-1">
            Configure SLA rules and escalation actions in one place
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleTriggerCheck}>
            <Play className="w-4 h-4 mr-2" />
            Run Check
          </Button>
          <Button onClick={() => { setEditingPolicy(null); setShowPolicyDialog(true); }}>
            <Plus className="w-4 h-4 mr-2" />
            New Policy
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {monitoringStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg">
                  <Check className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{monitoringStats.orders?.on_track || 0}</p>
                  <p className="text-xs">On Track</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg">
                  <Clock className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{monitoringStats.orders?.at_risk || 0}</p>
                  <p className="text-xs">At Risk</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{monitoringStats.orders?.breached || 0}</p>
                  <p className="text-xs">Breached</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg">
                  <Bell className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{monitoringStats.escalations?.unacknowledged || 0}</p>
                  <p className="text-xs">Unacknowledged</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="policies" data-testid="policies-tab">
            <Shield className="w-4 h-4 mr-2" />
            Policies ({policies.length})
          </TabsTrigger>
          <TabsTrigger value="templates" data-testid="templates-tab">
            <FileCode className="w-4 h-4 mr-2" />
            Templates
          </TabsTrigger>
          <TabsTrigger value="monitoring" data-testid="monitoring-tab">
            <Eye className="w-4 h-4 mr-2" />
            Monitoring
          </TabsTrigger>
          <TabsTrigger value="history" data-testid="history-tab">
            <History className="w-4 h-4 mr-2" />
            Escalation History
          </TabsTrigger>
        </TabsList>

        {/* Policies Tab */}
        <TabsContent value="policies" className="mt-4">
          <div className="grid gap-4">
            {policies.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Shield className="w-12 h-12 mx-auto text-[var(--tx-3)] mb-4" />
                  <p className="">No policies created yet</p>
                  <Button 
                    variant="outline" 
                    className="mt-4"
                    onClick={() => { setEditingPolicy(null); setShowPolicyDialog(true); }}
                  >
                    Create your first policy
                  </Button>
                </CardContent>
              </Card>
            ) : (
              policies.map((policy) => (
                <PolicyCard 
                  key={policy.id} 
                  policy={policy}
                  onEdit={() => { setEditingPolicy(policy); setShowPolicyDialog(true); }}
                  onDelete={() => handleDeletePolicy(policy.id)}
                />
              ))
            )}
          </div>
        </TabsContent>

        {/* Templates Tab */}
        <TabsContent value="templates" className="mt-4">
          <PolicyTemplates
            roles={roles}
            teams={teams}
            specialties={specialties}
            accessTiers={accessTiers}
            onApplyTemplate={(template) => {
              setEditingPolicy(null);
              setShowPolicyDialog(true);
              // Small delay to ensure dialog is open before setting form data
              setTimeout(() => {
                document.dispatchEvent(new CustomEvent('apply-template', { detail: template }));
              }, 100);
            }}
          />
        </TabsContent>

        {/* Monitoring Tab */}
        <TabsContent value="monitoring" className="mt-4">
          <div className="grid md:grid-cols-2 gap-6">
            {/* At Risk Orders */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Clock className="w-5 h-5 text-amber-500" />
                  At Risk ({atRiskOrders.length})
                </CardTitle>
                <CardDescription>Orders approaching SLA deadline</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {atRiskOrders.length === 0 ? (
                    <p className="text-sm text-center py-4">No at-risk orders</p>
                  ) : (
                    atRiskOrders.map((order) => (
                      <OrderCard key={order.id} order={order} status="at_risk" />
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Breached Orders */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                  Breached ({breachedOrders.length})
                </CardTitle>
                <CardDescription>Orders that have exceeded SLA</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {breachedOrders.length === 0 ? (
                    <p className="text-sm text-center py-4">No breached orders</p>
                  ) : (
                    breachedOrders.map((order) => (
                      <OrderCard key={order.id} order={order} status="breached" />
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Escalation History</CardTitle>
              <CardDescription>Log of all escalation actions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {escalationHistory.length === 0 ? (
                  <p className="text-sm text-center py-8">No escalation history</p>
                ) : (
                  escalationHistory.map((entry) => (
                    <div 
                      key={entry.id} 
                      className={`p-3 rounded-lg border ${entry.acknowledged ? '' : ''}`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <Badge variant={entry.trigger_type === 'breach' ? 'destructive' : 'secondary'}>
                              {entry.trigger_type}
                            </Badge>
                            <span className="font-medium text-sm">{entry.order_code}</span>
                            <span className="">•</span>
                            <span className="text-sm">Level {entry.level}</span>
                          </div>
                          <p className="text-xs mt-1">
                            Policy: {entry.policy_name} • {entry.level_name}
                          </p>
                          <p className="text-xs mt-1">
                            {new Date(entry.created_at).toLocaleString()}
                          </p>
                        </div>
                        {!entry.acknowledged && (
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleAcknowledge(entry.id)}
                          >
                            <Check className="w-3 h-3 mr-1" />
                            Acknowledge
                          </Button>
                        )}
                        {entry.acknowledged && (
                          <Badge variant="outline" className="text-green-600">
                            Acknowledged
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Policy Dialog */}
      <PolicyDialog
        open={showPolicyDialog}
        onOpenChange={setShowPolicyDialog}
        policy={editingPolicy}
        roles={roles}
        teams={teams}
        specialties={specialties}
        accessTiers={accessTiers}
        onSave={() => { fetchPolicies(); setShowPolicyDialog(false); }}
      />
    </div>
  );
}

// Policy Card Component
function PolicyCard({ policy, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  
  const scopeLabels = [];
  if (policy.scope?.role_names?.length > 0) {
    scopeLabels.push(`Roles: ${policy.scope.role_names.join(', ')}`);
  }
  if (policy.scope?.team_names?.length > 0) {
    scopeLabels.push(`Teams: ${policy.scope.team_names.join(', ')}`);
  }
  if (policy.scope?.specialty_names?.length > 0) {
    scopeLabels.push(`Specialties: ${policy.scope.specialty_names.join(', ')}`);
  }
  if (policy.scope?.access_tier_names?.length > 0) {
    scopeLabels.push(`Access Tiers: ${policy.scope.access_tier_names.join(', ')}`);
  }
  
  return (
    <Card className={!policy.is_active ? 'opacity-60' : ''}>
      <CardContent className="pt-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-lg">{policy.name}</h3>
              {!policy.is_active && <Badge variant="secondary">Inactive</Badge>}
              {policy.orders_count > 0 && (
                <Badge variant="outline">{policy.orders_count} orders</Badge>
              )}
            </div>
            {policy.description && (
              <p className="text-sm mt-1">{policy.description}</p>
            )}
            
            {/* SLA Info */}
            <div className="flex items-center gap-4 mt-3 text-sm">
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                <span>
                  {policy.sla_rules?.duration_minutes >= 60 
                    ? `${Math.floor(policy.sla_rules.duration_minutes / 60)}h ${policy.sla_rules.duration_minutes % 60}m`
                    : `${policy.sla_rules?.duration_minutes}m`
                  } SLA
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Layers className="w-4 h-4" />
                <span>{policy.escalation_levels?.length || 0} levels</span>
              </div>
            </div>
            
            {/* Scope */}
            {scopeLabels.length > 0 && (
              <div className="mt-2">
                <p className="text-xs">{scopeLabels.join(' • ')}</p>
              </div>
            )}
            
            {/* Expandable Escalation Levels */}
            {policy.escalation_levels?.length > 0 && (
              <div className="mt-3">
                <button 
                  className="flex items-center gap-1 text-sm hover:text-slate-900"
                  onClick={() => setExpanded(!expanded)}
                >
                  {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  {expanded ? 'Hide' : 'Show'} escalation levels
                </button>
                {expanded && (
                  <div className="mt-2 pl-4 border-l-2 space-y-2">
                    {policy.escalation_levels.map((level, idx) => (
                      <div key={idx} className="text-sm">
                        <span className="font-medium">Level {level.level}: {level.name}</span>
                        <span className="ml-2">
                          {level.trigger === 'at_risk' && '• On At Risk'}
                          {level.trigger === 'breach' && '• On Breach'}
                          {level.trigger === 'breach_plus_minutes' && `• ${level.delay_minutes}m after Breach`}
                        </span>
                        <p className="text-xs mt-1">
                          {level.actions?.length || 0} action(s)
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={onEdit}>
              <Edit className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onDelete}>
              <Trash2 className="w-4 h-4 text-red-500" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Order Card Component for Monitoring
function OrderCard({ order, status }) {
  const statusColors = {
    at_risk: '',
    breached: 'bg-red-100 text-red-700 border-red-200'
  };
  
  return (
    <div className={`p-3 rounded-lg border ${statusColors[status]}`}>
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">{order.order_code}</span>
            <Badge variant="outline" className="text-xs">{order.priority}</Badge>
          </div>
          <p className="text-sm truncate max-w-xs mt-1">{order.title}</p>
          {order.policy_name && (
            <p className="text-xs mt-1">Policy: {order.policy_name}</p>
          )}
        </div>
        <div className="text-right">
          <p className="text-sm font-medium">{order.time_remaining || 'N/A'}</p>
          <p className="text-xs">
            {order.current_escalation_level > 0 && `Level ${order.current_escalation_level}`}
          </p>
        </div>
      </div>
    </div>
  );
}

// Policy Dialog Component
function PolicyDialog({ open, onOpenChange, policy, roles, teams, specialties, accessTiers, onSave }) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    scope: { role_ids: [], team_ids: [], specialty_ids: [], access_tier_ids: [] },
    sla_rules: { duration_minutes: 1440, business_hours_only: false },
    thresholds: { at_risk_minutes: 240 },
    escalation_levels: [],
    is_active: true
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (policy) {
      setFormData({
        name: policy.name || '',
        description: policy.description || '',
        scope: policy.scope || { role_ids: [], team_ids: [], specialty_ids: [], access_tier_ids: [] },
        sla_rules: policy.sla_rules || { duration_minutes: 1440, business_hours_only: false },
        thresholds: policy.thresholds || { at_risk_minutes: 240 },
        escalation_levels: policy.escalation_levels || [],
        is_active: policy.is_active !== false
      });
    } else {
      setFormData({
        name: '',
        description: '',
        scope: { role_ids: [], team_ids: [], specialty_ids: [], access_tier_ids: [] },
        sla_rules: { duration_minutes: 1440, business_hours_only: false },
        thresholds: { at_risk_minutes: 240 },
        escalation_levels: [],
        is_active: true
      });
    }
  }, [policy, open]);

  // Listen for template application
  useEffect(() => {
    const handleApplyTemplate = (e) => {
      if (e.detail && open) {
        setFormData({
          ...e.detail,
          scope: e.detail.scope || { role_ids: [], team_ids: [], specialty_ids: [], access_tier_ids: [] }
        });
        toast.success('Template applied! Customize and save your policy.');
      }
    };
    
    document.addEventListener('apply-template', handleApplyTemplate);
    return () => document.removeEventListener('apply-template', handleApplyTemplate);
  }, [open]);

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('Policy name is required');
      return;
    }
    
    setSaving(true);
    try {
      if (policy) {
        await axios.put(`${API}/sla-policies/${policy.id}`, formData);
        toast.success('Policy updated');
      } else {
        await axios.post(`${API}/sla-policies`, formData);
        toast.success('Policy created');
      }
      onSave();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save policy');
    } finally {
      setSaving(false);
    }
  };

  const addEscalationLevel = () => {
    const newLevel = {
      level: formData.escalation_levels.length + 1,
      name: `Level ${formData.escalation_levels.length + 1}`,
      trigger: 'breach',
      delay_minutes: 0,
      actions: []
    };
    setFormData({ ...formData, escalation_levels: [...formData.escalation_levels, newLevel] });
  };

  const updateLevel = (index, updates) => {
    const levels = [...formData.escalation_levels];
    levels[index] = { ...levels[index], ...updates };
    setFormData({ ...formData, escalation_levels: levels });
  };

  const removeLevel = (index) => {
    const levels = formData.escalation_levels.filter((_, i) => i !== index);
    // Renumber levels
    levels.forEach((l, i) => l.level = i + 1);
    setFormData({ ...formData, escalation_levels: levels });
  };

  const addAction = (levelIndex) => {
    const levels = [...formData.escalation_levels];
    levels[levelIndex].actions = [
      ...(levels[levelIndex].actions || []),
      { type: 'notify_role', target_role_id: '', notification_message: 'SLA escalation triggered for {order_code}' }
    ];
    setFormData({ ...formData, escalation_levels: levels });
  };

  const updateAction = (levelIndex, actionIndex, updates) => {
    const levels = [...formData.escalation_levels];
    levels[levelIndex].actions[actionIndex] = { ...levels[levelIndex].actions[actionIndex], ...updates };
    setFormData({ ...formData, escalation_levels: levels });
  };

  const removeAction = (levelIndex, actionIndex) => {
    const levels = [...formData.escalation_levels];
    levels[levelIndex].actions = levels[levelIndex].actions.filter((_, i) => i !== actionIndex);
    setFormData({ ...formData, escalation_levels: levels });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{policy ? 'Edit Policy' : 'Create New Policy'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Basic Info */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Policy Name *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Standard SLA Policy"
                />
              </div>
              <div className="flex items-center gap-2 pt-6">
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
                <Label>Active</Label>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe when this policy applies..."
                rows={2}
              />
            </div>
          </div>

          <Separator />

          {/* Policy Scope */}
          <div className="space-y-4">
            <div>
              <h4 className="font-medium flex items-center gap-2">
                <Target className="w-4 h-4" />
                Policy Scope
              </h4>
              <p className="text-sm">Select which roles, teams, specialties, or access tiers this policy applies to</p>
            </div>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Roles */}
              <div className="space-y-2">
                <Label className="text-sm">Roles</Label>
                <div className="border rounded-lg p-2 max-h-32 overflow-y-auto space-y-1">
                  {roles.map((role) => (
                    <div key={role.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`role-${role.id}`}
                        checked={formData.scope.role_ids?.includes(role.id)}
                        onCheckedChange={(checked) => {
                          const roleIds = checked
                            ? [...(formData.scope.role_ids || []), role.id]
                            : formData.scope.role_ids?.filter(id => id !== role.id) || [];
                          setFormData({ ...formData, scope: { ...formData.scope, role_ids: roleIds } });
                        }}
                      />
                      <label htmlFor={`role-${role.id}`} className="text-sm cursor-pointer">{role.name}</label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Teams */}
              <div className="space-y-2">
                <Label className="text-sm">Teams</Label>
                <div className="border rounded-lg p-2 max-h-32 overflow-y-auto space-y-1">
                  {teams.map((team) => (
                    <div key={team.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`team-${team.id}`}
                        checked={formData.scope.team_ids?.includes(team.id)}
                        onCheckedChange={(checked) => {
                          const teamIds = checked
                            ? [...(formData.scope.team_ids || []), team.id]
                            : formData.scope.team_ids?.filter(id => id !== team.id) || [];
                          setFormData({ ...formData, scope: { ...formData.scope, team_ids: teamIds } });
                        }}
                      />
                      <label htmlFor={`team-${team.id}`} className="text-sm cursor-pointer">{team.name}</label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Specialties */}
              <div className="space-y-2">
                <Label className="text-sm">Specialties</Label>
                <div className="border rounded-lg p-2 max-h-32 overflow-y-auto space-y-1">
                  {specialties.slice(0, 10).map((specialty) => (
                    <div key={specialty.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`specialty-${specialty.id}`}
                        checked={formData.scope.specialty_ids?.includes(specialty.id)}
                        onCheckedChange={(checked) => {
                          const specialtyIds = checked
                            ? [...(formData.scope.specialty_ids || []), specialty.id]
                            : formData.scope.specialty_ids?.filter(id => id !== specialty.id) || [];
                          setFormData({ ...formData, scope: { ...formData.scope, specialty_ids: specialtyIds } });
                        }}
                      />
                      <label htmlFor={`specialty-${specialty.id}`} className="text-sm cursor-pointer">{specialty.name}</label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Access Tiers */}
              <div className="space-y-2">
                <Label className="text-sm">Access Tiers</Label>
                <div className="border rounded-lg p-2 max-h-32 overflow-y-auto space-y-1">
                  {accessTiers.map((tier) => (
                    <div key={tier.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`tier-${tier.id}`}
                        checked={formData.scope.access_tier_ids?.includes(tier.id)}
                        onCheckedChange={(checked) => {
                          const tierIds = checked
                            ? [...(formData.scope.access_tier_ids || []), tier.id]
                            : formData.scope.access_tier_ids?.filter(id => id !== tier.id) || [];
                          setFormData({ ...formData, scope: { ...formData.scope, access_tier_ids: tierIds } });
                        }}
                      />
                      <label htmlFor={`tier-${tier.id}`} className="text-sm cursor-pointer">{tier.name}</label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <p className="text-xs">Leave all empty to apply to all orders</p>
          </div>

          <Separator />

          {/* SLA Rules */}
          <div className="space-y-4">
            <div>
              <h4 className="font-medium flex items-center gap-2">
                <Clock className="w-4 h-4" />
                SLA Clock Rules
              </h4>
            </div>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>SLA Duration (minutes)</Label>
                <Input
                  type="number"
                  value={formData.sla_rules.duration_minutes}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    sla_rules: { ...formData.sla_rules, duration_minutes: parseInt(e.target.value) || 0 }
                  })}
                />
                <p className="text-xs">
                  = {Math.floor(formData.sla_rules.duration_minutes / 60)}h {formData.sla_rules.duration_minutes % 60}m
                </p>
              </div>
              <div className="space-y-2">
                <Label>At-Risk Threshold (minutes before deadline)</Label>
                <Input
                  type="number"
                  value={formData.thresholds.at_risk_minutes || 240}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    thresholds: { ...formData.thresholds, at_risk_minutes: parseInt(e.target.value) || 0 }
                  })}
                />
              </div>
              <div className="flex items-center gap-2 pt-6">
                <Switch
                  checked={formData.sla_rules.business_hours_only}
                  onCheckedChange={(checked) => setFormData({ 
                    ...formData, 
                    sla_rules: { ...formData.sla_rules, business_hours_only: checked }
                  })}
                />
                <Label>Business Hours Only</Label>
              </div>
            </div>
          </div>

          <Separator />

          {/* Escalation Levels */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium flex items-center gap-2">
                  <Layers className="w-4 h-4" />
                  Escalation Levels
                </h4>
                <p className="text-sm">Define multi-level escalation rules</p>
              </div>
              <Button variant="outline" size="sm" onClick={addEscalationLevel}>
                <Plus className="w-4 h-4 mr-1" />
                Add Level
              </Button>
            </div>

            <div className="space-y-4">
              {formData.escalation_levels.map((level, levelIdx) => (
                <div key={levelIdx} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h5 className="font-medium">Level {level.level}</h5>
                    <Button variant="ghost" size="icon" onClick={() => removeLevel(levelIdx)}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                  
                  <div className="grid md:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Level Name</Label>
                      <Input
                        value={level.name}
                        onChange={(e) => updateLevel(levelIdx, { name: e.target.value })}
                        placeholder="e.g., Manager Alert"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Trigger</Label>
                      <Select
                        value={level.trigger}
                        onValueChange={(val) => updateLevel(levelIdx, { trigger: val })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="at_risk">On At Risk</SelectItem>
                          <SelectItem value="breach">On Breach</SelectItem>
                          <SelectItem value="breach_plus_minutes">After Breach + Time</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {level.trigger === 'breach_plus_minutes' && (
                      <div className="space-y-1">
                        <Label className="text-xs">Delay (minutes)</Label>
                        <Input
                          type="number"
                          value={level.delay_minutes}
                          onChange={(e) => updateLevel(levelIdx, { delay_minutes: parseInt(e.target.value) || 0 })}
                        />
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Actions</Label>
                      <Button variant="ghost" size="sm" onClick={() => addAction(levelIdx)}>
                        <Plus className="w-3 h-3 mr-1" />
                        Add Action
                      </Button>
                    </div>
                    {(level.actions || []).map((action, actionIdx) => (
                      <div key={actionIdx} className="flex items-start gap-2 p-2 bg-white rounded border">
                        <Select
                          value={action.type}
                          onValueChange={(val) => updateAction(levelIdx, actionIdx, { type: val })}
                        >
                          <SelectTrigger className="w-40">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="notify_role">Notify Role</SelectItem>
                            <SelectItem value="notify_team">Notify Team</SelectItem>
                            <SelectItem value="escalate_to_role">Escalate to Role</SelectItem>
                            <SelectItem value="escalate_to_team">Escalate to Team</SelectItem>
                            <SelectItem value="change_priority">Change Priority</SelectItem>
                          </SelectContent>
                        </Select>
                        
                        {(action.type === 'notify_role' || action.type === 'escalate_to_role') && (
                          <Select
                            value={action.target_role_id || ''}
                            onValueChange={(val) => {
                              const role = roles.find(r => r.id === val);
                              updateAction(levelIdx, actionIdx, { 
                                target_role_id: val,
                                target_role_name: role?.name
                              });
                            }}
                          >
                            <SelectTrigger className="w-40">
                              <SelectValue placeholder="Select role" />
                            </SelectTrigger>
                            <SelectContent>
                              {roles.map((role) => (
                                <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                        
                        {(action.type === 'notify_team' || action.type === 'escalate_to_team') && (
                          <Select
                            value={action.target_team_id || ''}
                            onValueChange={(val) => {
                              const team = teams.find(t => t.id === val);
                              updateAction(levelIdx, actionIdx, { 
                                target_team_id: val,
                                target_team_name: team?.name
                              });
                            }}
                          >
                            <SelectTrigger className="w-40">
                              <SelectValue placeholder="Select team" />
                            </SelectTrigger>
                            <SelectContent>
                              {teams.map((team) => (
                                <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                        
                        {action.type === 'change_priority' && (
                          <Select
                            value={action.new_priority || ''}
                            onValueChange={(val) => updateAction(levelIdx, actionIdx, { new_priority: val })}
                          >
                            <SelectTrigger className="w-40">
                              <SelectValue placeholder="Priority" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Low">Low</SelectItem>
                              <SelectItem value="Normal">Normal</SelectItem>
                              <SelectItem value="High">High</SelectItem>
                              <SelectItem value="Critical">Critical</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                        
                        <Button variant="ghost" size="icon" onClick={() => removeAction(levelIdx, actionIdx)}>
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              
              {formData.escalation_levels.length === 0 && (
                <div className="text-center py-6 border rounded-lg border-dashed">
                  No escalation levels defined. Add levels to configure automated responses.
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : (policy ? 'Update Policy' : 'Create Policy')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// SLA Policy Templates Component
function PolicyTemplates({ roles, teams, specialties, accessTiers, onApplyTemplate }) {
  // Pre-built SLA policy templates
  const templates = [
    {
      id: 'standard-sla',
      name: 'Standard SLA (24 Hours)',
      description: 'Standard response/resolution SLA with 24-hour deadline. Includes 4-hour at-risk warning and escalation on breach.',
      category: 'Basic',
      icon: '⏱️',
      config: {
        name: 'Standard SLA - 24 Hours',
        description: 'Standard service level agreement with 24-hour resolution target',
        scope: { role_ids: [], team_ids: [], specialty_ids: [], access_tier_ids: [] },
        sla_rules: { duration_minutes: 1440, business_hours_only: false },
        thresholds: { at_risk_minutes: 240 },
        escalation_levels: [
          {
            level: 1,
            name: 'At Risk Alert',
            trigger: 'at_risk',
            delay_minutes: 0,
            actions: [{ type: 'notify_role', notification_message: 'Ticket approaching SLA deadline' }]
          },
          {
            level: 2,
            name: 'SLA Breach Alert',
            trigger: 'breach',
            delay_minutes: 0,
            actions: [{ type: 'change_priority', new_priority: 'High' }]
          }
        ],
        is_active: true
      }
    },
    {
      id: 'urgent-sla',
      name: 'Urgent SLA (4 Hours)',
      description: 'High-priority SLA with 4-hour response time. Immediate escalation chain on breach.',
      category: 'Priority',
      icon: '🚨',
      config: {
        name: 'Urgent SLA - 4 Hours',
        description: 'Urgent service level agreement for critical issues requiring rapid resolution',
        scope: { role_ids: [], team_ids: [], specialty_ids: [], access_tier_ids: [] },
        sla_rules: { duration_minutes: 240, business_hours_only: false },
        thresholds: { at_risk_minutes: 60 },
        escalation_levels: [
          {
            level: 1,
            name: 'At Risk - 1 Hour Warning',
            trigger: 'at_risk',
            delay_minutes: 0,
            actions: [{ type: 'notify_role', notification_message: 'Urgent ticket: 1 hour until SLA breach' }]
          },
          {
            level: 2,
            name: 'Immediate Breach Response',
            trigger: 'breach',
            delay_minutes: 0,
            actions: [
              { type: 'change_priority', new_priority: 'Critical' },
              { type: 'notify_role', notification_message: 'URGENT: SLA breached - immediate attention required' }
            ]
          },
          {
            level: 3,
            name: 'Executive Escalation',
            trigger: 'breach_plus_minutes',
            delay_minutes: 30,
            actions: [{ type: 'notify_role', notification_message: 'Executive escalation: SLA breach > 30 minutes' }]
          }
        ],
        is_active: true
      }
    },
    {
      id: 'business-hours-sla',
      name: 'Business Hours SLA (8 Hours)',
      description: 'SLA counted only during business hours. 8-hour resolution target with business day tracking.',
      category: 'Business',
      icon: '🏢',
      config: {
        name: 'Business Hours SLA - 8 Hours',
        description: 'Service level agreement measured during business hours only (9AM-5PM)',
        scope: { role_ids: [], team_ids: [], specialty_ids: [], access_tier_ids: [] },
        sla_rules: { duration_minutes: 480, business_hours_only: true, timezone: 'America/New_York' },
        thresholds: { at_risk_minutes: 120 },
        escalation_levels: [
          {
            level: 1,
            name: '2 Hour Warning',
            trigger: 'at_risk',
            delay_minutes: 0,
            actions: [{ type: 'notify_role', notification_message: 'Ticket at risk - 2 business hours remaining' }]
          },
          {
            level: 2,
            name: 'Business SLA Breach',
            trigger: 'breach',
            delay_minutes: 0,
            actions: [{ type: 'change_priority', new_priority: 'High' }]
          }
        ],
        is_active: true
      }
    },
    {
      id: 'premium-sla',
      name: 'Premium Partner SLA (2 Hours)',
      description: 'Premium SLA for top-tier partners. 2-hour response with aggressive escalation ladder.',
      category: 'Premium',
      icon: '⭐',
      config: {
        name: 'Premium Partner SLA - 2 Hours',
        description: 'Premium service level agreement for high-value partners with priority handling',
        scope: { role_ids: [], team_ids: [], specialty_ids: [], access_tier_ids: [] },
        sla_rules: { duration_minutes: 120, business_hours_only: false },
        thresholds: { at_risk_minutes: 30 },
        escalation_levels: [
          {
            level: 1,
            name: 'Premium At Risk',
            trigger: 'at_risk',
            delay_minutes: 0,
            actions: [
              { type: 'notify_role', notification_message: 'PREMIUM: 30 minutes until SLA breach' },
              { type: 'change_priority', new_priority: 'High' }
            ]
          },
          {
            level: 2,
            name: 'Premium Breach - Immediate',
            trigger: 'breach',
            delay_minutes: 0,
            actions: [
              { type: 'change_priority', new_priority: 'Critical' },
              { type: 'notify_role', notification_message: 'PREMIUM SLA BREACH - Immediate executive attention required' }
            ]
          },
          {
            level: 3,
            name: 'Executive Override',
            trigger: 'breach_plus_minutes',
            delay_minutes: 15,
            actions: [{ type: 'notify_role', notification_message: 'PREMIUM: Executive override - SLA breach > 15 minutes' }]
          },
          {
            level: 4,
            name: 'Critical Escalation',
            trigger: 'breach_plus_minutes',
            delay_minutes: 30,
            actions: [{ type: 'notify_role', notification_message: 'CRITICAL: Premium partner SLA breach exceeds 30 minutes' }]
          }
        ],
        is_active: true
      }
    },
    {
      id: 'extended-sla',
      name: 'Extended SLA (72 Hours)',
      description: 'Extended timeline SLA for complex requests. 3-day resolution window with staged alerts.',
      category: 'Extended',
      icon: '📅',
      config: {
        name: 'Extended SLA - 72 Hours',
        description: 'Extended service level agreement for complex issues requiring thorough investigation',
        scope: { role_ids: [], team_ids: [], specialty_ids: [], access_tier_ids: [] },
        sla_rules: { duration_minutes: 4320, business_hours_only: false },
        thresholds: { at_risk_minutes: 1440 },
        escalation_levels: [
          {
            level: 1,
            name: '24 Hour Warning',
            trigger: 'at_risk',
            delay_minutes: 0,
            actions: [{ type: 'notify_role', notification_message: 'Extended ticket: 24 hours remaining until deadline' }]
          },
          {
            level: 2,
            name: 'Extended SLA Breach',
            trigger: 'breach',
            delay_minutes: 0,
            actions: [{ type: 'change_priority', new_priority: 'High' }]
          },
          {
            level: 3,
            name: 'Continued Breach Alert',
            trigger: 'breach_plus_minutes',
            delay_minutes: 1440,
            actions: [{ type: 'notify_role', notification_message: 'Extended SLA: Breach exceeds 24 hours' }]
          }
        ],
        is_active: true
      }
    },
    {
      id: 'first-response-sla',
      name: 'First Response SLA (1 Hour)',
      description: 'Focused on initial acknowledgment. 1-hour first response guarantee for all tickets.',
      category: 'Response',
      icon: '💬',
      config: {
        name: 'First Response SLA - 1 Hour',
        description: 'Service level agreement focused on initial acknowledgment and first response time',
        scope: { role_ids: [], team_ids: [], specialty_ids: [], access_tier_ids: [] },
        sla_rules: { duration_minutes: 60, business_hours_only: false },
        thresholds: { at_risk_minutes: 15 },
        escalation_levels: [
          {
            level: 1,
            name: '15 Minute Warning',
            trigger: 'at_risk',
            delay_minutes: 0,
            actions: [{ type: 'notify_role', notification_message: 'First response needed: 15 minutes remaining' }]
          },
          {
            level: 2,
            name: 'First Response Breach',
            trigger: 'breach',
            delay_minutes: 0,
            actions: [
              { type: 'change_priority', new_priority: 'High' },
              { type: 'notify_role', notification_message: 'First response SLA breached - immediate acknowledgment required' }
            ]
          }
        ],
        is_active: true
      }
    }
  ];

  const categories = [...new Set(templates.map(t => t.category))];

  return (
    <div className="space-y-6" data-testid="sla-templates-section">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileCode className="w-5 h-5" />
            SLA Policy Templates
          </CardTitle>
          <CardDescription>
            Pre-configured SLA policies for common scenarios. Click &quot;Use Template&quot; to create a policy based on these settings.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {categories.map(category => (
            <div key={category} className="mb-6 last:mb-0">
              <h3 className="text-sm font-semibold mb-3 uppercase tracking-wide">{category}</h3>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {templates.filter(t => t.category === category).map(template => (
                  <Card key={template.id} className="hover:border-rose-300 transition-colors">
                    <CardContent className="pt-4">
                      <div className="flex items-start gap-3">
                        <span className="text-2xl">{template.icon}</span>
                        <div className="flex-1">
                          <h4 className="font-medium">{template.name}</h4>
                          <p className="text-sm mt-1 line-clamp-2">{template.description}</p>
                          <div className="flex items-center gap-2 mt-3">
                            <Badge variant="outline" className="text-xs">
                              {template.config.sla_rules.duration_minutes / 60}h SLA
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {template.config.escalation_levels.length} Escalations
                            </Badge>
                          </div>
                          <Button
                            size="sm"
                            className="mt-3 w-full bg-[var(--accent)] hover:bg-[var(--accent-hover)]"
                            onClick={() => onApplyTemplate(template.config)}
                            data-testid={`use-template-${template.id}`}
                          >
                            <Plus className="w-4 h-4 mr-1" />
                            Use Template
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
