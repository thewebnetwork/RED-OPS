import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog';
import { Calendar } from '../components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { Switch } from '../components/ui/switch';
import { ArrowLeft, CalendarIcon, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from '../lib/utils';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const ORDER_TYPES = ["Video Edit", "Reel Batch", "Listing Video", "Marketplace Service", "Videography Booking", "Other"];
const PRIORITIES = ["Low", "Normal", "High", "Urgent"];
const SOURCES = ["Manual", "Marketplace", "GHL", "Other"];

export default function CreateOrder() {
  const navigate = useNavigate();
  const [clients, setClients] = useState([]);
  const [editors, setEditors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [addClientOpen, setAddClientOpen] = useState(false);
  const [newClient, setNewClient] = useState({ name: '', email: '', phone: '' });
  
  const [formData, setFormData] = useState({
    client_id: '',
    title: '',
    type: 'Video Edit',
    priority: 'Normal',
    due_date: null,
    assigned_editor_id: '',
    source: 'Manual',
    intake_required: true,
    notes: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [clientsRes, editorsRes] = await Promise.all([
        axios.get(`${API}/clients`),
        axios.get(`${API}/users/role/editors`)
      ]);
      setClients(clientsRes.data);
      setEditors(editorsRes.data);
    } catch (error) {
      toast.error('Failed to load data');
    }
  };

  const handleAddClient = async (e) => {
    e.preventDefault();
    if (!newClient.name || !newClient.email) {
      toast.error('Name and email are required');
      return;
    }

    try {
      const res = await axios.post(`${API}/clients`, newClient);
      setClients(prev => [...prev, res.data]);
      setFormData(prev => ({ ...prev, client_id: res.data.id }));
      setAddClientOpen(false);
      setNewClient({ name: '', email: '', phone: '' });
      toast.success('Client created');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create client');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.client_id) {
      toast.error('Please select a client');
      return;
    }
    if (!formData.title) {
      toast.error('Please enter a title');
      return;
    }
    if (!formData.assigned_editor_id) {
      toast.error('Please assign an editor');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        ...formData,
        due_date: formData.due_date ? format(formData.due_date, 'yyyy-MM-dd') : null
      };
      const res = await axios.post(`${API}/orders`, payload);
      toast.success('Order created successfully');
      navigate(`/orders/${res.data.id}`);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create order');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in" data-testid="create-order-page">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate('/orders')}>
          <ArrowLeft size={18} className="mr-2" />
          Back
        </Button>
        <h1 className="text-2xl font-bold text-slate-900">Create Order</h1>
      </div>

      <form onSubmit={handleSubmit}>
        <Card className="border-slate-200">
          <CardHeader className="border-b border-slate-100 pb-4">
            <CardTitle>Order Details</CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            {/* Client Selection */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label>Client *</Label>
                <div className="flex gap-2 mt-1.5">
                  <Select 
                    value={formData.client_id} 
                    onValueChange={(v) => setFormData(prev => ({ ...prev, client_id: v }))}
                  >
                    <SelectTrigger data-testid="client-select">
                      <SelectValue placeholder="Select client" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Dialog open={addClientOpen} onOpenChange={setAddClientOpen}>
                    <DialogTrigger asChild>
                      <Button type="button" variant="outline" size="icon">
                        <Plus size={18} />
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Add New Client</DialogTitle>
                      </DialogHeader>
                      <form onSubmit={handleAddClient} className="space-y-4">
                        <div>
                          <Label>Name *</Label>
                          <Input
                            value={newClient.name}
                            onChange={(e) => setNewClient(prev => ({ ...prev, name: e.target.value }))}
                            className="mt-1.5"
                          />
                        </div>
                        <div>
                          <Label>Email *</Label>
                          <Input
                            type="email"
                            value={newClient.email}
                            onChange={(e) => setNewClient(prev => ({ ...prev, email: e.target.value }))}
                            className="mt-1.5"
                          />
                        </div>
                        <div>
                          <Label>Phone</Label>
                          <Input
                            value={newClient.phone}
                            onChange={(e) => setNewClient(prev => ({ ...prev, phone: e.target.value }))}
                            className="mt-1.5"
                          />
                        </div>
                        <Button type="submit" className="w-full bg-rose-600 hover:bg-rose-700">
                          Add Client
                        </Button>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>

              <div>
                <Label>Assigned Editor *</Label>
                <Select 
                  value={formData.assigned_editor_id} 
                  onValueChange={(v) => setFormData(prev => ({ ...prev, assigned_editor_id: v }))}
                >
                  <SelectTrigger className="mt-1.5" data-testid="editor-select">
                    <SelectValue placeholder="Select editor" />
                  </SelectTrigger>
                  <SelectContent>
                    {editors.map(e => (
                      <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Title */}
            <div>
              <Label>Title *</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="e.g., Product Launch Video for Acme Corp"
                className="mt-1.5"
                data-testid="title-input"
              />
            </div>

            {/* Type & Priority */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <Label>Type</Label>
                <Select 
                  value={formData.type} 
                  onValueChange={(v) => setFormData(prev => ({ ...prev, type: v }))}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ORDER_TYPES.map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Priority</Label>
                <Select 
                  value={formData.priority} 
                  onValueChange={(v) => setFormData(prev => ({ ...prev, priority: v }))}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map(p => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Source</Label>
                <Select 
                  value={formData.source} 
                  onValueChange={(v) => setFormData(prev => ({ ...prev, source: v }))}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SOURCES.map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Due Date */}
            <div>
              <Label>Due Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal mt-1.5",
                      !formData.due_date && "text-muted-foreground"
                    )}
                    data-testid="due-date-btn"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.due_date ? format(formData.due_date, 'PPP') : 'Pick a date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={formData.due_date}
                    onSelect={(date) => setFormData(prev => ({ ...prev, due_date: date }))}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Intake Required */}
            <div className="flex items-center justify-between">
              <div>
                <Label>Intake Required</Label>
                <p className="text-sm text-slate-500">Client needs to provide additional information</p>
              </div>
              <Switch
                checked={formData.intake_required}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, intake_required: checked }))}
              />
            </div>

            {/* Notes */}
            <div>
              <Label>Initial Notes</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Add any initial notes or instructions..."
                className="mt-1.5 min-h-[100px]"
              />
            </div>
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex justify-end gap-3 mt-6">
          <Button type="button" variant="outline" onClick={() => navigate('/orders')}>
            Cancel
          </Button>
          <Button 
            type="submit" 
            className="bg-rose-600 hover:bg-rose-700"
            disabled={loading}
            data-testid="create-order-submit"
          >
            {loading ? 'Creating...' : 'Create Order'}
          </Button>
        </div>
      </form>
    </div>
  );
}
