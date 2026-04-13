import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import {
  Settings,
  Search,
  Save,
  RotateCcw,
  Globe,
  Type,
  FileText,
  LayoutDashboard,
  ClipboardList,
  Users,
  FolderTree
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../components/ui/card';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../components/ui/tabs';
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
import { Badge } from '../components/ui/badge';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const categoryIcons = {
  general: Settings,
  navigation: LayoutDashboard,
  forms: FileText,
  orders: ClipboardList,
  users: Users,
  categories: FolderTree,
  languages: Globe,
};

export default function UISettings() {
const [settings, setSettings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editedSettings, setEditedSettings] = useState({});
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [activeTab, setActiveTab] = useState('all');

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await axios.get(`${API}/ui-settings`);
      setSettings(res.data);
      // Initialize edited settings with current values
      const edits = {};
      res.data.forEach(s => {
        edits[s.key] = s.value;
      });
      setEditedSettings(edits);
    } catch (error) {
      toast.error('Failed to load UI settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Find changed settings
      const changes = {};
      settings.forEach(s => {
        if (editedSettings[s.key] !== s.value) {
          changes[s.key] = editedSettings[s.key];
        }
      });

      if (Object.keys(changes).length === 0) {
        toast.info('No changes to save');
        setSaving(false);
        return;
      }

      await axios.post(`${API}/ui-settings/bulk-update`, changes);
      toast.success(`${Object.keys(changes).length} settings updated!`);
      fetchSettings();
    } catch (error) {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    try {
      await axios.post(`${API}/ui-settings/reset`);
      toast.success('Settings reset to defaults');
      setShowResetDialog(false);
      fetchSettings();
    } catch (error) {
      toast.error('Failed to reset settings');
    }
  };

  const categories = [...new Set(settings.map(s => s.category))];

  const filteredSettings = settings.filter(s => {
    const matchesSearch = s.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.value.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = activeTab === 'all' || s.category === activeTab;
    return matchesSearch && matchesCategory;
  });

  const hasChanges = settings.some(s => editedSettings[s.key] !== s.value);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-rose-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="ui-settings-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div>
          <h1 className="text-2xl font-bold">UI Customization</h1>
          <p className="mt-1">Customize text, labels, and messages across the platform</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setShowResetDialog(true)}
            data-testid="reset-settings-btn"
          >
            <RotateCcw size={16} className="mr-2" />
            Reset to Defaults
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className="bg-[var(--accent)] hover:bg-[var(--accent-hover)]"
            data-testid="save-settings-btn"
          >
            <Save size={16} className="mr-2" />
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2" />
        <Input
          placeholder="Search settings..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
          data-testid="search-settings"
        />
      </div>

      {/* Info Banner */}
      {hasChanges && (
        <div className="p-3 border rounded-lg flex items-center justify-between">
          <p className="text-sm">
            You have unsaved changes. Click &quot;Save Changes&quot; to apply them.
          </p>
          <Button size="sm" variant="outline" onClick={() => {
            const edits = {};
            settings.forEach(s => { edits[s.key] = s.value; });
            setEditedSettings(edits);
          }}>
            Discard Changes
          </Button>
        </div>
      )}

      {/* Tabs by Category */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="all" className="flex items-center gap-1">
            <Settings size={14} />
            All
          </TabsTrigger>
          {categories.map(cat => {
            const Icon = categoryIcons[cat] || Type;
            return (
              <TabsTrigger key={cat} value={cat} className="flex items-center gap-1 capitalize">
                <Icon size={14} />
                {cat}
              </TabsTrigger>
            );
          })}
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          {filteredSettings.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Type size={32} className="text-[var(--tx-3)] mb-4" />
                <p className="">No settings found</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {filteredSettings.map((setting) => (
                <Card key={setting.key} data-testid={`setting-card-${setting.key}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium">
                        {setting.key}
                      </CardTitle>
                      <Badge variant="outline" className="text-xs capitalize">
                        {setting.category}
                      </Badge>
                    </div>
                    {setting.description && (
                      <CardDescription className="text-xs">
                        {setting.description}
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    {setting.value.length > 100 ? (
                      <Textarea
                        value={editedSettings[setting.key] || ''}
                        onChange={(e) => setEditedSettings(prev => ({
                          ...prev,
                          [setting.key]: e.target.value
                        }))}
                        className="text-sm"
                        rows={3}
                      />
                    ) : (
                      <Input
                        value={editedSettings[setting.key] || ''}
                        onChange={(e) => setEditedSettings(prev => ({
                          ...prev,
                          [setting.key]: e.target.value
                        }))}
                        className="text-sm"
                      />
                    )}
                    {editedSettings[setting.key] !== setting.value && (
                      <p className="text-xs text-amber-600 mt-1">Modified</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Reset Confirmation */}
      <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset to Default Settings?</AlertDialogTitle>
            <AlertDialogDescription>
              This will reset all UI text to their original values. Any custom changes will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReset}
              className="bg-red-600 hover:bg-red-700"
            >
              Reset All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
