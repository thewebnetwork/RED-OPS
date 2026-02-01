import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog';
import { 
  Plus, 
  Search,
  Mail,
  Phone,
  Edit,
  Trash2
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function Clients() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    notes: ''
  });

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    try {
      const res = await axios.get(`${API}/clients`);
      setClients(res.data);
    } catch (error) {
      toast.error('Failed to load clients');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (client = null) => {
    if (client) {
      setEditingClient(client);
      setFormData({
        name: client.name,
        email: client.email,
        phone: client.phone || '',
        notes: client.notes || ''
      });
    } else {
      setEditingClient(null);
      setFormData({ name: '', email: '', phone: '', notes: '' });
    }
    setDialogOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.email) {
      toast.error('Name and email are required');
      return;
    }

    try {
      if (editingClient) {
        await axios.patch(`${API}/clients/${editingClient.id}`, formData);
        toast.success('Client updated');
      } else {
        await axios.post(`${API}/clients`, formData);
        toast.success('Client created');
      }
      setDialogOpen(false);
      fetchClients();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Operation failed');
    }
  };

  const handleDelete = async (clientId) => {
    if (!window.confirm('Are you sure you want to delete this client?')) return;
    
    try {
      await axios.delete(`${API}/clients/${clientId}`);
      toast.success('Client deleted');
      fetchClients();
    } catch (error) {
      toast.error('Failed to delete client');
    }
  };

  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in" data-testid="clients-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Clients</h1>
          <p className="text-slate-500 mt-1">{clients.length} clients</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button 
              className="bg-rose-600 hover:bg-rose-700"
              onClick={() => handleOpenDialog()}
              data-testid="add-client-btn"
            >
              <Plus size={18} className="mr-2" />
              Add Client
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingClient ? 'Edit Client' : 'Add Client'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Name *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Client name"
                  className="mt-1.5"
                  data-testid="client-name-input"
                />
              </div>
              <div>
                <Label>Email *</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="client@example.com"
                  className="mt-1.5"
                  data-testid="client-email-input"
                />
              </div>
              <div>
                <Label>Phone</Label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="+1 234 567 8900"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label>Notes</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Additional notes..."
                  className="mt-1.5"
                />
              </div>
              <Button type="submit" className="w-full bg-rose-600 hover:bg-rose-700" data-testid="save-client-btn">
                {editingClient ? 'Update Client' : 'Add Client'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <Card className="border-slate-200">
        <CardContent className="p-4">
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search clients..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
              data-testid="search-clients"
            />
          </div>
        </CardContent>
      </Card>

      {/* Clients Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin h-8 w-8 border-4 border-rose-600 border-t-transparent rounded-full" />
        </div>
      ) : filteredClients.length === 0 ? (
        <Card className="border-slate-200">
          <CardContent className="p-12 text-center text-slate-500">
            {search ? 'No clients match your search' : 'No clients yet'}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredClients.map(client => (
            <Card key={client.id} className="border-slate-200 hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-slate-900 truncate">{client.name}</h3>
                    <div className="flex items-center gap-2 mt-2 text-sm text-slate-500">
                      <Mail size={14} />
                      <span className="truncate">{client.email}</span>
                    </div>
                    {client.phone && (
                      <div className="flex items-center gap-2 mt-1 text-sm text-slate-500">
                        <Phone size={14} />
                        <span>{client.phone}</span>
                      </div>
                    )}
                    <p className="text-xs text-slate-400 mt-2">
                      Added {format(new Date(client.created_at), 'MMM d, yyyy')}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => handleOpenDialog(client)}
                      className="h-8 w-8"
                    >
                      <Edit size={14} />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => handleDelete(client.id)}
                      className="h-8 w-8 text-red-500 hover:text-red-700"
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
