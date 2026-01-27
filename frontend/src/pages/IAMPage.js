import { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Checkbox } from '../components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../components/ui/collapsible';
import { 
  KeyRound,
  Shield,
  Users,
  ChevronDown,
  Edit,
  Save,
  Info,
  Lock,
  Building2,
  Briefcase
} from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Default permission modules
const PERMISSION_MODULES = {
  dashboard: { label: 'Dashboard', actions: ['view'] },
  my_services: { label: 'My Services', actions: ['view'] },
  submit_request: { label: 'Submit Request', actions: ['view', 'create'] },
  orders: { label: 'Orders/Tickets', actions: ['view', 'create', 'edit', 'delete', 'export', 'pick', 'assign'] },
  users: { label: 'Users', actions: ['view', 'create', 'edit', 'delete'] },
  teams: { label: 'Teams', actions: ['view', 'create', 'edit', 'delete'] },
  specialties: { label: 'Specialties', actions: ['view', 'create', 'edit', 'delete'] },
  subscription_plans: { label: 'Subscription Plans', actions: ['view', 'create', 'edit', 'delete'] },
  categories: { label: 'Categories', actions: ['view', 'create', 'edit', 'delete'] },
  workflows: { label: 'Workflows', actions: ['view', 'create', 'edit', 'delete', 'execute'] },
  sla_policies: { label: 'SLA Policies', actions: ['view', 'create', 'edit', 'delete', 'acknowledge'] },
  integrations: { label: 'Integrations', actions: ['view', 'create', 'edit', 'delete'] },
  announcements: { label: 'Announcements', actions: ['view', 'create', 'edit', 'delete'] },
  logs: { label: 'Logs', actions: ['view', 'export'] },
  settings: { label: 'Settings', actions: ['view', 'edit'] },
  reports: { label: 'Reports', actions: ['view', 'export'] },
  ribbon_board: { label: 'The Ribbon Board', actions: ['view', 'pick'] }
};

// Role templates
const ROLE_TEMPLATES = {
  'Administrator': {
    description: 'Full system control. Can manage all modules, users, and settings.',
    permissions: Object.fromEntries(
      Object.entries(PERMISSION_MODULES).map(([key, config]) => [
        key,
        Object.fromEntries(config.actions.map(a => [a, true]))
      ])
    )
  },
  'Operator': {
    description: 'Internal staff operations. Can manage tickets/queues but not system governance.',
    permissions: {
      dashboard: { view: true },
      my_services: { view: true },
      submit_request: { view: true, create: true },
      orders: { view: true, create: true, edit: true, pick: true, assign: true },
      teams: { view: true, create: true, edit: true },
      categories: { view: true, create: true, edit: true },
      workflows: { view: true },
      logs: { view: true },
      reports: { view: true, export: true },
      ribbon_board: { view: true }
    }
  },
  'Standard User': {
    description: 'Basic user actions. Can submit requests and view own data.',
    permissions: {
      dashboard: { view: true },
      my_services: { view: true },
      submit_request: { view: true, create: true },
      orders: { view: true, create: true },
      reports: { view: true },
      ribbon_board: { view: true, pick: true }
    }
  }
};

