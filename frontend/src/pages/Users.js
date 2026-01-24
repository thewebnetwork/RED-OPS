import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
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
  UserX
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function Users() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [usersRes, rolesRes] = await Promise.all([
        axios.get(`${API}/users`),
        axios.get(`${API}/roles`)
      ]);
      setUsers(usersRes.data);
      setRoles(rolesRes.data);
      // Set default role to first available role
      if (rolesRes.data.length > 0 && !formData.role) {
        setFormData(prev => ({ ...prev, role: rolesRes.data[0].name }));
      }
    } catch (error) {
      toast.error('Failed to load data');
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
        role: user.role
      });
    } else {
      setEditingUser(null);
      const defaultRole = roles.find(r => r.role_type === 'service_provider')?.name || roles[0]?.name || 'Requester';
      setFormData({ name: '', email: '', password: '', role: defaultRole });
    }
    setDialogOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.email) {
      toast.error('Name and email are required');
      return;
    }
    if (!editingUser && !formData.password) {
      toast.error('Password is required for new users');
      return;
    }

    try {
      if (editingUser) {
        const updateData = { ...formData };
        if (!updateData.password) delete updateData.password;
        await axios.patch(`${API}/users/${editingUser.id}`, updateData);
        toast.success('User updated');
      } else {
        await axios.post(`${API}/users`, formData);
        toast.success('User created');
      }
      setDialogOpen(false);
      const defaultRole = roles.find(r => r.role_type === 'service_provider')?.name || roles[0]?.name || 'Requester';
      setFormData({ name: '', email: '', password: '', role: defaultRole });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Operation failed');
    }
  };

  const handleToggleActive = async (userId, currentActive) => {
    try {
      await axios.patch(`${API}/users/${userId}`, { active: !currentActive });
      toast.success(`User ${currentActive ? 'deactivated' : 'activated'}`);
      fetchData();
    } catch (error) {
      toast.error('Failed to update user');
    }
  };

  const handleDelete = async (userId) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;
    
    try {
      await axios.delete(`${API}/users/${userId}`);
      toast.success('User deleted');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete user');
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
          <h1 className="text-2xl font-bold text-slate-900">Users</h1>
          <p className="text-slate-500 mt-1">{users.length} users</p>
        </div>
        <Button 
          className="bg-rose-600 hover:bg-rose-700"
          onClick={() => handleOpenDialog()}
          data-testid="add-user-btn"
        >
          <Plus size={18} className="mr-2" />
          Add User
        </Button>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          if (!open) setDialogOpen(false);
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingUser ? 'Edit User' : 'Add User'}</DialogTitle>
              <DialogDescription>
                {editingUser ? 'Update user details' : 'Create a new user account'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Name *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Full name"
                  className="mt-1.5"
                  data-testid="user-name-input"
                />
              </div>
              <div>
                <Label>Email *</Label>
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
                <Label>{editingUser ? 'New Password (leave blank to keep)' : 'Password *'}</Label>
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
                <Label>Role</Label>
                <Select 
                  value={formData.role} 
                  onValueChange={(v) => setFormData(prev => ({ ...prev, role: v }))}
                >
                  <SelectTrigger className="mt-1.5" data-testid="user-role-select">
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent className="max-h-64">
                    {systemRoles.length > 0 && (
                      <>
                        <div className="px-2 py-1.5 text-xs font-semibold text-slate-500">System Roles</div>
                        {systemRoles.map(r => (
                          <SelectItem key={r.id} value={r.name}>{r.display_name}</SelectItem>
                        ))}
                      </>
                    )}
                    {serviceProviderRoles.length > 0 && (
                      <>
                        <div className="px-2 py-1.5 text-xs font-semibold text-slate-500 mt-2">Service Providers</div>
                        {serviceProviderRoles.map(r => (
                          <SelectItem key={r.id} value={r.name}>{r.display_name}</SelectItem>
                        ))}
                      </>
                    )}
                    {customRoles.length > 0 && (
                      <>
                        <div className="px-2 py-1.5 text-xs font-semibold text-slate-500 mt-2">Custom Roles</div>
                        {customRoles.map(r => (
                          <SelectItem key={r.id} value={r.name}>{r.display_name}</SelectItem>
                        ))}
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full bg-rose-600 hover:bg-rose-700" data-testid="save-user-btn">
                {editingUser ? 'Update User' : 'Add User'}
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
              placeholder="Search users..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
              data-testid="search-users"
            />
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card className="border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin h-8 w-8 border-4 border-rose-600 border-t-transparent rounded-full" />
          </div>
        ) : filteredUsers.length === 0 ? (
          <CardContent className="p-12 text-center text-slate-500">
            {search ? 'No users match your search' : 'No users yet'}
          </CardContent>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">User</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Role</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Created</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Actions</th>
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
                      <Badge className={user.active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}>
                        {user.active ? 'Active' : 'Inactive'}
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
                              title={user.active ? 'Deactivate' : 'Activate'}
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
                              size="icon"
                              onClick={() => handleDelete(user.id)}
                              className="h-8 w-8 text-red-500 hover:text-red-700"
                            >
                              <Trash2 size={14} />
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
