import { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Checkbox } from '../components/ui/checkbox';
import { Switch } from '../components/ui/switch';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../components/ui/collapsible';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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
  Shield, 
  ShieldCheck, 
  User,
  Users,
  ChevronDown,
  ChevronRight,
  RotateCcw,
  Save,
  Info
} from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Role icons and colors
const roleConfig = {
  'Administrator': {
    icon: Shield,
    color: '#dc2626',
    bgColor: '#dc262615',
    description: 'Full platform control - can manage all modules, users, and settings'
  },
  'Privileged User': {
    icon: ShieldCheck,
    color: '#2563eb',
    bgColor: '#2563eb15',
    description: 'Manager level - can manage teams, create workflows, receive escalations'
  },
  'Standard User': {
    icon: User,
    color: '#16a34a',
    bgColor: '#16a34a15',
    description: 'Basic access - can submit requests, pick orders, view dashboard'
  }
};

export default function Roles() {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRole, setSelectedRole] = useState(null);
  const [editingPermissions, setEditingPermissions] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [originalPermissions, setOriginalPermissions] = useState(null);
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);
  const [pendingRoleSwitch, setPendingRoleSwitch] = useState(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [expandedModules, setExpandedModules] = useState({});

  useEffect(() => {
    fetchRoles();
  }, []);

  useEffect(() => {
    // Detect changes
    if (originalPermissions && editingPermissions) {
      const changed = JSON.stringify(editingPermissions) !== JSON.stringify(originalPermissions);
      setHasChanges(changed);
    }
  }, [editingPermissions, originalPermissions]);

  const fetchRoles = async () => {
    try {
      const res = await axios.get(`${API}/roles`);
      setRoles(res.data);
      // Auto-select first role
      if (res.data.length > 0 && !selectedRole) {
        selectRole(res.data[0]);
      }
    } catch (error) {
      toast.error('Failed to load roles');
    } finally {
      setLoading(false);
    }
  };

  const selectRole = (role) => {
    setSelectedRole(role);
    setEditingPermissions(JSON.parse(JSON.stringify(role.permissions)));
    setOriginalPermissions(JSON.parse(JSON.stringify(role.permissions)));
    setHasChanges(false);
    // Expand all modules by default
    const expanded = {};
    Object.keys(role.permissions).forEach(m => expanded[m] = true);
    setExpandedModules(expanded);
  };

  const handleRoleSwitch = (role) => {
    if (hasChanges) {
      setPendingRoleSwitch(role);
      setShowUnsavedWarning(true);
    } else {
      selectRole(role);
    }
  };

  const confirmRoleSwitch = () => {
    setShowUnsavedWarning(false);
    if (pendingRoleSwitch) {
      selectRole(pendingRoleSwitch);
      setPendingRoleSwitch(null);
    }
  };

  const togglePermission = (module, action) => {
    setEditingPermissions(prev => ({
      ...prev,
      [module]: {
        ...prev[module],
        [action]: !prev[module][action]
      }
    }));
  };

  const toggleAllInModule = (module, value) => {
    const newModulePerms = {};
    Object.keys(editingPermissions[module]).forEach(action => {
      newModulePerms[action] = value;
    });
    setEditingPermissions(prev => ({
      ...prev,
      [module]: newModulePerms
    }));
  };

  const isModuleFullyEnabled = (module) => {
    return Object.values(editingPermissions[module]).every(v => v === true);
  };

  const isModulePartiallyEnabled = (module) => {
    const values = Object.values(editingPermissions[module]);
    return values.some(v => v) && !values.every(v => v);
  };

  const toggleModuleExpanded = (module) => {
    setExpandedModules(prev => ({
      ...prev,
      [module]: !prev[module]
    }));
  };

  const handleSave = async () => {
    if (!selectedRole) return;
    
    try {
      await axios.patch(`${API}/roles/${selectedRole.id}`, {
        permissions: editingPermissions
      });
      toast.success(`${selectedRole.name} permissions saved`);
      setOriginalPermissions(JSON.parse(JSON.stringify(editingPermissions)));
      setHasChanges(false);
      // Refresh roles to get updated data
      const res = await axios.get(`${API}/roles`);
      setRoles(res.data);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save permissions');
    }
  };

  const handleResetToDefaults = async () => {
    if (!selectedRole) return;

    try {
      await axios.post(`${API}/roles/reset-defaults/${selectedRole.id}`);
      toast.success(`${selectedRole.name} permissions reset to defaults`);
      setShowResetConfirm(false);
      // Refresh
      const res = await axios.get(`${API}/roles`);
      setRoles(res.data);
      const updated = res.data.find(r => r.id === selectedRole.id);
      if (updated) selectRole(updated);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to reset permissions');
    }
  };

  const getModuleLabel = (module) => {
    const labels = {
      dashboard: 'Dashboard',
      command_center: 'Command Center',
      orders: 'Orders/Tickets',
      users: 'Users',
      teams: 'Teams',
      roles: 'Roles',
      categories: 'Categories',
      workflows: 'Workflows',
      escalation: 'Escalation',
      sla: 'SLA Management',
      integrations: 'Integrations',
      announcements: 'Announcements',
      logs: 'Logs',
      settings: 'Settings',
      reports: 'Reports'
    };
    return labels[module] || module;
  };

  const getActionLabel = (action) => {
    const labels = {
      view: 'View',
      create: 'Create',
      edit: 'Edit',
      delete: 'Delete',
      export: 'Export',
      pick: 'Pick/Claim',
      execute: 'Execute',
      acknowledge: 'Acknowledge'
    };
    return labels[action] || action;
  };

  const getEnabledCount = (role) => {
    let total = 0;
    let enabled = 0;
    Object.values(role.permissions).forEach(module => {
      Object.values(module).forEach(val => {
        total++;
        if (val) enabled++;
      });
    });
    return { total, enabled };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-rose-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in" data-testid="roles-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Role Permissions</h1>
          <p className="mt-1">Configure access permissions for each role</p>
        </div>
      </div>

      {/* Info Banner */}
      <div className="border rounded-lg p-4 flex gap-3">
        <Info className="w-5 h-5 flex-shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-medium">Identity & Access Management</p>
          <p className="mt-1">
            The platform uses 3 fixed roles: <strong>Administrator</strong>, <strong>Privileged User</strong>, and <strong>Standard User</strong>. 
            Each role has default permissions that can be customized below. For user-specific overrides, use the Permissions tab when editing a user.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Role Cards - Left Side */}
        <div className="lg:col-span-1 space-y-4">
          <h2 className="text-sm font-medium uppercase tracking-wider">System Roles</h2>
          {roles.map((role) => {
            const config = roleConfig[role.name] || roleConfig['Standard User'];
            const Icon = config.icon;
            const counts = getEnabledCount(role);
            const isSelected = selectedRole?.id === role.id;
            
            return (
              <Card 
                key={role.id}
                className={`cursor-pointer transition-all ${
                  isSelected 
                    ? 'ring-2 ring-rose-500 shadow-md' 
                    : 'hover:shadow-md hover:border-slate-300'
                }`}
                onClick={() => handleRoleSwitch(role)}
                data-testid={`role-card-${role.name.replace(/\s+/g, '-').toLowerCase()}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div 
                      className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: config.bgColor }}
                    >
                      <Icon size={20} style={{ color: config.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold">{role.display_name}</p>
                      <p className="text-xs mt-0.5 line-clamp-2">{config.description}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="outline" className="text-xs">
                          <Users size={12} className="mr-1" />
                          {role.user_count} users
                        </Badge>
                        <Badge 
                          variant="outline" 
                          className="text-xs"
                          style={{ borderColor: config.color, color: config.color }}
                        >
                          {counts.enabled}/{counts.total} enabled
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Permission Matrix - Right Side */}
        <div className="lg:col-span-3">
          {selectedRole && editingPermissions ? (
            <Card>
              <CardHeader className="border-b">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {(() => {
                      const config = roleConfig[selectedRole.name] || roleConfig['Standard User'];
                      const Icon = config.icon;
                      return (
                        <>
                          <div 
                            className="w-10 h-10 rounded-lg flex items-center justify-center"
                            style={{ backgroundColor: config.bgColor }}
                          >
                            <Icon size={20} style={{ color: config.color }} />
                          </div>
                          <div>
                            <CardTitle>{selectedRole.display_name}</CardTitle>
                            <CardDescription>{selectedRole.description}</CardDescription>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                  <div className="flex items-center gap-2">
                    {hasChanges && (
                      <Badge className="">
                        Unsaved changes
                      </Badge>
                    )}
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setShowResetConfirm(true)}
                    >
                      <RotateCcw size={14} className="mr-1" />
                      Reset to Defaults
                    </Button>
                    <Button 
                      size="sm"
                      className="bg-rose-600 hover:bg-rose-700"
                      onClick={handleSave}
                      disabled={!hasChanges}
                      data-testid="save-permissions-btn"
                    >
                      <Save size={14} className="mr-1" />
                      Save Changes
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {Object.entries(editingPermissions).map(([module, actions]) => (
                    <Collapsible 
                      key={module} 
                      open={expandedModules[module]}
                      onOpenChange={() => toggleModuleExpanded(module)}
                    >
                      <CollapsibleTrigger className="w-full">
                        <div className="flex items-center justify-between px-4 py-3 transition-colors">
                          <div className="flex items-center gap-3">
                            {expandedModules[module] ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                            <span className="font-medium">{getModuleLabel(module)}</span>
                            <Badge variant="outline" className="text-xs">
                              {Object.values(actions).filter(v => v).length}/{Object.keys(actions).length}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                            <span className="text-xs mr-2">
                              {isModuleFullyEnabled(module) ? 'All enabled' : isModulePartiallyEnabled(module) ? 'Partial' : 'Disabled'}
                            </span>
                            <Switch
                              checked={isModuleFullyEnabled(module)}
                              onCheckedChange={(checked) => toggleAllInModule(module, checked)}
                              data-testid={`module-toggle-${module}`}
                            />
                          </div>
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="px-4 pb-4 pt-1 bg-slate-50/50">
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                            {Object.entries(actions).map(([action, enabled]) => (
                              <label
                                key={action}
                                className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all ${
                                  enabled 
                                    ? 'bg-white border-rose-200 text-rose-700' 
                                    : 'bg-white hover:border-slate-300'
                                }`}
                                data-testid={`permission-${module}-${action}`}
                              >
                                <Checkbox
                                  checked={enabled}
                                  onCheckedChange={() => togglePermission(module, action)}
                                />
                                <span className="text-sm font-medium capitalize">{getActionLabel(action)}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-12 text-center">
                <Shield className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                <p>Select a role to view and edit its permissions</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Unsaved Changes Warning */}
      <AlertDialog open={showUnsavedWarning} onOpenChange={setShowUnsavedWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved permission changes for "{selectedRole?.display_name}". 
              Do you want to discard these changes?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingRoleSwitch(null)}>Stay</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRoleSwitch}>Discard Changes</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset Confirmation */}
      <AlertDialog open={showResetConfirm} onOpenChange={setShowResetConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset Permissions</AlertDialogTitle>
            <AlertDialogDescription>
              This will reset all permissions for "{selectedRole?.display_name}" back to their default values. 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleResetToDefaults} className="bg-rose-600 hover:bg-rose-700">
              Reset to Defaults
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
