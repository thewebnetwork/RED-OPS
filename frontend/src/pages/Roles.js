import { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Switch } from '../components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../components/ui/tabs';
import { 
  Plus, 
  Edit,
  Trash2,
  Users,
  Shield,
  Briefcase,
  Settings,
  Video,
  Camera,
  Film,
  Plane,
  Home,
  Paintbrush,
  Zap,
  Droplet,
  Thermometer,
  TreeDeciduous,
  Bug,
  Key,
  Calculator,
  Map,
  Palette,
  Share2,
  PenTool,
  Search,
  Code,
  Printer
} from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const iconOptions = [
  { value: 'shield', label: 'Shield', icon: Shield },
  { value: 'user', label: 'User', icon: Users },
  { value: 'video', label: 'Video', icon: Video },
  { value: 'camera', label: 'Camera', icon: Camera },
  { value: 'film', label: 'Film', icon: Film },
  { value: 'plane', label: 'Plane/Drone', icon: Plane },
  { value: 'home', label: 'Home', icon: Home },
  { value: 'paintbrush', label: 'Paintbrush', icon: Paintbrush },
  { value: 'zap', label: 'Electricity', icon: Zap },
  { value: 'droplet', label: 'Water/Plumbing', icon: Droplet },
  { value: 'thermometer', label: 'HVAC', icon: Thermometer },
  { value: 'tree', label: 'Landscaping', icon: TreeDeciduous },
  { value: 'bug', label: 'Pest Control', icon: Bug },
  { value: 'key', label: 'Key/Locksmith', icon: Key },
  { value: 'calculator', label: 'Calculator', icon: Calculator },
  { value: 'map', label: 'Map/Survey', icon: Map },
  { value: 'palette', label: 'Design', icon: Palette },
  { value: 'share-2', label: 'Social Media', icon: Share2 },
  { value: 'pen-tool', label: 'Writing', icon: PenTool },
  { value: 'search', label: 'Search/SEO', icon: Search },
  { value: 'code', label: 'Code/Web', icon: Code },
  { value: 'printer', label: 'Print', icon: Printer },
  { value: 'briefcase', label: 'Briefcase', icon: Briefcase },
  { value: 'settings', label: 'Settings', icon: Settings },
];

const getIcon = (iconName) => {
  const found = iconOptions.find(i => i.value === iconName);
  return found ? found.icon : Briefcase;
};

const colorOptions = [
  { value: '#DC2626', label: 'Red' },
  { value: '#F59E0B', label: 'Amber' },
  { value: '#EAB308', label: 'Yellow' },
  { value: '#22C55E', label: 'Green' },
  { value: '#10B981', label: 'Emerald' },
  { value: '#06B6D4', label: 'Cyan' },
  { value: '#3B82F6', label: 'Blue' },
  { value: '#6366F1', label: 'Indigo' },
  { value: '#8B5CF6', label: 'Violet' },
  { value: '#A855F7', label: 'Purple' },
  { value: '#EC4899', label: 'Pink' },
  { value: '#78716C', label: 'Stone' },
];

