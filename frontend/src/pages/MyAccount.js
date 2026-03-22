import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { User, Shield, Key, Camera, Mail, Phone, FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function MyAccount() {
const { user, refreshUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const fileInputRef = useRef(null);

  const [profileData, setProfileData] = useState({
    name: '', email: '', phone: '', bio: '', avatar: '',
  });

  const [passwordData, setPasswordData] = useState({
    current_password: '', new_password: '', confirm_password: ''
  });

  useEffect(() => {
    if (user) {
      setProfileData({
        name: user.name || '',
        email: user.email || '',
        phone: user.phone || '',
        bio: user.bio || '',
        avatar: user.avatar || '',
      });
      if (user.avatar) setAvatarPreview(user.avatar);
    }
  }, [user]);

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error('Image must be under 2MB'); return; }
    const reader = new FileReader();
    reader.onloadend = () => {
      setAvatarPreview(reader.result);
      setProfileData(prev => ({ ...prev, avatar: reader.result }));
    };
    reader.readAsDataURL(file);
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {};
      if (profileData.name) payload.name = profileData.name;
      if (profileData.email) payload.email = profileData.email;
      if (profileData.avatar) payload.avatar = profileData.avatar;
      payload.bio = profileData.bio || '';
      payload.phone = profileData.phone || '';
      await axios.patch(`${API}/auth/profile`, payload);
      await refreshUser();
      toast.success('Profile updated successfully');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update profile');
    } finally { setLoading(false); }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (passwordData.new_password !== passwordData.confirm_password) { toast.error('New passwords do not match'); return; }
    if (passwordData.new_password.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    setLoading(true);
    try {
      await axios.post(`${API}/auth/change-password`, {
        current_password: passwordData.current_password,
        new_password: passwordData.new_password,
      });
      toast.success('Password changed successfully');
      setPasswordData({ current_password: '', new_password: '', confirm_password: '' });
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to change password');
    } finally { setLoading(false); }
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(" ").map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{'My Account'}</h1>
          <p className="text-muted-foreground mt-1">{'Manage your profile and account settings'}</p>
        </div>

        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="profile" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              {'Profile'}
            </TabsTrigger>
            <TabsTrigger value="security" className="flex items-center gap-2">
              <Key className="h-4 w-4" />
              {'Security'}
            </TabsTrigger>
            <TabsTrigger value="account" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              {'Account Info'}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="mt-6">
            <form onSubmit={handleProfileUpdate}>
              <Card>
                <CardHeader>
                  <CardTitle>{'Profile Information'}</CardTitle>
                  <CardDescription>{'Update your personal details and public profile'}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex flex-col items-center gap-4">
                    <div className="relative">
                      {avatarPreview ? (
                        <img src={avatarPreview} alt="Profile" className="h-24 w-24 rounded-full object-cover border-2 border-border" />
                      ) : (
                        <div className="h-24 w-24 rounded-full bg-primary flex items-center justify-center border-2 border-border">
                          <span className="text-2xl font-bold text-primary-foreground">{getInitials(user.name)}</span>
                        </div>
                      )}
                      <button type="button" onClick={() => fileInputRef.current?.click()}
                        className="absolute bottom-0 right-0 h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg hover:bg-primary/90 transition-colors">
                        <Camera className="h-4 w-4" />
                      </button>
                    </div>
                    <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
                    <p className="text-xs text-muted-foreground">JPG, PNG or GIF — max 2MB</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="name" className="flex items-center gap-2"><User className="h-4 w-4" />{'Full Name'}</Label>
                    <Input id="name" value={profileData.name} onChange={(e) => setProfileData(prev => ({ ...prev, name: e.target.value }))} placeholder="Your full name" />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email" className="flex items-center gap-2"><Mail className="h-4 w-4" />{'Email Address'}</Label>
                    <Input id="email" type="email" value={profileData.email} onChange={(e) => setProfileData(prev => ({ ...prev, email: e.target.value }))} placeholder="your@email.com" />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone" className="flex items-center gap-2"><Phone className="h-4 w-4" />{'Phone Number'}</Label>
                    <Input id="phone" type="tel" value={profileData.phone} onChange={(e) => setProfileData(prev => ({ ...prev, phone: e.target.value }))} placeholder="+1 (555) 000-0000" />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="bio" className="flex items-center gap-2"><FileText className="h-4 w-4" />{'Bio'}</Label>
                    <textarea id="bio" rows={4} maxLength={300} value={profileData.bio}
                      onChange={(e) => setProfileData(prev => ({ ...prev, bio: e.target.value }))}
                      placeholder="Tell us a bit about yourself..."
                      className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none" />
                    <p className="text-xs text-muted-foreground text-right">{(profileData.bio || '').length}/300</p>
                  </div>

                  <Button type="submit" disabled={loading} className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold">
                    {loading ? 'Saving...' : 'Save Changes'}
                  </Button>
                </CardContent>
              </Card>
            </form>
          </TabsContent>

          <TabsContent value="security" className="mt-6">
            <form onSubmit={handlePasswordChange}>
              <Card>
                <CardHeader>
                  <CardTitle>{'Change Password'}</CardTitle>
                  <CardDescription>{'Keep your account secure with a strong password'}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="current_password">{'Current Password'}</Label>
                    <Input id="current_password" type="password" value={passwordData.current_password}
                      onChange={(e) => setPasswordData(prev => ({ ...prev, current_password: e.target.value }))} placeholder="••••••••" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new_password">{'New Password'}</Label>
                    <Input id="new_password" type="password" value={passwordData.new_password}
                      onChange={(e) => setPasswordData(prev => ({ ...prev, new_password: e.target.value }))} placeholder="Min 8 characters" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm_password">{'Confirm New Password'}</Label>
                    <Input id="confirm_password" type="password" value={passwordData.confirm_password}
                      onChange={(e) => setPasswordData(prev => ({ ...prev, confirm_password: e.target.value }))} placeholder="Repeat new password" />
                  </div>
                  <Button type="submit" disabled={loading} className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold">
                    {loading ? 'Saving...' : 'Update Password'}
                  </Button>
                </CardContent>
              </Card>
            </form>
          </TabsContent>

          <TabsContent value="account" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>{'Account Details'}</CardTitle>
                <CardDescription>{'Your account type and permissions'}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">{'Role'}</p>
                    <Badge variant={user.role === 'admin' ? 'default' : 'secondary'} className="capitalize">{user.role || 'user'}</Badge>
                  </div>
                  {user.account_type && (
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">{'Account Type'}</p>
                      <Badge variant="outline" className="capitalize">{user.account_type}</Badge>
                    </div>
                  )}
                  {user.specialty && (
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">{'Specialty'}</p>
                      <p className="text-sm font-medium">{user.specialty}</p>
                    </div>
                  )}
                  {user.team && (
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">{'Team'}</p>
                      <p className="text-sm font-medium">{user.team}</p>
                    </div>
                  )}
                </div>
                <div className="pt-4 border-t">
                  <p className="text-xs text-muted-foreground">
                    {'Account ID'}: <span className="font-mono">{user.id}</span>
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
                          }
