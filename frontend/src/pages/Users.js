import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
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
  DialogTrigger,
} from '../components/ui/dialog';
import { 
  Plus, 
  Search,
  Edit,
  Trash2,
  UserCheck,
  UserX,
  KeyRound,
  Shield
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function Users() {
  const { t } = useTranslation();
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: '',
    team_id: '',
    force_password_change: false,
    force_otp_setup: false
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [usersRes, rolesRes, teamsRes] = await Promise.all([
        axios.get(`${API}/users`),
        axios.get(`${API}/roles`),
        axios.get(`${API}/teams`)
      ]);
      setUsers(usersRes.data);
      setRoles(rolesRes.data);
      setTeams(teamsRes.data);
      // Set default role to first available role
      if (rolesRes.data.length > 0 && !formData.role) {
        setFormData(prev => ({ ...prev, role: rolesRes.data[0].name }));
      }
    } catch (error) {
      toast.error(t('errors.generic'));
    } finally {
      setLoading(false);
    }
  };

  const getRoleColor = (roleName) => {
    const role = roles.find(r => r.name === roleName);
    if (role?.color) {
      return { backgroundColor: `${role.color}20`, color: role.color };
    }
    return { backgroundColor: '#e2e8f0', color: '#475569' };
  };

  const handleOpenDialog = (user = null) => {
    if (user) {
      setEditingUser(user);
      setFormData({
        name: user.name,
        email: user.email,
        password: '',
        role: user.role,
        team_id: user.team_id || '',
        force_password_change: user.force_password_change || false,
        force_otp_setup: user.force_otp_setup || false
      });
    } else {
      setEditingUser(null);
      const defaultRole = roles.find(r => r.role_type === 'service_provider')?.name || roles[0]?.name || 'Requester';
      setFormData({ 
        name: '', 
        email: '', 
        password: '', 
        role: defaultRole, 
        team_id: '',
        force_password_change: false,
        force_otp_setup: false 
      });
    }
    setDialogOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.email) {
      toast.error(t('errors.validation'));
      return;
    }
    if (!editingUser && !formData.password) {
      toast.error(t('errors.validation'));
      return;
    }

    try {
      const submitData = { ...formData };
      if (!submitData.team_id) submitData.team_id = null;
      
      if (editingUser) {
        if (!submitData.password) delete submitData.password;
        await axios.patch(`${API}/users/${editingUser.id}`, submitData);
        toast.success(t('success.updated'));
      } else {
        await axios.post(`${API}/users`, submitData);
        toast.success(t('success.created'));
        if (submitData.force_otp_setup) {
          toast.info('OTP code has been sent to the user\'s email (simulated)');
        }
      }
      setDialogOpen(false);
      const defaultRole = roles.find(r => r.role_type === 'service_provider')?.name || roles[0]?.name || 'Requester';
      setFormData({ 
        name: '', 
        email: '', 
        password: '', 
        role: defaultRole, 
        team_id: '',
        force_password_change: false,
        force_otp_setup: false
      });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || t('errors.generic'));
    }
  };

  const handleToggleActive = async (userId, currentActive) => {
    try {
      await axios.patch(`${API}/users/${userId}`, { active: !currentActive });
      toast.success(t('success.updated'));
      fetchData();
    } catch (error) {
      toast.error(t('errors.generic'));
    }
  };

  const handleDelete = async (userId) => {
    if (!window.confirm(t('common.confirm'))) return;
    
    try {
      await axios.delete(`${API}/users/${userId}`);
      toast.success(t('success.deleted'));
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || t('errors.generic'));
    }
  };

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  // Group roles by type for the dropdown
  const systemRoles = roles.filter(r => r.role_type === 'system');
  const serviceProviderRoles = roles.filter(r => r.role_type === 'service_provider');
  const customRoles = roles.filter(r => r.role_type === 'custom');

  return (
    <div className="space-y-6 animate-fade-in" data-testid="users-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('users.title')}</h1>
          <p className="text-slate-500 mt-1">{users.length} {t('users.title').toLowerCase()}</p>
        </div>
        <Button 
          className="bg-rose-600 hover:bg-rose-700"
          onClick={() => handleOpenDialog()}
          data-testid="add-user-btn"
        >
          <Plus size={18} className="mr-2" />
          {t('users.addUser')}
        </Button>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          if (!open) setDialogOpen(false);
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingUser ? t('users.editUser') : t('users.addUser')}</DialogTitle>
              <DialogDescription>
                {editingUser ? t('users.editUser') : t('users.newUser')}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>{t('common.name')} *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder={t('common.name')}
                  className="mt-1.5"
                  data-testid="user-name-input"
                />
              </div>
              <div>
                <Label>{t('common.email')} *</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="user@example.com"
                  className="mt-1.5"
                  data-testid="user-email-input"
                />
              </div>
              <div>
                <Label>{editingUser ? t('auth.newPassword') : t('auth.password')} {editingUser ? '' : '*'}</Label>
                <Input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                  placeholder="••••••••"
                  className="mt-1.5"
                  data-testid="user-password-input"
                />
              </div>
              <div>
                <Label>{t('users.userRole')}</Label>
                <Select 
                  value={formData.role} 
                  onValueChange={(v) => setFormData(prev => ({ ...prev, role: v }))}
                >
                  <SelectTrigger className="mt-1.5" data-testid="user-role-select">
                    <SelectValue placeholder={t('users.selectRole')} />
                  </SelectTrigger>
                  <SelectContent className="max-h-64">
                    {systemRoles.length > 0 && (
                      <>
                        <div className="px-2 py-1.5 text-xs font-semibold text-slate-500">{t('roles.systemRole')}</div>
                        {systemRoles.map(r => (
                          <SelectItem key={r.id} value={r.name}>{r.display_name}</SelectItem>
                        ))}
                      </>
                    )}
                    {serviceProviderRoles.length > 0 && (
                      <>
                        <div className="px-2 py-1.5 text-xs font-semibold text-slate-500 mt-2">{t('roles.serviceProvider')}</div>
                        {serviceProviderRoles.map(r => (
                          <SelectItem key={r.id} value={r.name}>{r.display_name}</SelectItem>
                        ))}
                      </>
                    )}
                    {customRoles.length > 0 && (
                      <>
                        <div className="px-2 py-1.5 text-xs font-semibold text-slate-500 mt-2">{t('roles.title')}</div>
                        {customRoles.map(r => (
                          <SelectItem key={r.id} value={r.name}>{r.display_name}</SelectItem>
                        ))}
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t('users.userTeam')}</Label>
                <Select 
                  value={formData.team_id || "none"} 
                  onValueChange={(v) => setFormData(prev => ({ ...prev, team_id: v === "none" ? "" : v }))}
                >
                  <SelectTrigger className="mt-1.5" data-testid="user-team-select">
                    <SelectValue placeholder={t('users.selectTeam')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t('users.noTeam')}</SelectItem>
                    {teams.map(t => (
                      <SelectItem key={t.id} value={t.id}>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: t.color }} />
                          {t.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {/* Security Options Section */}
              <div className="border-t border-slate-200 pt-4 mt-4">
                <Label className="text-sm font-medium flex items-center gap-2 mb-3">
                  <Shield size={16} className="text-slate-500" />
                  Security Options
                </Label>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <KeyRound size={18} className="text-amber-500" />
                      <div>
                        <p className="text-sm font-medium">Force Password Change</p>
                        <p className="text-xs text-slate-500">User must change password on next login</p>
                      </div>
                    </div>
                    <Switch
                      checked={formData.force_password_change}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, force_password_change: checked }))}
                      data-testid="force-password-change-switch"
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Shield size={18} className="text-blue-500" />
                      <div>
                        <p className="text-sm font-medium">Force OTP Setup</p>
                        <p className="text-xs text-slate-500">User must verify OTP code (6 digits) via email</p>
                      </div>
                    </div>
                    <Switch
                      checked={formData.force_otp_setup}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, force_otp_setup: checked }))}
                      data-testid="force-otp-setup-switch"
                    />
                  </div>
                </div>
              </div>

              <Button type="submit" className="w-full bg-rose-600 hover:bg-rose-700" data-testid="save-user-btn">
                {editingUser ? t('common.save') : t('users.addUser')}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <Card className="border-slate-200">
        <CardContent className="p-4">
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder={t('users.searchUsers')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
              data-testid="search-users"
            />
          </div>
        </CardContent>
      </Card>

      {/* Users - Mobile Card View */}
      <div className="md:hidden space-y-3">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin h-8 w-8 border-4 border-rose-600 border-t-transparent rounded-full" />
          </div>
        ) : filteredUsers.length === 0 ? (
          <Card className="border-slate-200">
            <CardContent className="p-12 text-center text-slate-500">
              {search ? t('users.noMatch') : t('users.noUsers')}
            </CardContent>
          </Card>
        ) : (
          filteredUsers.map(user => (
            <Card key={user.id} className="border-slate-200" data-testid={`user-card-${user.id}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden shrink-0">
                      {user.avatar ? (
                        <img src={user.avatar} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="font-medium text-slate-600 text-lg">{user.name.charAt(0)}</span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-slate-900 truncate">{user.name}</p>
                      <p className="text-sm text-slate-500 truncate">{user.email}</p>
                    </div>
                  </div>
                  <Badge className={user.active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}>
                    {user.active ? t('users.active') : t('users.inactive')}
                  </Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge style={getRoleColor(user.role)}>
                    {roles.find(r => r.name === user.role)?.display_name || user.role}
                  </Badge>
                  {user.team_name && (
                    <Badge variant="outline" className="text-slate-600">
                      {user.team_name}
                    </Badge>
                  )}
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs text-slate-400">
                    {t('users.created')}: {format(new Date(user.created_at), 'MMM d, yyyy')}
                  </span>
                  {user.id !== currentUser.id && (
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleToggleActive(user.id, user.active)}
                      >
                        {user.active ? <UserX size={16} /> : <UserCheck size={16} />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleOpenDialog(user)}
                      >
                        <Edit size={16} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-500"
                        onClick={() => handleDelete(user.id)}
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Users Table - Desktop Only */}
      <Card className="border-slate-200 overflow-hidden hidden md:block">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin h-8 w-8 border-4 border-rose-600 border-t-transparent rounded-full" />
          </div>
        ) : filteredUsers.length === 0 ? (
          <CardContent className="p-12 text-center text-slate-500">
            {search ? t('users.noMatch') : t('users.noUsers')}
          </CardContent>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">{t('users.user')}</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">{t('users.userRole')}</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">{t('users.userTeam')}</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">{t('common.status')}</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">{t('users.created')}</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600 uppercase">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map(user => (
                  <tr key={user.id} className="hover:bg-slate-50" data-testid={`user-row-${user.id}`}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden">
                          {user.avatar ? (
                            <img src={user.avatar} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span className="font-medium text-slate-600">{user.name.charAt(0)}</span>
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">{user.name}</p>
                          <p className="text-sm text-slate-500">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Badge style={getRoleColor(user.role)}>
                        {roles.find(r => r.name === user.role)?.display_name || user.role}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      {user.team_name ? (
                        <span className="text-sm text-slate-600">{user.team_name}</span>
                      ) : (
                        <span className="text-sm text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <Badge className={user.active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}>
                        {user.active ? t('users.active') : t('users.inactive')}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500">
                      {format(new Date(user.created_at), 'MMM d, yyyy')}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-2">
                        {user.id !== currentUser.id && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleToggleActive(user.id, user.active)}
                              title={user.active ? t('users.inactive') : t('users.active')}
                            >
                              {user.active ? <UserX size={16} /> : <UserCheck size={16} />}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleOpenDialog(user)}
                            >
                              <Edit size={16} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-red-500"
                              onClick={() => handleDelete(user.id)}
                            >
                              <Trash2 size={16} />
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}