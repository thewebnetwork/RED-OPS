import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Checkbox } from '../components/ui/checkbox';
import { Switch } from '../components/ui/switch';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../components/ui/collapsible';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { SearchableSelect, SearchableMultiSelect } from '../components/ui/searchable-select';
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
  KeyRound, Shield, Users, ChevronDown, Edit, Save, Info, Lock, Building2, Briefcase,
  Plus, Search, Trash2, UserCheck, UserX, UsersRound, Eye, EyeOff, RefreshCw, X
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Permission modules
const PERMISSION_MODULES = {
  dashboard: { label: 'Dashboard', actions: ['view'] },
  orders: { label: 'Orders/Tickets', actions: ['view', 'create', 'edit', 'delete', 'export', 'pick', 'assign'] },
  users: { label: 'Users', actions: ['view', 'create', 'edit', 'delete'] },
  teams: { label: 'Teams', actions: ['view', 'create', 'edit', 'delete'] },
  settings: { label: 'Settings', actions: ['view', 'edit'] },
  reports: { label: 'Reports', actions: ['view', 'export'] },
};

// Role templates
const ROLE_TEMPLATES = {
  'Administrator': {
    description: 'Full system control. Can manage all modules, users, and settings.',
    permissions: Object.fromEntries(
      Object.entries(PERMISSION_MODULES).map(([key, config]) => [
        key, Object.fromEntries(config.actions.map(a => [a, true]))
      ])
    )
  },
  'Operator': {
    description: 'Internal staff operations. Can manage tickets/queues but not system governance.',
    permissions: {
      dashboard: { view: true },
      orders: { view: true, create: true, edit: true, pick: true, assign: true },
      teams: { view: true, create: true, edit: true },
      reports: { view: true, export: true },
    }
  },
  'Standard User': {
    description: 'Basic user actions. Can submit requests and view own data.',
    permissions: {
      dashboard: { view: true },
      orders: { view: true, create: true },
      reports: { view: true },
    }
  }
};

