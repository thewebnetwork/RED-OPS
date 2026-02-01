import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Checkbox } from '../components/ui/checkbox';
import { Switch } from '../components/ui/switch';
import { Label } from '../components/ui/label';
import { 
  ArrowLeft, 
  Users, 
  Loader2, 
  Save,
  RotateCcw,
  Shield,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

const POOL_OPTIONS = [
  { value: 'POOL_1', label: 'Pool 1 (Opportunity Ribbon)', description: 'First 24 hours of ticket availability' },
  { value: 'POOL_2', label: 'Pool 2 (Opportunity Pool)', description: 'After 24 hours or if no Pool 1 pickers' }
];

const ACCOUNT_TYPE_DESCRIPTIONS = {
  'Partner': 'External partners with subscription plans',
  'Internal Staff': 'Internal team members',
  'Vendor/Freelancer': 'External vendors and freelancers',
  'Media Client': 'Clients who submit requests'
};

export default function PoolPickerRulesPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rules, setRules] = useState([]);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    fetchRules();
  }, []);

  const fetchRules = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API}/api/pool-picker-rules`);
      setRules(res.data.rules);
      setHasChanges(false);
    } catch (err) {
      console.error('Error fetching pool picker rules:', err);
      toast.error('Failed to load pool picker rules');
    } finally {
      setLoading(false);
    }
  };

  const updateRule = (accountType, field, value) => {
    setRules(prev => prev.map(rule => {
      if (rule.account_type === accountType) {
        return { ...rule, [field]: value };
      }
      return rule;
    }));
    setHasChanges(true);
  };

  const togglePool = (accountType, poolValue) => {
    setRules(prev => prev.map(rule => {
      if (rule.account_type === accountType) {
        const currentPools = rule.allowed_pools || [];
        const newPools = currentPools.includes(poolValue)
          ? currentPools.filter(p => p !== poolValue)
          : [...currentPools, poolValue];
        return { ...rule, allowed_pools: newPools };
      }
      return rule;
    }));
    setHasChanges(true);
  };

  const saveRules = async () => {
    try {
      setSaving(true);
      for (const rule of rules) {
        await axios.patch(`${API}/api/pool-picker-rules/${rule.account_type}`, {
          can_pick: rule.can_pick,
          allowed_pools: rule.allowed_pools
        });
      }
      toast.success('Pool picker rules saved successfully');
      setHasChanges(false);
    } catch (err) {
      console.error('Error saving pool picker rules:', err);
      toast.error('Failed to save pool picker rules');
    } finally {
      setSaving(false);
    }
  };

  const resetToDefaults = async () => {
    if (!window.confirm('Reset all pool picker rules to default values?')) return;
    
    try {
      setSaving(true);
      await axios.post(`${API}/api/pool-picker-rules/reset-defaults`);
      toast.success('Pool picker rules reset to defaults');
      await fetchRules();
    } catch (err) {
      console.error('Error resetting rules:', err);
      toast.error('Failed to reset rules');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]" data-testid="pool-rules-loading">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#A2182C] mx-auto mb-2" />
          <p className="text-slate-500">Loading pool picker rules...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in" data-testid="pool-picker-rules-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate('/settings')}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Shield className="text-[#A2182C]" />
              Pool Picker Rules
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              Configure which account types can pick from which pools
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={resetToDefaults}
            disabled={saving}
            data-testid="reset-defaults-btn"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset to Defaults
          </Button>
          <Button
            onClick={saveRules}
            disabled={saving || !hasChanges}
            className="bg-[#A2182C] hover:bg-[#8a1526]"
            data-testid="save-rules-btn"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Changes
          </Button>
        </div>
      </div>

      {/* Info Banner */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="p-4">
          <div className="flex gap-3">
            <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">How Pool Eligibility Works</p>
              <ul className="list-disc pl-4 space-y-1">
                <li><strong>Account Type Config:</strong> Controls which pools each account type can access</li>
                <li><strong>User-level "Can Pick":</strong> Individual user override (set in user edit)</li>
                <li><strong>Effective Rule:</strong> User can pick = Account config allows + User can_pick is ON</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Rules Grid */}
      <div className="grid gap-4">
        {rules.map((rule) => (
          <Card key={rule.account_type} data-testid={`rule-card-${rule.account_type.replace(/\s+/g, '-').toLowerCase()}`}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Users className="h-5 w-5 text-slate-500" />
                    {rule.account_type}
                  </CardTitle>
                  <CardDescription>
                    {ACCOUNT_TYPE_DESCRIPTIONS[rule.account_type] || 'Account type'}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor={`can-pick-${rule.account_type}`} className="text-sm text-slate-600">
                    Can Pick Opportunities
                  </Label>
                  <Switch
                    id={`can-pick-${rule.account_type}`}
                    checked={rule.can_pick}
                    onCheckedChange={(checked) => updateRule(rule.account_type, 'can_pick', checked)}
                    data-testid={`can-pick-toggle-${rule.account_type.replace(/\s+/g, '-').toLowerCase()}`}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className={`transition-opacity ${rule.can_pick ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                <Label className="text-sm text-slate-600 mb-3 block">Allowed Pools</Label>
                <div className="flex flex-wrap gap-4">
                  {POOL_OPTIONS.map((pool) => (
                    <label
                      key={pool.value}
                      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                        rule.allowed_pools?.includes(pool.value)
                          ? 'border-[#A2182C] bg-rose-50'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <Checkbox
                        checked={rule.allowed_pools?.includes(pool.value)}
                        onCheckedChange={() => togglePool(rule.account_type, pool.value)}
                        disabled={!rule.can_pick}
                        data-testid={`pool-checkbox-${rule.account_type.replace(/\s+/g, '-').toLowerCase()}-${pool.value.toLowerCase()}`}
                      />
                      <div>
                        <p className="font-medium text-sm">{pool.label}</p>
                        <p className="text-xs text-slate-500">{pool.description}</p>
                      </div>
                    </label>
                  ))}
                </div>
                
                {/* Current Config Summary */}
                <div className="mt-4 pt-4 border-t">
                  <p className="text-xs text-slate-500">
                    Current: {rule.can_pick ? (
                      rule.allowed_pools?.length > 0 ? (
                        <>Can pick from {rule.allowed_pools.map(p => (
                          <Badge key={p} variant="outline" className="mx-1 text-xs">
                            {p === 'POOL_1' ? 'Pool 1' : 'Pool 2'}
                          </Badge>
                        ))}</>
                      ) : (
                        <span className="text-amber-600">Can pick enabled but no pools selected</span>
                      )
                    ) : (
                      <span className="text-slate-400">Cannot pick opportunities</span>
                    )}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Unsaved Changes Warning */}
      {hasChanges && (
        <div className="fixed bottom-4 right-4 bg-amber-100 border border-amber-300 rounded-lg p-4 shadow-lg animate-fade-in">
          <p className="text-amber-800 text-sm font-medium">You have unsaved changes</p>
        </div>
      )}
    </div>
  );
}
