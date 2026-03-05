import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
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
  Star,
  Clock,
  User,
  Calendar,
  FileText,
  MessageSquare,
  CheckCircle2,
  AlertTriangle,
  Play,
  RotateCcw,
  XCircle,
  Shuffle,
  Trash2,
  ListTodo,
  Package,
  Hourglass,
  CircleDot,
  Eye
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const statusConfig = {
  'Draft': { class: 'bg-slate-200 text-slate-600', color: 'bg-slate-400' },
  'Open': { class: 'bg-blue-100 text-blue-700', color: 'bg-blue-500' },
  'In Progress': { class: 'bg-amber-100 text-amber-700', color: 'bg-amber-500' },
  'Pending': { class: 'bg-purple-100 text-purple-700', color: 'bg-purple-500' },
  'Delivered': { class: 'bg-green-100 text-green-700', color: 'bg-green-500' },
  'Closed': { class: 'bg-slate-100 text-slate-500', color: 'bg-slate-500' },
  'Canceled': { class: 'bg-red-100 text-red-600', color: 'bg-red-500' },
};

const statusExplanations = {
  'Draft': 'This request is saved as a draft and has not been submitted yet.',
  'Open': 'Your request has been submitted and the team will pick it up shortly.',
  'In Progress': 'Your request is being worked on by the team.',
  'Pending': 'The team needs your input before continuing. Please review and respond.',
  'Delivered': 'Your deliverables are ready! Please review the final files.',
  'Closed': 'This request has been completed and closed.',
  'Canceled': 'This request was canceled.',
};

const taskStatusBadge = {
  'backlog': 'bg-slate-100 text-slate-600',
  'todo': 'bg-blue-100 text-blue-700',
  'doing': 'bg-amber-100 text-amber-700',
  'waiting_on_client': 'bg-purple-100 text-purple-700',
  'review': 'bg-indigo-100 text-indigo-700',
  'done': 'bg-green-100 text-green-700',
};

const priorityConfig = {
  'Low': 'bg-slate-100 text-slate-600',
  'Normal': 'bg-blue-100 text-blue-600',
  'High': 'bg-orange-100 text-orange-600',
  'Urgent': 'bg-red-100 text-red-600',
};

const FILE_TYPES = ["Raw Footage", "Reference", "Export", "Final Delivery", "Other"];

