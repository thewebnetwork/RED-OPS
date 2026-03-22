import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Switch } from '../components/ui/switch';
import { Checkbox } from '../components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../components/ui/collapsible';
import { 
  Plus, 
  Search,
  Edit,
  Trash2,
  UserCheck,
  UserX,
  Shield,
  ChevronDown,
  Briefcase,
  Building2
} from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function Users() {
  const { t } = useTranslation();
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [specialties, setSpecialties] = useState([]);
  const [identityConfig, setIdentityConfig] = useState({ roles: [], account_types: [] });
  const [permissionModules, setPermissionModules] = useState({});
  const [defaultPermissions, setDefaultPermissions] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [hasFormChanges, setHasFormChanges] = useState(false);
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);
  const [activeTab, setActiveTab] = useState('basic');
  const [showPermissions, setShowPermissions] = useState(false);
  const initialFormRef = useRef(null);
  
  // Form state with new identity model
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'Standard User',
    account_type: 'Internal Staff',
    specialty_id: '',
    team_id: '',
    permission_overrides: null,
    force_password_change: false,
    force_otp_setup: false
  });
  
  // Inline creation states
  const [newSpecialty, setNewSpecialty] = useState('');
  const [showNewSpecialty, setShowNewSpecialty] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (initialFormRef.current) {
      const changed = JSON.stringify(formData) !== JSON.stringify(initialFormRef.current);
      setHasFormChanges(changed);
    }
  }, [formData]);

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
    if (!open && hasFormChanges) {
      setShowUnsavedWarning(true);
      return;
    }
    setDialogOpen(open);
    if (!open) {
      setHasFormChanges(false);
      initialFormRef.current = null;
      setActiveTab('basic');
      setShowPermissions(false);
    }
  };

  const confirmCloseDialog = () => {
    setShowUnsavedWarning(false);
    setDialogOpen(false);
    setHasFormChanges(false);
    initialFormRef.current = null;
  };

  const fetchData = async () => {
    try {
      const [usersRes, teamsRes, specialtiesRes, configRes, modulesRes] = await Promise.all([
        axios.get(`${API}/users`),
        axios.get(`${API}/teams`),
        axios.get(`${API}/specialties`),
        axios.get(`${API}/users/identity-config`),
        axios.get(`${API}/users/permissions/modules`).catch(() => ({ data: { modules: {}, default_permissions: {} } }))
      ]);
      setUsers(usersRes.data);
      setTeams(teamsRes.data);
      setSpecialties(specialtiesRes.data);
      setIdentityConfig(configRes.data);
      setPermissionModules(modulesRes.data.modules || {});
      setDefaultPermissions(modulesRes.data.default_permissions || {});
    } catch (error) {
      toast.error(t('errors.generic'));
    } finally {
      setLoading(false);
    }
  };

  const getRoleColor = (roleName) => {
    const colors = {
      'Administrator': { bg: '#dc262620', text: '#dc2626' },
      'Operator': { bg: '#2563eb20', text: '#2563eb' },
      'Standard User': { bg: '#16a34a20', text: '#16a34a' }
    };
    return colors[roleName] || { bg: '#e2e8f0', text: '#475569' };
  };

  const getAccountTypeColor = (accountType) => {
    const colors = {
      'Partner': { bg: '#8b5cf620', text: '#8b5cf6' },
      'Media Client': { bg: '#06b6d420', text: '#06b6d4' },
      'Internal Staff': { bg: '#f9731620', text: '#f97316' },
      'Vendor/Freelancer': { bg: '#10b98120', text: '#10b981' }
    };
    return colors[accountType] || { bg: '#e2e8f0', text: '#475569' };
  };

  const handleOpenDialog = (user = null) => {
    let initialData;
    if (user) {
      setEditingUser(user);
      initialData = {
        name: user.name,
        email: user.email,
        password: '',
        role: user.role,
        account_type: user.account_type || 'Internal Staff',
        specialty_id: user.specialty_id || '',
        team_id: user.team_id || '',
        permission_overrides: user.permission_overrides || null,
        force_password_change: user.force_password_change || false,
        force_otp_setup: user.force_otp_setup || false
      };
      setFormData(initialData);
      setShowPermissions(!!user.permission_overrides);
    } else {
      setEditingUser(null);
      initialData = { 
        name: '', 
        email: '', 
        password: '', 
        role: 'Standard User',
        account_type: 'Internal Staff',
        specialty_id: '',
        team_id: '',
        permission_overrides: null,
        force_password_change: false,
        force_otp_setup: false 
      };
      setFormData(initialData);
      setShowPermissions(false);
    }
    initialFormRef.current = initialData;
    setHasFormChanges(false);
    setActiveTab('basic');
    setDialogOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!formData.name || !formData.email || !formData.role || !formData.account_type) {
      toast.error('Please fill in all required fields (Name, Email, Role, Account Type)');
      return;
    }
    if (!formData.specialty_id) {
      toast.error('Specialty is required');
      return;
    }
    if (!editingUser && !formData.password) {
      toast.error('Password is required for new users');
      return;
    }
    try {
      const submitData = { ...formData };
      if (!submitData.team_id) submitData.team_id = null;
      
      if (!showPermissions) submitData.permission_overrides = null;
      
      if (editingUser) {
        if (!submitData.password) delete submitData.password;
        await axios.patch(`${API}/users/${editingUser.id}`, submitData);
        toast.success('User updated successfully');
      } else {
        await axios.post(`${API}/users`, submitData);
        toast.success('User created successfully');
      }
      setHasFormChanges(false);
      initialFormRef.current = null;
      setDialogOpen(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save user');
    }
  };

  const handleCreateSpecialty = async () => {
    if (!newSpecialty.trim()) return;
    try {
      const response = await axios.post(`${API}/specialties`, { name: newSpecialty.trim() });
      setSpecialties([...specialties, response.data].sort((a, b) => a.name.localeCompare(b.name)));
      setFormData({ ...formData, specialty_id: response.data.id });
      setNewSpecialty('');
      setShowNewSpecialty(false);
      toast.success('Specialty created');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create specialty');
    }
  };

  const handleToggleActive = async (userId, currentActive) => {
    try {
      await axios.patch(`${API}/users/${userId}`, { active: !currentActive });
      toast.success('User status updated');
      fetchData();
    } catch (error) {
      toast.error('Failed to update user');
    }
  };

  const handleDelete = async (userId) => {
    toast('Delete this user? This cannot be undone.', {
      action: {
        label: 'Delete',
        onClick: async () => {
          try {
            await axios.delete(`${API}/users/${userId}`);
            toast.success('User deleted');
            fetchData();
          } catch (error) {
            toast.error(error.response?.data?.detail || 'Failed to delete user');
          }
        },
      },
      cancel: { label: 'Cancel' },
    });
  };

  const togglePermission = (module, action) => {
    const current = formData.permission_overrides || {};
    const modulePerms = current[module] || {};
    const newModulePerms = { ...modulePerms, [action]: !modulePerms[action] };
    setFormData({
      ...formData,
      permission_overrides: { ...current, [module]: newModulePerms }
    });
  };

  const getPermissionValue = (module, action) => {
    if (formData.permission_overrides?.[module]?.[action] !== undefined) {
      return formData.permission_overrides[module][action];
    }
    // Get from role defaults
    const roleDefaults = defaultPermissions[formData.role];
    return roleDefaults?.[module]?.[action] || false;
  };

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    (u.specialty_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (u.account_type || '').toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#A2182C]"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in" data-testid="users-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--tx-1)', margin: 0 }}>{t('users.title')}</h1>
          <p style={{ fontSize: 13, color: 'var(--tx-3)', marginTop: 4 }}>{users.length} users</p>
        </div>
        <Button 
          className="bg-rose-600 hover:bg-rose-700"
          onClick={() => handleOpenDialog()}
          data-testid="add-user-btn"
        >
          <Plus size={18} className="mr-2" />
          Add User
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--tx-3)', pointerEvents: 'none' }} size={13} />
        <Input
          placeholder="Search users by name, email, specialty, or account type..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
          data-testid="user-search"
        />
      </div>

      {/* Users Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)' }}>
                <tr>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 10.5, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '.06em' }}>User</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 10.5, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Role</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 10.5, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Account Type</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 10.5, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Specialty</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 10.5, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Team</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 10.5, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Status</th>
                  <th style={{ padding: '10px 16px', textAlign: 'right', fontSize: 10.5, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map((user) => (
                  <tr key={user.id} style={{ cursor: 'default' }} data-testid={`user-row-${user.id}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 font-medium text-sm">
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--tx-1)' }}>{user.name}</p>
                          <p style={{ fontSize: 12, color: 'var(--tx-3)' }}>{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge style={getRoleColor(user.role)}>{user.role}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      {user.account_type ? (
                        <Badge style={getAccountTypeColor(user.account_type)}>
                          <Building2 size={12} className="mr-1" />
                          {user.account_type}
                        </Badge>
                      ) : (
                        <span style={{ fontSize: 13, color: 'var(--tx-3)' }}>—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {user.specialty_name ? (
                        <span style={{ fontSize: 13, color: 'var(--tx-2)', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Briefcase size={14}style={{ color: 'var(--tx-3)' }} />
                          {user.specialty_name}
                        </span>
                      ) : (
                        <span style={{ fontSize: 13, color: 'var(--tx-3)' }}>—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span style={{ fontSize: 13, color: 'var(--tx-2)' }}>{user.team_name || '—'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={user.active ? 'success' : 'secondary'}>
                        {user.active ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => handleOpenDialog(user)} data-testid={`edit-user-${user.id}`}>
                          <Edit size={16} />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleToggleActive(user.id, user.active)}
                        >
                          {user.active ? <UserX size={16} /> : <UserCheck size={16} />}
                        </Button>
                        {user.id !== currentUser?.id && (
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(user.id)}>
                            <Trash2 size={16} className="text-red-500" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* User Dialog */}
      <Dialog open={dialogOpen} onOpenChange={handleDialogClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingUser ? 'Edit User' : 'Add User'}</DialogTitle>
            <DialogDescription>
              {editingUser ? 'Update user information and permissions' : 'Create a new user account'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-6">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="basic">Basic Info</TabsTrigger>
                <TabsTrigger value="permissions">Access Controls</TabsTrigger>
              </TabsList>

              {/* Basic Info Tab */}
              <TabsContent value="basic" className="space-y-4 mt-4">
                {/* Name & Email */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Full name"
                      data-testid="user-name-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="email@example.com"
                      data-testid="user-email-input"
                    />
                  </div>
                </div>

                {/* Password & Role */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="password">{editingUser ? 'New Password' : 'Password *'}</Label>
                    <Input
                      id="password"
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder={editingUser ? 'Leave blank to keep current' : 'Enter password'}
                      data-testid="user-password-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="role">Role *</Label>
                    <Select
                      value={formData.role}
                      onValueChange={(v) => setFormData({ ...formData, role: v })}
                    >
                      <SelectTrigger data-testid="user-role-select">
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        {identityConfig.roles.map((role) => (
                          <SelectItem key={role} value={role}>{role}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Account Type (required) */}
                <div className="space-y-2">
                  <Label htmlFor="account_type">Account Type *</Label>
                  <Select
                    value={formData.account_type}
                    onValueChange={(v) => {
                      setFormData({ 
                        ...formData, 
                        account_type: v
                      });
                    }}
                  >
                    <SelectTrigger data-testid="user-account-type-select">
                      <SelectValue placeholder="Select account type" />
                    </SelectTrigger>
                    <SelectContent>
                      {identityConfig.account_types.map((type) => (
                        <SelectItem key={type} value={type}>{type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p style={{ fontSize: 11, color: 'var(--tx-3)' }}>
                    Determines routing, pricing logic, and UI experience
                  </p>
                </div>

                {/* Specialty (required) with inline creation */}
                <div className="space-y-2">
                  <Label htmlFor="specialty">Specialty * (what the user does)</Label>
                  {showNewSpecialty ? (
                    <div className="flex gap-2">
                      <Input
                        value={newSpecialty}
                        onChange={(e) => setNewSpecialty(e.target.value)}
                        placeholder="New specialty name"
                        autoFocus
                      />
                      <Button type="button" size="sm" onClick={handleCreateSpecialty}>Add</Button>
                      <Button type="button" variant="ghost" size="sm" onClick={() => setShowNewSpecialty(false)}>Cancel</Button>
                    </div>
                  ) : (
                    <Select
                      value={formData.specialty_id || '__none__'}
                      onValueChange={(v) => {
                        if (v === '__new__') {
                          setShowNewSpecialty(true);
                        } else {
                          setFormData({ ...formData, specialty_id: v === '__none__' ? '' : v });
                        }
                      }}
                    >
                      <SelectTrigger data-testid="user-specialty-select">
                        <SelectValue placeholder="Select specialty (required)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__" disabled>Select a specialty...</SelectItem>
                        {specialties.map((s) => (
                          <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                        ))}
                        <SelectItem value="__new__" className="text-blue-600 font-medium">
                          <Plus size={14} className="inline mr-1" /> Create new specialty
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {/* Team (optional) */}
                <div className="space-y-2">
                  <Label htmlFor="team">Team (optional)</Label>
                  <Select
                    value={formData.team_id || '__none__'}
                    onValueChange={(v) => setFormData({ ...formData, team_id: v === '__none__' ? '' : v })}
                  >
                    <SelectTrigger data-testid="user-team-select">
                      <SelectValue placeholder="Select team (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">No team</SelectItem>
                      {teams.map((team) => (
                        <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Security Options */}
                <div className="border-t pt-4 space-y-3">
                  <h4 style={{ fontSize: 13, fontWeight: 600, color: 'var(--tx-2)' }}>Security Options</h4>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Force Password Change</p>
                      <p style={{ fontSize: 11, color: 'var(--tx-3)' }}>User must change password on next login</p>
                    </div>
                    <Switch
                      checked={formData.force_password_change}
                      onCheckedChange={(v) => setFormData({ ...formData, force_password_change: v })}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Force OTP Setup</p>
                      <p style={{ fontSize: 11, color: 'var(--tx-3)' }}>User must set up two-factor authentication</p>
                    </div>
                    <Switch
                      checked={formData.force_otp_setup}
                      onCheckedChange={(v) => setFormData({ ...formData, force_otp_setup: v })}
                    />
                  </div>
                </div>
              </TabsContent>

              {/* Permissions Tab (Access Controls) */}
              <TabsContent value="permissions" className="space-y-4 mt-4">
                <div className="flex items-center justify-between pb-4 border-b">
                  <div>
                    <p className="font-medium">Per-User Permission Overrides</p>
                    <p style={{ fontSize: 12, color: 'var(--tx-3)' }}>
                      Override default permissions from the "{formData.role}" role
                    </p>
                  </div>
                  <Switch
                    checked={showPermissions}
                    onCheckedChange={setShowPermissions}
                    data-testid="enable-permissions-toggle"
                  />
                </div>

                {showPermissions && (
                  <div className="space-y-2">
                    <p className="text-sm text-amber-600 bg-amber-50 p-3 rounded-lg">
                      Checked = granted, Unchecked = denied. These overrides will take precedence over role defaults.
                    </p>
                    {Object.entries(permissionModules).map(([moduleKey, moduleConfig]) => (
                      <Collapsible key={moduleKey} className="border rounded-lg">
                        <CollapsibleTrigger style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '12px 16px' }}>
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
                                  data-testid={`perm-${moduleKey}-${action}`}
                                />
                                <span className="text-sm capitalize">{action}</span>
                              </label>
                            ))}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    ))}
                  </div>
                )}

                {!showPermissions && (
                  <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--tx-3)' }}>
                    <Shield style={{ color: 'var(--tx-3)', margin: '0 auto 12px' }} />
                    <p>Using default permissions from "{formData.role}" role</p>
                    <p className="text-sm mt-1">Enable overrides to customize for this user</p>
                  </div>
                )}
              </TabsContent>
            </Tabs>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => handleDialogClose(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-rose-600 hover:bg-rose-700" data-testid="save-user-btn">
                {editingUser ? 'Save Changes' : 'Create User'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Unsaved Changes Warning */}
      <AlertDialog open={showUnsavedWarning} onOpenChange={setShowUnsavedWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. Are you sure you want to close without saving?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmCloseDialog}>Discard Changes</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
