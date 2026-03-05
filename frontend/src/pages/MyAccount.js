import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { 
  User, 
  Shield,
  Key
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function MyAccount() {
  const { t } = useTranslation();
  const { user, refreshUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [profileData, setProfileData] = useState({
    name: '',
    email: '',
    phone: '',
    company: ''
  });
  const [passwordData, setPasswordData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  });

  useEffect(() => {
    if (user) {
      setProfileData({
        name: user.name || '',
        email: user.email || '',
        phone: user.phone || '',
        company: user.company || ''
      });
    }
  }, [user]);

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.patch(`${API}/users/profile`, profileData);
      await refreshUser();
      toast.success(t('myAccount.profileUpdated', 'Profile updated successfully'));
    } catch (error) {
      toast.error(error.response?.data?.detail || t('myAccount.updateFailed', 'Failed to update profile'));
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (passwordData.new_password !== passwordData.confirm_password) {
      toast.error(t('myAccount.passwordMismatch', 'Passwords do not match'));
      return;
    }
    if (passwordData.new_password.length < 8) {
      toast.error(t('myAccount.passwordTooShort', 'Password must be at least 8 characters'));
      return;
    }
    
    setLoading(true);
    try {
      await axios.post(`${API}/auth/change-password`, {
        current_password: passwordData.current_password,
        new_password: passwordData.new_password
      });
      toast.success(t('myAccount.passwordChanged', 'Password changed successfully'));
      setPasswordData({ current_password: '', new_password: '', confirm_password: '' });
    } catch (error) {
      toast.error(error.response?.data?.detail || t('myAccount.passwordChangeFailed', 'Failed to change password'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto" data-testid="my-account-page">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{t('myAccount.title', 'My Account')}</h1>
        <p className="text-slate-500 mt-1">{t('myAccount.subtitle', 'Manage your profile and preferences')}</p>
      </div>

      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-xs">
          <TabsTrigger value="profile" className="flex items-center gap-2">
            <User size={16} />
            {t('myAccount.profile', 'Profile')}
          </TabsTrigger>
          <TabsTrigger value="security" className="flex items-center gap-2">
            <Shield size={16} />
            {t('myAccount.security', 'Security')}
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t('myAccount.personalInfo', 'Personal Information')}</CardTitle>
              <CardDescription>{t('myAccount.personalInfoDesc', 'Update your personal details')}</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleProfileUpdate} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>{t('myAccount.fullName', 'Full Name')}</Label>
                    <Input
                      value={profileData.name}
                      onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                      className="mt-1.5"
                      data-testid="profile-name-input"
                    />
                  </div>
                  <div>
                    <Label>{t('myAccount.email', 'Email')}</Label>
                    <Input
                      type="email"
                      value={profileData.email}
                      disabled
                      className="mt-1.5 bg-slate-50"
                    />
                    <p className="text-xs text-slate-400 mt-1">{t('myAccount.emailCannotChange', 'Contact support to change email')}</p>
                  </div>
                  <div>
                    <Label>{t('myAccount.phone', 'Phone')}</Label>
                    <Input
                      value={profileData.phone}
                      onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                      className="mt-1.5"
                      placeholder="+1 (555) 000-0000"
                      data-testid="profile-phone-input"
                    />
                  </div>
                  <div>
                    <Label>{t('myAccount.company', 'Company')}</Label>
                    <Input
                      value={profileData.company}
                      onChange={(e) => setProfileData({ ...profileData, company: e.target.value })}
                      className="mt-1.5"
                      data-testid="profile-company-input"
                    />
                  </div>
                </div>
                <div className="flex justify-end pt-4">
                  <Button 
                    type="submit" 
                    disabled={loading}
                    className="bg-[#A2182C] hover:bg-[#8B1526]"
                    data-testid="save-profile-btn"
                  >
                    {loading ? t('common.saving', 'Saving...') : t('common.saveChanges', 'Save Changes')}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security" className="mt-6 space-y-4">
          {/* Change Password */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t('myAccount.changePassword', 'Change Password')}</CardTitle>
              <CardDescription>{t('myAccount.changePasswordDesc', 'Update your password regularly for security')}</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePasswordChange} className="space-y-4">
                <div>
                  <Label>{t('myAccount.currentPassword', 'Current Password')}</Label>
                  <Input
                    type="password"
                    value={passwordData.current_password}
                    onChange={(e) => setPasswordData({ ...passwordData, current_password: e.target.value })}
                    className="mt-1.5"
                    data-testid="current-password-input"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>{t('myAccount.newPassword', 'New Password')}</Label>
                    <Input
                      type="password"
                      value={passwordData.new_password}
                      onChange={(e) => setPasswordData({ ...passwordData, new_password: e.target.value })}
                      className="mt-1.5"
                      data-testid="new-password-input"
                    />
                  </div>
                  <div>
                    <Label>{t('myAccount.confirmPassword', 'Confirm Password')}</Label>
                    <Input
                      type="password"
                      value={passwordData.confirm_password}
                      onChange={(e) => setPasswordData({ ...passwordData, confirm_password: e.target.value })}
                      className="mt-1.5"
                      data-testid="confirm-password-input"
                    />
                  </div>
                </div>
                <div className="flex justify-end pt-4">
                  <Button 
                    type="submit" 
                    disabled={loading}
                    className="bg-[#A2182C] hover:bg-[#8B1526]"
                    data-testid="change-password-btn"
                  >
                    {t('myAccount.updatePassword', 'Update Password')}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Two-Factor Authentication */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t('myAccount.twoFactor', 'Two-Factor Authentication')}</CardTitle>
              <CardDescription>{t('myAccount.twoFactorDesc', 'Add an extra layer of security')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-slate-100 rounded-lg">
                    <Key size={20} className="text-slate-600" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-900">{t('myAccount.authenticatorApp', 'Authenticator App')}</p>
                    <p className="text-sm text-slate-500">
                      {user?.otp_verified 
                        ? t('myAccount.twoFactorEnabled', 'Enabled - Your account is protected')
                        : t('myAccount.twoFactorDisabled', 'Not enabled')}
                    </p>
                  </div>
                </div>
                <Badge className={user?.otp_verified ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}>
                  {user?.otp_verified ? t('myAccount.enabled', 'Enabled') : t('myAccount.disabled', 'Disabled')}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