export default function OrderDetail() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const messagesEndRef = useRef(null);
  
  const [order, setOrder] = useState(null);
  const [messages, setMessages] = useState([]);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [addFileOpen, setAddFileOpen] = useState(false);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [closeReason, setCloseReason] = useState('');
  const [closingOrder, setClosingOrder] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelNotes, setCancelNotes] = useState('');
  const [cancelingOrder, setCancelingOrder] = useState(false);
  const [cancellationReasons, setCancellationReasons] = useState([]);
  const [deliverDialogOpen, setDeliverDialogOpen] = useState(false);
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [deliveringOrder, setDeliveringOrder] = useState(false);
  
  // Reassign state
  const [reassignDialogOpen, setReassignDialogOpen] = useState(false);
  const [reassignOptions, setReassignOptions] = useState({ users: [], teams: [], specialties: [] });
  const [reassignType, setReassignType] = useState('user');
  const [reassignTargetId, setReassignTargetId] = useState('');
  const [reassignReason, setReassignReason] = useState('');
  const [reassigning, setReassigning] = useState(false);
  
  // Soft delete state (Admin only)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');
  const [deletingOrder, setDeletingOrder] = useState(false);
  
  const [newFile, setNewFile] = useState({
    file_type: 'Export',
    label: '',
    url: ''
  });
  
  // Linked tasks
  const [linkedTasks, setLinkedTasks] = useState([]);
  
  // Account manager
  const [accountManager, setAccountManager] = useState(null);

  useEffect(() => {
    fetchOrderData();
    fetchCancellationReasons();
  }, [orderId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchCancellationReasons = async () => {
    try {
      const res = await axios.get(`${API}/orders/cancellation-reasons`);
      setCancellationReasons(res.data.reasons || []);
    } catch (error) {
      console.error('Failed to fetch cancellation reasons');
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchOrderData = async () => {
    try {
      const [orderRes, messagesRes, filesRes] = await Promise.all([
        axios.get(`${API}/orders/${orderId}`),
        axios.get(`${API}/orders/${orderId}/messages`),
        axios.get(`${API}/orders/${orderId}/files`)
      ]);
      setOrder(orderRes.data);
      setMessages(messagesRes.data);
      setFiles(filesRes.data);
      
      // Fetch linked tasks
      try {
        const tasksRes = await axios.get(`${API}/tasks`, { params: { request_id: orderRes.data.id } });
        setLinkedTasks(tasksRes.data?.tasks || []);
      } catch {
        setLinkedTasks([]);
      }
      
      // Fetch account manager for the requester
      try {
        const amRes = await axios.get(`${API}/tasks/account-manager/${orderRes.data.requester_id}`);
        setAccountManager(amRes.data?.account_manager || null);
      } catch {
        setAccountManager(null);
      }
    } catch (error) {
      toast.error('Failed to load request');
      navigate('/');
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

  const handlePickOrder = async () => {
    try {
      await axios.post(`${API}/orders/${orderId}/pick`);
      toast.success('Order picked successfully!');
      fetchOrderData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to pick order');
    }
  };

  const handleSubmitForReview = async () => {
    try {
      await axios.post(`${API}/orders/${orderId}/submit-for-review`);
      toast.success('Order submitted for review');
      fetchOrderData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to submit for review');
    }
  };

  const handleRespondToOrder = async () => {
    try {
      await axios.post(`${API}/orders/${orderId}/respond`);
      toast.success('Response sent to editor');
      fetchOrderData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to respond');
    }
  };

  const handleDeliver = async () => {
    if (!deliveryNotes.trim()) {
      toast.error('Please provide delivery notes');
      return;
    }

    setDeliveringOrder(true);
    try {
      await axios.post(`${API}/orders/${orderId}/deliver`, {
        resolution_notes: deliveryNotes.trim()
      });
      toast.success('Order delivered!');
      setDeliverDialogOpen(false);
      setDeliveryNotes('');
      fetchOrderData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to deliver order');
    } finally {
      setDeliveringOrder(false);
    }
  };

  const handleCancelOrder = async () => {
    if (!cancelReason) {
      toast.error('Please select a cancellation reason');
      return;
    }
    if (cancelReason === 'Other' && !cancelNotes.trim()) {
      toast.error('Please provide additional details for "Other" reason');
      return;
    }

    setCancelingOrder(true);
    try {
      await axios.post(`${API}/orders/${orderId}/cancel`, {
        reason: cancelReason,
        notes: cancelNotes.trim() || null
      });
      toast.success('Ticket canceled successfully');
      setCancelDialogOpen(false);
      setCancelReason('');
      setCancelNotes('');
      fetchOrderData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to cancel ticket');
    } finally {
      setCancelingOrder(false);
    }
  };

  // Reassign handlers
  const openReassignDialog = async () => {
    try {
      const res = await axios.get(`${API}/orders/${orderId}/reassign-options`);
      setReassignOptions(res.data);
      setReassignDialogOpen(true);
    } catch (error) {
      toast.error('Failed to load reassign options');
    }
  };

  const handleReassign = async () => {
    if (!reassignTargetId) {
      toast.error('Please select a target to reassign to');
      return;
    }

    setReassigning(true);
    try {
      await axios.post(`${API}/orders/${orderId}/reassign`, {
        reassign_type: reassignType,
        target_id: reassignTargetId,
        reason: reassignReason.trim() || null
      });
      toast.success('Ticket reassigned successfully');
      setReassignDialogOpen(false);
      setReassignTargetId('');
      setReassignReason('');
      setReassignType('user');
      fetchOrderData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to reassign ticket');
    } finally {
      setReassigning(false);
    }
  };

  // Soft delete handler (Admin only)
  const handleSoftDelete = async () => {
    if (!deleteReason.trim()) {
      toast.error('Please provide a reason for deletion');
      return;
    }

    setDeletingOrder(true);
    try {
      await axios.delete(`${API}/orders/${orderId}`, {
        data: { reason: deleteReason.trim() }
      });
      toast.success('Ticket soft-deleted successfully');
      setDeleteDialogOpen(false);
      setDeleteReason('');
      navigate('/orders');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete ticket');
    } finally {
      setDeletingOrder(false);
    }
  };

  const handleAddFile = async (e) => {
    e.preventDefault();
    if (!newFile.label || !newFile.url) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      await axios.post(`${API}/orders/${orderId}/files`, newFile);
      toast.success('File added successfully');
      setAddFileOpen(false);
      setNewFile({ file_type: 'Export', label: '', url: '' });
      fetchOrderData();
    } catch (error) {
      toast.error('Failed to add file');
    }
  };

  const handleMarkFinal = async (fileId) => {
    try {
      await axios.patch(`${API}/orders/${orderId}/files/${fileId}/mark-final`);
      toast.success('File marked as final delivery');
      fetchOrderData();
    } catch (error) {
      toast.error('Failed to mark file as final');
    }
  };

  const handleCloseOrder = async () => {
    if (!closeReason.trim()) {
      toast.error('Please provide a reason for closing the ticket');
      return;
    }

    setClosingOrder(true);
    try {
      await axios.post(`${API}/orders/${orderId}/close`, {
        reason: closeReason.trim()
      });
      toast.success('Ticket closed successfully');
      setCloseDialogOpen(false);
      setCloseReason('');
      fetchOrderData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to close ticket');
    } finally {
      setClosingOrder(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-rose-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!order) return null;

  const finalFile = files.find(f => f.is_final_delivery);
  // Check specialty_name for role-based permissions (system uses specialties now)
  const isEditor = user?.specialty_name === 'Editor' || user?.role === 'Editor';
  const isRequester = user?.specialty_name === 'Requester' || user?.role === 'Requester';
  const isAdmin = user?.role === 'Administrator' || user?.role === 'Admin';
  
  const canPick = isEditor && order.status === 'Open';
  const canSubmitForReview = isEditor && order.editor_id === user?.id && order.status === 'In Progress';
  const canRespond = isRequester && order.requester_id === user?.id && order.status === 'Pending';
  const canDeliver = isEditor && order.editor_id === user?.id && ['In Progress', 'Pending'].includes(order.status);
  const canAddFile = (isEditor && order.editor_id === user?.id) || 
                     (order.requester_id === user?.id) ||
                     isAdmin;
  // Requester can close their own ticket if it's not already closed, delivered, or canceled
  const canClose = (order.requester_id === user?.id && !['Closed', 'Delivered', 'Canceled'].includes(order.status)) ||
                   (isAdmin && !['Closed', 'Delivered', 'Canceled'].includes(order.status));
  // Requester can cancel their own ticket if it's still active
  const canCancel = order.requester_id === user?.id && !['Delivered', 'Closed', 'Canceled'].includes(order.status);
  // Resolvers (admin, operator, current editor) can reassign tickets that aren't closed/canceled/delivered
  const isOperator = user?.role === 'Operator';
  const isResolver = order.editor_id === user?.id;
  const canReassign = (isAdmin || isOperator || isResolver) && !['Closed', 'Canceled', 'Delivered'].includes(order.status);
  // Admin can soft-delete any ticket that isn't already deleted
  const canSoftDelete = isAdmin && !order.deleted;

  const isClient = !isAdmin && !isOperator && !isEditor;

  // Check if admin is in "Preview as Client" mode or Client Portal mode
  const isClientPreview = typeof window !== 'undefined' && localStorage.getItem('preview_as_client') === 'true';
  const isClientPortalMode = typeof window !== 'undefined' && localStorage.getItem('active_app_mode') === 'client_portal';
  const showAsClient = isClient || isClientPreview || isClientPortalMode;

  return (
    <div className="space-y-6 animate-fade-in" data-testid="order-detail-page">
      {/* Header with Service Context */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <Button variant="ghost" onClick={() => navigate(-1)} className="w-fit" data-testid="back-btn">
          <ArrowLeft size={18} className="mr-2" />
          Back
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-mono text-sm text-slate-500">{order.order_code}</span>
            <Badge className={statusConfig[order.status]?.class}>{order.status}</Badge>
            <Badge className={priorityConfig[order.priority]}>{order.priority}</Badge>
            {order.service_name && (
              <Badge variant="outline" className="border-[#A2182C]/30 text-[#A2182C]" data-testid="service-badge">
                <Package size={12} className="mr-1" />
                {order.service_name}
              </Badge>
            )}
            {order.is_sla_breached && (
              <Badge className="bg-red-100 text-red-700">
                <AlertTriangle size={12} className="mr-1" />
                SLA Breach
              </Badge>
            )}
          </div>
          <h1 className="text-xl font-bold text-slate-900 mt-1" data-testid="request-title">{order.title}</h1>
        </div>
      </div>

      {/* Plain Language Status Banner */}
      {statusExplanations[order.status] && (
        <div className={`flex items-start gap-3 p-4 rounded-lg border ${
          order.status === 'Pending' ? 'bg-purple-50 border-purple-200' :
          order.status === 'Delivered' ? 'bg-green-50 border-green-200' :
          order.status === 'In Progress' ? 'bg-amber-50 border-amber-200' :
          'bg-blue-50 border-blue-200'
        }`} data-testid="status-banner">
          {order.status === 'Pending' ? <Hourglass size={18} className="text-purple-600 mt-0.5 shrink-0" /> :
           order.status === 'Delivered' ? <CheckCircle2 size={18} className="text-green-600 mt-0.5 shrink-0" /> :
           order.status === 'In Progress' ? <Play size={18} className="text-amber-600 mt-0.5 shrink-0" /> :
           <CircleDot size={18} className="text-blue-600 mt-0.5 shrink-0" />}
          <div>
            <p className={`text-sm font-medium ${
              order.status === 'Pending' ? 'text-purple-800' :
              order.status === 'Delivered' ? 'text-green-800' :
              order.status === 'In Progress' ? 'text-amber-800' :
              'text-blue-800'
            }`}>{statusExplanations[order.status]}</p>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3">
        {!showAsClient && canPick && (
          <Button 
            className="bg-rose-600 hover:bg-rose-700"
            onClick={handlePickOrder}
            data-testid="pick-order-btn"
          >
            <Play size={18} className="mr-2" />
            Pick This Order
          </Button>
        )}
        {!showAsClient && canSubmitForReview && (
          <Button 
            className="bg-purple-600 hover:bg-purple-700"
            onClick={handleSubmitForReview}
            data-testid="submit-review-btn"
          >
            <Send size={18} className="mr-2" />
            Submit for Review
          </Button>
        )}
        {!showAsClient && canRespond && (
          <Button 
            className="bg-indigo-600 hover:bg-indigo-700"
            onClick={handleRespondToOrder}
            data-testid="respond-btn"
          >
            <RotateCcw size={18} className="mr-2" />
            Send Response to Editor
          </Button>
        )}
        {!showAsClient && canDeliver && (
          <Dialog open={deliverDialogOpen} onOpenChange={setDeliverDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                className="bg-green-600 hover:bg-green-700"
                data-testid="deliver-btn"
              >
                <CheckCircle2 size={18} className="mr-2" />
                Mark as Delivered
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Mark as Delivered</DialogTitle>
                <DialogDescription>
                  Please provide delivery notes describing what was completed. This will be visible to the requester.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div>
                  <Label>Delivery Notes *</Label>
                  <Textarea
                    value={deliveryNotes}
                    onChange={(e) => setDeliveryNotes(e.target.value)}
                    placeholder="Describe what was delivered, any important notes, next steps..."
                    className="mt-1.5 min-h-[120px]"
                    data-testid="delivery-notes-input"
                  />
                </div>
                <div className="flex gap-3 justify-end">
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setDeliverDialogOpen(false);
                      setDeliveryNotes('');
                    }}
                  >
                    Cancel
                  </Button>
                  <Button 
                    className="bg-green-600 hover:bg-green-700"
                    onClick={handleDeliver}
                    disabled={deliveringOrder || !deliveryNotes.trim()}
                    data-testid="confirm-deliver-btn"
                  >
                    {deliveringOrder ? 'Delivering...' : 'Confirm Delivery'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
        {!showAsClient && canReassign && (
          <Dialog open={reassignDialogOpen} onOpenChange={setReassignDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                variant="outline"
                className="border-indigo-300 text-indigo-600 hover:bg-indigo-50"
                onClick={openReassignDialog}
                data-testid="reassign-btn"
              >
                <Shuffle size={18} className="mr-2" />
                Reassign
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Reassign Ticket</DialogTitle>
                <DialogDescription>
                  Transfer this ticket to another user, team, or specialty.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div>
                  <Label>Reassign by</Label>
                  <Select value={reassignType} onValueChange={(v) => { setReassignType(v); setReassignTargetId(''); }}>
                    <SelectTrigger className="mt-1.5" data-testid="reassign-type-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">User</SelectItem>
                      <SelectItem value="team">Team</SelectItem>
                      <SelectItem value="specialty">Specialty</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Select {reassignType === 'user' ? 'User' : reassignType === 'team' ? 'Team' : 'Specialty'} *</Label>
                  <Select value={reassignTargetId} onValueChange={setReassignTargetId}>
                    <SelectTrigger className="mt-1.5" data-testid="reassign-target-select">
                      <SelectValue placeholder={`Select a ${reassignType}...`} />
                    </SelectTrigger>
                    <SelectContent>
                      {reassignType === 'user' && reassignOptions.users.map(u => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.name} {u.specialty_name && `(${u.specialty_name})`}
                        </SelectItem>
                      ))}
                      {reassignType === 'team' && reassignOptions.teams.map(t => (
                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                      ))}
                      {reassignType === 'specialty' && reassignOptions.specialties.map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Reason (optional)</Label>
                  <Textarea
                    value={reassignReason}
                    onChange={(e) => setReassignReason(e.target.value)}
                    placeholder="Why is this ticket being reassigned?"
                    className="mt-1.5"
                    data-testid="reassign-reason-input"
                  />
                </div>
                <div className="flex gap-3 justify-end">
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setReassignDialogOpen(false);
                      setReassignTargetId('');
                      setReassignReason('');
                    }}
                  >
                    Cancel
                  </Button>
                  <Button 
                    className="bg-indigo-600 hover:bg-indigo-700"
                    onClick={handleReassign}
                    disabled={reassigning || !reassignTargetId}
                    data-testid="confirm-reassign-btn"
                  >
                    {reassigning ? 'Reassigning...' : 'Reassign Ticket'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
        {canCancel && (
          <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                variant="outline"
                className="border-red-300 text-red-600 hover:bg-red-50"
                data-testid="cancel-ticket-btn"
              >
                <XCircle size={18} className="mr-2" />
                Cancel Ticket
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Cancel this ticket?</DialogTitle>
                <DialogDescription>
                  This will cancel your request. The resolver will be notified. This action cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div>
                  <Label>Reason for cancellation *</Label>
                  <Select value={cancelReason} onValueChange={setCancelReason}>
                    <SelectTrigger className="mt-1.5" data-testid="cancel-reason-select">
                      <SelectValue placeholder="Select a reason" />
                    </SelectTrigger>
                    <SelectContent>
                      {cancellationReasons.map(reason => (
                        <SelectItem key={reason} value={reason}>{reason}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Additional notes {cancelReason === 'Other' ? '*' : '(optional)'}</Label>
                  <Textarea
                    value={cancelNotes}
                    onChange={(e) => setCancelNotes(e.target.value)}
                    placeholder="Any additional details..."
                    className="mt-1.5"
                    data-testid="cancel-notes-input"
                  />
                </div>
                <div className="flex gap-3 justify-end">
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setCancelDialogOpen(false);
                      setCancelReason('');
                      setCancelNotes('');
                    }}
                  >
                    Keep Ticket
                  </Button>
                  <Button 
                    className="bg-red-600 hover:bg-red-700"
                    onClick={handleCancelOrder}
                    disabled={cancelingOrder || !cancelReason || (cancelReason === 'Other' && !cancelNotes.trim())}
                    data-testid="confirm-cancel-btn"
                  >
                    {cancelingOrder ? 'Canceling...' : 'Cancel Ticket'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
        {!showAsClient && canClose && (
          <Dialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                variant="outline"
                className="border-slate-300 text-slate-700 hover:bg-slate-100"
                data-testid="close-ticket-btn"
              >
                <XCircle size={18} className="mr-2" />
                Close Ticket
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Close Ticket</DialogTitle>
                <DialogDescription>
                  Please provide a reason for closing this ticket. This action cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div>
                  <Label>Reason for closing *</Label>
                  <Textarea
                    value={closeReason}
                    onChange={(e) => setCloseReason(e.target.value)}
                    placeholder="e.g., Issue resolved, No longer needed, Duplicate request..."
                    className="mt-1.5 min-h-[100px]"
                    data-testid="close-reason-input"
                  />
                </div>
                <div className="flex gap-3 justify-end">
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setCloseDialogOpen(false);
                      setCloseReason('');
                    }}
                  >
                    Cancel
                  </Button>
                  <Button 
                    className="bg-slate-700 hover:bg-slate-800"
                    onClick={handleCloseOrder}
                    disabled={closingOrder || !closeReason.trim()}
                    data-testid="confirm-close-btn"
                  >
                    {closingOrder ? 'Closing...' : 'Close Ticket'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
        {!showAsClient && canSoftDelete && (
          <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                variant="outline"
                className="border-red-400 text-red-600 hover:bg-red-50"
                data-testid="delete-ticket-btn"
              >
                <Trash2 size={18} className="mr-2" />
                Delete Ticket
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="text-red-600">Soft Delete Ticket</DialogTitle>
                <DialogDescription>
                  This will soft-delete the ticket. It can be restored later from the Deleted Tickets page. 
                  A reason is required for the audit trail.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div>
                  <Label>Reason for deletion *</Label>
                  <Textarea
                    value={deleteReason}
                    onChange={(e) => setDeleteReason(e.target.value)}
                    placeholder="e.g., Duplicate ticket, Test data, Spam request..."
                    className="mt-1.5 min-h-[100px]"
                    data-testid="delete-reason-input"
                  />
                </div>
                <div className="flex gap-3 justify-end">
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setDeleteDialogOpen(false);
                      setDeleteReason('');
                    }}
                  >
                    Cancel
                  </Button>
                  <Button 
                    className="bg-red-600 hover:bg-red-700"
                    onClick={handleSoftDelete}
                    disabled={deletingOrder || !deleteReason.trim()}
                    data-testid="confirm-delete-btn"
                  >
                    {deletingOrder ? 'Deleting...' : 'Delete Ticket'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Order Details Card */}
          <Card className="border-slate-200">
            <CardHeader className="border-b border-slate-100 pb-4">
              <CardTitle>Request Details</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              {/* Service-specific fields (structured data) */}
              {order.service_fields && Object.keys(order.service_fields).length > 0 ? (
                <div className="space-y-3" data-testid="service-fields-section">
                  {Object.entries(order.service_fields).map(([key, value]) => {
                    if (!value) return null;
                    const label = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                    return (
                      <div key={key}>
                        <Label className="text-xs text-slate-500">{label}</Label>
                        <p className="mt-1 text-slate-700 whitespace-pre-wrap">{value}</p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <>
                  <div>
                    <Label className="text-xs text-slate-500">Description</Label>
                    <p className="mt-1 text-slate-700 whitespace-pre-wrap">{order.description}</p>
                  </div>
                  {order.video_script && (
                    <div>
                      <Label className="text-xs text-slate-500">Video Script</Label>
                      <p className="mt-1 text-slate-700 whitespace-pre-wrap">{order.video_script}</p>
                    </div>
                  )}
                  {order.reference_links && (
                    <div>
                      <Label className="text-xs text-slate-500">Reference Links</Label>
                      <p className="mt-1 text-slate-700 whitespace-pre-wrap">{order.reference_links}</p>
                    </div>
                  )}
                  {order.footage_links && (
                    <div>
                      <Label className="text-xs text-slate-500">Footage Links</Label>
                      <p className="mt-1 text-slate-700 whitespace-pre-wrap">{order.footage_links}</p>
                    </div>
                  )}
                  {order.music_preference && (
                    <div>
                      <Label className="text-xs text-slate-500">Music Preference</Label>
                      <p className="mt-1 text-slate-700">{order.music_preference}</p>
                    </div>
                  )}
                  {order.delivery_format && (
                    <div>
                      <Label className="text-xs text-slate-500">Delivery Format</Label>
                      <p className="mt-1 text-slate-700">{order.delivery_format}</p>
                    </div>
                  )}
                  {order.special_instructions && (
                    <div>
                      <Label className="text-xs text-slate-500">Special Instructions</Label>
                      <p className="mt-1 text-slate-700 whitespace-pre-wrap">{order.special_instructions}</p>
                    </div>
                  )}
                </>
              )}
              
              {/* Resolution/Delivery Notes */}
              {order.resolution_notes && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <Label className="text-xs text-green-700 font-semibold">Delivery Notes</Label>
                  <p className="mt-1 text-green-800 whitespace-pre-wrap">{order.resolution_notes}</p>
                </div>
              )}
              
              {/* Cancellation Info */}
              {order.status === 'Canceled' && order.cancellation_reason && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <Label className="text-xs text-red-700 font-semibold">Cancellation Reason</Label>
                  <p className="mt-1 text-red-800">{order.cancellation_reason}</p>
                  {order.cancellation_notes && (
                    <p className="mt-2 text-red-700 text-sm whitespace-pre-wrap">{order.cancellation_notes}</p>
                  )}
                  {order.canceled_at && (
                    <p className="mt-2 text-xs text-red-600">
                      Canceled: {format(new Date(order.canceled_at), 'PPpp')}
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tabs: Tasks, Messages & Files */}
          <Tabs defaultValue="tasks">
            <TabsList>
              <TabsTrigger value="tasks" data-testid="tasks-tab">
                <ListTodo size={16} className="mr-2" />
                Tasks ({linkedTasks.length})
              </TabsTrigger>
              <TabsTrigger value="messages" data-testid="messages-tab">
                <MessageSquare size={16} className="mr-2" />
                Messages ({messages.length})
              </TabsTrigger>
              <TabsTrigger value="files" data-testid="files-tab">
                <FileText size={16} className="mr-2" />
                Files ({files.length})
              </TabsTrigger>
            </TabsList>

            {/* Linked Tasks Tab */}
            <TabsContent value="tasks" className="mt-4">
              <Card className="border-slate-200">
                <CardContent className="p-4">
                  {linkedTasks.length === 0 ? (
                    <div className="text-center text-slate-500 py-8">
                      <ListTodo size={32} className="mx-auto text-slate-300 mb-2" />
                      <p className="text-sm">No tasks linked to this request yet</p>
                      {!isClient && (
                        <p className="text-xs text-slate-400 mt-1">Tasks will appear here when assigned to this request</p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2" data-testid="linked-tasks-list">
                      {linkedTasks.map(task => (
                        <div
                          key={task.id}
                          className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                          onClick={() => navigate('/task-board')}
                          data-testid={`linked-task-${task.id}`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-2 h-2 rounded-full ${
                              task.status === 'done' ? 'bg-green-500' :
                              task.status === 'doing' ? 'bg-amber-500' :
                              task.status === 'waiting_on_client' ? 'bg-purple-500' :
                              'bg-slate-400'
                            }`} />
                            <div>
                              <p className="text-sm font-medium text-slate-800">{task.title}</p>
                              {task.assignee_name && (
                                <p className="text-xs text-slate-500">{task.assignee_name}</p>
                              )}
                            </div>
                          </div>
                          <Badge className={taskStatusBadge[task.status] || 'bg-slate-100 text-slate-600'}>
                            {task.status === 'waiting_on_client' ? 'Waiting on you' :
                             task.status === 'doing' ? 'In Progress' :
                             task.status?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Unknown'}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="messages" className="mt-4">
              <Card className="border-slate-200">
                <CardContent className="p-0">
                  <div className="h-80 overflow-y-auto p-4 space-y-4">
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
                  {(order.editor_id === user?.id || order.requester_id === user?.id || user?.role === 'Admin') && (
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
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="files" className="mt-4">
              <Card className="border-slate-200">
                <CardHeader className="border-b border-slate-100 pb-4 flex flex-row items-center justify-between">
                  <CardTitle className="text-base">Order Files</CardTitle>
                  {canAddFile && (
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
                          <DialogDescription>Add a file link to this order.</DialogDescription>
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
                            <Label>URL</Label>
                            <Input
                              value={newFile.url}
                              onChange={(e) => setNewFile(prev => ({ ...prev, url: e.target.value }))}
                              placeholder="https://drive.google.com/..."
                              className="mt-1.5"
                            />
                          </div>
                          <Button type="submit" className="w-full bg-rose-600 hover:bg-rose-700">
                            Add File
                          </Button>
                        </form>
                      </DialogContent>
                    </Dialog>
                  )}
                </CardHeader>
                <CardContent className="p-4">
                  {/* Final Delivery */}
                  {finalFile && (
                    <div className="mb-4 p-4 border-2 border-green-500 bg-green-50 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Star size={16} className="text-green-600 fill-green-600" />
                        <span className="font-semibold text-green-700">Final Delivery</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{finalFile.label}</p>
                          <p className="text-sm text-slate-500">{finalFile.file_type}</p>
                        </div>
                        <a 
                          href={finalFile.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-green-600 hover:text-green-700"
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
                      {files.filter(f => !f.is_final_delivery).map(file => (
                        <div 
                          key={file.id}
                          className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                        >
                          <div>
                            <p className="font-medium text-sm">{file.label}</p>
                            <p className="text-xs text-slate-500">
                              {file.file_type} • by {file.uploaded_by_name}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {user?.role === 'Editor' && order.editor_id === user?.id && (
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => handleMarkFinal(file.id)}
                                className="text-slate-600"
                                data-testid={`mark-final-${file.id}`}
                              >
                                <Star size={16} />
                              </Button>
                            )}
                            <a 
                              href={file.url} 
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
          </Tabs>
        </div>

        {/* Right Sidebar */}
        <div className="space-y-6">
          {/* Order Summary */}
          <Card className="border-slate-200">
            <CardHeader className="border-b border-slate-100 pb-4">
              <CardTitle className="text-base">Request Info</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div>
                <Label className="text-xs text-slate-500">Status</Label>
                <Badge className={`mt-1.5 ${statusConfig[order.status]?.class}`}>{order.status}</Badge>
              </div>

              {order.service_name && (
                <div>
                  <Label className="text-xs text-slate-500">Service</Label>
                  <p className="font-medium mt-1.5">{order.service_name}</p>
                </div>
              )}

              {!order.service_name && order.category_l1_name && !isClient && (
                <div>
                  <Label className="text-xs text-slate-500">Category</Label>
                  <p className="font-medium mt-1.5">{order.category_l1_name}</p>
                </div>
              )}

              <div>
                <Label className="text-xs text-slate-500">Requester</Label>
                <div className="flex items-center gap-2 mt-1.5">
                  <User size={16} className="text-slate-400" />
                  <span className="font-medium">{order.requester_name}</span>
                </div>
                <p className="text-xs text-slate-500 ml-6">{order.requester_email}</p>
              </div>

              <div>
                <Label className="text-xs text-slate-500">Assigned to</Label>
                <div className="flex items-center gap-2 mt-1.5">
                  <User size={16} className="text-slate-400" />
                  {showAsClient ? (
                    <span className="font-medium">RRM Team</span>
                  ) : (
                    <span className={`font-medium ${order.editor_name ? '' : 'text-slate-400 italic'}`}>
                      {order.editor_name || 'Unassigned'}
                    </span>
                  )}
                </div>
              </div>

              {/* Queue label — internal users only */}
              {!showAsClient && order.assigned_queue_key && (
                <div data-testid="queue-info">
                  <Label className="text-xs text-slate-500">Queue</Label>
                  <p className="font-medium mt-1.5 text-sm" data-testid="queue-label">
                    {order.assigned_queue_key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </p>
                </div>
              )}

              {accountManager && (
                <div data-testid="account-manager-info">
                  <Label className="text-xs text-slate-500">Account Manager</Label>
                  <div className="flex items-center gap-2 mt-1.5">
                    <User size={16} className="text-[#A2182C]" />
                    <span className="font-medium">{accountManager.name}</span>
                  </div>
                  {accountManager.email && (
                    <p className="text-xs text-slate-500 ml-6">{accountManager.email}</p>
                  )}
                </div>
              )}

              {order.sla_deadline && (
                <div>
                  <Label className="text-xs text-slate-500">Deadline</Label>
                  <div className="flex items-center gap-2 mt-1.5">
                    <Calendar size={16} className="text-slate-400" />
                    <span className={`font-medium ${order.is_sla_breached ? 'text-red-600' : ''}`}>
                      {format(new Date(order.sla_deadline), 'MMM d, yyyy')}
                    </span>
                  </div>
                  {order.is_sla_breached && (
                    <p className="text-xs text-red-600 ml-6 mt-1">Overdue</p>
                  )}
                </div>
              )}

              <div>
                <Label className="text-xs text-slate-500">Created</Label>
                <div className="flex items-center gap-2 mt-1.5">
                  <Clock size={16} className="text-slate-400" />
                  <span className="font-medium">
                    {format(new Date(order.created_at), 'MMM d, yyyy')}
                  </span>
                </div>
              </div>

              {order.delivered_at && (
                <div>
                  <Label className="text-xs text-slate-500">Delivered</Label>
                  <p className="font-medium mt-1.5">
                    {format(new Date(order.delivered_at), 'MMM d, yyyy')}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
