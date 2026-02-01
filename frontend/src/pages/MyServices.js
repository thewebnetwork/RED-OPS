import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog';
import { 
  PackageOpen,
  CreditCard,
  Building2,
  Briefcase,
  CheckCircle2,
  Edit,
  Save,
  Users,
  Star
} from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function MyServices() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [serviceContent, setServiceContent] = useState(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [subscriptionPlan, setSubscriptionPlan] = useState(null);

  const isAdmin = user?.role === 'Administrator';

  useEffect(() => {
    fetchServiceContent();
  }, []);

  const fetchServiceContent = async () => {
    try {
      // Fetch service content from settings
      const contentRes = await axios.get(`${API}/settings/my-services-content`).catch(() => ({ data: null }));
      setServiceContent(contentRes.data);
      setEditContent(contentRes.data?.content || '');

      // Fetch user's subscription plan if they're a Partner
      if (user?.subscription_plan_id) {
        const planRes = await axios.get(`${API}/subscription-plans/${user.subscription_plan_id}`).catch(() => ({ data: null }));
        setSubscriptionPlan(planRes.data);
      }
    } catch (error) {
      console.error('Failed to fetch service content');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveContent = async () => {
    setSaving(true);
    try {
      await axios.put(`${API}/settings/my-services-content`, { content: editContent });
      setServiceContent({ content: editContent });
      setEditDialogOpen(false);
      toast.success('Service content updated');
    } catch (error) {
      toast.error('Failed to save content');
    } finally {
      setSaving(false);
    }
  };

  const getAccountTypeBadge = () => {
    const colors = {
      'Partner': 'bg-purple-100 text-purple-700',
      'Media Client': 'bg-cyan-100 text-cyan-700',
      'Internal Staff': 'bg-orange-100 text-orange-700',
      'Vendor/Freelancer': 'bg-emerald-100 text-emerald-700'
    };
    return colors[user?.account_type] || 'bg-slate-100 text-slate-700';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#A2182C]"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="my-services-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <PackageOpen className="text-[#A2182C]" />
            My Services
          </h1>
          <p className="text-slate-500 mt-1">View your account details and service information</p>
        </div>
        {isAdmin && (
          <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" data-testid="edit-services-btn">
                <Edit size={16} className="mr-2" />
                Edit Content
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Edit Service Content</DialogTitle>
                <DialogDescription>
                  Customize the information displayed to all users on the My Services page.
                  Use Markdown formatting for rich text.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div>
                  <Label>Service Information Content</Label>
                  <Textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="mt-2 min-h-[300px] font-mono text-sm"
                    placeholder="Enter service information using Markdown...

# Welcome to Our Services

## What We Offer
- Service 1
- Service 2

## Contact
For support, email support@example.com"
                    data-testid="services-content-input"
                  />
                </div>
                <div className="flex gap-3 justify-end">
                  <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleSaveContent} disabled={saving} data-testid="save-services-btn">
                    <Save size={16} className="mr-2" />
                    {saving ? 'Saving...' : 'Save Content'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* User Account Info */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Account Details Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 size={20} className="text-slate-500" />
              Account Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500">Account Type</span>
              <Badge className={getAccountTypeBadge()}>
                {user?.account_type || 'Not set'}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500">Role</span>
              <Badge variant="outline">{user?.role}</Badge>
            </div>
            {user?.specialty_name && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">Specialty</span>
                <span className="text-sm font-medium flex items-center gap-1">
                  <Briefcase size={14} className="text-slate-400" />
                  {user.specialty_name}
                </span>
              </div>
            )}
            {user?.team_name && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">Team</span>
                <span className="text-sm font-medium flex items-center gap-1">
                  <Users size={14} className="text-slate-400" />
                  {user.team_name}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Subscription Plan Card - Only for Partners */}
        {user?.account_type === 'Partner' && (
          <Card className="border-purple-200 bg-purple-50/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-purple-800">
                <CreditCard size={20} />
                Subscription Plan
              </CardTitle>
              <CardDescription>Your current partner subscription</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-purple-600">Current Plan</span>
                <Badge className="bg-purple-600 text-white">
                  {subscriptionPlan?.name || user?.subscription_plan_name || 'Unknown'}
                </Badge>
              </div>
              {subscriptionPlan?.description && (
                <p className="text-sm text-purple-700">{subscriptionPlan.description}</p>
              )}
              {subscriptionPlan?.features && subscriptionPlan.features.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-purple-800 mb-2">Plan Features:</p>
                  <ul className="space-y-1">
                    {subscriptionPlan.features.map((feature, idx) => (
                      <li key={idx} className="text-sm text-purple-700 flex items-center gap-2">
                        <CheckCircle2 size={14} className="text-purple-500" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Non-Partner Info Card */}
        {user?.account_type && user?.account_type !== 'Partner' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Star size={20} className="text-amber-500" />
                Service Access
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600">
                As a <strong>{user.account_type}</strong>, you have access to request services 
                and manage your work within the platform.
              </p>
              {user.account_type === 'Media Client' && (
                <p className="text-sm text-slate-500 mt-3">
                  Your services are billed on an A La Carte basis. Contact support for pricing details.
                </p>
              )}
              {user.account_type === 'Vendor/Freelancer' && (
                <p className="text-sm text-slate-500 mt-3">
                  Pick available work from the pool to earn based on completed services.
                </p>
              )}
              {user.account_type === 'Internal Staff' && (
                <p className="text-sm text-slate-500 mt-3">
                  Access all operational features as part of the internal team.
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Admin-editable Content */}
      <Card>
        <CardHeader>
          <CardTitle>Service Information</CardTitle>
          <CardDescription>Important information about our services</CardDescription>
        </CardHeader>
        <CardContent>
          {serviceContent?.content ? (
            <div className="prose prose-slate max-w-none">
              {/* Simple markdown rendering */}
              {serviceContent.content.split('\n').map((line, idx) => {
                if (line.startsWith('# ')) {
                  return <h1 key={idx} className="text-xl font-bold mt-4 mb-2">{line.slice(2)}</h1>;
                } else if (line.startsWith('## ')) {
                  return <h2 key={idx} className="text-lg font-semibold mt-3 mb-2">{line.slice(3)}</h2>;
                } else if (line.startsWith('- ')) {
                  return <li key={idx} className="ml-4">{line.slice(2)}</li>;
                } else if (line.trim()) {
                  return <p key={idx} className="text-slate-600 my-1">{line}</p>;
                }
                return null;
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500">
              <PackageOpen size={40} className="mx-auto mb-3 text-slate-300" />
              <p>No service information has been configured.</p>
              {isAdmin && (
                <p className="text-sm mt-2">Click "Edit Content" to add information.</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