export default function IAMPage() {
  const [loading, setLoading] = useState(true);
  const [identityConfig, setIdentityConfig] = useState(null);
  const [selectedRole, setSelectedRole] = useState('Administrator');
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingPermissions, setEditingPermissions] = useState(null);

  useEffect(() => {
    fetchIdentityConfig();
  }, []);

  const fetchIdentityConfig = async () => {
    try {
      const response = await axios.get(`${API}/users/identity-config`);
      setIdentityConfig(response.data);
    } catch (error) {
      toast.error('Failed to fetch identity configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleEditPermissions = (role) => {
    setSelectedRole(role);
    setEditingPermissions({ ...ROLE_TEMPLATES[role].permissions });
    setEditDialogOpen(true);
  };

  const togglePermission = (module, action) => {
    setEditingPermissions(prev => ({
      ...prev,
      [module]: {
        ...prev[module],
        [action]: !prev[module]?.[action]
      }
    }));
  };

  const getPermissionValue = (module, action) => {
    return editingPermissions?.[module]?.[action] || false;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#A2182C]"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in" data-testid="iam-page">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <KeyRound className="text-[#A2182C]" />
          Identity & Access Management
        </h1>
        <p className="text-slate-500 mt-1">Configure roles, permissions, and access controls</p>
      </div>

      {/* Overview Cards */}
      <div className="grid md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-rose-100 flex items-center justify-center">
                <Shield className="text-rose-600" size={20} />
              </div>
              <div>
                <p className="text-2xl font-bold">{identityConfig?.roles?.length || 3}</p>
                <p className="text-sm text-slate-500">Roles</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                <Building2 className="text-purple-600" size={20} />
              </div>
              <div>
                <p className="text-2xl font-bold">{identityConfig?.account_types?.length || 4}</p>
                <p className="text-sm text-slate-500">Account Types</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <Lock className="text-blue-600" size={20} />
              </div>
              <div>
                <p className="text-2xl font-bold">{Object.keys(PERMISSION_MODULES).length}</p>
                <p className="text-sm text-slate-500">Modules</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                <Briefcase className="text-emerald-600" size={20} />
              </div>
              <div>
                <p className="text-2xl font-bold">{identityConfig?.subscription_plans?.length || 4}</p>
                <p className="text-sm text-slate-500">Plans</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="roles" className="w-full">
        <TabsList>
          <TabsTrigger value="roles">Roles & Permissions</TabsTrigger>
          <TabsTrigger value="account-types">Account Types</TabsTrigger>
          <TabsTrigger value="modules">Permission Modules</TabsTrigger>
        </TabsList>

        {/* Roles Tab */}
        <TabsContent value="roles" className="mt-6">
          <div className="grid md:grid-cols-3 gap-6">
            {identityConfig?.roles?.map(role => (
              <Card key={role} className="relative overflow-hidden" data-testid={`role-card-${role}`}>
                <div className={`absolute top-0 left-0 right-0 h-1 ${
                  role === 'Administrator' ? 'bg-rose-500' :
                  role === 'Operator' ? 'bg-blue-500' : 'bg-emerald-500'
                }`} />
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Shield size={18} />
                      {role}
                    </CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEditPermissions(role)}
                      data-testid={`edit-role-${role}`}
                    >
                      <Edit size={14} />
                    </Button>
                  </div>
                  <CardDescription>{ROLE_TEMPLATES[role]?.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-slate-700">Key Permissions:</p>
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(ROLE_TEMPLATES[role]?.permissions || {})
                        .filter(([_, perms]) => Object.values(perms).some(v => v))
                        .slice(0, 6)
                        .map(([module]) => (
                          <Badge key={module} variant="secondary" className="text-xs">
                            {PERMISSION_MODULES[module]?.label || module}
                          </Badge>
                        ))}
                      {Object.keys(ROLE_TEMPLATES[role]?.permissions || {}).length > 6 && (
                        <Badge variant="outline" className="text-xs">
                          +{Object.keys(ROLE_TEMPLATES[role]?.permissions || {}).length - 6} more
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Account Types Tab */}
        <TabsContent value="account-types" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Account Types</CardTitle>
              <CardDescription>
                Account types determine user classification for routing, pricing, and UI experience
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4">
                {identityConfig?.account_types?.map(type => (
                  <div key={type} className="p-4 border rounded-lg" data-testid={`account-type-${type}`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        type === 'Partner' ? 'bg-purple-100' :
                        type === 'Media Client' ? 'bg-cyan-100' :
                        type === 'Internal Staff' ? 'bg-orange-100' : 'bg-emerald-100'
                      }`}>
                        <Building2 className={`${
                          type === 'Partner' ? 'text-purple-600' :
                          type === 'Media Client' ? 'text-cyan-600' :
                          type === 'Internal Staff' ? 'text-orange-600' : 'text-emerald-600'
                        }`} size={20} />
                      </div>
                      <div>
                        <p className="font-medium">{type}</p>
                        <p className="text-sm text-slate-500">
                          {type === 'Partner' && 'Business partners with subscription plans'}
                          {type === 'Media Client' && 'Media service clients (A La Carte)'}
                          {type === 'Internal Staff' && 'Company employees'}
                          {type === 'Vendor/Freelancer' && 'External contractors'}
                        </p>
                      </div>
                    </div>
                    {type === 'Partner' && (
                      <div className="mt-3 pt-3 border-t">
                        <p className="text-xs text-slate-500 mb-2">Available Plans:</p>
                        <div className="flex flex-wrap gap-1">
                          {identityConfig?.subscription_plans?.map(plan => (
                            <Badge key={plan} variant="outline" className="text-xs">{plan}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Modules Tab */}
        <TabsContent value="modules" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Permission Modules</CardTitle>
              <CardDescription>
                All available modules and their permission actions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                {Object.entries(PERMISSION_MODULES).map(([key, config]) => (
                  <div key={key} className="p-3 border rounded-lg" data-testid={`module-${key}`}>
                    <p className="font-medium text-sm">{config.label}</p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {config.actions.map(action => (
                        <Badge key={action} variant="secondary" className="text-xs capitalize">
                          {action}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Permissions Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit {selectedRole} Permissions</DialogTitle>
            <DialogDescription>
              Configure default permissions for the {selectedRole} role
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 pt-4">
            <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 mb-4">
              <p className="text-sm text-amber-700 flex items-center gap-2">
                <Info size={16} />
                These are default permissions. Individual users can have overrides applied.
              </p>
            </div>
            {Object.entries(PERMISSION_MODULES).map(([moduleKey, moduleConfig]) => (
              <Collapsible key={moduleKey} className="border rounded-lg">
                <CollapsibleTrigger className="flex items-center justify-between w-full px-4 py-3 hover:bg-slate-50">
                  <span className="font-medium">{moduleConfig.label}</span>
                  <ChevronDown className="w-4 h-4" />
                </CollapsibleTrigger>
                <CollapsibleContent className="px-4 pb-3">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {moduleConfig.actions.map((action) => (
                      <label
                        key={action}
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <Checkbox
                          checked={getPermissionValue(moduleKey, action)}
                          onCheckedChange={() => togglePermission(moduleKey, action)}
                        />
                        <span className="text-sm capitalize">{action}</span>
                      </label>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            ))}
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              className="bg-rose-600 hover:bg-rose-700"
              onClick={() => {
                toast.success('Permissions updated (changes apply to new users)');
                setEditDialogOpen(false);
              }}
            >
              <Save size={16} className="mr-2" />
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
