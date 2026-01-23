import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
import { Checkbox } from '../components/ui/checkbox';
import { Label } from '../components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog';
import { 
  ArrowLeft,
  Send,
  Paperclip,
  Download,
  Pin,
  Clock,
  User,
  Calendar,
  AlertCircle,
  FileText,
  Activity,
  CheckCircle2
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const statusConfig = {
  'New': { class: 'status-new', color: 'bg-blue-500' },
  'In Progress': { class: 'status-in-progress', color: 'bg-amber-500' },
  'Needs Client Review': { class: 'status-needs-review', color: 'bg-purple-500' },
  'Revision Requested': { class: 'status-revision', color: 'bg-orange-500' },
  'Approved': { class: 'status-approved', color: 'bg-emerald-500' },
  'Delivered': { class: 'status-delivered', color: 'bg-green-500' },
  'Canceled': { class: 'status-canceled', color: 'bg-slate-400' },
};

const priorityConfig = {
  'Low': 'priority-low',
  'Normal': 'priority-normal',
  'High': 'priority-high',
  'Urgent': 'priority-urgent',
};

const ORDER_STATUSES = ["New", "In Progress", "Needs Client Review", "Revision Requested", "Approved", "Delivered", "Canceled"];
const FILE_TYPES = ["Raw", "Working", "Export", "Final", "Other"];

export default function OrderDetail() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { user, hasRole } = useAuth();
  const messagesEndRef = useRef(null);
  
  const [order, setOrder] = useState(null);
  const [messages, setMessages] = useState([]);
  const [files, setFiles] = useState([]);
  const [checklist, setChecklist] = useState(null);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [addFileOpen, setAddFileOpen] = useState(false);
  const [newFile, setNewFile] = useState({
    file_type: 'Export',
    label: '',
    url_or_upload: '',
    version: 'V1'
  });

  useEffect(() => {
    fetchOrderData();
  }, [orderId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchOrderData = async () => {
    try {
      const [orderRes, messagesRes, filesRes, checklistRes, activityRes] = await Promise.all([
        axios.get(`${API}/orders/${orderId}`),
        axios.get(`${API}/orders/${orderId}/messages`),
        axios.get(`${API}/orders/${orderId}/files`),
        axios.get(`${API}/orders/${orderId}/checklist`),
        axios.get(`${API}/orders/${orderId}/activity`)
      ]);
      setOrder(orderRes.data);
      setMessages(messagesRes.data);
      setFiles(filesRes.data);
      setChecklist(checklistRes.data);
      setActivity(activityRes.data);
    } catch (error) {
      toast.error('Failed to load order');
      navigate('/orders');
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    setSendingMessage(true);
    try {
      await axios.post(`${API}/orders/${orderId}/messages`, {
        message_body: newMessage.trim()
      });
      setNewMessage('');
      const messagesRes = await axios.get(`${API}/orders/${orderId}/messages`);
      setMessages(messagesRes.data);
    } catch (error) {
      toast.error('Failed to send message');
    } finally {
      setSendingMessage(false);
    }
  };

  const handleStatusChange = async (newStatus) => {
    try {
      await axios.patch(`${API}/orders/${orderId}`, { status: newStatus });
      toast.success(`Status updated to ${newStatus}`);
      fetchOrderData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update status');
    }
  };

  const handleChecklistUpdate = async (field, value) => {
    try {
      await axios.patch(`${API}/orders/${orderId}/checklist`, { [field]: value });
      fetchOrderData();
    } catch (error) {
      toast.error('Failed to update checklist');
    }
  };

  const handleAddFile = async (e) => {
    e.preventDefault();
    if (!newFile.label || !newFile.url_or_upload) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      await axios.post(`${API}/orders/${orderId}/files`, newFile);
      toast.success('File added successfully');
      setAddFileOpen(false);
      setNewFile({ file_type: 'Export', label: '', url_or_upload: '', version: 'V1' });
      fetchOrderData();
    } catch (error) {
      toast.error('Failed to add file');
    }
  };

  const handlePinFile = async (fileId) => {
    try {
      await axios.patch(`${API}/orders/${orderId}/files/${fileId}/pin`);
      toast.success('File pinned as latest final');
      fetchOrderData();
    } catch (error) {
      toast.error('Failed to pin file');
    }
  };

  const getAvailableStatuses = () => {
    if (!order) return [];
    
    if (hasRole('Admin', 'Manager')) {
      return ORDER_STATUSES;
    }
    
    if (hasRole('Editor')) {
      const transitions = {
        'New': ['In Progress'],
        'In Progress': ['Needs Client Review', 'Delivered'],
        'Revision Requested': ['In Progress']
      };
      return transitions[order.status] || [];
    }
    
    if (hasRole('Client')) {
      const transitions = {
        'Needs Client Review': ['Revision Requested', 'Approved']
      };
      return transitions[order.status] || [];
    }
    
    return [];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-rose-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!order) return null;

  const pinnedFile = files.find(f => f.is_pinned_latest_final);
  const availableStatuses = getAvailableStatuses();

  return (
    <div className="space-y-6 animate-fade-in" data-testid="order-detail-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <Button variant="ghost" onClick={() => navigate('/orders')} className="w-fit">
          <ArrowLeft size={18} className="mr-2" />
          Back to Orders
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <span className="font-mono text-sm text-slate-500">{order.order_code}</span>
            <Badge className={statusConfig[order.status]?.class}>{order.status}</Badge>
            <Badge className={priorityConfig[order.priority]}>{order.priority}</Badge>
          </div>
          <h1 className="text-xl font-bold text-slate-900 mt-1">{order.title}</h1>
        </div>
      </div>

      {/* Intake Required Banner */}
      {order.intake_required && !order.intake_completed && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertCircle className="text-amber-600" size={20} />
            <p className="text-sm text-amber-800 font-medium">
              Intake Required: Waiting on client information
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content - Messages & Tabs */}
        <div className="lg:col-span-2 space-y-6">
          {/* Message Thread */}
          <Card className="border-slate-200">
            <CardHeader className="border-b border-slate-100 pb-4">
              <CardTitle className="text-lg">Messages</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="h-96 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 ? (
                  <div className="text-center text-slate-500 py-8">
                    No messages yet. Start the conversation!
                  </div>
                ) : (
                  messages.map(msg => (
                    <div 
                      key={msg.id}
                      className={`flex ${msg.author_user_id === user?.id ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`max-w-[80%] ${msg.author_user_id === user?.id ? 'bg-rose-50' : 'bg-slate-100'} rounded-lg p-4`}>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-medium text-sm">{msg.author_name}</span>
                          <Badge variant="outline" className="text-xs">{msg.author_role}</Badge>
                        </div>
                        <p className="text-sm text-slate-700 whitespace-pre-wrap">{msg.message_body}</p>
                        <p className="text-xs text-slate-400 mt-2">
                          {format(new Date(msg.created_at), 'MMM d, yyyy h:mm a')}
                        </p>
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>
              
              {/* Message Composer */}
              <form onSubmit={handleSendMessage} className="border-t border-slate-100 p-4">
                <div className="flex gap-3">
                  <Textarea
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type your message..."
                    className="flex-1 min-h-[60px] resize-none"
                    data-testid="message-input"
                  />
                  <Button 
                    type="submit" 
                    className="bg-rose-600 hover:bg-rose-700"
                    disabled={sendingMessage || !newMessage.trim()}
                    data-testid="send-message-btn"
                  >
                    <Send size={18} />
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Tabs: Files & Activity */}
          <Tabs defaultValue="files">
            <TabsList>
              <TabsTrigger value="files" data-testid="files-tab">
                <FileText size={16} className="mr-2" />
                Files ({files.length})
              </TabsTrigger>
              <TabsTrigger value="activity" data-testid="activity-tab">
                <Activity size={16} className="mr-2" />
                Activity
              </TabsTrigger>
            </TabsList>

            <TabsContent value="files" className="mt-4">
              <Card className="border-slate-200">
                <CardHeader className="border-b border-slate-100 pb-4 flex flex-row items-center justify-between">
                  <CardTitle className="text-base">Order Files</CardTitle>
                  <Dialog open={addFileOpen} onOpenChange={setAddFileOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" data-testid="add-file-btn">
                        <Paperclip size={16} className="mr-2" />
                        Add File
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Add File</DialogTitle>
                        <DialogDescription>Add a file link or URL to this order.</DialogDescription>
                      </DialogHeader>
                      <form onSubmit={handleAddFile} className="space-y-4">
                        <div>
                          <Label>File Type</Label>
                          <Select value={newFile.file_type} onValueChange={(v) => setNewFile(prev => ({ ...prev, file_type: v }))}>
                            <SelectTrigger className="mt-1.5">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {FILE_TYPES.map(t => (
                                <SelectItem key={t} value={t}>{t}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Label</Label>
                          <Input
                            value={newFile.label}
                            onChange={(e) => setNewFile(prev => ({ ...prev, label: e.target.value }))}
                            placeholder="e.g., V2 Export 9x16"
                            className="mt-1.5"
                          />
                        </div>
                        <div>
                          <Label>URL or Link</Label>
                          <Input
                            value={newFile.url_or_upload}
                            onChange={(e) => setNewFile(prev => ({ ...prev, url_or_upload: e.target.value }))}
                            placeholder="https://drive.google.com/..."
                            className="mt-1.5"
                          />
                        </div>
                        <div>
                          <Label>Version</Label>
                          <Input
                            value={newFile.version}
                            onChange={(e) => setNewFile(prev => ({ ...prev, version: e.target.value }))}
                            placeholder="V1, V2, FINAL"
                            className="mt-1.5"
                          />
                        </div>
                        <Button type="submit" className="w-full bg-rose-600 hover:bg-rose-700">
                          Add File
                        </Button>
                      </form>
                    </DialogContent>
                  </Dialog>
                </CardHeader>
                <CardContent className="p-4">
                  {/* Pinned Latest Final */}
                  {pinnedFile && (
                    <div className="mb-4 p-4 border-2 border-rose-500 bg-rose-50 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Pin size={16} className="text-rose-600" />
                        <span className="font-semibold text-rose-700">Latest Final Export</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{pinnedFile.label}</p>
                          <p className="text-sm text-slate-500">{pinnedFile.version} • {pinnedFile.file_type}</p>
                        </div>
                        <a 
                          href={pinnedFile.url_or_upload} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-rose-600 hover:text-rose-700"
                        >
                          <Download size={20} />
                        </a>
                      </div>
                    </div>
                  )}

                  {/* Files List */}
                  {files.length === 0 ? (
                    <div className="text-center text-slate-500 py-8">
                      No files uploaded yet
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {files.filter(f => !f.is_pinned_latest_final).map(file => (
                        <div 
                          key={file.id}
                          className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                        >
                          <div>
                            <p className="font-medium text-sm">{file.label}</p>
                            <p className="text-xs text-slate-500">
                              {file.version} • {file.file_type} • by {file.uploaded_by_name}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {!hasRole('Client') && (file.file_type === 'Final' || file.file_type === 'Export') && (
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => handlePinFile(file.id)}
                                className="text-slate-600"
                              >
                                <Pin size={16} />
                              </Button>
                            )}
                            <a 
                              href={file.url_or_upload} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="p-2 text-slate-600 hover:text-rose-600"
                            >
                              <Download size={18} />
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="activity" className="mt-4">
              <Card className="border-slate-200">
                <CardHeader className="border-b border-slate-100 pb-4">
                  <CardTitle className="text-base">Activity Log</CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  {activity.length === 0 ? (
                    <div className="text-center text-slate-500 py-8">
                      No activity recorded
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {activity.map(log => (
                        <div key={log.id} className="flex gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                            <Activity size={14} className="text-slate-500" />
                          </div>
                          <div>
                            <p className="text-sm">
                              <span className="font-medium">{log.user_name}</span>
                              {' '}{log.details}
                            </p>
                            <p className="text-xs text-slate-500">
                              {format(new Date(log.created_at), 'MMM d, yyyy h:mm a')}
                            </p>
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

        {/* Right Sidebar */}
        <div className="space-y-6">
          {/* Order Summary */}
          <Card className="border-slate-200">
            <CardHeader className="border-b border-slate-100 pb-4">
              <CardTitle className="text-base">Order Details</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              {/* Status */}
              <div>
                <Label className="text-xs text-slate-500">Status</Label>
                {availableStatuses.length > 0 ? (
                  <Select value={order.status} onValueChange={handleStatusChange}>
                    <SelectTrigger className="mt-1.5" data-testid="status-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={order.status}>{order.status}</SelectItem>
                      {availableStatuses.map(s => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge className={`mt-1.5 ${statusConfig[order.status]?.class}`}>{order.status}</Badge>
                )}
              </div>

              {/* Client */}
              <div>
                <Label className="text-xs text-slate-500">Client</Label>
                <div className="flex items-center gap-2 mt-1.5">
                  <User size={16} className="text-slate-400" />
                  <span className="font-medium">{order.client_name}</span>
                </div>
              </div>

              {/* Assigned Editor */}
              <div>
                <Label className="text-xs text-slate-500">Assigned Editor</Label>
                <div className="flex items-center gap-2 mt-1.5">
                  <User size={16} className="text-slate-400" />
                  <span className="font-medium">{order.assigned_editor_name}</span>
                </div>
              </div>

              {/* Due Date */}
              <div>
                <Label className="text-xs text-slate-500">Due Date</Label>
                <div className="flex items-center gap-2 mt-1.5">
                  <Calendar size={16} className="text-slate-400" />
                  <span className="font-medium">
                    {order.due_date ? format(new Date(order.due_date), 'MMM d, yyyy') : 'Not set'}
                  </span>
                </div>
              </div>

              {/* Type */}
              <div>
                <Label className="text-xs text-slate-500">Type</Label>
                <p className="font-medium mt-1.5">{order.type}</p>
              </div>

              {/* Source */}
              <div>
                <Label className="text-xs text-slate-500">Source</Label>
                <p className="font-medium mt-1.5">{order.source}</p>
              </div>
            </CardContent>
          </Card>

          {/* Checklist */}
          {!hasRole('Client') && checklist && (
            <Card className="border-slate-200">
              <CardHeader className="border-b border-slate-100 pb-4">
                <CardTitle className="text-base">Checklist</CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                {[
                  { key: 'intake_complete', label: 'Intake Complete' },
                  { key: 'assets_received', label: 'Assets Received' },
                  { key: 'first_cut_delivered', label: 'First Cut Delivered' },
                  { key: 'revision_round_1_done', label: 'Revision Round 1 Done' },
                  { key: 'final_export_delivered', label: 'Final Export Delivered' },
                ].map(item => (
                  <div key={item.key} className="flex items-center gap-3">
                    <Checkbox
                      id={item.key}
                      checked={checklist[item.key]}
                      onCheckedChange={(checked) => handleChecklistUpdate(item.key, checked)}
                      data-testid={`checklist-${item.key}`}
                    />
                    <Label htmlFor={item.key} className="text-sm cursor-pointer">
                      {item.label}
                    </Label>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Client Actions */}
          {hasRole('Client') && order.status === 'Needs Client Review' && (
            <Card className="border-slate-200">
              <CardHeader className="border-b border-slate-100 pb-4">
                <CardTitle className="text-base">Your Review</CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                <Button 
                  className="w-full bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => handleStatusChange('Approved')}
                  data-testid="approve-btn"
                >
                  <CheckCircle2 size={18} className="mr-2" />
                  Approve
                </Button>
                <Button 
                  variant="outline"
                  className="w-full border-orange-500 text-orange-600 hover:bg-orange-50"
                  onClick={() => handleStatusChange('Revision Requested')}
                  data-testid="request-revision-btn"
                >
                  Request Revisions
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