export default function IAMPage() {
  const { t } = useTranslation();
  const { user: currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('users');
  const [identityConfig, setIdentityConfig] = useState(null);
  
  // Users state
  const [users, setUsers] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [dashboardTemplates, setDashboardTemplates] = useState([]);
  const [userForm, setUserForm] = useState({
    name: '', email: '', password: '', role: 'Standard User', 
    account_type: 'Internal Staff', specialty_ids: [], primary_specialty_id: '', team_id: '',
    dashboard_type_id: '', force_password_change: true, force_otp_setup: true, send_welcome_email: true, can_pick: true,
    pool_access: 'both'  // none, pool1, pool2, both
  });

  // Generate a random password
  const generatePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  };

  // Teams state
  const [teams, setTeams] = useState([]);
  const [teamSearch, setTeamSearch] = useState('');
  const [teamDialogOpen, setTeamDialogOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState(null);
  const [teamForm, setTeamForm] = useState({ name: '', description: '', related_specialty_ids: [] });

  // Specialties state
  const [specialties, setSpecialties] = useState([]);
  const [specialtySearch, setSpecialtySearch] = useState('');
  const [specialtyDialogOpen, setSpecialtyDialogOpen] = useState(false);
  const [editingSpecialty, setEditingSpecialty] = useState(null);
  const [specialtyForm, setSpecialtyForm] = useState({ name: '', description: '', color: '#6366F1' });
  const [userSpecialtySearch, setUserSpecialtySearch] = useState(''); // Search for user form specialty selection

  // Roles state
  const [roles, setRoles] = useState([]);
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [roleForm, setRoleForm] = useState({ 
    name: '', 
    description: '', 
    color: '#6366F1',
    permissions: {}
  });

  // Account Types state
  const [accountTypes, setAccountTypes] = useState([]);
  const [accountTypeDialogOpen, setAccountTypeDialogOpen] = useState(false);
  const [editingAccountType, setEditingAccountType] = useState(null);
  const [accountTypeForm, setAccountTypeForm] = useState({ name: '', description: '', color: '#6366F1', requires_subscription: false });

  // Delete confirmation
  const [deleteDialog, setDeleteDialog] = useState({ open: false, type: '', item: null });

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    try {
      const [usersRes, teamsRes, specialtiesRes, configRes, rolesRes, accountTypesRes, dashboardsRes] = await Promise.all([
        axios.get(`${API}/users`),
        axios.get(`${API}/teams`),
        axios.get(`${API}/specialties`),
        axios.get(`${API}/users/identity-config`),
        axios.get(`${API}/iam/roles`).catch(() => ({ data: [] })),
        axios.get(`${API}/iam/account-types`).catch(() => ({ data: [] })),
        axios.get(`${API}/dashboards/list`).catch(() => ({ data: { dashboards: [] } }))
      ]);
      setUsers(usersRes.data);
      setTeams(teamsRes.data);
      setSpecialties(specialtiesRes.data);
      setIdentityConfig(configRes.data);
      setRoles(rolesRes.data);
      setAccountTypes(accountTypesRes.data);
      setDashboardTemplates(dashboardsRes.data.dashboards || []);
    } catch (error) {
      toast.error('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  // =============== USER HANDLERS ===============
  const openUserDialog = (user = null) => {
    if (user) {
      setEditingUser(user);
      setUserForm({
        name: user.name, email: user.email, password: '',
        role: user.role, account_type: user.account_type || 'Internal Staff',
        // Multi-specialty support
        specialty_ids: user.specialty_ids || (user.specialty_id ? [user.specialty_id] : []),
        primary_specialty_id: user.primary_specialty_id || user.specialty_id || '',
        team_id: user.team_id || '',
        dashboard_type_id: user.dashboard_type_id || '',
        force_password_change: user.force_password_change || false,
        force_otp_setup: user.force_otp_setup || false,
        send_welcome_email: false,
        can_pick: user.can_pick !== false,  // Default to true if not set
        pool_access: user.pool_access || 'both'  // Default to both if not set
      });
    } else {
      setEditingUser(null);
      // Generate temp password for new users
      const tempPassword = generatePassword();
      setUserForm({ 
        name: '', email: '', password: tempPassword, role: 'Standard User', 
        account_type: 'Internal Staff', specialty_ids: [], primary_specialty_id: '', team_id: '', 
        dashboard_type_id: '', force_password_change: true, force_otp_setup: true,
        send_welcome_email: true, can_pick: true, pool_access: 'both'
      });
    }
    setUserSpecialtySearch(''); // Reset search when opening dialog
    setUserDialogOpen(true);
  };

  const saveUser = async () => {
    if (!userForm.name || !userForm.email) { toast.error('Name and email required'); return; }
    if (!editingUser && !userForm.password) { toast.error('Password required for new users'); return; }
    
    // Specialty validation - only required for account types that can pick/execute work
    // Media Clients are requesters, they don't need specialties
    const requiresSpecialty = userForm.account_type !== 'Media Client';
    if (requiresSpecialty && (!userForm.specialty_ids || userForm.specialty_ids.length === 0)) { 
      toast.error('At least one specialty is required for this account type'); 
      return; 
    }
    
    if (!userForm.dashboard_type_id) { toast.error('Dashboard type is required'); return; }

    try {
      const data = { 
        ...userForm, 
        team_id: userForm.team_id || null, 
        dashboard_type_id: userForm.dashboard_type_id || null,
        send_welcome_email: !editingUser ? userForm.send_welcome_email : false,
        // Ensure primary_specialty_id is set (only if specialties selected)
        primary_specialty_id: userForm.specialty_ids.length > 0 
          ? (userForm.primary_specialty_id || userForm.specialty_ids[0]) 
          : null,
        // Ensure specialty_ids is always an array
        specialty_ids: userForm.specialty_ids || [],
        // Pool access - only relevant if can_pick is true
        pool_access: userForm.can_pick ? userForm.pool_access : 'none'
      };
      if (editingUser) {
        if (!data.password) delete data.password;
        delete data.send_welcome_email;
        await axios.patch(`${API}/users/${editingUser.id}`, data);
        toast.success('User updated');
      } else {
        await axios.post(`${API}/users`, data);
        toast.success('User created' + (data.send_welcome_email ? ' - Welcome email sent' : ''));
      }
      setUserDialogOpen(false);
      fetchAllData();
    } catch (error) {
      const detail = error.response?.data?.detail;
      if (Array.isArray(detail)) {
        // Handle Pydantic validation errors (array of error objects)
        const messages = detail.map(e => e.msg || e.message || 'Validation error').join(', ');
        toast.error(messages);
      } else {
        toast.error(detail || 'Failed to save user');
      }
    }
  };

  const toggleUserActive = async (userId, currentActive) => {
    try {
      await axios.patch(`${API}/users/${userId}`, { active: !currentActive });
      toast.success('User status updated');
      fetchAllData();
    } catch (error) {
      toast.error('Failed to update user');
    }
  };

  // =============== TEAM HANDLERS ===============
  const openTeamDialog = (team = null) => {
    if (team) {
      setEditingTeam(team);
      setTeamForm({ 
        name: team.name, 
        description: team.description || '',
        related_specialty_ids: team.related_specialty_ids || []
      });
    } else {
      setEditingTeam(null);
      setTeamForm({ name: '', description: '', related_specialty_ids: [] });
    }
    setTeamDialogOpen(true);
  };

  const saveTeam = async () => {
    if (!teamForm.name) { toast.error('Team name required'); return; }
    try {
      const data = {
        name: teamForm.name,
        description: teamForm.description || null,
        related_specialty_ids: teamForm.related_specialty_ids || []
      };
      if (editingTeam) {
        await axios.patch(`${API}/teams/${editingTeam.id}`, data);
        toast.success('Team updated');
      } else {
        await axios.post(`${API}/teams`, data);
        toast.success('Team created');
      }
      setTeamDialogOpen(false);
      fetchAllData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save team');
    }
  };

  // =============== SPECIALTY HANDLERS ===============
  const openSpecialtyDialog = (specialty = null) => {
    if (specialty) {
      setEditingSpecialty(specialty);
      setSpecialtyForm({ name: specialty.name, description: specialty.description || '', color: specialty.color || '#6366F1' });
    } else {
      setEditingSpecialty(null);
      setSpecialtyForm({ name: '', description: '', color: '#6366F1' });
    }
    setSpecialtyDialogOpen(true);
  };

  const saveSpecialty = async () => {
    if (!specialtyForm.name) { toast.error('Specialty name required'); return; }
    try {
      if (editingSpecialty) {
        await axios.patch(`${API}/specialties/${editingSpecialty.id}`, specialtyForm);
        toast.success('Specialty updated');
      } else {
        await axios.post(`${API}/specialties`, specialtyForm);
        toast.success('Specialty created');
      }
      setSpecialtyDialogOpen(false);
      fetchAllData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save specialty');
    }
  };

  // =============== ROLE HANDLERS ===============
  const openRoleDialog = (role = null) => {
    if (role) {
      setEditingRole(role);
      // Load existing permissions or use template defaults
      const existingPermissions = role.permissions || ROLE_TEMPLATES[role.name]?.permissions || {};
      setRoleForm({ 
        name: role.name, 
        description: role.description || '', 
        color: role.color || '#6366F1',
        permissions: JSON.parse(JSON.stringify(existingPermissions)) // Deep clone
      });
    } else {
      setEditingRole(null);
      setRoleForm({ name: '', description: '', color: '#6366F1', permissions: {} });
    }
    setRoleDialogOpen(true);
  };
  
  const togglePermission = (module, action) => {
    setRoleForm(prev => {
      // Deep clone all permissions to ensure React detects the change
      const newPermissions = JSON.parse(JSON.stringify(prev.permissions || {}));
      if (!newPermissions[module]) {
        newPermissions[module] = {};
      }
      newPermissions[module][action] = !newPermissions[module][action];
      return { ...prev, permissions: newPermissions };
    });
  };
  
  const toggleModuleAll = (module, actions) => {
    setRoleForm(prev => {
      // Deep clone all permissions to ensure React detects the change
      const newPermissions = JSON.parse(JSON.stringify(prev.permissions || {}));
      const currentModule = newPermissions[module] || {};
      const allEnabled = actions.every(a => currentModule[a]);
      
      newPermissions[module] = {};
      actions.forEach(action => {
        newPermissions[module][action] = !allEnabled;
      });
      return { ...prev, permissions: newPermissions };
    });
  };

  const saveRole = async () => {
    if (!roleForm.name) { toast.error('Role name required'); return; }
    try {
      if (editingRole) {
        await axios.patch(`${API}/iam/roles/${editingRole.id}`, roleForm);
        toast.success('Role updated');
      } else {
        await axios.post(`${API}/iam/roles`, roleForm);
        toast.success('Role created');
      }
      setRoleDialogOpen(false);
      fetchAllData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save role');
    }
  };

  // =============== ACCOUNT TYPE HANDLERS ===============
  const openAccountTypeDialog = (at = null) => {
    if (at) {
      setEditingAccountType(at);
      setAccountTypeForm({ name: at.name, description: at.description || '', color: at.color || '#6366F1', requires_subscription: at.requires_subscription || false });
    } else {
      setEditingAccountType(null);
      setAccountTypeForm({ name: '', description: '', color: '#6366F1', requires_subscription: false });
    }
    setAccountTypeDialogOpen(true);
  };

  const saveAccountType = async () => {
    if (!accountTypeForm.name) { toast.error('Account type name required'); return; }
    try {
      if (editingAccountType) {
        await axios.patch(`${API}/iam/account-types/${editingAccountType.id}`, accountTypeForm);
        toast.success('Account type updated');
      } else {
        await axios.post(`${API}/iam/account-types`, accountTypeForm);
        toast.success('Account type created');
      }
      setAccountTypeDialogOpen(false);
      fetchAllData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save account type');
    }
  };

  // =============== DELETE HANDLER ===============
  const confirmDelete = async () => {
    const { type, item } = deleteDialog;
    try {
      if (type === 'user') await axios.delete(`${API}/users/${item.id}`);
      else if (type === 'team') await axios.delete(`${API}/teams/${item.id}`);
      else if (type === 'specialty') await axios.delete(`${API}/specialties/${item.id}`);
      else if (type === 'role') await axios.delete(`${API}/iam/roles/${item.id}`);
      else if (type === 'accountType') await axios.delete(`${API}/iam/account-types/${item.id}`);
      toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} deleted`);
      setDeleteDialog({ open: false, type: '', item: null });
      fetchAllData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete');
    }
  };

  const getRoleColor = (role) => {
    const colors = { 'Administrator': 'bg-rose-100 text-rose-700', 'Operator': 'bg-blue-100 text-blue-700', 'Standard User': 'bg-emerald-100 text-emerald-700' };
    return colors[role] || 'bg-slate-100 text-slate-700';
  };

  const getAccountTypeColor = (type) => {
    const colors = { 'Partner': 'bg-purple-100 text-purple-700', 'Media Client': 'bg-cyan-100 text-cyan-700', 'Internal Staff': 'bg-orange-100 text-orange-700', 'Vendor/Freelancer': 'bg-emerald-100 text-emerald-700' };
    return colors[type] || 'bg-slate-100 text-slate-700';
  };

  // Get ALL specialties - NOT filtered by team (teams can suggest but not restrict)
  // Users can have specialties that cross teams
  const getFilteredSpecialties = () => {
    return specialties; // Return all specialties regardless of team selection
  };
  
  // Get team's suggested specialties (for display hint only, not restriction)
  const getTeamSuggestedSpecialties = () => {
    if (!userForm.team_id) return [];
    const selectedTeam = teams.find(t => t.id === userForm.team_id);
    if (!selectedTeam || !selectedTeam.related_specialty_ids || selectedTeam.related_specialty_ids.length === 0) {
      return [];
    }
    return selectedTeam.related_specialty_ids;
  };

  // Convert arrays to searchable select options
  const roleOptions = (identityConfig?.roles || []).map(r => ({ value: r, label: r }));
  const accountTypeOptions = (identityConfig?.account_types || []).map(t => ({ value: t, label: t }));
  const specialtyOptions = specialties.map(s => ({ value: s.id, label: s.name, color: s.color }));
  const filteredSpecialtyOptions = getFilteredSpecialties().map(s => ({ value: s.id, label: s.name, color: s.color }));
  const teamOptions = [{ value: '', label: 'No team' }, ...teams.map(t => ({ value: t.id, label: t.name }))];

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#A2182C]"></div></div>;
  }

  const filteredUsers = users.filter(u => u.name.toLowerCase().includes(userSearch.toLowerCase()) || u.email.toLowerCase().includes(userSearch.toLowerCase()));
  const filteredTeams = teams.filter(t => t.name.toLowerCase().includes(teamSearch.toLowerCase()));
  const filteredSpecialties = specialties.filter(s => s.name.toLowerCase().includes(specialtySearch.toLowerCase()));

  return (
    <div className="space-y-6 animate-fade-in" data-testid="iam-page">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <KeyRound className="text-[#A2182C]" />
          {t('iam.title')}
        </h1>
        <p className="text-slate-500 mt-1">{t('iam.subtitle')}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{users.length}</p><p className="text-sm text-slate-500">{t('iam.users')}</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{teams.length}</p><p className="text-sm text-slate-500">{t('iam.teams')}</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{specialties.length}</p><p className="text-sm text-slate-500">{t('iam.specialties')}</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{roles.length || identityConfig?.roles?.length || 3}</p><p className="text-sm text-slate-500">{t('iam.roles')}</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{accountTypes.length || identityConfig?.account_types?.length || 4}</p><p className="text-sm text-slate-500">{t('iam.accountTypes')}</p></CardContent></Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="users"><Users size={16} className="mr-1" />{t('iam.users')}</TabsTrigger>
          <TabsTrigger value="teams"><UsersRound size={16} className="mr-1" />{t('iam.teams')}</TabsTrigger>
          <TabsTrigger value="specialties"><Briefcase size={16} className="mr-1" />{t('iam.specialties')}</TabsTrigger>
          <TabsTrigger value="roles"><Shield size={16} className="mr-1" />{t('iam.roles')}</TabsTrigger>
          <TabsTrigger value="account-types"><Building2 size={16} className="mr-1" />{t('iam.accountTypes')}</TabsTrigger>
        </TabsList>

        {/* USERS TAB */}
        <TabsContent value="users" className="mt-6">
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <Input placeholder={t('iam.searchUsers')} value={userSearch} onChange={(e) => setUserSearch(e.target.value)} className="pl-10" />
            </div>
            <Button className="bg-rose-600 hover:bg-rose-700" onClick={() => openUserDialog()} data-testid="add-user-btn">
              <Plus size={16} className="mr-2" />{t('iam.newUser')}
            </Button>
          </div>
          <Card>
            <CardContent className="p-0">
              <table className="w-full">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">{t('common.user')}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">{t('common.role')}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">{t('iam.accountTypes')}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">{t('common.specialty')}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">{t('common.status')}</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredUsers.map(user => (
                    <tr key={user.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 font-medium text-sm">{user.name.charAt(0)}</div>
                          <div><p className="font-medium">{user.name}</p><p className="text-sm text-slate-500">{user.email}</p></div>
                        </div>
                      </td>
                      <td className="px-4 py-3"><Badge className={getRoleColor(user.role)}>{user.role}</Badge></td>
                      <td className="px-4 py-3">{user.account_type ? <Badge className={getAccountTypeColor(user.account_type)}>{user.account_type}</Badge> : '—'}</td>
                      <td className="px-4 py-3">
                        {/* Multi-specialty display */}
                        {user.specialties && user.specialties.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {user.specialties.slice(0, 2).map((spec, i) => (
                              <Badge key={spec.id} variant={spec.is_primary ? "default" : "outline"} className="text-xs">
                                {spec.name}
                              </Badge>
                            ))}
                            {user.specialties.length > 2 && (
                              <Badge variant="outline" className="text-xs">+{user.specialties.length - 2} more</Badge>
                            )}
                          </div>
                        ) : (
                          user.specialty_name || '—'
                        )}
                      </td>
                      <td className="px-4 py-3"><Badge variant={user.active ? 'success' : 'secondary'}>{user.active ? 'Active' : 'Inactive'}</Badge></td>
                      <td className="px-4 py-3 text-right">
                        <Button variant="ghost" size="sm" onClick={() => openUserDialog(user)}><Edit size={16} /></Button>
                        <Button variant="ghost" size="sm" onClick={() => toggleUserActive(user.id, user.active)}>{user.active ? <UserX size={16} /> : <UserCheck size={16} />}</Button>
                        {user.id !== currentUser?.id && <Button variant="ghost" size="sm" onClick={() => setDeleteDialog({ open: true, type: 'user', item: user })}><Trash2 size={16} className="text-red-500" /></Button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TEAMS TAB */}
        <TabsContent value="teams" className="mt-6">
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <Input placeholder="Search teams..." value={teamSearch} onChange={(e) => setTeamSearch(e.target.value)} className="pl-10" />
            </div>
            <Button className="bg-rose-600 hover:bg-rose-700" onClick={() => openTeamDialog()}>
              <Plus size={16} className="mr-2" />Add Team
            </Button>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {filteredTeams.map(team => (
              <Card key={team.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium">{team.name}</h3>
                      {team.description && <p className="text-sm text-slate-500 mt-1">{team.description}</p>}
                      <p className="text-xs text-slate-400 mt-2">{team.member_count || 0} members</p>
                      {team.related_specialty_names && team.related_specialty_names.length > 0 && (
                        <div className="mt-2">
                          <p className="text-xs text-slate-500 mb-1">Related Specialties:</p>
                          <div className="flex flex-wrap gap-1">
                            {team.related_specialty_names.slice(0, 3).map((name, i) => (
                              <Badge key={i} variant="secondary" className="text-xs">{name}</Badge>
                            ))}
                            {team.related_specialty_names.length > 3 && (
                              <Badge variant="outline" className="text-xs">+{team.related_specialty_names.length - 3} more</Badge>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openTeamDialog(team)}><Edit size={16} /></Button>
                      <Button variant="ghost" size="sm" onClick={() => setDeleteDialog({ open: true, type: 'team', item: team })}><Trash2 size={16} className="text-red-500" /></Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* SPECIALTIES TAB */}
        <TabsContent value="specialties" className="mt-6">
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <Input placeholder="Search specialties..." value={specialtySearch} onChange={(e) => setSpecialtySearch(e.target.value)} className="pl-10" />
            </div>
            <Button className="bg-rose-600 hover:bg-rose-700" onClick={() => openSpecialtyDialog()}>
              <Plus size={16} className="mr-2" />Add Specialty
            </Button>
          </div>
          <div className="grid md:grid-cols-4 gap-3">
            {filteredSpecialties.map(s => (
              <Card key={s.id}>
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold" style={{ backgroundColor: s.color || '#6366F1' }}>{s.name.charAt(0)}</div>
                      <div>
                        <p className="font-medium text-sm">{s.name}</p>
                        <p className="text-xs text-slate-400">{s.user_count || 0} users</p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openSpecialtyDialog(s)}><Edit size={14} /></Button>
                      <Button variant="ghost" size="sm" onClick={() => setDeleteDialog({ open: true, type: 'specialty', item: s })}><Trash2 size={14} className="text-red-500" /></Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ROLES TAB */}
        <TabsContent value="roles" className="mt-6">
          <div className="flex justify-end mb-4">
            <Button className="bg-rose-600 hover:bg-rose-700" onClick={() => openRoleDialog()}>
              <Plus size={16} className="mr-2" />Add Role
            </Button>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {(roles.length > 0 ? roles : (identityConfig?.roles || []).map(r => ({ id: r, name: r, description: ROLE_TEMPLATES[r]?.description, is_system: true }))).map(role => (
              <Card key={role.id || role.name} className="relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1" style={{ backgroundColor: role.color || (role.name === 'Administrator' ? '#DC2626' : role.name === 'Operator' ? '#2563EB' : '#10B981') }} />
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2"><Shield size={18} />{role.name}</CardTitle>
                      <CardDescription className="mt-1">{role.description || ROLE_TEMPLATES[role.name]?.description}</CardDescription>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openRoleDialog(role)}><Edit size={14} /></Button>
                      {!role.is_system && (
                        <Button variant="ghost" size="sm" onClick={() => setDeleteDialog({ open: true, type: 'role', item: role })}><Trash2 size={14} className="text-red-500" /></Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-700 mb-2">Key Permissions:</p>
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(role.permissions || ROLE_TEMPLATES[role.name]?.permissions || {}).filter(([_, perms]) => Object.values(perms).some(v => v)).slice(0, 5).map(([module]) => (
                          <Badge key={module} variant="secondary" className="text-xs">{PERMISSION_MODULES[module]?.label || module}</Badge>
                        ))}
                      </div>
                    </div>
                    {role.is_system && <Badge variant="outline" className="text-xs">System</Badge>}
                  </div>
                  {role.user_count !== undefined && <p className="text-xs text-slate-400 mt-3">{role.user_count} users</p>}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ACCOUNT TYPES TAB */}
        <TabsContent value="account-types" className="mt-6">
          <div className="flex justify-end mb-4">
            <Button className="bg-rose-600 hover:bg-rose-700" onClick={() => openAccountTypeDialog()}>
              <Plus size={16} className="mr-2" />Add Account Type
            </Button>
          </div>
          <div className="grid md:grid-cols-4 gap-4">
            {(accountTypes.length > 0 ? accountTypes : (identityConfig?.account_types || []).map(at => ({ id: at, name: at, is_system: true }))).map(at => (
              <Card key={at.id || at.name} className="relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1" style={{ backgroundColor: at.color || '#6366F1' }} />
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <Badge className={getAccountTypeColor(at.name)}>{at.name}</Badge>
                      <p className="text-sm text-slate-500 mt-2">
                        {at.description || (
                          at.name === 'Partner' ? 'Business partners' :
                          at.name === 'Media Client' ? 'Media service clients (A La Carte)' :
                          at.name === 'Internal Staff' ? 'Company employees' :
                          at.name === 'Vendor/Freelancer' ? 'External contractors' : ''
                        )}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openAccountTypeDialog(at)}><Edit size={14} /></Button>
                      {!at.is_system && (
                        <Button variant="ghost" size="sm" onClick={() => setDeleteDialog({ open: true, type: 'accountType', item: at })}><Trash2 size={14} className="text-red-500" /></Button>
                      )}
                    </div>
                  </div>
                  {at.is_system && <Badge variant="outline" className="mt-2 text-xs">System</Badge>}
                  {at.user_count !== undefined && <p className="text-xs text-slate-400 mt-3">{at.user_count} users</p>}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* USER DIALOG */}
      <Dialog open={userDialogOpen} onOpenChange={setUserDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingUser ? 'Edit User' : 'Add User'}</DialogTitle>
            <DialogDescription>
              {!editingUser && 'Create a new user account. A temporary password will be generated.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Name *</Label><Input value={userForm.name} onChange={(e) => setUserForm({ ...userForm, name: e.target.value })} data-testid="user-name-input" /></div>
              <div><Label>Email *</Label><Input type="email" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} data-testid="user-email-input" /></div>
            </div>
            
            {/* Password field with show/hide and regenerate */}
            <div>
              <Label>{editingUser ? 'New Password' : 'Temporary Password *'}</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input 
                    type={showPassword ? 'text' : 'password'} 
                    value={userForm.password} 
                    onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} 
                    placeholder={editingUser ? 'Leave blank to keep' : ''} 
                    data-testid="user-password-input"
                  />
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="sm" 
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </Button>
                </div>
                {!editingUser && (
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="icon"
                    onClick={() => setUserForm({ ...userForm, password: generatePassword() })}
                    title="Generate new password"
                  >
                    <RefreshCw size={14} />
                  </Button>
                )}
              </div>
              {!editingUser && <p className="text-xs text-slate-500 mt-1">This password will be sent to the user via email</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Role *</Label>
                <SearchableSelect
                  options={roleOptions}
                  value={userForm.role}
                  onValueChange={(v) => setUserForm({ ...userForm, role: v })}
                  placeholder="Select role..."
                  searchPlaceholder="Search roles..."
                  data-testid="user-role-select"
                />
              </div>
              <div>
                <Label>Account Type *</Label>
                <SearchableSelect
                  options={accountTypeOptions}
                  value={userForm.account_type}
                  onValueChange={(v) => setUserForm({ ...userForm, account_type: v })}
                  placeholder="Select account type..."
                  searchPlaceholder="Search account types..."
                  data-testid="user-account-type-select"
                />
              </div>
            </div>

            <div>
              <Label>Team</Label>
              <SearchableSelect
                options={teamOptions}
                value={userForm.team_id || ''}
                onValueChange={(v) => {
                  // When team changes, DO NOT filter specialties - just update team
                  // Users can have specialties that cross teams
                  setUserForm({ ...userForm, team_id: v || '' });
                }}
                placeholder="Select team (optional)..."
                searchPlaceholder="Search teams..."
                data-testid="user-team-select"
              />
              {userForm.team_id && getTeamSuggestedSpecialties().length > 0 && (
                <p className="text-xs text-blue-600 mt-1">
                  <Info size={12} className="inline mr-1" />
                  Team has {getTeamSuggestedSpecialties().length} suggested specialties (not restricted)
                </p>
              )}
            </div>

            <div>
              <Label>
                Specialties {userForm.account_type !== 'Media Client' ? '*' : ''} (Select multiple)
              </Label>
              {userForm.account_type === 'Media Client' && (
                <p className="text-xs text-slate-500 mb-1">
                  Optional for Media Clients (they submit requests, not execute work)
                </p>
              )}
              {/* Searchable specialty input */}
              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <Input
                  placeholder="Search specialties..."
                  value={userSpecialtySearch}
                  onChange={(e) => setUserSpecialtySearch(e.target.value)}
                  className="pl-9"
                  data-testid="specialty-search-input"
                />
                {userSpecialtySearch && (
                  <button 
                    onClick={() => setUserSpecialtySearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
              <div className="border rounded-md p-2 max-h-48 overflow-y-auto space-y-1 bg-white">
                {(() => {
                  // Filter specialties by search (all specialties, not filtered by team)
                  const allSpecs = filteredSpecialtyOptions;
                  const searchLower = userSpecialtySearch.toLowerCase();
                  const filtered = searchLower 
                    ? allSpecs.filter(s => s.label.toLowerCase().includes(searchLower))
                    : allSpecs;
                  const teamSuggested = getTeamSuggestedSpecialties();
                  
                  if (filtered.length === 0) {
                    return <p className="text-sm text-slate-500 p-2 text-center">
                      {userSpecialtySearch ? 'No specialties match your search' : 'No specialties available'}
                    </p>;
                  }
                  
                  return filtered.map(spec => {
                    const isSuggested = teamSuggested.includes(spec.value);
                    return (
                      <label 
                        key={spec.value} 
                        className={`flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-slate-50 ${
                          userForm.specialty_ids.includes(spec.value) ? 'bg-rose-50 border border-rose-200' : ''
                        } ${isSuggested && !userForm.specialty_ids.includes(spec.value) ? 'bg-blue-50/50' : ''}`}
                      >
                        <Checkbox 
                          checked={userForm.specialty_ids.includes(spec.value)}
                          onCheckedChange={(checked) => {
                            const newIds = checked 
                              ? [...userForm.specialty_ids, spec.value]
                              : userForm.specialty_ids.filter(id => id !== spec.value);
                            let newPrimaryId = userForm.primary_specialty_id;
                            if (!checked && spec.value === userForm.primary_specialty_id) {
                              newPrimaryId = newIds.length > 0 ? newIds[0] : '';
                            }
                            if (checked && !newPrimaryId) {
                              newPrimaryId = spec.value;
                            }
                            setUserForm({ ...userForm, specialty_ids: newIds, primary_specialty_id: newPrimaryId });
                          }}
                        />
                        <span className="text-sm flex-1">
                          {spec.label}
                          {isSuggested && <span className="text-blue-500 text-xs ml-1">(team suggested)</span>}
                        </span>
                        {userForm.specialty_ids.includes(spec.value) && (
                          <Badge 
                            variant={userForm.primary_specialty_id === spec.value ? "default" : "outline"} 
                            className={`text-xs cursor-pointer ${userForm.primary_specialty_id === spec.value ? 'bg-rose-600' : ''}`}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setUserForm({ ...userForm, primary_specialty_id: spec.value });
                            }}
                          >
                            {userForm.primary_specialty_id === spec.value ? 'Primary' : 'Set Primary'}
                          </Badge>
                        )}
                      </label>
                    );
                  });
                })()}
              </div>
              {userForm.specialty_ids.length > 0 && (
                <p className="text-xs text-slate-500 mt-1">
                  Selected: {userForm.specialty_ids.length} specialt{userForm.specialty_ids.length === 1 ? 'y' : 'ies'}
                  {userForm.primary_specialty_id && (
                    <span className="text-rose-600 ml-1">
                      • Primary: {specialties.find(s => s.id === userForm.primary_specialty_id)?.name}
                    </span>
                  )}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-3 pt-4 border-t">
              <label className="flex items-center gap-2 cursor-pointer">
                <Switch checked={userForm.can_pick} onCheckedChange={(v) => setUserForm({ ...userForm, can_pick: v, pool_access: v ? userForm.pool_access : 'none' })} data-testid="can-pick-toggle" />
                <span className="text-sm">Can pick opportunities from pools</span>
              </label>
              
              {/* Pool Access Dropdown - only shown when can_pick is true */}
              {userForm.can_pick && (
                <div className="ml-8 p-3 bg-slate-50 rounded-lg">
                  <Label className="text-sm">Pool Access Level</Label>
                  <p className="text-xs text-slate-500 mb-2">Which pools can this user access?</p>
                  <Select
                    value={userForm.pool_access || 'both'}
                    onValueChange={(v) => setUserForm({ ...userForm, pool_access: v })}
                  >
                    <SelectTrigger data-testid="pool-access-select" className="mt-1">
                      <SelectValue placeholder="Select pool access..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="both">Both Pools (Pool 1 + Pool 2)</SelectItem>
                      <SelectItem value="pool1">Pool 1 Only</SelectItem>
                      <SelectItem value="pool2">Pool 2 Only</SelectItem>
                      <SelectItem value="none">No Pool Access</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              <label className="flex items-center gap-2 cursor-pointer">
                <Switch checked={userForm.force_password_change} onCheckedChange={(v) => setUserForm({ ...userForm, force_password_change: v })} />
                <span className="text-sm">Force password change on first login</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <Switch checked={userForm.force_otp_setup} onCheckedChange={(v) => setUserForm({ ...userForm, force_otp_setup: v })} />
                <span className="text-sm">Force OTP/2FA setup</span>
              </label>
              {!editingUser && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <Switch checked={userForm.send_welcome_email} onCheckedChange={(v) => setUserForm({ ...userForm, send_welcome_email: v })} />
                  <span className="text-sm">Send welcome email with login credentials</span>
                </label>
              )}
            </div>
            {/* Dashboard Type Assignment */}
            <div>
              <Label>Dashboard Type *</Label>
              <p className="text-xs text-slate-500 mb-2">Select the dashboard experience for this user</p>
              <Select
                value={userForm.dashboard_type_id}
                onValueChange={(v) => setUserForm({ ...userForm, dashboard_type_id: v })}
              >
                <SelectTrigger data-testid="dashboard-type-select">
                  <SelectValue placeholder="Select dashboard type..." />
                </SelectTrigger>
                <SelectContent>
                  {dashboardTemplates.map(d => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name} {d.is_default_for && <span className="text-slate-500">({d.is_default_for})</span>}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setUserDialogOpen(false)}>Cancel</Button>
              <Button className="bg-rose-600 hover:bg-rose-700" onClick={saveUser} data-testid="save-user-btn">{editingUser ? 'Save' : 'Create User'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* TEAM DIALOG */}
      <Dialog open={teamDialogOpen} onOpenChange={setTeamDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingTeam ? 'Edit Team' : 'Add Team'}</DialogTitle>
            <DialogDescription>
              Assign related specialties to filter user specialty options
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div><Label>Name *</Label><Input value={teamForm.name} onChange={(e) => setTeamForm({ ...teamForm, name: e.target.value })} data-testid="team-name-input" /></div>
            <div><Label>Description</Label><Input value={teamForm.description} onChange={(e) => setTeamForm({ ...teamForm, description: e.target.value })} /></div>
            <div>
              <Label>Related Specialties</Label>
              <p className="text-xs text-slate-500 mb-2">Users in this team will have specialty options filtered to these selections</p>
              <SearchableMultiSelect
                options={specialtyOptions}
                value={teamForm.related_specialty_ids}
                onValueChange={(v) => setTeamForm({ ...teamForm, related_specialty_ids: v })}
                placeholder="Select related specialties..."
                searchPlaceholder="Search specialties..."
                emptyText="No specialties found"
                data-testid="team-specialties-select"
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setTeamDialogOpen(false)}>Cancel</Button>
              <Button className="bg-rose-600 hover:bg-rose-700" onClick={saveTeam} data-testid="save-team-btn">Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* SPECIALTY DIALOG */}
      <Dialog open={specialtyDialogOpen} onOpenChange={setSpecialtyDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingSpecialty ? 'Edit Specialty' : 'Add Specialty'}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-4">
            <div><Label>Name *</Label><Input value={specialtyForm.name} onChange={(e) => setSpecialtyForm({ ...specialtyForm, name: e.target.value })} /></div>
            <div><Label>Description</Label><Input value={specialtyForm.description} onChange={(e) => setSpecialtyForm({ ...specialtyForm, description: e.target.value })} /></div>
            <div><Label>Color</Label><div className="flex gap-2"><Input type="color" value={specialtyForm.color} onChange={(e) => setSpecialtyForm({ ...specialtyForm, color: e.target.value })} className="w-16 h-10 p-1" /><Input value={specialtyForm.color} onChange={(e) => setSpecialtyForm({ ...specialtyForm, color: e.target.value })} /></div></div>
            <div className="flex justify-end gap-3"><Button variant="outline" onClick={() => setSpecialtyDialogOpen(false)}>Cancel</Button><Button className="bg-rose-600 hover:bg-rose-700" onClick={saveSpecialty}>Save</Button></div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ROLE DIALOG */}
      <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingRole ? 'Edit Role' : 'Add Role'}</DialogTitle>
            <DialogDescription>
              {editingRole?.is_system && <Badge variant="outline" className="mt-2">System Role - Name cannot be changed</Badge>}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Name *</Label>
                <Input 
                  value={roleForm.name} 
                  onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })} 
                  disabled={editingRole?.is_system}
                  data-testid="role-name-input"
                />
              </div>
              <div>
                <Label>Color</Label>
                <div className="flex gap-2">
                  <Input 
                    type="color" 
                    value={roleForm.color} 
                    onChange={(e) => setRoleForm({ ...roleForm, color: e.target.value })} 
                    className="w-16 h-10 p-1" 
                  />
                  <Input 
                    value={roleForm.color} 
                    onChange={(e) => setRoleForm({ ...roleForm, color: e.target.value })} 
                  />
                </div>
              </div>
            </div>
            <div>
              <Label>Description</Label>
              <Input 
                value={roleForm.description} 
                onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })} 
                data-testid="role-description-input"
              />
            </div>
            
            {/* Permission Matrix */}
            <div className="border rounded-lg p-4 bg-slate-50">
              <div className="flex items-center gap-2 mb-4">
                <Shield size={18} className="text-rose-600" />
                <Label className="text-base font-semibold">Permission Matrix</Label>
              </div>
              
              <div className="space-y-3">
                {Object.entries(PERMISSION_MODULES).map(([moduleKey, moduleConfig]) => (
                  <Collapsible key={moduleKey} defaultOpen={true}>
                    <div className="flex items-center justify-between p-3 bg-white rounded-lg border">
                      <CollapsibleTrigger className="flex items-center gap-2 flex-1 hover:bg-slate-50 rounded p-1">
                        <ChevronDown size={16} className="text-slate-400" />
                        <span className="font-medium">{moduleConfig.label}</span>
                        <Badge variant="secondary" className="ml-2 text-xs">
                          {moduleConfig.actions.filter(a => roleForm.permissions?.[moduleKey]?.[a]).length}/{moduleConfig.actions.length}
                        </Badge>
                      </CollapsibleTrigger>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-xs"
                        onClick={() => toggleModuleAll(moduleKey, moduleConfig.actions)}
                      >
                        {moduleConfig.actions.every(a => roleForm.permissions?.[moduleKey]?.[a]) ? 'Disable All' : 'Enable All'}
                      </Button>
                    </div>
                    <CollapsibleContent>
                      <div className="flex flex-wrap gap-3 p-3 pl-8 bg-white rounded-b-lg border-x border-b">
                        {moduleConfig.actions.map(action => (
                          <div key={action} className="flex items-center gap-2">
                            <Checkbox 
                              id={`${moduleKey}-${action}`}
                              checked={roleForm.permissions?.[moduleKey]?.[action] || false}
                              onCheckedChange={() => togglePermission(moduleKey, action)}
                              data-testid={`perm-${moduleKey}-${action}`}
                            />
                            <label 
                              htmlFor={`${moduleKey}-${action}`} 
                              className="text-sm cursor-pointer capitalize"
                            >
                              {action}
                            </label>
                          </div>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                ))}
              </div>
            </div>
            
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setRoleDialogOpen(false)}>Cancel</Button>
              <Button className="bg-rose-600 hover:bg-rose-700" onClick={saveRole} data-testid="save-role-btn">
                {editingRole ? 'Save Changes' : 'Create Role'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ACCOUNT TYPE DIALOG */}
      <Dialog open={accountTypeDialogOpen} onOpenChange={setAccountTypeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingAccountType ? 'Edit Account Type' : 'Add Account Type'}</DialogTitle>
            <DialogDescription>
              {editingAccountType?.is_system && <Badge variant="outline" className="mt-2">System Type - Name cannot be changed</Badge>}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <Label>Name *</Label>
              <Input 
                value={accountTypeForm.name} 
                onChange={(e) => setAccountTypeForm({ ...accountTypeForm, name: e.target.value })} 
                disabled={editingAccountType?.is_system}
                data-testid="account-type-name-input"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Input 
                value={accountTypeForm.description} 
                onChange={(e) => setAccountTypeForm({ ...accountTypeForm, description: e.target.value })} 
                data-testid="account-type-description-input"
              />
            </div>
            <div>
              <Label>Color</Label>
              <div className="flex gap-2">
                <Input 
                  type="color" 
                  value={accountTypeForm.color} 
                  onChange={(e) => setAccountTypeForm({ ...accountTypeForm, color: e.target.value })} 
                  className="w-16 h-10 p-1" 
                />
                <Input 
                  value={accountTypeForm.color} 
                  onChange={(e) => setAccountTypeForm({ ...accountTypeForm, color: e.target.value })} 
                />
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setAccountTypeDialogOpen(false)}>Cancel</Button>
              <Button className="bg-rose-600 hover:bg-rose-700" onClick={saveAccountType} data-testid="save-account-type-btn">
                {editingAccountType ? 'Save' : 'Create'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* DELETE DIALOG */}
      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ ...deleteDialog, open })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteDialog.type}?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone. Are you sure you want to delete &quot;{deleteDialog.item?.name}&quot;?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
