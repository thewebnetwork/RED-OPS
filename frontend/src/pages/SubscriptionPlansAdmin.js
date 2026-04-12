import { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
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
import { Plus, Search, Edit, Trash2, CreditCard, CheckCircle2, Users, DollarSign, Star } from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function SubscriptionPlansAdmin() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [planToDelete, setPlanToDelete] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price_monthly: '',
    price_yearly: '',
    features: '',
    sort_order: 1
  });

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      const response = await axios.get(`${API}/subscription-plans`);
      setPlans(response.data);
    } catch (error) {
      toast.error('Failed to fetch subscription plans');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (plan = null) => {
    if (plan) {
      setEditingPlan(plan);
      setFormData({
        name: plan.name,
        description: plan.description || '',
        price_monthly: plan.price_monthly || '',
        price_yearly: plan.price_yearly || '',
        features: (plan.features || []).join('\n'),
        sort_order: plan.sort_order || 1
      });
    } else {
      setEditingPlan(null);
      setFormData({
        name: '',
        description: '',
        price_monthly: '',
        price_yearly: '',
        features: '',
        sort_order: plans.length + 1
      });
    }
    setDialogOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Name is required');
      return;
    }

    try {
      const submitData = {
        ...formData,
        price_monthly: formData.price_monthly ? parseFloat(formData.price_monthly) : null,
        price_yearly: formData.price_yearly ? parseFloat(formData.price_yearly) : null,
        features: formData.features.split("\n").filter(f => f.trim()),
        sort_order: parseInt(formData.sort_order) || 1
      };

      if (editingPlan) {
        await axios.patch(`${API}/subscription-plans/${editingPlan.id}`, submitData);
        toast.success('Subscription plan updated');
      } else {
        await axios.post(`${API}/subscription-plans`, submitData);
        toast.success('Subscription plan created');
      }
      setDialogOpen(false);
      fetchPlans();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save plan');
    }
  };

  const handleDelete = async () => {
    if (!planToDelete) return;
    try {
      await axios.delete(`${API}/subscription-plans/${planToDelete.id}`);
      toast.success('Subscription plan deleted');
      setDeleteDialogOpen(false);
      setPlanToDelete(null);
      fetchPlans();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete plan');
    }
  };

  const filteredPlans = plans.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.description || '').toLowerCase().includes(search.toLowerCase())
  );

  const getPlanColor = (index) => {
    const colors = ['#10B981', '#3B82F6', '#8B5CF6', '#F59E0B'];
    return colors[index % colors.length];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent)]"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in" data-testid="subscription-plans-admin-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CreditCard className="text-[var(--accent)]" />
            Subscription Plans
          </h1>
          <p className="mt-1">Manage Partner subscription plans and features</p>
        </div>
        <Button
          className="bg-[var(--accent)] hover:bg-[var(--accent-hover)]"
          onClick={() => handleOpenDialog()}
          data-testid="add-plan-btn"
        >
          <Plus size={18} className="mr-2" />
          Add Plan
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2" size={18} />
        <Input
          placeholder="Search plans..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
          data-testid="plan-search"
        />
      </div>

      {/* Plans Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        {filteredPlans.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)).map((plan, index) => (
          <Card 
            key={plan.id} 
            className="hover:shadow-md transition-shadow relative overflow-hidden"
            data-testid={`plan-card-${plan.id}`}
          >
            <div 
              className="absolute top-0 left-0 right-0 h-1" 
              style={{ backgroundColor: getPlanColor(index) }}
            />
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{plan.name}</CardTitle>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleOpenDialog(plan)}
                    data-testid={`edit-plan-${plan.id}`}
                  >
                    <Edit size={14} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setPlanToDelete(plan);
                      setDeleteDialogOpen(true);
                    }}
                    data-testid={`delete-plan-${plan.id}`}
                  >
                    <Trash2 size={14} className="text-red-500" />
                  </Button>
                </div>
              </div>
              {plan.description && (
                <p className="text-sm">{plan.description}</p>
              )}
            </CardHeader>
            <CardContent>
              {/* Pricing */}
              {(plan.price_monthly || plan.price_yearly) ? (
                <div className="mb-4">
                  {plan.price_monthly && (
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-bold">${plan.price_monthly}</span>
                      <span className="text-sm">/month</span>
                    </div>
                  )}
                  {plan.price_yearly && (
                    <p className="text-sm">
                      or ${plan.price_yearly}/year
                    </p>
                  )}
                </div>
              ) : (
                <div className="mb-4 text-sm">No pricing set</div>
              )}

              {/* Features */}
              {plan.features && plan.features.length > 0 && (
                <ul className="space-y-2">
                  {plan.features.slice(0, 4).map((feature, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-sm">
                      <CheckCircle2 size={14} className="text-green-500 flex-shrink-0" />
                      <span className="">{feature}</span>
                    </li>
                  ))}
                  {plan.features.length > 4 && (
                    <li className="text-xs">
                      +{plan.features.length - 4} more features
                    </li>
                  )}
                </ul>
              )}

              {/* User count */}
              <div className="flex items-center gap-1 mt-4 pt-4 border-t text-xs">
                <Users size={12} />
                <span>{plan.user_count || 0} partners</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredPlans.length === 0 && (
        <div className="text-center py-12">
          <CreditCard size={48} className="mx-auto mb-4 text-slate-300" />
          <p>No subscription plans found</p>
          <p className="text-sm mt-1">Create your first plan to get started</p>
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingPlan ? 'Edit Plan' : 'Add Subscription Plan'}</DialogTitle>
            <DialogDescription>
              {editingPlan ? 'Update plan details' : 'Create a new Partner subscription plan'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="name">Plan Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Core, Engage, Scale"
                data-testid="plan-name-input"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description of this plan"
                data-testid="plan-description-input"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="price_monthly">Monthly Price ($)</Label>
                <Input
                  id="price_monthly"
                  type="number"
                  step="0.01"
                  value={formData.price_monthly}
                  onChange={(e) => setFormData({ ...formData, price_monthly: e.target.value })}
                  placeholder="99.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="price_yearly">Yearly Price ($)</Label>
                <Input
                  id="price_yearly"
                  type="number"
                  step="0.01"
                  value={formData.price_yearly}
                  onChange={(e) => setFormData({ ...formData, price_yearly: e.target.value })}
                  placeholder="999.00"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="features">Features (one per line)</Label>
              <Textarea
                id="features"
                value={formData.features}
                onChange={(e) => setFormData({ ...formData, features: e.target.value })}
                placeholder="Priority Support
Enhanced SLA
Advanced Analytics
Custom Integrations"
                className="min-h-[120px]"
                data-testid="plan-features-input"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sort_order">Display Order</Label>
              <Input
                id="sort_order"
                type="number"
                min="1"
                value={formData.sort_order}
                onChange={(e) => setFormData({ ...formData, sort_order: e.target.value })}
                placeholder="1"
              />
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-[var(--accent)] hover:bg-[var(--accent-hover)]" data-testid="save-plan-btn">
                {editingPlan ? 'Save Changes' : 'Create Plan'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Subscription Plan</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{planToDelete?.name}"?
              {planToDelete?.user_count > 0 && (
                <span className="block mt-2 text-amber-600">
                  Warning: {planToDelete.user_count} partners are subscribed to this plan.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