export default function Roles() {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('service_provider');
  
  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    display_name: '',
    description: '',
    role_type: 'service_provider',
    icon: 'briefcase',
    color: '#3B82F6',
    can_pick_orders: true,
    can_create_orders: false
  });

  useEffect(() => {
    fetchRoles();
  }, []);

  const fetchRoles = async () => {
    try {
      const res = await axios.get(`${API}/roles?active_only=false`);
      setRoles(res.data);
    } catch (error) {
      toast.error('Failed to load roles');
    } finally {
      setLoading(false);
    }
  };

  const openDialog = (role = null) => {
    setEditingRole(role);
    
    if (role) {
      setFormData({
        name: role.name,
        display_name: role.display_name,
        description: role.description || '',
        role_type: role.role_type,
        icon: role.icon || 'briefcase',
        color: role.color || '#3B82F6',
        can_pick_orders: role.can_pick_orders,
        can_create_orders: role.can_create_orders
      });
    } else {
      setFormData({
        name: '',
        display_name: '',
        description: '',
        role_type: 'service_provider',
        icon: 'briefcase',
        color: '#3B82F6',
        can_pick_orders: true,
        can_create_orders: false
      });
    }
    setDialogOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.display_name) {
      toast.error('Name and Display Name are required');
      return;
    }

    // Generate name from display_name if creating new
    const payload = {
      ...formData,
      name: editingRole ? formData.name : formData.display_name.replace(/\s+/g, ''),
    };

    try {
      if (editingRole) {
        await axios.patch(`${API}/roles/${editingRole.id}`, {
          display_name: payload.display_name,
          description: payload.description || null,
          icon: payload.icon,
          color: payload.color,
          can_pick_orders: payload.can_pick_orders,
          can_create_orders: payload.can_create_orders
        });
        toast.success('Role updated');
      } else {
        await axios.post(`${API}/roles`, payload);
        toast.success('Role created');
      }
      fetchRoles();
      setDialogOpen(false);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Operation failed');
    }
  };

  const handleDelete = async (roleId) => {
    if (!window.confirm('Are you sure you want to deactivate this role?')) return;
    
    try {
      await axios.delete(`${API}/roles/${roleId}`);
      fetchRoles();
      toast.success('Role deactivated');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete role');
    }
  };

  const filterRolesByType = (type) => {
    return roles.filter(r => r.role_type === type && r.active);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-rose-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  const RoleCard = ({ role }) => {
    const Icon = getIcon(role.icon);
    return (
      <div 
        className="flex items-center gap-4 p-4 bg-white rounded-xl border border-slate-200 hover:shadow-md transition-shadow"
        data-testid={`role-card-${role.name}`}
      >
        <div 
          className="w-12 h-12 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: `${role.color}20` }}
        >
          <Icon size={24} style={{ color: role.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-slate-900">{role.display_name}</p>
            {role.role_type === 'system' && (
              <Badge variant="outline" className="text-xs">System</Badge>
            )}
          </div>
          {role.description && (
            <p className="text-sm text-slate-500 truncate">{role.description}</p>
          )}
          <div className="flex gap-2 mt-1">
            {role.can_pick_orders && (
              <Badge className="bg-green-100 text-green-700 text-xs">Can Pick Orders</Badge>
            )}
            {role.can_create_orders && (
              <Badge className="bg-blue-100 text-blue-700 text-xs">Can Create</Badge>
            )}
          </div>
        </div>
        {role.role_type !== 'system' && (
          <div className="flex gap-1">
            <Button 
              variant="ghost" 
              size="icon"
              className="h-8 w-8"
              onClick={() => openDialog(role)}
            >
              <Edit size={16} />
            </Button>
            <Button 
              variant="ghost" 
              size="icon"
              className="h-8 w-8 text-red-500"
              onClick={() => handleDelete(role.id)}
            >
              <Trash2 size={16} />
            </Button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in" data-testid="roles-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Roles</h1>
          <p className="text-slate-500 mt-1">Manage service provider and custom roles</p>
        </div>
        <Button 
          className="bg-rose-600 hover:bg-rose-700"
          onClick={() => openDialog()}
          data-testid="add-role-btn"
        >
          <Plus size={18} className="mr-2" />
          Add Role
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-rose-100 rounded-lg flex items-center justify-center">
                <Shield size={20} className="text-rose-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{roles.filter(r => r.active).length}</p>
                <p className="text-sm text-slate-500">Total Roles</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Briefcase size={20} className="text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{filterRolesByType('service_provider').length}</p>
                <p className="text-sm text-slate-500">Service Providers</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <Users size={20} className="text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{roles.filter(r => r.can_pick_orders && r.active).length}</p>
                <p className="text-sm text-slate-500">Can Pick Orders</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                <Settings size={20} className="text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{filterRolesByType('custom').length}</p>
                <p className="text-sm text-slate-500">Custom Roles</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Roles by Type */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="service_provider">Service Providers ({filterRolesByType('service_provider').length})</TabsTrigger>
          <TabsTrigger value="system">System Roles ({filterRolesByType('system').length})</TabsTrigger>
          <TabsTrigger value="custom">Custom ({filterRolesByType('custom').length})</TabsTrigger>
        </TabsList>
        
        <TabsContent value="service_provider" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filterRolesByType('service_provider').map(role => (
              <RoleCard key={role.id} role={role} />
            ))}
          </div>
          {filterRolesByType('service_provider').length === 0 && (
            <div className="text-center py-12 text-slate-500">
              No service provider roles found
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="system" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filterRolesByType('system').map(role => (
              <RoleCard key={role.id} role={role} />
            ))}
          </div>
        </TabsContent>
        
        <TabsContent value="custom" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filterRolesByType('custom').map(role => (
              <RoleCard key={role.id} role={role} />
            ))}
          </div>
          {filterRolesByType('custom').length === 0 && (
            <div className="text-center py-12 text-slate-500">
              <p>No custom roles yet</p>
              <Button 
                variant="outline" 
                className="mt-4"
                onClick={() => openDialog()}
              >
                <Plus size={16} className="mr-2" />
                Create Custom Role
              </Button>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingRole ? 'Edit Role' : 'Create New Role'}</DialogTitle>
            <DialogDescription>
              {editingRole 
                ? 'Update role settings and permissions' 
                : 'Create a new service provider or custom role'
              }
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Display Name *</Label>
                <Input
                  value={formData.display_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, display_name: e.target.value }))}
                  placeholder="e.g., General Contractor"
                  className="mt-1.5"
                  data-testid="role-display-name-input"
                />
              </div>
              
              <div className="col-span-2">
                <Label>Description</Label>
                <Input
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Brief description of this role"
                  className="mt-1.5"
                />
              </div>

              {!editingRole && (
                <div className="col-span-2">
                  <Label>Role Type</Label>
                  <Select 
                    value={formData.role_type} 
                    onValueChange={(v) => setFormData(prev => ({ ...prev, role_type: v }))}
                  >
                    <SelectTrigger className="mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="service_provider">Service Provider</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div>
                <Label>Icon</Label>
                <Select 
                  value={formData.icon} 
                  onValueChange={(v) => setFormData(prev => ({ ...prev, icon: v }))}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-64">
                    {iconOptions.map(opt => {
                      const Icon = opt.icon;
                      return (
                        <SelectItem key={opt.value} value={opt.value}>
                          <div className="flex items-center gap-2">
                            <Icon size={16} />
                            {opt.label}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Color</Label>
                <Select 
                  value={formData.color} 
                  onValueChange={(v) => setFormData(prev => ({ ...prev, color: v }))}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {colorOptions.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-4 h-4 rounded-full" 
                            style={{ backgroundColor: opt.value }} 
                          />
                          {opt.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Permissions */}
            <div className="space-y-3 pt-2">
              <p className="text-sm font-medium text-slate-700">Permissions</p>
              
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div>
                  <p className="font-medium text-sm">Can Pick Orders</p>
                  <p className="text-xs text-slate-500">This role can claim and work on orders from the pool</p>
                </div>
                <Switch
                  checked={formData.can_pick_orders}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, can_pick_orders: checked }))}
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div>
                  <p className="font-medium text-sm">Can Create Orders</p>
                  <p className="text-xs text-slate-500">This role can submit new orders/requests</p>
                </div>
                <Switch
                  checked={formData.can_create_orders}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, can_create_orders: checked }))}
                />
              </div>
            </div>

            <Button type="submit" className="w-full bg-rose-600 hover:bg-rose-700" data-testid="save-role-btn">
              {editingRole ? 'Update Role' : 'Create Role'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
