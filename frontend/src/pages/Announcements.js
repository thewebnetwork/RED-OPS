import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Switch } from '../components/ui/switch';
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
import { Megaphone, Save, Eye } from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function Announcements() {
  const [ticker, setTicker] = useState({
    message: '',
    is_active: false,
    background_color: '#A2182C',
    text_color: '#FFFFFF'
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const initialDataRef = useRef(null);

  useEffect(() => {
    fetchTicker();
  }, []);

  // Track changes
  useEffect(() => {
    if (initialDataRef.current) {
      const changed = JSON.stringify(ticker) !== JSON.stringify(initialDataRef.current);
      setHasChanges(changed);
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

  const fetchTicker = async () => {
    try {
      const res = await axios.get(`${API}/announcement-ticker`);
      setTicker(res.data);
      initialDataRef.current = res.data;
    } catch (error) {
      console.error('Failed to fetch ticker');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await axios.put(`${API}/announcement-ticker`, ticker);
      toast.success('Announcement ticker updated');
      initialDataRef.current = ticker;
      setHasChanges(false);
      // Trigger a page refresh for the ticker component
      window.dispatchEvent(new Event('ticker-updated'));
    } catch (error) {
      toast.error('Failed to update ticker');
    } finally {
      setSaving(false);
    }
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
        <h1 className="text-2xl font-bold text-slate-900">Announcement Ticker</h1>
        <p className="text-slate-500 mt-1">Manage the global announcement banner shown to all users</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Settings Card */}
        <Card className="border-slate-200">
          <CardHeader className="border-b border-slate-100 pb-4">
            <CardTitle className="flex items-center gap-2">
              <Megaphone size={20} />
              Ticker Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            {/* Active Toggle */}
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base">Enable Ticker</Label>
                <p className="text-sm text-slate-500">Show the announcement banner to all users</p>
              </div>
              <Switch
                checked={ticker.is_active}
                onCheckedChange={(checked) => setTicker(prev => ({ ...prev, is_active: checked }))}
                data-testid="ticker-active-switch"
              />
            </div>

            {/* Message */}
            <div>
              <Label>Announcement Message</Label>
              <Textarea
                value={ticker.message}
                onChange={(e) => setTicker(prev => ({ ...prev, message: e.target.value }))}
                placeholder="Enter your announcement message..."
                className="mt-1.5 min-h-[100px]"
                data-testid="ticker-message-input"
              />
              <p className="text-xs text-slate-500 mt-1">This message will scroll across the top of all pages</p>
            </div>

            {/* Colors */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Background Color</Label>
                <div className="flex items-center gap-2 mt-1.5">
                  <input
                    type="color"
                    value={ticker.background_color}
                    onChange={(e) => setTicker(prev => ({ ...prev, background_color: e.target.value }))}
                    className="w-10 h-10 rounded border border-slate-200 cursor-pointer"
                  />
                  <Input
                    value={ticker.background_color}
                    onChange={(e) => setTicker(prev => ({ ...prev, background_color: e.target.value }))}
                    className="flex-1"
                    placeholder="#A2182C"
                  />
                </div>
              </div>
              <div>
                <Label>Text Color</Label>
                <div className="flex items-center gap-2 mt-1.5">
                  <input
                    type="color"
                    value={ticker.text_color}
                    onChange={(e) => setTicker(prev => ({ ...prev, text_color: e.target.value }))}
                    className="w-10 h-10 rounded border border-slate-200 cursor-pointer"
                  />
                  <Input
                    value={ticker.text_color}
                    onChange={(e) => setTicker(prev => ({ ...prev, text_color: e.target.value }))}
                    className="flex-1"
                    placeholder="#FFFFFF"
                  />
                </div>
              </div>
            </div>

            {/* Save Button */}
            <Button 
              onClick={handleSave} 
              className={`w-full ${hasChanges ? 'bg-rose-600 hover:bg-rose-700' : 'bg-slate-400 hover:bg-slate-500'}`}
              disabled={saving || !hasChanges}
              data-testid="save-ticker-btn"
            >
              <Save size={18} className="mr-2" />
              {saving ? 'Saving...' : hasChanges ? 'Save Changes' : 'No Changes'}
            </Button>
            {hasChanges && (
              <p className="text-xs text-amber-600 text-center mt-2">You have unsaved changes</p>
            )}
          </CardContent>
        </Card>

        {/* Preview Card */}
        <Card className="border-slate-200">
          <CardHeader className="border-b border-slate-100 pb-4">
            <CardTitle className="flex items-center gap-2">
              <Eye size={20} />
              Live Preview
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              {/* Simulated Header */}
              <div className="bg-slate-100 h-12 flex items-center px-4 border-b border-slate-200">
                <div className="w-24 h-4 bg-slate-300 rounded" />
              </div>
              
              {/* Ticker Preview */}
              {ticker.is_active && ticker.message ? (
                <div 
                  className="overflow-hidden"
                  style={{ 
                    backgroundColor: ticker.background_color,
                    color: ticker.text_color 
                  }}
                >
                  <div className="flex items-center h-10 px-4">
                    <Megaphone size={16} className="shrink-0 mr-3" />
                    <div className="flex-1 overflow-hidden">
                      <div className="ticker-scroll whitespace-nowrap">
                        <span className="text-sm font-medium">{ticker.message}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-10 bg-slate-50 flex items-center justify-center text-slate-400 text-sm">
                  Ticker is {ticker.is_active ? 'empty' : 'disabled'}
                </div>
              )}
              
              {/* Simulated Content */}
              <div className="p-4 space-y-3">
                <div className="w-full h-6 bg-slate-100 rounded" />
                <div className="w-3/4 h-4 bg-slate-100 rounded" />
                <div className="w-1/2 h-4 bg-slate-100 rounded" />
              </div>
            </div>
            
            <p className="text-sm text-slate-500 mt-4 text-center">
              This is how the ticker will appear at the top of all pages
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
