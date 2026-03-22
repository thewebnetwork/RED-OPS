import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  Plus, Trash2, Edit, Shield, Clock, AlertTriangle, 
  Users, Mail, Bell, Webhook, ChevronDown, ChevronUp,
  Check, X, Play, Settings, BarChart3
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Switch } from '../components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

const ACTION_TYPES = [
  { value: 'notify_user', label: 'Notify User', icon: Bell, description: 'Send in-app notification to a specific user' },
  { value: 'notify_role', label: 'Notify Role', icon: Users, description: 'Notify all users with a specific role' },
  { value: 'reassign_user', label: 'Reassign to User', icon: Users, description: 'Reassign ticket to a specific user' },
  { value: 'reassign_team', label: 'Reassign to Team', icon: Users, description: 'Reassign to next available team member' },
  { value: 'change_priority', label: 'Change Priority', icon: AlertTriangle, description: 'Change ticket priority' },
  { value: 'send_email', label: 'Send Email', icon: Mail, description: 'Send email notification' },
  { value: 'webhook', label: 'Webhook', icon: Webhook, description: 'Call external webhook (e.g., Slack)' },
];

const PRIORITIES = ['Low', 'Normal', 'High', 'Urgent'];

export default function EscalationPolicies() {
  const { token } = useAuth();
  const [policies, setPolicies] = useState([]);
  const [escalatedOrders, setEscalatedOrders] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('policies');
  
  // Form state
  const [showPolicyDialog, setShowPolicyDialog] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    trigger: 'both',
    category_l1_ids: [],
    category_l2_ids: [],
    priorities: [],
    levels: [],
    cooldown_minutes: 30,
    is_active: true
  });
  
  // Lookup data
  const [categories, setCategories] = useState([]);
  const [roles, setRoles] = useState([]);
  const [teams, setTeams] = useState([]);
  const [users, setUsers] = useState([]);
  
  // Expanded levels
  const [expandedLevels, setExpandedLevels] = useState({});

  useEffect(() => {
    fetchData();
  }, [token]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      
      const [policiesRes, ordersRes, statsRes, catsRes, rolesRes, teamsRes, usersRes] = await Promise.all([
        fetch(`${API}/api/escalation/policies`, { headers }),
        fetch(`${API}/api/escalation/orders`, { headers }),
        fetch(`${API}/api/escalation/stats`, { headers }),
        fetch(`${API}/api/categories/l1`, { headers }),
        fetch(`${API}/api/roles`, { headers }),
        fetch(`${API}/api/teams`, { headers }),
        fetch(`${API}/api/users`, { headers }),
      ]);

      if (policiesRes.ok) setPolicies(await policiesRes.json());
      if (ordersRes.ok) setEscalatedOrders(await ordersRes.json());
      if (statsRes.ok) setStats(await statsRes.json());
      if (catsRes.ok) setCategories(await catsRes.json());
      if (rolesRes.ok) setRoles(await rolesRes.json());
      if (teamsRes.ok) setTeams(await teamsRes.json());
      if (usersRes.ok) setUsers(await usersRes.json());
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePolicy = () => {
    setEditingPolicy(null);
    setFormData({
      name: '',
      description: '',
      trigger: 'both',
      category_l1_ids: [],
      category_l2_ids: [],
      priorities: [],
      levels: [
        {
          level: 1,
          name: 'Initial Alert',
          time_threshold_minutes: 0,
          actions: [],
          notify_message: 'Order {order_code} requires attention: {title}'
        }
      ],
      cooldown_minutes: 30,
      is_active: true
    });
    setExpandedLevels({ 0: true });
    setShowPolicyDialog(true);
  };

  const handleEditPolicy = (policy) => {
    setEditingPolicy(policy);
    setFormData({
      name: policy.name,
      description: policy.description || '',
      trigger: policy.trigger,
      category_l1_ids: policy.category_l1_ids || [],
      category_l2_ids: policy.category_l2_ids || [],
      priorities: policy.priorities || [],
      levels: policy.levels || [],
      cooldown_minutes: policy.cooldown_minutes || 30,
      is_active: policy.is_active
    });
    setExpandedLevels({});
    setShowPolicyDialog(true);
  };

  const handleSavePolicy = async () => {
    if (!formData.name.trim()) {
      toast.error('Policy name is required');
      return;
    }
    if (formData.levels.length === 0) {
      toast.error('At least one escalation level is required');
      return;
    }

    try {
      const headers = {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      };

      const url = editingPolicy
        ? `${API}/api/escalation/policies/${editingPolicy.id}`
        : `${API}/api/escalation/policies`;
      
      const method = editingPolicy ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers,
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        toast.success(editingPolicy ? 'Policy updated' : 'Policy created');
        setShowPolicyDialog(false);
        fetchData();
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Failed to save policy');
      }
    } catch (error) {
      toast.error('Failed to save policy');
    }
  };

  const handleDeletePolicy = async (policyId) => {
    if (!confirm('Are you sure you want to delete this policy?')) return;

    try {
      const response = await fetch(`${API}/api/escalation/policies/${policyId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        toast.success('Policy deleted');
        fetchData();
      }
    } catch (error) {
      toast.error('Failed to delete policy');
    }
  };

  const handleTriggerCheck = async () => {
    try {
      const response = await fetch(`${API}/api/escalation/check`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        toast.success('Escalation check completed');
        fetchData();
      }
    } catch (error) {
      toast.error('Failed to trigger escalation check');
    }
  };

  // Level management
  const addLevel = () => {
    const newLevel = {
      level: formData.levels.length + 1,
      name: `Level ${formData.levels.length + 1}`,
      time_threshold_minutes: (formData.levels.length) * 60,
      actions: [],
      notify_message: 'Order {order_code} escalated to Level {level}: {title}'
    };
    setFormData({ ...formData, levels: [...formData.levels, newLevel] });
    setExpandedLevels({ ...expandedLevels, [formData.levels.length]: true });
  };

  const removeLevel = (index) => {
    const newLevels = formData.levels.filter((_, i) => i !== index);
    // Renumber levels
    newLevels.forEach((l, i) => l.level = i + 1);
    setFormData({ ...formData, levels: newLevels });
  };

  const updateLevel = (index, field, value) => {
    const newLevels = [...formData.levels];
    newLevels[index] = { ...newLevels[index], [field]: value };
    setFormData({ ...formData, levels: newLevels });
  };

  // Action management
  const addAction = (levelIndex) => {
    const newLevels = [...formData.levels];
    newLevels[levelIndex].actions.push({
      type: 'notify_role',
      target_role_id: '',
      target_role_name: ''
    });
    setFormData({ ...formData, levels: newLevels });
  };

  const removeAction = (levelIndex, actionIndex) => {
    const newLevels = [...formData.levels];
    newLevels[levelIndex].actions = newLevels[levelIndex].actions.filter((_, i) => i !== actionIndex);
    setFormData({ ...formData, levels: newLevels });
  };

  const updateAction = (levelIndex, actionIndex, updates) => {
    const newLevels = [...formData.levels];
    newLevels[levelIndex].actions[actionIndex] = {
      ...newLevels[levelIndex].actions[actionIndex],
      ...updates
    };
    setFormData({ ...formData, levels: newLevels });
  };

  const togglePriority = (priority) => {
    const current = formData.priorities;
    const updated = current.includes(priority)
      ? current.filter(p => p !== priority)
      : [...current, priority];
    setFormData({ ...formData, priorities: updated });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#A2182C]"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="escalation-policies-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Escalation Policies</h1>
          <p className="text-gray-600">Configure automatic escalation rules for SLA breaches</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleTriggerCheck} data-testid="trigger-check-btn">
            <Play className="w-4 h-4 mr-2" />
            Run Check
          </Button>
          <Button onClick={handleCreatePolicy} data-testid="create-policy-btn">
            <Plus className="w-4 h-4 mr-2" />
            New Policy
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-[#A2182C]">{stats.currently_escalated_orders}</div>
              <div className="text-sm text-gray-600">Escalated Orders</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-orange-600">{stats.unacknowledged}</div>
              <div className="text-sm text-gray-600">Unacknowledged</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{stats.escalations_today}</div>
              <div className="text-sm text-gray-600">Today</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-green-600">{stats.active_policies}</div>
              <div className="text-sm text-gray-600">Active Policies</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="policies">
            <Settings className="w-4 h-4 mr-2" />
            Policies
          </TabsTrigger>
          <TabsTrigger value="escalated">
            <AlertTriangle className="w-4 h-4 mr-2" />
            Escalated Orders ({escalatedOrders.length})
          </TabsTrigger>
        </TabsList>

        {/* Policies Tab */}
        <TabsContent value="policies" className="space-y-4">
          {policies.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Shield className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-medium">No Escalation Policies</h3>
                <p className="text-gray-600 mt-1">Create your first policy to automate escalations</p>
                <Button onClick={handleCreatePolicy} className="mt-4">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Policy
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {policies.map((policy) => (
                <Card key={policy.id} className={!policy.is_active ? 'opacity-60' : ''}>
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          {policy.name}
                          {!policy.is_active && <Badge variant="secondary">Inactive</Badge>}
                        </CardTitle>
                        <CardDescription>{policy.description}</CardDescription>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => handleEditPolicy(policy)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDeletePolicy(policy.id)}>
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="">Trigger:</span>
                        <Badge variant="outline" className="ml-2">
                          {policy.trigger === 'both' ? 'Warning & Breach' : policy.trigger}
                        </Badge>
                      </div>
                      <div>
                        <span className="">Levels:</span>
                        <span className="ml-2 font-medium">{policy.levels?.length || 0}</span>
                      </div>
                      <div>
                        <span className="">Cooldown:</span>
                        <span className="ml-2">{policy.cooldown_minutes} min</span>
                      </div>
                      <div>
                        <span className="">Priorities:</span>
                        <span className="ml-2">{policy.priorities?.length > 0 ? policy.priorities.join(', ') : 'All'}</span>
                      </div>
                    </div>
                    
                    {/* Levels preview */}
                    <div className="mt-4 flex flex-wrap gap-2">
                      {policy.levels?.map((level, i) => (
                        <div key={i} className="px-3 py-1 rounded-full text-sm flex items-center gap-2">
                          <span className="w-5 h-5 bg-[#A2182C] text-white rounded-full text-xs flex items-center justify-center">
                            {level.level}
                          </span>
                          <span>{level.name}</span>
                          <span className="">({level.time_threshold_minutes}m)</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Escalated Orders Tab */}
        <TabsContent value="escalated" className="space-y-4">
          {escalatedOrders.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Check className="w-12 h-12 mx-auto text-green-500 mb-4" />
                <h3 className="text-lg font-medium">No Escalated Orders</h3>
                <p className="text-gray-600 mt-1">All tickets are within SLA thresholds</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {escalatedOrders.map((order) => (
                <Card key={order.order_id} className="border-l-4 border-l-[#A2182C]">
                  <CardContent className="py-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-medium">{order.order_code}</span>
                          <Badge variant="destructive">Level {order.current_escalation_level}</Badge>
                          <Badge variant="outline">{order.order_priority}</Badge>
                        </div>
                        <p className="mt-1">{order.order_title}</p>
                        <div className="text-sm mt-1">
                          Policy: {order.policy_name} • Escalated {order.time_in_escalation} ago
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm">Assigned to</div>
                        <div className="font-medium">{order.assigned_to || 'Unassigned'}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Policy Dialog */}
      <Dialog open={showPolicyDialog} onOpenChange={setShowPolicyDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPolicy ? 'Edit Policy' : 'Create Escalation Policy'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Policy Name *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., High Priority Escalation"
                />
              </div>
              <div>
                <Label>Trigger When</Label>
                <Select
                  value={formData.trigger}
                  onValueChange={(v) => setFormData({ ...formData, trigger: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="both">SLA Warning & Breach</SelectItem>
                    <SelectItem value="sla_warning">SLA Warning Only</SelectItem>
                    <SelectItem value="sla_breach">SLA Breach Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe when this policy should be applied..."
                rows={2}
              />
            </div>

            {/* Filters */}
            <div className="border rounded-lg p-4 space-y-4">
              <h4 className="font-medium">Apply to (leave empty for all)</h4>
              
              <div>
                <Label>Priorities</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {PRIORITIES.map((p) => (
                    <Button
                      key={p}
                      type="button"
                      variant={formData.priorities.includes(p) ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => togglePriority(p)}
                    >
                      {p}
                    </Button>
                  ))}
                </div>
              </div>

              <div>
                <Label>Categories</Label>
                <Select
                  value=""
                  onValueChange={(v) => {
                    if (!formData.category_l1_ids.includes(v)) {
                      setFormData({ ...formData, category_l1_ids: [...formData.category_l1_ids, v] });
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Add category filter..." />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex flex-wrap gap-2 mt-2">
                  {formData.category_l1_ids.map((catId) => {
                    const cat = categories.find(c => c.id === catId);
                    return (
                      <Badge key={catId} variant="secondary" className="gap-1">
                        {cat?.name || catId}
                        <X
                          className="w-3 h-3 cursor-pointer"
                          onClick={() => setFormData({
                            ...formData,
                            category_l1_ids: formData.category_l1_ids.filter(id => id !== catId)
                          })}
                        />
                      </Badge>
                    );
                  })}
                </div>
              </div>

              <div>
                <Label>Cooldown (minutes)</Label>
                <Input
                  type="number"
                  min={5}
                  value={formData.cooldown_minutes}
                  onChange={(e) => setFormData({ ...formData, cooldown_minutes: parseInt(e.target.value) || 30 })}
                  className="w-32"
                />
                <p className="text-xs mt-1">Minimum time between escalations for the same order</p>
              </div>
            </div>

            {/* Escalation Levels */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="font-medium">Escalation Levels</h4>
                <Button type="button" variant="outline" size="sm" onClick={addLevel}>
                  <Plus className="w-4 h-4 mr-1" />
                  Add Level
                </Button>
              </div>

              {formData.levels.map((level, levelIndex) => (
                <div key={levelIndex} className="border rounded-lg overflow-hidden">
                  <div
                    className="px-4 py-3 flex items-center justify-between cursor-pointer"
                    onClick={() => setExpandedLevels({ ...expandedLevels, [levelIndex]: !expandedLevels[levelIndex] })}
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 bg-[#A2182C] text-white rounded-full text-sm flex items-center justify-center">
                        {level.level}
                      </span>
                      <span className="font-medium">{level.name}</span>
                      <Badge variant="outline">{level.time_threshold_minutes} min</Badge>
                      <Badge variant="secondary">{level.actions?.length || 0} actions</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      {formData.levels.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); removeLevel(levelIndex); }}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      )}
                      {expandedLevels[levelIndex] ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </div>

                  {expandedLevels[levelIndex] && (
                    <div className="p-4 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <Label>Level Name</Label>
                          <Input
                            value={level.name}
                            onChange={(e) => updateLevel(levelIndex, 'name', e.target.value)}
                          />
                        </div>
                        <div>
                          <Label>Time Threshold (minutes)</Label>
                          <Input
                            type="number"
                            min={0}
                            value={level.time_threshold_minutes}
                            onChange={(e) => updateLevel(levelIndex, 'time_threshold_minutes', parseInt(e.target.value) || 0)}
                          />
                        </div>
                      </div>

                      <div>
                        <Label>Notification Message</Label>
                        <Input
                          value={level.notify_message || ''}
                          onChange={(e) => updateLevel(levelIndex, 'notify_message', e.target.value)}
                          placeholder="Use {order_code}, {title}, {level}, {level_name}"
                        />
                      </div>

                      {/* Actions */}
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <Label>Actions</Label>
                          <Button type="button" variant="outline" size="sm" onClick={() => addAction(levelIndex)}>
                            <Plus className="w-3 h-3 mr-1" />
                            Add Action
                          </Button>
                        </div>

                        {(level.actions || []).map((action, actionIndex) => (
                          <div key={actionIndex} className="flex flex-wrap gap-2 items-start p-3 rounded">
                            <Select
                              value={action.type}
                              onValueChange={(v) => updateAction(levelIndex, actionIndex, { type: v })}
                            >
                              <SelectTrigger className="w-48">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {ACTION_TYPES.map((at) => (
                                  <SelectItem key={at.value} value={at.value}>{at.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>

                            {/* Conditional fields based on action type */}
                            {(action.type === 'notify_user' || action.type === 'reassign_user') && (
                              <Select
                                value={action.target_user_id || ''}
                                onValueChange={(v) => {
                                  const user = users.find(u => u.id === v);
                                  updateAction(levelIndex, actionIndex, { 
                                    target_user_id: v, 
                                    target_user_name: user?.name 
                                  });
                                }}
                              >
                                <SelectTrigger className="w-48">
                                  <SelectValue placeholder="Select user..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {users.map((u) => (
                                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}

                            {action.type === 'notify_role' && (
                              <Select
                                value={action.target_role_id || ''}
                                onValueChange={(v) => {
                                  const role = roles.find(r => r.id === v);
                                  updateAction(levelIndex, actionIndex, { 
                                    target_role_id: v, 
                                    target_role_name: role?.name 
                                  });
                                }}
                              >
                                <SelectTrigger className="w-48">
                                  <SelectValue placeholder="Select role..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {roles.map((r) => (
                                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}

                            {action.type === 'reassign_team' && (
                              <Select
                                value={action.target_team_id || ''}
                                onValueChange={(v) => {
                                  const team = teams.find(t => t.id === v);
                                  updateAction(levelIndex, actionIndex, { 
                                    target_team_id: v, 
                                    target_team_name: team?.name 
                                  });
                                }}
                              >
                                <SelectTrigger className="w-48">
                                  <SelectValue placeholder="Select team..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {teams.map((t) => (
                                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}

                            {action.type === 'change_priority' && (
                              <Select
                                value={action.new_priority || ''}
                                onValueChange={(v) => updateAction(levelIndex, actionIndex, { new_priority: v })}
                              >
                                <SelectTrigger className="w-32">
                                  <SelectValue placeholder="Priority" />
                                </SelectTrigger>
                                <SelectContent>
                                  {PRIORITIES.map((p) => (
                                    <SelectItem key={p} value={p}>{p}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}

                            {action.type === 'send_email' && (
                              <div className="flex-1 space-y-2">
                                <Input
                                  placeholder="Email subject"
                                  value={action.email_subject || ''}
                                  onChange={(e) => updateAction(levelIndex, actionIndex, { email_subject: e.target.value })}
                                />
                              </div>
                            )}

                            {action.type === 'webhook' && (
                              <Input
                                placeholder="Webhook URL"
                                value={action.webhook_url || ''}
                                onChange={(e) => updateAction(levelIndex, actionIndex, { webhook_url: e.target.value })}
                                className="flex-1"
                              />
                            )}

                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeAction(levelIndex, actionIndex)}
                            >
                              <X className="w-4 h-4 text-red-500" />
                            </Button>
                          </div>
                        ))}

                        {(!level.actions || level.actions.length === 0) && (
                          <p className="text-sm text-center py-2">
                            No actions configured. Add actions to define what happens at this level.
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Active toggle */}
            <div className="flex items-center gap-3">
              <Switch
                checked={formData.is_active}
                onCheckedChange={(v) => setFormData({ ...formData, is_active: v })}
              />
              <Label>Policy is active</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPolicyDialog(false)}>Cancel</Button>
            <Button onClick={handleSavePolicy}>{editingPolicy ? 'Save Changes' : 'Create Policy'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
