import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { 
  Key, 
  Webhook, 
  Plus, 
  Copy, 
  Trash2, 
  Eye, 
  EyeOff,
  RefreshCw,
  CheckCircle,
  XCircle,
  ArrowDownLeft,
  ArrowUpRight,
  Clock
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function Integrations() {
  const [activeTab, setActiveTab] = useState('api-keys');
  const [apiKeys, setApiKeys] = useState([]);
  const [webhooks, setWebhooks] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // API Key dialog
  const [apiKeyDialogOpen, setApiKeyDialogOpen] = useState(false);
  const [newApiKey, setNewApiKey] = useState({ name: '', permissions: 'read' });
  const [generatedKey, setGeneratedKey] = useState(null);
  
  // Webhook dialog
  const [webhookDialogOpen, setWebhookDialogOpen] = useState(false);
  const [newWebhook, setNewWebhook] = useState({
    name: '',
    url: '',
    direction: 'outgoing',
    events: [],
    is_active: true
  });
  
  const [visibleKeys, setVisibleKeys] = useState({});
  
  // Unsaved changes tracking
  const [hasApiKeyChanges, setHasApiKeyChanges] = useState(false);
  const [hasWebhookChanges, setHasWebhookChanges] = useState(false);
  const [showApiKeyUnsavedWarning, setShowApiKeyUnsavedWarning] = useState(false);
  const [showWebhookUnsavedWarning, setShowWebhookUnsavedWarning] = useState(false);
  const initialApiKeyRef = useRef(null);
  const initialWebhookRef = useRef(null);

  useEffect(() => {
    fetchData();
  }, []);

  // Track API key form changes
  useEffect(() => {
    if (initialApiKeyRef.current && apiKeyDialogOpen) {
      const changed = JSON.stringify(newApiKey) !== JSON.stringify(initialApiKeyRef.current);
      setHasApiKeyChanges(changed);
    }
  }, [newApiKey, apiKeyDialogOpen]);

  // Track webhook form changes
  useEffect(() => {
    if (initialWebhookRef.current && webhookDialogOpen) {
      const changed = JSON.stringify(newWebhook) !== JSON.stringify(initialWebhookRef.current);
      setHasWebhookChanges(changed);
    }
  }, [newWebhook, webhookDialogOpen]);

  // Browser beforeunload warning
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if ((hasApiKeyChanges && apiKeyDialogOpen) || (hasWebhookChanges && webhookDialogOpen)) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes.';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasApiKeyChanges, hasWebhookChanges, apiKeyDialogOpen, webhookDialogOpen]);

  const handleApiKeyDialogClose = (open) => {
    if (!open && hasApiKeyChanges && !generatedKey) {
      setShowApiKeyUnsavedWarning(true);
      return;
    }
    setApiKeyDialogOpen(open);
    if (!open) {
      setGeneratedKey(null);
      const initialData = { name: '', permissions: 'read' };
      setNewApiKey(initialData);
      initialApiKeyRef.current = null;
      setHasApiKeyChanges(false);
    }
  };

  const handleWebhookDialogClose = (open) => {
    if (!open && hasWebhookChanges) {
      setShowWebhookUnsavedWarning(true);
      return;
    }
    setWebhookDialogOpen(open);
    if (!open) {
      const initialData = { name: '', url: '', direction: 'outgoing', events: [], is_active: true };
      setNewWebhook(initialData);
      initialWebhookRef.current = null;
      setHasWebhookChanges(false);
    }
  };

  const confirmCloseApiKeyDialog = () => {
    setShowApiKeyUnsavedWarning(false);
    setApiKeyDialogOpen(false);
    setGeneratedKey(null);
    setNewApiKey({ name: '', permissions: 'read' });
    initialApiKeyRef.current = null;
    setHasApiKeyChanges(false);
  };

  const confirmCloseWebhookDialog = () => {
    setShowWebhookUnsavedWarning(false);
    setWebhookDialogOpen(false);
    setNewWebhook({ name: '', url: '', direction: 'outgoing', events: [], is_active: true });
    initialWebhookRef.current = null;
    setHasWebhookChanges(false);
  };

  const handleOpenApiKeyDialog = () => {
    const initialData = { name: '', permissions: 'read' };
    setNewApiKey(initialData);
    initialApiKeyRef.current = initialData;
    setHasApiKeyChanges(false);
    setApiKeyDialogOpen(true);
  };

  const handleOpenWebhookDialog = () => {
    const initialData = { name: '', url: '', direction: 'outgoing', events: [], is_active: true };
    setNewWebhook(initialData);
    initialWebhookRef.current = initialData;
    setHasWebhookChanges(false);
    setWebhookDialogOpen(true);
  };

  const fetchData = async () => {
    try {
      const [keysRes, webhooksRes] = await Promise.all([
        axios.get(`${API}/api-keys`).catch(() => ({ data: [] })),
        axios.get(`${API}/webhooks`).catch(() => ({ data: [] }))
      ]);
      setApiKeys(keysRes.data || getSampleApiKeys());
      setWebhooks(webhooksRes.data || getSampleWebhooks());
    } catch (error) {
      setApiKeys(getSampleApiKeys());
      setWebhooks(getSampleWebhooks());
    } finally {
      setLoading(false);
    }
  };

  const getSampleApiKeys = () => [
    {
      id: 'key-1',
      name: 'Production API Key',
      key_preview: 'rr_live_****1234',
      permissions: 'read_write',
      created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      last_used: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
      is_active: true
    },
    {
      id: 'key-2',
      name: 'Development Key',
      key_preview: 'rr_test_****5678',
      permissions: 'read',
      created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      last_used: null,
      is_active: true
    }
  ];

  const getSampleWebhooks = () => [
    {
      id: 'wh-1',
      name: 'Order Updates',
      url: 'https://api.example.com/webhooks/orders',
      direction: 'outgoing',
      events: ['order.created', 'order.updated', 'order.delivered'],
      is_active: true,
      created_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
      last_triggered: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      success_rate: 98
    },
    {
      id: 'wh-2',
      name: 'CRM Sync',
      url: 'https://crm.example.com/api/sync',
      direction: 'outgoing',
      events: ['user.created', 'user.updated'],
      is_active: false,
      created_at: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
      last_triggered: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      success_rate: 85
    }
  ];

  const handleCreateApiKey = async () => {
    try {
      // Simulate API key generation
      const newKey = {
        id: `key-${Date.now()}`,
        name: newApiKey.name,
        key: `rr_${newApiKey.permissions === 'read' ? 'read' : 'live'}_${Math.random().toString(36).substring(2, 15)}`,
        key_preview: `rr_${newApiKey.permissions === 'read' ? 'read' : 'live'}_****${Math.random().toString(36).substring(2, 6)}`,
        permissions: newApiKey.permissions,
        created_at: new Date().toISOString(),
        last_used: null,
        is_active: true
      };
      
      setGeneratedKey(newKey.key);
      setApiKeys(prev => [newKey, ...prev]);
      setHasApiKeyChanges(false);
      initialApiKeyRef.current = null;
      toast.success('API key created');
    } catch (error) {
      toast.error('Failed to create API key');
    }
  };

  const handleDeleteApiKey = async (keyId) => {
    if (!window.confirm('Are you sure you want to revoke this API key? This action cannot be undone.')) return;
    
    try {
      setApiKeys(prev => prev.filter(k => k.id !== keyId));
      toast.success('API key revoked');
    } catch (error) {
      toast.error('Failed to revoke API key');
    }
  };

  const handleCreateWebhook = async () => {
    try {
      const webhook = {
        id: `wh-${Date.now()}`,
        ...newWebhook,
        created_at: new Date().toISOString(),
        last_triggered: null,
        success_rate: 100
      };
      
      setWebhooks(prev => [webhook, ...prev]);
      setWebhookDialogOpen(false);
      setNewWebhook({ name: '', url: '', direction: 'outgoing', events: [], is_active: true });
      setHasWebhookChanges(false);
      initialWebhookRef.current = null;
      toast.success('Webhook created');
    } catch (error) {
      toast.error('Failed to create webhook');
    }
  };

  const handleDeleteWebhook = async (webhookId) => {
    if (!window.confirm('Are you sure you want to delete this webhook?')) return;
    
    try {
      setWebhooks(prev => prev.filter(w => w.id !== webhookId));
      toast.success('Webhook deleted');
    } catch (error) {
      toast.error('Failed to delete webhook');
    }
  };

  const handleToggleWebhook = async (webhookId) => {
    setWebhooks(prev => prev.map(w => 
      w.id === webhookId ? { ...w, is_active: !w.is_active } : w
    ));
    toast.success('Webhook status updated');
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const toggleKeyVisibility = (keyId) => {
    setVisibleKeys(prev => ({ ...prev, [keyId]: !prev[keyId] }));
  };

  const WEBHOOK_EVENTS = [
    { value: 'order.created', label: 'Order Created' },
    { value: 'order.updated', label: 'Order Updated' },
    { value: 'order.delivered', label: 'Order Delivered' },
    { value: 'order.closed', label: 'Order Closed' },
    { value: 'user.created', label: 'User Created' },
    { value: 'user.updated', label: 'User Updated' },
    { value: 'message.sent', label: 'Message Sent' },
    { value: 'file.uploaded', label: 'File Uploaded' }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-rose-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in" data-testid="integrations-page">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Integrations</h1>
        <p className="text-slate-500 mt-1">Manage API keys and webhook configurations</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-2 w-full max-w-sm">
          <TabsTrigger value="api-keys" className="flex items-center gap-2" data-testid="api-keys-tab">
            <Key size={14} />
            API Keys
          </TabsTrigger>
          <TabsTrigger value="webhooks" className="flex items-center gap-2" data-testid="webhooks-tab">
            <Webhook size={14} />
            Webhooks
          </TabsTrigger>
        </TabsList>

        {/* API Keys Tab */}
        <TabsContent value="api-keys" className="mt-6">
          <Card className="border-slate-200">
            <CardHeader className="border-b border-slate-100 pb-4 flex flex-row items-center justify-between">
              <div>
                <CardTitle>API Keys</CardTitle>
                <p className="text-sm text-slate-500 mt-1">Manage API keys for external integrations</p>
              </div>
              <Dialog open={apiKeyDialogOpen} onOpenChange={handleApiKeyDialogClose}>
                <DialogTrigger asChild>
                  <Button className="bg-rose-600 hover:bg-rose-700" onClick={handleOpenApiKeyDialog} data-testid="create-api-key-btn">
                    <Plus size={16} className="mr-2" />
                    Create Key
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create API Key</DialogTitle>
                    <DialogDescription>
                      Generate a new API key for external integrations
                    </DialogDescription>
                  </DialogHeader>
                  
                  {generatedKey ? (
                    <div className="space-y-4 pt-4">
                      <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                        <p className="text-sm text-amber-800 font-medium mb-2">
                          Copy this key now - you won't be able to see it again!
                        </p>
                        <div className="flex items-center gap-2">
                          <code className="flex-1 p-2 bg-white rounded border text-sm font-mono break-all">
                            {generatedKey}
                          </code>
                          <Button variant="outline" size="icon" onClick={() => copyToClipboard(generatedKey)}>
                            <Copy size={16} />
                          </Button>
                        </div>
                      </div>
                      <Button onClick={() => {
                        setApiKeyDialogOpen(false);
                        setGeneratedKey(null);
                        setNewApiKey({ name: '', permissions: 'read' });
                      }} className="w-full">
                        Done
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4 pt-4">
                      <div>
                        <Label>Key Name *</Label>
                        <Input
                          value={newApiKey.name}
                          onChange={(e) => setNewApiKey(prev => ({ ...prev, name: e.target.value }))}
                          placeholder="e.g., Production API Key"
                          className="mt-1.5"
                          data-testid="api-key-name-input"
                        />
                      </div>
                      <div>
                        <Label>Permissions</Label>
                        <Select 
                          value={newApiKey.permissions} 
                          onValueChange={(val) => setNewApiKey(prev => ({ ...prev, permissions: val }))}
                        >
                          <SelectTrigger className="mt-1.5">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="read">Read Only</SelectItem>
                            <SelectItem value="read_write">Read & Write</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex gap-3 pt-2">
                        <Button variant="outline" onClick={() => setApiKeyDialogOpen(false)} className="flex-1">
                          Cancel
                        </Button>
                        <Button 
                          onClick={handleCreateApiKey}
                          className="flex-1 bg-rose-600 hover:bg-rose-700"
                          disabled={!newApiKey.name}
                          data-testid="generate-api-key-btn"
                        >
                          Generate Key
                        </Button>
                      </div>
                    </div>
                  )}
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="p-0">
              {apiKeys.length === 0 ? (
                <div className="p-12 text-center text-slate-500">
                  <Key size={48} className="mx-auto text-slate-300 mb-3" />
                  <p>No API keys created yet</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {apiKeys.map(key => (
                    <div key={key.id} className="p-4 hover:bg-slate-50" data-testid={`api-key-${key.id}`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-slate-900">{key.name}</span>
                            <Badge className={key.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}>
                              {key.is_active ? 'Active' : 'Revoked'}
                            </Badge>
                            <Badge className="bg-slate-100 text-slate-600">
                              {key.permissions === 'read' ? 'Read Only' : 'Read & Write'}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-4 mt-1 text-sm text-slate-500">
                            <code className="font-mono">{key.key_preview}</code>
                            <span>Created {format(new Date(key.created_at), 'MMM d, yyyy')}</span>
                            {key.last_used && (
                              <span className="flex items-center gap-1">
                                <Clock size={12} />
                                Last used {format(new Date(key.last_used), 'MMM d, h:mm a')}
                              </span>
                            )}
                          </div>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="text-red-500 hover:text-red-700 hover:bg-red-50"
                          onClick={() => handleDeleteApiKey(key.id)}
                        >
                          <Trash2 size={18} />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Webhooks Tab */}
        <TabsContent value="webhooks" className="mt-6">
          <Card className="border-slate-200">
            <CardHeader className="border-b border-slate-100 pb-4 flex flex-row items-center justify-between">
              <div>
                <CardTitle>Webhooks</CardTitle>
                <p className="text-sm text-slate-500 mt-1">Configure incoming and outgoing webhooks</p>
              </div>
              <Dialog open={webhookDialogOpen} onOpenChange={handleWebhookDialogClose}>
                <DialogTrigger asChild>
                  <Button className="bg-rose-600 hover:bg-rose-700" onClick={handleOpenWebhookDialog} data-testid="create-webhook-btn">
                    <Plus size={16} className="mr-2" />
                    Add Webhook
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Create Webhook</DialogTitle>
                    <DialogDescription>
                      Configure a new webhook endpoint
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <div>
                      <Label>Webhook Name *</Label>
                      <Input
                        value={newWebhook.name}
                        onChange={(e) => setNewWebhook(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="e.g., Order Notifications"
                        className="mt-1.5"
                        data-testid="webhook-name-input"
                      />
                    </div>
                    <div>
                      <Label>Direction</Label>
                      <Select 
                        value={newWebhook.direction} 
                        onValueChange={(val) => setNewWebhook(prev => ({ ...prev, direction: val }))}
                      >
                        <SelectTrigger className="mt-1.5">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="outgoing">
                            <div className="flex items-center gap-2">
                              <ArrowUpRight size={14} />
                              Outgoing (send events to external URL)
                            </div>
                          </SelectItem>
                          <SelectItem value="incoming">
                            <div className="flex items-center gap-2">
                              <ArrowDownLeft size={14} />
                              Incoming (receive events from external source)
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Endpoint URL *</Label>
                      <Input
                        value={newWebhook.url}
                        onChange={(e) => setNewWebhook(prev => ({ ...prev, url: e.target.value }))}
                        placeholder="https://api.example.com/webhook"
                        className="mt-1.5"
                        data-testid="webhook-url-input"
                      />
                    </div>
                    <div>
                      <Label>Events to trigger</Label>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        {WEBHOOK_EVENTS.map(event => (
                          <label key={event.value} className="flex items-center gap-2 text-sm cursor-pointer">
                            <input
                              type="checkbox"
                              checked={newWebhook.events.includes(event.value)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setNewWebhook(prev => ({ ...prev, events: [...prev.events, event.value] }));
                                } else {
                                  setNewWebhook(prev => ({ ...prev, events: prev.events.filter(ev => ev !== event.value) }));
                                }
                              }}
                              className="rounded border-slate-300"
                            />
                            {event.label}
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-3 pt-2">
                      <Button variant="outline" onClick={() => setWebhookDialogOpen(false)} className="flex-1">
                        Cancel
                      </Button>
                      <Button 
                        onClick={handleCreateWebhook}
                        className="flex-1 bg-rose-600 hover:bg-rose-700"
                        disabled={!newWebhook.name || !newWebhook.url}
                        data-testid="save-webhook-btn"
                      >
                        Create Webhook
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="p-0">
              {webhooks.length === 0 ? (
                <div className="p-12 text-center text-slate-500">
                  <Webhook size={48} className="mx-auto text-slate-300 mb-3" />
                  <p>No webhooks configured yet</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {webhooks.map(webhook => (
                    <div key={webhook.id} className="p-4 hover:bg-slate-50" data-testid={`webhook-${webhook.id}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-slate-900">{webhook.name}</span>
                            <Badge className={webhook.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}>
                              {webhook.is_active ? 'Active' : 'Paused'}
                            </Badge>
                            <Badge className="bg-slate-100 text-slate-600">
                              {webhook.direction === 'outgoing' ? (
                                <><ArrowUpRight size={12} className="mr-1" /> Outgoing</>
                              ) : (
                                <><ArrowDownLeft size={12} className="mr-1" /> Incoming</>
                              )}
                            </Badge>
                            {webhook.success_rate !== undefined && (
                              <Badge className={webhook.success_rate >= 90 ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}>
                                {webhook.success_rate}% success
                              </Badge>
                            )}
                          </div>
                          <code className="text-sm text-slate-500 mt-1 block truncate">{webhook.url}</code>
                          <div className="flex items-center gap-4 mt-1 text-xs text-slate-400 flex-wrap">
                            <span>Events: {webhook.events.join(', ') || 'None'}</span>
                            {webhook.last_triggered && (
                              <span>Last triggered: {format(new Date(webhook.last_triggered), 'MMM d, h:mm a')}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => handleToggleWebhook(webhook.id)}
                            className={webhook.is_active ? 'text-amber-500 hover:text-amber-700' : 'text-green-500 hover:text-green-700'}
                          >
                            {webhook.is_active ? <XCircle size={18} /> : <CheckCircle size={18} />}
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={() => handleDeleteWebhook(webhook.id)}
                          >
                            <Trash2 size={18} />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
