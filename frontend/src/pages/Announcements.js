import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Switch } from '../components/ui/switch';
import { Badge } from '../components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Megaphone, Save, Eye, Users, Shield, Globe, Info } from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Helper to format ISO date to datetime-local input value (no timezone conversion)
const formatDateTimeLocal = (isoString) => {
  if (!isoString) return '';
  // If it's already in datetime-local format (YYYY-MM-DDTHH:MM), return as-is
  if (isoString.length === 16) return isoString;
  // If it's an ISO string with timezone, extract just the local part
  // Parse and format without timezone conversion
  try {
    const date = new Date(isoString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  } catch {
    return isoString.slice(0, 16);
  }
};

export default function Announcements() {
  const [ticker, setTicker] = useState({
    message: '',
    is_active: false,
    send_to_all: true,
    target_teams: [],
    target_roles: [],
    target_specialties: [],
    start_at: '',
    end_at: '',
    priority: '',
    background_color: '#A2182C',
    text_color: '#FFFFFF'
  });
  const [teams, setTeams] = useState([]);
  const [roles, setRoles] = useState([]);
  const [specialties, setSpecialties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [validationError, setValidationError] = useState('');
  const initialDataRef = useRef(null);

  useEffect(() => {
    fetchData();
  }, []);

  // Track changes
  useEffect(() => {
    if (initialDataRef.current) {
      const changed = JSON.stringify(ticker) !== JSON.stringify(initialDataRef.current);
      setHasChanges(changed);
    }
    
    // Validation: if send_to_all is OFF, require at least one team, role, or specialty
    if (!ticker.send_to_all && 
        ticker.target_teams.length === 0 && 
        ticker.target_roles.length === 0 && 
        ticker.target_specialties.length === 0) {
      setValidationError('Select at least one role, team, or specialty, or turn on "Send to all"');
    } else {
      setValidationError('');
    }
  }, [ticker]);

  // Browser beforeunload warning
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasChanges) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes.';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasChanges]);

  const fetchData = async () => {
    try {
      const [tickerRes, teamsRes, rolesRes, specialtiesRes] = await Promise.all([
        axios.get(`${API}/announcement-ticker/admin`),
        axios.get(`${API}/teams`),
        axios.get(`${API}/roles`),
        axios.get(`${API}/specialties`)
      ]);
      
      const tickerData = {
        message: tickerRes.data.message || '',
        is_active: tickerRes.data.is_active || false,
        send_to_all: tickerRes.data.send_to_all ?? true,
        target_teams: tickerRes.data.target_teams || [],
        target_roles: tickerRes.data.target_roles || [],
        target_specialties: tickerRes.data.target_specialties || [],
        start_at: tickerRes.data.start_at || '',
        end_at: tickerRes.data.end_at || '',
        priority: tickerRes.data.priority || '',
        background_color: tickerRes.data.background_color || '#A2182C',
        text_color: tickerRes.data.text_color || '#FFFFFF'
      };
      
      setTicker(tickerData);
      initialDataRef.current = tickerData;
      setTeams(teamsRes.data || []);
      setRoles(rolesRes.data || []);
      setSpecialties(specialtiesRes.data || []);
    } catch (error) {
      console.error('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    // Validate before saving
    if (!ticker.send_to_all && ticker.target_teams.length === 0 && ticker.target_roles.length === 0) {
      toast.error('Select at least one team or role, or turn on "Send to all"');
      return;
    }
    
    setSaving(true);
    try {
      await axios.put(`${API}/announcement-ticker`, ticker);
      toast.success('Announcement updated');
      initialDataRef.current = { ...ticker };
      setHasChanges(false);
      // Trigger a page refresh for the ticker component
      window.dispatchEvent(new Event('ticker-updated'));
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update announcement');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleTeam = (teamId) => {
    setTicker(prev => {
      const newTargets = prev.target_teams.includes(teamId)
        ? prev.target_teams.filter(id => id !== teamId)
        : [...prev.target_teams, teamId];
      return { ...prev, target_teams: newTargets };
    });
  };

  const handleToggleRole = (roleId) => {
    setTicker(prev => {
      const newTargets = prev.target_roles.includes(roleId)
        ? prev.target_roles.filter(id => id !== roleId)
        : [...prev.target_roles, roleId];
      return { ...prev, target_roles: newTargets };
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-rose-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in" data-testid="announcements-page">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Announcement Banner</h1>
        <p className="text-slate-500 mt-1">Manage the global announcement banner and target specific audiences</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Settings Card */}
        <Card className="border-slate-200">
          <CardHeader className="border-b border-slate-100 pb-4">
            <CardTitle className="flex items-center gap-2">
              <Megaphone size={20} />
              Banner Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            {/* Active Toggle */}
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
              <div>
                <Label className="text-base">Enable Banner</Label>
                <p className="text-sm text-slate-500">Show the announcement banner</p>
              </div>
              <Switch
                checked={ticker.is_active}
                onCheckedChange={(checked) => setTicker(prev => ({ ...prev, is_active: checked }))}
                data-testid="ticker-active-switch"
              />
            </div>

            {/* Message */}
            <div>
              <Label>Announcement Message *</Label>
              <Textarea
                value={ticker.message}
                onChange={(e) => setTicker(prev => ({ ...prev, message: e.target.value }))}
                placeholder="Enter your announcement message..."
                className="mt-1.5 min-h-[80px]"
                data-testid="ticker-message-input"
              />
            </div>

            {/* Schedule */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Start Date/Time (optional)</Label>
                <Input
                  type="datetime-local"
                  value={ticker.start_at ? formatDateTimeLocal(ticker.start_at) : ''}
                  onChange={(e) => setTicker(prev => ({ ...prev, start_at: e.target.value || '' }))}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label>End Date/Time (optional)</Label>
                <Input
                  type="datetime-local"
                  value={ticker.end_at ? formatDateTimeLocal(ticker.end_at) : ''}
                  onChange={(e) => setTicker(prev => ({ ...prev, end_at: e.target.value || '' }))}
                  className="mt-1.5"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Targeting Card */}
        <Card className="border-slate-200">
          <CardHeader className="border-b border-slate-100 pb-4">
            <CardTitle className="flex items-center gap-2">
              <Users size={20} />
              Audience Targeting
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            {/* Send to All Toggle */}
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
              <div className="flex items-center gap-3">
                <Globe size={20} className="text-slate-500" />
                <div>
                  <Label className="text-base">Send to All</Label>
                  <p className="text-sm text-slate-500">Show to everyone</p>
                </div>
              </div>
              <Switch
                checked={ticker.send_to_all}
                onCheckedChange={(checked) => setTicker(prev => ({ ...prev, send_to_all: checked }))}
                data-testid="send-to-all-switch"
              />
            </div>

            {ticker.send_to_all ? (
              <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg">
                <div className="flex items-start gap-2">
                  <Info size={16} className="text-blue-500 mt-0.5" />
                  <p className="text-sm text-blue-700">This announcement will be shown to everyone.</p>
                </div>
              </div>
            ) : (
              <>
                {/* Team Selector */}
                <div>
                  <Label className="flex items-center gap-2 mb-2">
                    <Users size={16} />
                    Target Teams
                  </Label>
                  <div className="space-y-2 max-h-40 overflow-y-auto border border-slate-200 rounded-lg p-3">
                    {teams.length === 0 ? (
                      <p className="text-sm text-slate-500">No teams available</p>
                    ) : (
                      teams.map(team => (
                        <label key={team.id} className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-2 rounded">
                          <input
                            type="checkbox"
                            checked={ticker.target_teams.includes(team.id)}
                            onChange={() => handleToggleTeam(team.id)}
                            className="rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                          />
                          <span className="text-sm">{team.name}</span>
                        </label>
                      ))
                    )}
                  </div>
                  {ticker.target_teams.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {ticker.target_teams.map(teamId => {
                        const team = teams.find(t => t.id === teamId);
                        return team && (
                          <Badge key={teamId} className="bg-blue-100 text-blue-700">
                            {team.name}
                          </Badge>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Role Selector */}
                <div>
                  <Label className="flex items-center gap-2 mb-2">
                    <Shield size={16} />
                    Target Roles
                  </Label>
                  <div className="space-y-2 max-h-40 overflow-y-auto border border-slate-200 rounded-lg p-3">
                    {roles.length === 0 ? (
                      <p className="text-sm text-slate-500">No roles available</p>
                    ) : (
                      roles.map(role => (
                        <label key={role.id} className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-2 rounded">
                          <input
                            type="checkbox"
                            checked={ticker.target_roles.includes(role.id)}
                            onChange={() => handleToggleRole(role.id)}
                            className="rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                          />
                          <span className="text-sm">{role.name}</span>
                        </label>
                      ))
                    )}
                  </div>
                  {ticker.target_roles.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {ticker.target_roles.map(roleId => {
                        const role = roles.find(r => r.id === roleId);
                        return role && (
                          <Badge key={roleId} className="bg-purple-100 text-purple-700">
                            {role.name}
                          </Badge>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Specialty Selector */}
                <div>
                  <Label className="flex items-center gap-2 mb-2">
                    <Briefcase size={16} />
                    Target Specialties
                  </Label>
                  <div className="space-y-2 max-h-40 overflow-y-auto border border-slate-200 rounded-lg p-3">
                    {specialties.length === 0 ? (
                      <p className="text-sm text-slate-500">No specialties available</p>
                    ) : (
                      specialties.map(specialty => (
                        <label key={specialty.id} className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-2 rounded">
                          <input
                            type="checkbox"
                            checked={ticker.target_specialties.includes(specialty.id)}
                            onChange={() => handleToggleSpecialty(specialty.id)}
                            className="rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                          />
                          <span className="text-sm">{specialty.name}</span>
                        </label>
                      ))
                    )}
                  </div>
                  {ticker.target_specialties.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {ticker.target_specialties.map(specialtyId => {
                        const specialty = specialties.find(s => s.id === specialtyId);
                        return specialty && (
                          <Badge key={specialtyId} className="bg-emerald-100 text-emerald-700">
                            {specialty.name}
                          </Badge>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Helper Text */}
                <div className="p-4 bg-amber-50 border border-amber-100 rounded-lg">
                  <div className="flex items-start gap-2">
                    <Info size={16} className="text-amber-500 mt-0.5" />
                    <p className="text-sm text-amber-700">
                      Users who match <strong>any</strong> selected team, role, or specialty will see this announcement.
                    </p>
                  </div>
                </div>

                {/* Validation Error */}
                {validationError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-700">{validationError}</p>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Preview & Save */}
      <Card className="border-slate-200">
        <CardHeader className="border-b border-slate-100 pb-4">
          <CardTitle className="flex items-center gap-2">
            <Eye size={20} />
            Preview
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="border border-slate-200 rounded-lg overflow-hidden mb-6">
            {/* Simulated Header */}
            <div className="bg-white h-16 flex items-center px-6 border-b border-slate-200">
              <div className="flex items-center gap-4">
                <div className="w-8 h-8 bg-slate-200 rounded" />
                <div className="w-24 h-4 bg-slate-200 rounded" />
              </div>
              <div className="flex-1" />
              
              {/* Banner Preview (inline in header) */}
              {ticker.is_active && ticker.message && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-lg border border-slate-200 mr-4 max-w-sm">
                  <Megaphone size={16} className="shrink-0 text-black" />
                  <span className="text-sm font-bold text-black truncate">{ticker.message}</span>
                </div>
              )}
              
              <div className="w-8 h-8 bg-slate-200 rounded-full" />
            </div>
            
            {/* Simulated Content */}
            <div className="p-6 space-y-3 bg-slate-50">
              <div className="w-full h-6 bg-slate-200 rounded" />
              <div className="w-3/4 h-4 bg-slate-200 rounded" />
              <div className="w-1/2 h-4 bg-slate-200 rounded" />
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="text-sm text-slate-500">
              {ticker.is_active ? (
                ticker.send_to_all ? (
                  <span className="flex items-center gap-2">
                    <Globe size={16} /> Visible to all users
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Users size={16} /> 
                    Visible to: {ticker.target_teams.length} team(s), {ticker.target_roles.length} role(s)
                  </span>
                )
              ) : (
                <span className="text-slate-400">Banner is disabled</span>
              )}
            </div>
            
            <Button 
              onClick={handleSave} 
              className={`${hasChanges && !validationError ? 'bg-rose-600 hover:bg-rose-700' : 'bg-slate-400'}`}
              disabled={saving || !hasChanges || !!validationError}
              data-testid="save-ticker-btn"
            >
              <Save size={18} className="mr-2" />
              {saving ? 'Saving...' : hasChanges ? 'Save Changes' : 'No Changes'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
