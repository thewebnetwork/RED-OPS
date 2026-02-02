import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Switch } from '../components/ui/switch';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Megaphone, Plus, Edit, Trash2, Eye, Users, Shield, Globe, Briefcase, Calendar, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const formatDateTimeLocal = (isoString) => {
  if (!isoString) return '';
  if (isoString.length === 16) return isoString;
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
  const [activeTab, setActiveTab] = useState('list');
  const [announcements, setAnnouncements] = useState([]);
  const [teams, setTeams] = useState([]);
  const [roles, setRoles] = useState([]);
  const [specialties, setSpecialties] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState(null);
  const [deleteDialog, setDeleteDialog] = useState({ open: false, item: null });
  
  // Form state
  const [form, setForm] = useState({
    title: '',
    message: '',
    is_active: true,
    send_to_all: true,
    target_teams: [],
    target_roles: [],
    target_specialties: [],
    start_at: '',
    end_at: '',
    priority: 1,
    background_color: '#A2182C',
    text_color: '#FFFFFF'
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [announcementsRes, teamsRes, rolesRes, specialtiesRes] = await Promise.all([
        axios.get(`${API}/announcements`).catch(() => ({ data: [] })),
        axios.get(`${API}/teams`),
        axios.get(`${API}/iam/roles`).catch(() => ({ data: [] })),
        axios.get(`${API}/specialties`)
      ]);
      
      setAnnouncements(announcementsRes.data || []);
      setTeams(teamsRes.data || []);
      setRoles(rolesRes.data || []);
      setSpecialties(specialtiesRes.data || []);
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const openDialog = (announcement = null) => {
    if (announcement) {
      setEditingAnnouncement(announcement);
      setForm({
        title: announcement.title || '',
        message: announcement.message || '',
        is_active: announcement.is_active ?? true,
        send_to_all: announcement.send_to_all ?? true,
        target_teams: announcement.target_teams || [],
        target_roles: announcement.target_roles || [],
        target_specialties: announcement.target_specialties || [],
        start_at: formatDateTimeLocal(announcement.start_at) || '',
        end_at: formatDateTimeLocal(announcement.end_at) || '',
        priority: announcement.priority || 1,
        background_color: announcement.background_color || '#A2182C',
        text_color: announcement.text_color || '#FFFFFF'
      });
    } else {
      setEditingAnnouncement(null);
      setForm({
        title: '',
        message: '',
        is_active: true,
        send_to_all: true,
        target_teams: [],
        target_roles: [],
        target_specialties: [],
        start_at: '',
        end_at: '',
        priority: 1,
        background_color: '#A2182C',
        text_color: '#FFFFFF'
      });
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.message.trim()) {
      toast.error('Title and message are required');
      return;
    }
    
    if (!form.send_to_all && !form.target_teams.length && !form.target_roles.length && !form.target_specialties.length) {
      toast.error('Select at least one target or enable "Send to all"');
      return;
    }
    
    try {
      const payload = {
        ...form,
        start_at: form.start_at ? new Date(form.start_at).toISOString() : null,
        end_at: form.end_at ? new Date(form.end_at).toISOString() : null
      };
      
      if (editingAnnouncement) {
        await axios.patch(`${API}/announcements/${editingAnnouncement.id}`, payload);
        toast.success('Announcement updated');
      } else {
        await axios.post(`${API}/announcements`, payload);
        toast.success('Announcement created');
      }
      
      setDialogOpen(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save announcement');
    }
  };

  const handleDelete = async () => {
    try {
      await axios.delete(`${API}/announcements/${deleteDialog.item.id}`);
      toast.success('Announcement deleted');
      setDeleteDialog({ open: false, item: null });
      fetchData();
    } catch (error) {
      toast.error('Failed to delete announcement');
    }
  };

  const handleToggle = (field, id) => {
    const current = form[field];
    const updated = current.includes(id) 
      ? current.filter(i => i !== id)
      : [...current, id];
    setForm({ ...form, [field]: updated });
  };

  const getStatusBadge = (ann) => {
    const now = new Date();
    const startAt = ann.start_at ? new Date(ann.start_at) : null;
    const endAt = ann.end_at ? new Date(ann.end_at) : null;
    
    if (!ann.is_active) return <Badge variant="outline" className="text-slate-500">Inactive</Badge>;
    if (startAt && now < startAt) return <Badge className="bg-yellow-100 text-yellow-700">Scheduled</Badge>;
    if (endAt && now > endAt) return (
      <Badge className="bg-slate-100 text-slate-600" title="Will be auto-deleted after 24 hours">
        Expired (24h retention)
      </Badge>
    );
    return <Badge className="bg-emerald-100 text-emerald-700">Active</Badge>;
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#A2182C]"></div></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in" data-testid="announcements-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Megaphone className="text-[#A2182C]" />
            {t('announcements.title')}
          </h1>
          <p className="text-slate-500 mt-1">{t('announcements.description')}</p>
        </div>
        <Button className="bg-rose-600 hover:bg-rose-700" onClick={() => openDialog()}>
          <Plus size={16} className="mr-2" />
          {t('announcements.newAnnouncement')}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{announcements.length}</p>
            <p className="text-sm text-slate-500">{t('announcements.total')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-emerald-600">{announcements.filter(a => a.is_active).length}</p>
            <p className="text-sm text-slate-500">{t('common.active')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-yellow-600">{announcements.filter(a => a.start_at && new Date(a.start_at) > new Date()).length}</p>
            <p className="text-sm text-slate-500">{t('announcements.scheduled')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-slate-400">{announcements.filter(a => !a.is_active).length}</p>
            <p className="text-sm text-slate-500">{t('common.inactive')}</p>
          </CardContent>
        </Card>
      </div>

      {/* Announcements List */}
      <Card>
        <CardHeader>
          <CardTitle>{t('announcements.allAnnouncements')}</CardTitle>
          <CardDescription>{t('announcements.displayDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          {announcements.length === 0 ? (
            <div className="py-12 text-center text-slate-500">
              <Megaphone size={48} className="mx-auto mb-4 text-slate-300" />
              <p>{t('announcements.noAnnouncements')}</p>
              <Button className="mt-4 bg-rose-600 hover:bg-rose-700" onClick={() => openDialog()}>
                {t('announcements.createFirst')}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {announcements.map((ann) => (
                <div 
                  key={ann.id} 
                  className="p-4 border rounded-lg hover:bg-slate-50 transition-colors"
                  style={{ borderLeftColor: ann.background_color, borderLeftWidth: '4px' }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-slate-900">{ann.title}</h3>
                        {getStatusBadge(ann)}
                        <Badge variant="outline" className="text-xs">{t('announcements.priority')}: {ann.priority}</Badge>
                      </div>
                      <p className="text-sm text-slate-600 mt-1 line-clamp-2">{ann.message}</p>
                      <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-slate-500">
                        {ann.send_to_all ? (
                          <span className="flex items-center gap-1"><Globe size={12} /> {t('announcements.allUsers')}</span>
                        ) : (
                          <>
                            {ann.target_team_names?.length > 0 && (
                              <span className="flex items-center gap-1"><Users size={12} /> {ann.target_team_names.join(', ')}</span>
                            )}
                            {ann.target_role_names?.length > 0 && (
                              <span className="flex items-center gap-1"><Shield size={12} /> {ann.target_role_names.join(', ')}</span>
                            )}
                            {ann.target_specialty_names?.length > 0 && (
                              <span className="flex items-center gap-1"><Briefcase size={12} /> {ann.target_specialty_names.join(', ')}</span>
                            )}
                          </>
                        )}
                        {ann.start_at && (
                          <span className="flex items-center gap-1">
                            <Calendar size={12} /> 
                            {t('announcements.starts')}: {format(new Date(ann.start_at), 'MMM d, yyyy HH:mm')}
                          </span>
                        )}
                        {ann.end_at && (
                          <span className="flex items-center gap-1">
                            <Calendar size={12} /> 
                            {t('announcements.ends')}: {format(new Date(ann.end_at), 'MMM d, yyyy HH:mm')}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 ml-4">
                      <Button variant="ghost" size="sm" onClick={() => openDialog(ann)}>
                        <Edit size={16} />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setDeleteDialog({ open: true, item: ann })}>
                        <Trash2 size={16} className="text-red-500" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingAnnouncement ? t('announcements.editAnnouncement') : t('announcements.createAnnouncement')}</DialogTitle>
            <DialogDescription>
              {t('announcements.createDescription')}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 pt-4">
            {/* Basic Info */}
            <div className="grid gap-4">
              <div>
                <Label>{t('announcements.titleLabel')} *</Label>
                <Input 
                  value={form.title} 
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder={t('announcements.titlePlaceholder')}
                  data-testid="announcement-title-input"
                />
              </div>
              <div>
                <Label>{t('announcements.messageLabel')} *</Label>
                <Textarea 
                  value={form.message} 
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  placeholder={t('announcements.messagePlaceholder')}
                  rows={3}
                  data-testid="announcement-message-input"
                />
              </div>
            </div>

            {/* Active & Priority */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <Switch 
                  checked={form.is_active} 
                  onCheckedChange={(v) => setForm({ ...form, is_active: v })}
                  data-testid="announcement-active-switch"
                />
                <Label>{t('common.active')}</Label>
              </div>
              <div>
                <Label>{t('announcements.priorityLabel')}</Label>
                <Input 
                  type="number" 
                  min={1} 
                  max={100}
                  value={form.priority} 
                  onChange={(e) => setForm({ ...form, priority: parseInt(e.target.value) || 1 })}
                />
              </div>
            </div>

            {/* Schedule */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t('announcements.startAt')}</Label>
                <Input 
                  type="datetime-local" 
                  value={form.start_at} 
                  onChange={(e) => setForm({ ...form, start_at: e.target.value })}
                />
              </div>
              <div>
                <Label>{t('announcements.endAt')}</Label>
                <Input 
                  type="datetime-local" 
                  value={form.end_at} 
                  onChange={(e) => setForm({ ...form, end_at: e.target.value })}
                />
              </div>
            </div>

            {/* Targeting */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Switch 
                  checked={form.send_to_all} 
                  onCheckedChange={(v) => setForm({ ...form, send_to_all: v })}
                />
                <Label className="flex items-center gap-2">
                  <Globe size={16} />
                  {t('announcements.sendToAllUsers')}
                </Label>
              </div>

              {!form.send_to_all && (
                <div className="space-y-4 p-4 border rounded-lg bg-slate-50">
                  {!form.send_to_all && form.target_teams.length === 0 && form.target_roles.length === 0 && form.target_specialties.length === 0 && (
                    <div className="flex items-center gap-2 text-amber-600 text-sm">
                      <AlertCircle size={16} />
                      {t('announcements.selectAtLeastOne')}
                    </div>
                  )}
                  
                  {/* Teams */}
                  <div>
                    <Label className="flex items-center gap-2 mb-2"><Users size={14} /> {t('announcements.targetTeams')}</Label>
                    <div className="flex flex-wrap gap-2">
                      {teams.map((team) => (
                        <Badge 
                          key={team.id}
                          variant={form.target_teams.includes(team.id) ? 'default' : 'outline'}
                          className={`cursor-pointer ${form.target_teams.includes(team.id) ? 'bg-blue-600' : ''}`}
                          onClick={() => handleToggle('target_teams', team.id)}
                        >
                          {team.name}
                        </Badge>
                      ))}
                      {teams.length === 0 && <span className="text-sm text-slate-400">{t('announcements.noTeamsAvailable')}</span>}
                    </div>
                  </div>

                  {/* Roles */}
                  <div>
                    <Label className="flex items-center gap-2 mb-2"><Shield size={14} /> {t('announcements.targetRoles')}</Label>
                    <div className="flex flex-wrap gap-2">
                      {roles.map((role) => (
                        <Badge 
                          key={role.id}
                          variant={form.target_roles.includes(role.id) ? 'default' : 'outline'}
                          className={`cursor-pointer ${form.target_roles.includes(role.id) ? 'bg-purple-600' : ''}`}
                          onClick={() => handleToggle('target_roles', role.id)}
                        >
                          {role.name}
                        </Badge>
                      ))}
                      {roles.length === 0 && <span className="text-sm text-slate-400">{t('announcements.noRolesAvailable')}</span>}
                    </div>
                  </div>

                  {/* Specialties */}
                  <div>
                    <Label className="flex items-center gap-2 mb-2"><Briefcase size={14} /> {t('announcements.targetSpecialties')}</Label>
                    <div className="flex flex-wrap gap-2">
                      {specialties.map((spec) => (
                        <Badge 
                          key={spec.id}
                          variant={form.target_specialties.includes(spec.id) ? 'default' : 'outline'}
                          className={`cursor-pointer ${form.target_specialties.includes(spec.id) ? 'bg-emerald-600' : ''}`}
                          onClick={() => handleToggle('target_specialties', spec.id)}
                        >
                          {spec.name}
                        </Badge>
                      ))}
                      {specialties.length === 0 && <span className="text-sm text-slate-400">{t('announcements.noSpecialtiesAvailable')}</span>}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Colors */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t('announcements.backgroundColor')}</Label>
                <div className="flex gap-2">
                  <Input 
                    type="color" 
                    value={form.background_color} 
                    onChange={(e) => setForm({ ...form, background_color: e.target.value })}
                    className="w-16 h-10 p-1"
                  />
                  <Input 
                    value={form.background_color} 
                    onChange={(e) => setForm({ ...form, background_color: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label>{t('announcements.textColor')}</Label>
                <div className="flex gap-2">
                  <Input 
                    type="color" 
                    value={form.text_color} 
                    onChange={(e) => setForm({ ...form, text_color: e.target.value })}
                    className="w-16 h-10 p-1"
                  />
                  <Input 
                    value={form.text_color} 
                    onChange={(e) => setForm({ ...form, text_color: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* Preview */}
            <div>
              <Label className="mb-2 block">{t('announcements.preview')}</Label>
              <div 
                className="p-4 rounded-lg text-center"
                style={{ backgroundColor: form.background_color, color: form.text_color }}
              >
                <p className="font-medium">{form.title || t('announcements.titleLabel')}</p>
                <p className="text-sm opacity-90">{form.message || t('announcements.previewPlaceholder')}</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>{t('common.cancel')}</Button>
              <Button className="bg-rose-600 hover:bg-rose-700" onClick={handleSave} data-testid="save-announcement-btn">
                {editingAnnouncement ? t('common.update') : t('common.create')} {t('announcements.announcement')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ ...deleteDialog, open })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('announcements.deleteAnnouncement')}</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deleteDialog.item?.title}&quot;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
