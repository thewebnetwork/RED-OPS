import { useState, useEffect } from 'react';
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
  Plus, Search, Trash2, UserCheck, UserX, CreditCard, CheckCircle2, UsersRound, Eye, EyeOff, RefreshCw
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
  const [userForm, setUserForm] = useState({
    name: '', email: '', password: '', role: 'Standard User', 
    account_type: 'Internal Staff', specialty_id: '', team_id: '', subscription_plan_id: '',
    force_password_change: true, force_otp_setup: true, send_welcome_email: true
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

  // Subscription Plans state
  const [plans, setPlans] = useState([]);
  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [planForm, setPlanForm] = useState({ name: '', description: '', price_monthly: '', price_yearly: '', features: '', sort_order: 1 });

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
      const [usersRes, teamsRes, specialtiesRes, plansRes, configRes, rolesRes, accountTypesRes] = await Promise.all([
        axios.get(`${API}/users`),
        axios.get(`${API}/teams`),
        axios.get(`${API}/specialties`),
        axios.get(`${API}/subscription-plans`),
        axios.get(`${API}/users/identity-config`),
        axios.get(`${API}/iam/roles`).catch(() => ({ data: [] })),
        axios.get(`${API}/iam/account-types`).catch(() => ({ data: [] }))
      ]);
      setUsers(usersRes.data);
      setTeams(teamsRes.data);
      setSpecialties(specialtiesRes.data);
      setPlans(plansRes.data);
      setIdentityConfig(configRes.data);
      setRoles(rolesRes.data);
      setAccountTypes(accountTypesRes.data);
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
        specialty_id: user.specialty_id || '', team_id: user.team_id || '',
        subscription_plan_id: user.subscription_plan_id || '',
        force_password_change: user.force_password_change || false,
        force_otp_setup: user.force_otp_setup || false,
        send_welcome_email: false
      });
    } else {
      setEditingUser(null);
      // Generate temp password for new users
      const tempPassword = generatePassword();
      setUserForm({ 
        name: '', email: '', password: tempPassword, role: 'Standard User', 
        account_type: 'Internal Staff', specialty_id: '', team_id: '', 
        subscription_plan_id: '', force_password_change: true, force_otp_setup: true,
        send_welcome_email: true
      });
    }
    setUserDialogOpen(true);
  };

  const saveUser = async () => {
    if (!userForm.name || !userForm.email) { toast.error('Name and email required'); return; }
    if (!editingUser && !userForm.password) { toast.error('Password required for new users'); return; }
    if (!userForm.specialty_id) { toast.error('Specialty is required'); return; }
    if (userForm.account_type === 'Partner' && !userForm.subscription_plan_id) { toast.error('Subscription plan required for Partners'); return; }

    try {
      const data = { 
        ...userForm, 
        team_id: userForm.team_id || null, 
        subscription_plan_id: userForm.account_type === 'Partner' ? userForm.subscription_plan_id : null,
        send_welcome_email: !editingUser ? userForm.send_welcome_email : false
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

  // =============== PLAN HANDLERS ===============
  const openPlanDialog = (plan = null) => {
    if (plan) {
      setEditingPlan(plan);
      setPlanForm({ name: plan.name, description: plan.description || '', price_monthly: plan.price_monthly || '', price_yearly: plan.price_yearly || '', features: (plan.features || []).join('\n'), sort_order: plan.sort_order || 1 });
    } else {
      setEditingPlan(null);
      setPlanForm({ name: '', description: '', price_monthly: '', price_yearly: '', features: '', sort_order: plans.length + 1 });
    }
    setPlanDialogOpen(true);
  };

  const savePlan = async () => {
    if (!planForm.name) { toast.error('Plan name required'); return; }
    try {
      const data = {
        ...planForm,
        price_monthly: planForm.price_monthly ? parseFloat(planForm.price_monthly) : null,
        price_yearly: planForm.price_yearly ? parseFloat(planForm.price_yearly) : null,
        features: planForm.features.split('\n').filter(f => f.trim()),
        sort_order: parseInt(planForm.sort_order) || 1
      };
      if (editingPlan) {
        await axios.patch(`${API}/subscription-plans/${editingPlan.id}`, data);
        toast.success('Plan updated');
      } else {
        await axios.post(`${API}/subscription-plans`, data);
        toast.success('Plan created');
      }
      setPlanDialogOpen(false);
      fetchAllData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save plan');
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
      const newPermissions = { ...prev.permissions };
      if (!newPermissions[module]) {
        newPermissions[module] = {};
      }
      newPermissions[module][action] = !newPermissions[module]?.[action];
      return { ...prev, permissions: newPermissions };
    });
  };
  
  const toggleModuleAll = (module, actions) => {
    setRoleForm(prev => {
      const newPermissions = { ...prev.permissions };
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
      else if (type === 'plan') await axios.delete(`${API}/subscription-plans/${item.id}`);
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

  // Get specialties filtered by selected team (if team has related specialties)
  const getFilteredSpecialties = () => {
    if (!userForm.team_id) return specialties;
    const selectedTeam = teams.find(t => t.id === userForm.team_id);
    if (!selectedTeam || !selectedTeam.related_specialty_ids || selectedTeam.related_specialty_ids.length === 0) {
      return specialties;
    }
    return specialties.filter(s => selectedTeam.related_specialty_ids.includes(s.id));
  };

  // Convert arrays to searchable select options
  const roleOptions = (identityConfig?.roles || []).map(r => ({ value: r, label: r }));
  const accountTypeOptions = (identityConfig?.account_types || []).map(t => ({ value: t, label: t }));
  const specialtyOptions = specialties.map(s => ({ value: s.id, label: s.name, color: s.color }));
  const filteredSpecialtyOptions = getFilteredSpecialties().map(s => ({ value: s.id, label: s.name, color: s.color }));
  const teamOptions = [{ value: '', label: 'No team' }, ...teams.map(t => ({ value: t.id, label: t.name }))];
  const planOptions = plans.map(p => ({ value: p.id, label: p.name }));

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
          Identity & Access Management
        </h1>
        <p className="text-slate-500 mt-1">Manage users, teams, specialties, roles, account types, and subscription plans</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{users.length}</p><p className="text-sm text-slate-500">Users</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{teams.length}</p><p className="text-sm text-slate-500">Teams</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{specialties.length}</p><p className="text-sm text-slate-500">Specialties</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{roles.length || identityConfig?.roles?.length || 3}</p><p className="text-sm text-slate-500">Roles</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{accountTypes.length || identityConfig?.account_types?.length || 4}</p><p className="text-sm text-slate-500">Account Types</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{plans.length}</p><p className="text-sm text-slate-500">Plans</p></CardContent></Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="users"><Users size={16} className="mr-1" />Users</TabsTrigger>
          <TabsTrigger value="teams"><UsersRound size={16} className="mr-1" />Teams</TabsTrigger>
          <TabsTrigger value="specialties"><Briefcase size={16} className="mr-1" />Specialties</TabsTrigger>
          <TabsTrigger value="roles"><Shield size={16} className="mr-1" />Roles</TabsTrigger>
          <TabsTrigger value="account-types"><Building2 size={16} className="mr-1" />Account Types</TabsTrigger>
          <TabsTrigger value="plans"><CreditCard size={16} className="mr-1" />Plans</TabsTrigger>
        </TabsList>

        {/* USERS TAB */}
        <TabsContent value="users" className="mt-6">
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <Input placeholder="Search users..." value={userSearch} onChange={(e) => setUserSearch(e.target.value)} className="pl-10" />
            </div>
            <Button className="bg-rose-600 hover:bg-rose-700" onClick={() => openUserDialog()} data-testid="add-user-btn">
              <Plus size={16} className="mr-2" />Add User
            </Button>
          </div>
          <Card>
            <CardContent className="p-0">
              <table className="w-full">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">User</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Role</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Account Type</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Specialty</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Actions</th>
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
                      <td className="px-4 py-3">{user.specialty_name || '—'}</td>
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
                          at.name === 'Partner' ? 'Business partners with subscription plans' :
                          at.name === 'Media Client' ? 'Media service clients (A La Carte)' :
                          at.name === 'Internal Staff' ? 'Company employees' :
                          at.name === 'Vendor/Freelancer' ? 'External contractors' : ''
                        )}
                      </p>
                      {at.requires_subscription && <Badge variant="outline" className="mt-2 text-xs">Requires Plan</Badge>}
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

        {/* PLANS TAB */}
        <TabsContent value="plans" className="mt-6">
          <div className="flex justify-end mb-4">
            <Button className="bg-rose-600 hover:bg-rose-700" onClick={() => openPlanDialog()}>
              <Plus size={16} className="mr-2" />Add Plan
            </Button>
          </div>
          <div className="grid md:grid-cols-4 gap-4">
            {plans.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)).map((plan, idx) => (
              <Card key={plan.id} className="relative overflow-hidden">
                <div className={`absolute top-0 left-0 right-0 h-1`} style={{ backgroundColor: ['#10B981', '#3B82F6', '#8B5CF6', '#F59E0B'][idx % 4] }} />
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{plan.name}</CardTitle>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openPlanDialog(plan)}><Edit size={14} /></Button>
                      <Button variant="ghost" size="sm" onClick={() => setDeleteDialog({ open: true, type: 'plan', item: plan })}><Trash2 size={14} className="text-red-500" /></Button>
                    </div>
                  </div>
                  {plan.description && <CardDescription>{plan.description}</CardDescription>}
                </CardHeader>
                <CardContent>
                  {plan.price_monthly && <p className="text-2xl font-bold">${plan.price_monthly}<span className="text-sm text-slate-500 font-normal">/mo</span></p>}
                  {plan.features?.length > 0 && (
                    <ul className="mt-3 space-y-1">
                      {plan.features.slice(0, 4).map((f, i) => <li key={i} className="text-sm flex items-center gap-2"><CheckCircle2 size={14} className="text-green-500" />{f}</li>)}
                    </ul>
                  )}
                  <p className="text-xs text-slate-400 mt-3">{plan.user_count || 0} partners</p>
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
                  onValueChange={(v) => setUserForm({ ...userForm, account_type: v, subscription_plan_id: v === 'Partner' ? userForm.subscription_plan_id : '' })}
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
                  // When team changes, check if current specialty is still valid
                  const newTeam = teams.find(t => t.id === v);
                  let newSpecialtyId = userForm.specialty_id;
                  if (newTeam && newTeam.related_specialty_ids && newTeam.related_specialty_ids.length > 0) {
                    // If current specialty is not in the team's related specialties, clear it
                    if (!newTeam.related_specialty_ids.includes(userForm.specialty_id)) {
                      newSpecialtyId = '';
                    }
                  }
                  setUserForm({ ...userForm, team_id: v || '', specialty_id: newSpecialtyId });
                }}
                placeholder="Select team (optional)..."
                searchPlaceholder="Search teams..."
                data-testid="user-team-select"
              />
              {userForm.team_id && teams.find(t => t.id === userForm.team_id)?.related_specialty_ids?.length > 0 && (
                <p className="text-xs text-blue-600 mt-1">
                  <Info size={12} className="inline mr-1" />
                  Specialty options filtered by team
                </p>
              )}
            </div>

            <div>
              <Label>Specialty *</Label>
              <SearchableSelect
                options={filteredSpecialtyOptions}
                value={userForm.specialty_id}
                onValueChange={(v) => setUserForm({ ...userForm, specialty_id: v })}
                placeholder="Select specialty..."
                searchPlaceholder="Search specialties..."
                emptyText="No specialties found"
                data-testid="user-specialty-select"
              />
            </div>

            {userForm.account_type === 'Partner' && (
              <div className="p-4 bg-purple-50 rounded-lg">
                <Label className="text-purple-800">Subscription Plan *</Label>
                <SearchableSelect
                  options={planOptions}
                  value={userForm.subscription_plan_id}
                  onValueChange={(v) => setUserForm({ ...userForm, subscription_plan_id: v })}
                  placeholder="Select plan..."
                  searchPlaceholder="Search plans..."
                  className="mt-1 border-purple-200"
                  data-testid="user-subscription-plan-select"
                />
              </div>
            )}

            <div className="flex flex-col gap-3 pt-4 border-t">
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

      {/* PLAN DIALOG */}
      <Dialog open={planDialogOpen} onOpenChange={setPlanDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingPlan ? 'Edit Plan' : 'Add Plan'}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-4">
            <div><Label>Name *</Label><Input value={planForm.name} onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })} /></div>
            <div><Label>Description</Label><Input value={planForm.description} onChange={(e) => setPlanForm({ ...planForm, description: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Monthly Price ($)</Label><Input type="number" step="0.01" value={planForm.price_monthly} onChange={(e) => setPlanForm({ ...planForm, price_monthly: e.target.value })} /></div>
              <div><Label>Yearly Price ($)</Label><Input type="number" step="0.01" value={planForm.price_yearly} onChange={(e) => setPlanForm({ ...planForm, price_yearly: e.target.value })} /></div>
            </div>
            <div><Label>Features (one per line)</Label><Textarea value={planForm.features} onChange={(e) => setPlanForm({ ...planForm, features: e.target.value })} className="min-h-[100px]" /></div>
            <div className="flex justify-end gap-3"><Button variant="outline" onClick={() => setPlanDialogOpen(false)}>Cancel</Button><Button className="bg-rose-600 hover:bg-rose-700" onClick={savePlan}>Save</Button></div>
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
            <div className="flex items-center gap-2">
              <Switch 
                checked={accountTypeForm.requires_subscription} 
                onCheckedChange={(v) => setAccountTypeForm({ ...accountTypeForm, requires_subscription: v })} 
                data-testid="requires-subscription-switch"
              />
              <Label className="cursor-pointer">Requires Subscription Plan</Label>
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
