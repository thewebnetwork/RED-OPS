import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
import { Badge } from '../components/ui/badge';
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
import { 
  Mail, 
  Save, 
  Send,
  CheckCircle,
  XCircle,
  AlertCircle,
  Eye,
  EyeOff
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function EmailSettings() {
  const [config, setConfig] = useState({
    smtp_host: '',
    smtp_port: 587,
    smtp_user: '',
    smtp_password: '',
    smtp_from: '',
    smtp_use_tls: true
  });
  const [status, setStatus] = useState({
    is_configured: false,
    last_test_status: null,
    last_test_at: null
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // Unsaved changes tracking
  const [hasFormChanges, setHasFormChanges] = useState(false);
  const initialConfigRef = useRef(null);

  useEffect(() => {
    fetchConfig();
  }, []);

  // Track form changes
  useEffect(() => {
    if (initialConfigRef.current) {
      const changed = JSON.stringify(config) !== JSON.stringify(initialConfigRef.current);
      setHasFormChanges(changed);
    }
  }, [config]);

  // Browser beforeunload warning
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasFormChanges) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes.';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasFormChanges]);

  const fetchConfig = async () => {
    try {
      const res = await axios.get(`${API}/smtp-config`);
      const loadedConfig = {
        smtp_host: res.data.smtp_host || '',
        smtp_port: res.data.smtp_port || 587,
        smtp_user: res.data.smtp_user || '',
        smtp_from: res.data.smtp_from || '',
        smtp_use_tls: res.data.smtp_use_tls ?? true,
        smtp_password: '' // Never pre-fill password
      };
      setConfig(loadedConfig);
      initialConfigRef.current = loadedConfig;
      setStatus({
        is_configured: res.data.is_configured,
        last_test_status: res.data.last_test_status,
        last_test_at: res.data.last_test_at
      });
    } catch (error) {
      toast.error('Failed to load SMTP configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await axios.put(`${API}/smtp-config`, config);
      setStatus({
        is_configured: res.data.is_configured,
        last_test_status: res.data.last_test_status,
        last_test_at: res.data.last_test_at
      });
      // Reset change tracking after successful save
      initialConfigRef.current = { ...config };
      setHasFormChanges(false);
      toast.success('SMTP configuration saved');
    } catch (error) {
      toast.error('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!testEmail) {
      toast.error('Please enter a test email address');
      return;
    }
    setTesting(true);
    try {
      await axios.post(`${API}/smtp-config/test`, { to_email: testEmail });
      toast.success(`Test email sent to ${testEmail}`);
      fetchConfig(); // Refresh status
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to send test email');
      fetchConfig(); // Refresh status to show error
    } finally {
      setTesting(false);
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
    <div className="space-y-6 animate-fade-in" data-testid="email-settings-page">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Email Settings</h1>
        <p className="mt-1">Configure SMTP settings for email notifications</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* SMTP Configuration */}
        <div className="lg:col-span-2">
          <Card className="">
            <CardHeader className="border-b pb-4">
              <CardTitle className="flex items-center gap-2">
                <Mail size={20} />
                SMTP Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>SMTP Host *</Label>
                  <Input
                    value={config.smtp_host}
                    onChange={(e) => setConfig(prev => ({ ...prev, smtp_host: e.target.value }))}
                    placeholder="smtp.gmail.com"
                    className="mt-1.5"
                    data-testid="smtp-host-input"
                  />
                </div>
                <div>
                  <Label>Port</Label>
                  <Input
                    type="number"
                    value={config.smtp_port}
                    onChange={(e) => setConfig(prev => ({ ...prev, smtp_port: parseInt(e.target.value) || 587 }))}
                    placeholder="587"
                    className="mt-1.5"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Username/Email *</Label>
                  <Input
                    value={config.smtp_user}
                    onChange={(e) => setConfig(prev => ({ ...prev, smtp_user: e.target.value }))}
                    placeholder="your-email@gmail.com"
                    className="mt-1.5"
                    data-testid="smtp-user-input"
                  />
                </div>
                <div>
                  <Label>Password</Label>
                  <div className="relative mt-1.5">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      value={config.smtp_password}
                      onChange={(e) => setConfig(prev => ({ ...prev, smtp_password: e.target.value }))}
                      placeholder={status.is_configured ? '••••••••' : 'App password or SMTP password'}
                      className="pr-10"
                      data-testid="smtp-password-input"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  <p className="text-xs mt-1">Leave blank to keep existing password</p>
                </div>
              </div>

              <div>
                <Label>From Email</Label>
                <Input
                  value={config.smtp_from}
                  onChange={(e) => setConfig(prev => ({ ...prev, smtp_from: e.target.value }))}
                  placeholder="noreply@yourdomain.com"
                  className="mt-1.5"
                />
                <p className="text-xs mt-1">Email address shown in the &quot;From&quot; field. Defaults to username if empty.</p>
              </div>

              <div className="flex items-center justify-between p-4 rounded-lg">
                <div>
                  <p className="font-medium text-sm">Use TLS/STARTTLS</p>
                  <p className="text-xs">Enable secure connection (recommended)</p>
                </div>
                <Switch
                  checked={config.smtp_use_tls}
                  onCheckedChange={(checked) => setConfig(prev => ({ ...prev, smtp_use_tls: checked }))}
                />
              </div>

              {hasFormChanges && (
                <div className="p-3 border rounded-lg text-sm text-amber-800">
                  You have unsaved changes.
                </div>
              )}

              <Button 
                onClick={handleSave} 
                className="w-full bg-rose-600 hover:bg-rose-700"
                disabled={saving}
                data-testid="save-smtp-btn"
              >
                <Save size={18} className="mr-2" />
                {saving ? 'Saving...' : 'Save Configuration'}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Status & Test */}
        <div className="space-y-6">
          {/* Status Card */}
          <Card className="">
            <CardHeader className="border-b pb-4">
              <CardTitle>Status</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm">Configuration</span>
                {status.is_configured ? (
                  <Badge className="text-green-700">
                    <CheckCircle size={12} className="mr-1" />
                    Configured
                  </Badge>
                ) : (
                  <Badge className="">
                    <AlertCircle size={12} className="mr-1" />
                    Not Configured
                  </Badge>
                )}
              </div>

              {status.last_test_at && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Last Test</span>
                    {status.last_test_status === 'success' ? (
                      <Badge className="text-green-700">
                        <CheckCircle size={12} className="mr-1" />
                        Passed
                      </Badge>
                    ) : (
                      <Badge className="bg-red-100 text-red-700">
                        <XCircle size={12} className="mr-1" />
                        Failed
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs">
                    {format(new Date(status.last_test_at), 'MMM d, yyyy h:mm a')}
                  </p>
                  {status.last_test_status && status.last_test_status !== 'success' && (
                    <p className="text-xs text-red-500 mt-1">{status.last_test_status}</p>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Test Email Card */}
          <Card className="">
            <CardHeader className="border-b pb-4">
              <CardTitle>Test Email</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div>
                <Label>Send test email to</Label>
                <Input
                  type="email"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="test@example.com"
                  className="mt-1.5"
                  data-testid="test-email-input"
                />
              </div>
              <Button 
                onClick={handleTest} 
                variant="outline"
                className="w-full"
                disabled={testing || !status.is_configured}
                data-testid="send-test-btn"
              >
                <Send size={18} className="mr-2" />
                {testing ? 'Sending...' : 'Send Test Email'}
              </Button>
              {!status.is_configured && (
                <p className="text-xs text-amber-600 text-center">
                  Save configuration first to test
                </p>
              )}
            </CardContent>
          </Card>

          {/* Help Card */}
          <Card className="">
            <CardContent className="p-4">
              <h4 className="font-medium text-sm mb-2">Common SMTP Settings</h4>
              <div className="space-y-2 text-xs">
                <div>
                  <strong>Gmail:</strong><br />
                  Host: smtp.gmail.com, Port: 587<br />
                  <span className="text-amber-600">Use App Password (not regular password)</span>
                </div>
                <div>
                  <strong>SendGrid:</strong><br />
                  Host: smtp.sendgrid.net, Port: 587
                </div>
                <div>
                  <strong>AWS SES:</strong><br />
                  Host: email-smtp.region.amazonaws.com
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
