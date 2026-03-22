import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
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
import {
  Plus, Search, Mail, Phone, MapPin, Calendar, DollarSign, TrendingUp,
  Activity, Tag, X, Edit3, Trash2, Eye, ChevronRight, MoreHorizontal,
  Loader2, Users, Briefcase, BarChart3, Target, CheckCircle2, XCircle,
  Clock, AlertCircle, ArrowRight, GripVertical
} from 'lucide-react';
import { format } from 'date-fns';

// ── Config & Constants ────────────────────────────────────────────────────────
const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const tok = () => localStorage.getItem('token');
const ax = () => axios.create({ headers: { Authorization: `Bearer ${tok()}` } });

const CONTACT_STATUS = {
  active: { label: 'Active', color: '#22c55e', icon: CheckCircle2 },
  inactive: { label: 'Inactive', color: '#606060', icon: XCircle },
  lead: { label: 'Lead', color: '#3b82f6', icon: AlertCircle },
  churned: { label: 'Churned', color: '#ef4444', icon: XCircle },
};

const DEAL_STATUS = {
  won: { label: 'Won', color: '#22c55e' },
  lost: { label: 'Lost', color: '#ef4444' },
};

// ── Utility Functions ────────────────────────────────────────────────────────
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
  }).format(amount || 0);
};

const formatDate = (dateString) => {
  if (!dateString) return '—';
  try {
    return format(new Date(dateString), 'MMM dd, yyyy');
  } catch {
    return '—';
  }
};

// ── Spinner Component ────────────────────────────────────────────────────────
function LoadingSpinner() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px' }}>
      <Loader2 size={32} style={{ color: 'var(--accent)', animation: 'spin 1s linear infinite' }} />
    </div>
  );
}

// ── Status Badge ────────────────────────────────────────────────────────────
function ContactStatusBadge({ status }) {
  const cfg = CONTACT_STATUS[status] || CONTACT_STATUS.lead;
  const IconComp = cfg.icon;
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      fontSize: 12,
      fontWeight: 600,
      padding: '4px 10px',
      borderRadius: 6,
      background: `${cfg.color}18`,
      color: cfg.color,
    }}>
      <IconComp size={14} /> {cfg.label}
    </span>
  );
}

// ── Contacts Tab ────────────────────────────────────────────────────────────
function ContactsTab({ token, onRefresh }) {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showNewModal, setShowNewModal] = useState(false);
  const [showDetailsPanel, setShowDetailsPanel] = useState(false);
  const [selectedContact, setSelectedContact] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [activityForm, setActivityForm] = useState('');
  const [newForm, setNewForm] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    status: 'lead',
    tags: '',
    notes: '',
  });

  // Fetch contacts
  const fetchContacts = useCallback(async () => {
    try {
      setLoading(true);
      const res = await ax().get(`${API}/crm/contacts`);
      setContacts(Array.isArray(res.data) ? res.data : res.data.data || []);
    } catch (err) {
      toast.error('Failed to load contacts');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  // Filter contacts
  const filteredContacts = useMemo(() => {
    return contacts.filter(c => {
      const matchesSearch = !search ||
        c.name?.toLowerCase().includes(search.toLowerCase()) ||
        c.email?.toLowerCase().includes(search.toLowerCase()) ||
        c.company?.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [contacts, search, statusFilter]);

  // Create contact
  const handleCreateContact = async () => {
    if (!newForm.name.trim()) {
      toast.error('Contact name is required');
      return;
    }
    try {
      await ax().post(`${API}/crm/contacts`, {
        name: newForm.name,
        email: newForm.email || null,
        phone: newForm.phone || null,
        company: newForm.company || null,
        status: newForm.status,
        tags: newForm.tags ? newForm.tags.split(',').map(t => t.trim()) : [],
        notes: newForm.notes || null,
      });
      toast.success('Contact created');
      setShowNewModal(false);
      setNewForm({ name: '', email: '', phone: '', company: '', status: 'lead', tags: '', notes: '' });
      await fetchContacts();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create contact');
    }
  };

  // Update contact
  const handleUpdateContact = async (id, updates) => {
    try {
      await ax().patch(`${API}/crm/contacts/${id}`, updates);
      toast.success('Contact updated');
      setEditingId(null);
      await fetchContacts();
    } catch (err) {
      toast.error('Failed to update contact');
    }
  };

  // Delete contact
  const handleDeleteContact = async (id) => {
    if (!window.confirm('Delete this contact?')) return;
    try {
      await ax().delete(`${API}/crm/contacts/${id}`);
      toast.success('Contact deleted');
      setShowDetailsPanel(false);
      setSelectedContact(null);
      await fetchContacts();
    } catch (err) {
      toast.error('Failed to delete contact');
    }
  };

  // Add activity
  const handleAddActivity = async (contactId) => {
    if (!activityForm.trim()) {
      toast.error('Activity note is required');
      return;
    }
    try {
      await ax().post(`${API}/crm/contacts/${contactId}/activity`, {
        activity: activityForm,
      });
      toast.success('Activity added');
      setActivityForm('');
      await fetchContacts();
      // Refresh selected contact details
      const updated = contacts.find(c => c.id === contactId);
      if (updated) setSelectedContact(updated);
    } catch (err) {
      toast.error('Failed to add activity');
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--tx-1)', marginBottom: 12 }}>
            Contacts
          </h2>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 250 }}>
              <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--tx-3)' }} />
              <Input
                placeholder="Search contacts..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ paddingLeft: 36 }}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger style={{ minWidth: 150 }}>
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {Object.entries(CONTACT_STATUS).map(([key, cfg]) => (
                  <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <Dialog open={showNewModal} onOpenChange={setShowNewModal}>
          <DialogTrigger asChild>
            <Button style={{ background: 'var(--accent)', color: '#fff', gap: 8 }}>
              <Plus size={18} /> New Contact
            </Button>
          </DialogTrigger>
          <DialogContent style={{ background: 'var(--card)' }}>
            <DialogHeader>
              <DialogTitle style={{ color: 'var(--tx-1)' }}>Create New Contact</DialogTitle>
            </DialogHeader>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <Label style={{ color: 'var(--tx-2)', marginBottom: 6 }}>Name *</Label>
                <Input
                  value={newForm.name}
                  onChange={(e) => setNewForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="John Doe"
                />
              </div>
              <div>
                <Label style={{ color: 'var(--tx-2)', marginBottom: 6 }}>Email</Label>
                <Input
                  type="email"
                  value={newForm.email}
                  onChange={(e) => setNewForm(p => ({ ...p, email: e.target.value }))}
                  placeholder="john@example.com"
                />
              </div>
              <div>
                <Label style={{ color: 'var(--tx-2)', marginBottom: 6 }}>Phone</Label>
                <Input
                  value={newForm.phone}
                  onChange={(e) => setNewForm(p => ({ ...p, phone: e.target.value }))}
                  placeholder="+1 (555) 123-4567"
                />
              </div>
              <div>
                <Label style={{ color: 'var(--tx-2)', marginBottom: 6 }}>Company</Label>
                <Input
                  value={newForm.company}
                  onChange={(e) => setNewForm(p => ({ ...p, company: e.target.value }))}
                  placeholder="Acme Corp"
                />
              </div>
              <div>
                <Label style={{ color: 'var(--tx-2)', marginBottom: 6 }}>Status</Label>
                <Select value={newForm.status} onValueChange={(val) => setNewForm(p => ({ ...p, status: val }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CONTACT_STATUS).map(([key, cfg]) => (
                      <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label style={{ color: 'var(--tx-2)', marginBottom: 6 }}>Tags (comma-separated)</Label>
                <Input
                  value={newForm.tags}
                  onChange={(e) => setNewForm(p => ({ ...p, tags: e.target.value }))}
                  placeholder="vip, urgent, follow-up"
                />
              </div>
              <div>
                <Label style={{ color: 'var(--tx-2)', marginBottom: 6 }}>Notes</Label>
                <Textarea
                  value={newForm.notes}
                  onChange={(e) => setNewForm(p => ({ ...p, notes: e.target.value }))}
                  placeholder="Additional notes..."
                  style={{ minHeight: 80 }}
                />
              </div>
              <Button
                onClick={handleCreateContact}
                style={{ background: 'var(--accent)', color: '#fff', width: '100%' }}
              >
                Create Contact
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Contacts List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {filteredContacts.length === 0 ? (
          <div style={{
            padding: 40,
            textAlign: 'center',
            background: 'var(--card)',
            borderRadius: 8,
            border: `1px solid var(--border)`,
            color: 'var(--tx-3)',
          }}>
            No contacts found
          </div>
        ) : (
          filteredContacts.map(contact => (
            <div
              key={contact.id}
              onClick={() => {
                setSelectedContact(contact);
                setShowDetailsPanel(true);
              }}
              style={{
                padding: 16,
                background: 'var(--card)',
                border: `1px solid var(--border)`,
                borderRadius: 8,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--border)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--card)';
              }}
            >
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--tx-1)', marginBottom: 8 }}>
                  {contact.name}
                </h3>
                <div style={{ display: 'flex', gap: 16, fontSize: 13, color: 'var(--tx-2)', flexWrap: 'wrap', marginBottom: 8 }}>
                  {contact.email && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Mail size={14} /> {contact.email}
                    </div>
                  )}
                  {contact.phone && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Phone size={14} /> {contact.phone}
                    </div>
                  )}
                  {contact.company && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Briefcase size={14} /> {contact.company}
                    </div>
                  )}
                </div>
                {contact.tags && contact.tags.length > 0 && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {contact.tags.map((tag, i) => (
                      <Badge key={i} style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px' }}>
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <ContactStatusBadge status={contact.status} />
                <ChevronRight size={18} color="var(--tx-3)" />
              </div>
            </div>
          ))
        )}
      </div>

      {/* Contact Details Panel */}
      {showDetailsPanel && selectedContact && (
        <div style={{
          position: 'fixed',
          right: 0,
          top: 0,
          bottom: 0,
          width: '100%',
          maxWidth: 500,
          background: 'var(--card)',
          borderLeft: `1px solid var(--border)`,
          boxShadow: '-2px 0 8px rgba(0,0,0,0.3)',
          zIndex: 100,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
        }}>
          {/* Header */}
          <div style={{
            padding: 20,
            borderBottom: `1px solid var(--border)`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--tx-1)' }}>
              Contact Details
            </h3>
            <button
              onClick={() => setShowDetailsPanel(false)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--tx-3)',
                padding: 4,
              }}
            >
              <X size={20} />
            </button>
          </div>

          {/* Content */}
          <div style={{ flex: 1, overflow: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Info Section */}
            <div>
              <h4 style={{ fontSize: 12, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
                Information
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <p style={{ fontSize: 11, color: 'var(--tx-3)', fontWeight: 600, marginBottom: 4 }}>NAME</p>
                  <p style={{ fontSize: 14, color: 'var(--tx-1)', fontWeight: 600 }}>
                    {editingId === selectedContact.id ? (
                      <Input
                        value={selectedContact.name}
                        onChange={(e) => setSelectedContact(p => ({ ...p, name: e.target.value }))}
                        style={{ marginTop: 4 }}
                      />
                    ) : (
                      selectedContact.name
                    )}
                  </p>
                </div>
                <div>
                  <p style={{ fontSize: 11, color: 'var(--tx-3)', fontWeight: 600, marginBottom: 4 }}>EMAIL</p>
                  <p style={{ fontSize: 13, color: 'var(--tx-2)' }}>
                    {editingId === selectedContact.id ? (
                      <Input
                        value={selectedContact.email || ''}
                        onChange={(e) => setSelectedContact(p => ({ ...p, email: e.target.value }))}
                        style={{ marginTop: 4 }}
                      />
                    ) : (
                      selectedContact.email || '—'
                    )}
                  </p>
                </div>
                <div>
                  <p style={{ fontSize: 11, color: 'var(--tx-3)', fontWeight: 600, marginBottom: 4 }}>PHONE</p>
                  <p style={{ fontSize: 13, color: 'var(--tx-2)' }}>
                    {editingId === selectedContact.id ? (
                      <Input
                        value={selectedContact.phone || ''}
                        onChange={(e) => setSelectedContact(p => ({ ...p, phone: e.target.value }))}
                        style={{ marginTop: 4 }}
                      />
                    ) : (
                      selectedContact.phone || '—'
                    )}
                  </p>
                </div>
                <div>
                  <p style={{ fontSize: 11, color: 'var(--tx-3)', fontWeight: 600, marginBottom: 4 }}>COMPANY</p>
                  <p style={{ fontSize: 13, color: 'var(--tx-2)' }}>
                    {editingId === selectedContact.id ? (
                      <Input
                        value={selectedContact.company || ''}
                        onChange={(e) => setSelectedContact(p => ({ ...p, company: e.target.value }))}
                        style={{ marginTop: 4 }}
                      />
                    ) : (
                      selectedContact.company || '—'
                    )}
                  </p>
                </div>
                <div>
                  <p style={{ fontSize: 11, color: 'var(--tx-3)', fontWeight: 600, marginBottom: 4 }}>STATUS</p>
                  <div style={{ marginTop: 4 }}>
                    {editingId === selectedContact.id ? (
                      <Select
                        value={selectedContact.status}
                        onValueChange={(val) => setSelectedContact(p => ({ ...p, status: val }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(CONTACT_STATUS).map(([key, cfg]) => (
                            <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <ContactStatusBadge status={selectedContact.status} />
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Tags */}
            {(selectedContact.tags?.length > 0 || editingId === selectedContact.id) && (
              <div>
                <h4 style={{ fontSize: 12, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
                  Tags
                </h4>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {selectedContact.tags?.map((tag, i) => (
                    <Badge key={i} style={{ fontSize: 11, fontWeight: 600, padding: '4px 10px' }}>
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Notes */}
            {(selectedContact.notes || editingId === selectedContact.id) && (
              <div>
                <h4 style={{ fontSize: 12, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
                  Notes
                </h4>
                {editingId === selectedContact.id ? (
                  <Textarea
                    value={selectedContact.notes || ''}
                    onChange={(e) => setSelectedContact(p => ({ ...p, notes: e.target.value }))}
                    style={{ minHeight: 80 }}
                  />
                ) : (
                  <p style={{ fontSize: 13, color: 'var(--tx-2)', lineHeight: 1.6 }}>
                    {selectedContact.notes || '—'}
                  </p>
                )}
              </div>
            )}

            {/* Activity Timeline */}
            {selectedContact.activity && selectedContact.activity.length > 0 && (
              <div>
                <h4 style={{ fontSize: 12, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
                  Activity Log
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {selectedContact.activity.map((act, i) => (
                    <div
                      key={i}
                      style={{
                        padding: 12,
                        background: 'var(--bg)',
                        borderRadius: 6,
                        borderLeft: `3px solid var(--accent)`,
                      }}
                    >
                      <p style={{ fontSize: 12, color: 'var(--tx-2)', marginBottom: 6 }}>
                        {formatDate(act.created_at)}
                      </p>
                      <p style={{ fontSize: 13, color: 'var(--tx-1)' }}>
                        {act.activity}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Add Activity */}
            <div>
              <h4 style={{ fontSize: 12, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
                Add Activity
              </h4>
              <div style={{ display: 'flex', gap: 8 }}>
                <Textarea
                  value={activityForm}
                  onChange={(e) => setActivityForm(e.target.value)}
                  placeholder="Log an activity..."
                  style={{ minHeight: 80 }}
                />
              </div>
              <Button
                onClick={() => handleAddActivity(selectedContact.id)}
                style={{
                  background: 'var(--accent)',
                  color: '#fff',
                  width: '100%',
                  marginTop: 8,
                }}
              >
                Log Activity
              </Button>
            </div>
          </div>

          {/* Footer Actions */}
          <div style={{
            padding: 16,
            borderTop: `1px solid var(--border)`,
            display: 'flex',
            gap: 8,
          }}>
            {editingId === selectedContact.id ? (
              <>
                <Button
                  onClick={() => {
                    handleUpdateContact(selectedContact.id, {
                      name: selectedContact.name,
                      email: selectedContact.email,
                      phone: selectedContact.phone,
                      company: selectedContact.company,
                      status: selectedContact.status,
                      notes: selectedContact.notes,
                    });
                  }}
                  style={{ background: 'var(--accent)', color: '#fff', flex: 1 }}
                >
                  Save
                </Button>
                <Button
                  onClick={() => setEditingId(null)}
                  style={{ background: 'var(--border)', color: 'var(--tx-1)', flex: 1 }}
                >
                  Cancel
                </Button>
              </>
            ) : (
              <>
                <Button
                  onClick={() => setEditingId(selectedContact.id)}
                  style={{ background: 'var(--accent)', color: '#fff', flex: 1, gap: 6 }}
                >
                  <Edit3 size={16} /> Edit
                </Button>
                <Button
                  onClick={() => handleDeleteContact(selectedContact.id)}
                  style={{ background: '#ef4444', color: '#fff', gap: 6 }}
                >
                  <Trash2 size={16} />
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Overlay */}
      {showDetailsPanel && (
        <div
          onClick={() => setShowDetailsPanel(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 99,
            pointerEvents: 'auto',
          }}
        />
      )}
    </div>
  );
}

// ── Pipeline Tab ────────────────────────────────────────────────────────────
function PipelineTab({ token, onRefresh }) {
  const [pipelines, setPipelines] = useState([]);
  const [selectedPipeline, setSelectedPipeline] = useState(null);
  const [deals, setDeals] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewPipeline, setShowNewPipeline] = useState(false);
  const [showNewDeal, setShowNewDeal] = useState(false);
  const [newPipelineForm, setNewPipelineForm] = useState({
    name: '',
    stages: '',
  });
  const [newDealForm, setNewDealForm] = useState({
    title: '',
    contact_id: '',
    value: '',
    probability: 50,
    assigned_to: '',
    pipeline_id: '',
  });
  const [stats, setStats] = useState(null);

  // Fetch data
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [pipeRes, dealsRes, contactsRes, statsRes] = await Promise.all([
        ax().get(`${API}/crm/pipelines`),
        ax().get(`${API}/crm/deals`),
        ax().get(`${API}/crm/contacts`),
        ax().get(`${API}/crm/stats`),
      ]);

      const pipeArray = Array.isArray(pipeRes.data) ? pipeRes.data : pipeRes.data.data || [];
      const dealsArray = Array.isArray(dealsRes.data) ? dealsRes.data : dealsRes.data.data || [];
      const contactsArray = Array.isArray(contactsRes.data) ? contactsRes.data : contactsRes.data.data || [];

      setPipelines(pipeArray);
      setDeals(dealsArray);
      setContacts(contactsArray);
      setStats(statsRes.data);

      if (pipeArray.length > 0 && !selectedPipeline) {
        setSelectedPipeline(pipeArray[0].id);
      }
    } catch (err) {
      toast.error('Failed to load pipeline data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [selectedPipeline]);

  useEffect(() => {
    fetchData();
  }, []);

  // Create pipeline
  const handleCreatePipeline = async () => {
    if (!newPipelineForm.name.trim()) {
      toast.error('Pipeline name is required');
      return;
    }
    try {
      const stageNames = newPipelineForm.stages
        .split(',')
        .map(s => s.trim())
        .filter(s => s);

      if (stageNames.length === 0) {
        toast.error('At least one stage is required');
        return;
      }

      const stageColors = ['#3b82f6', '#f59e0b', '#8b5cf6', '#06b6d4', '#22c55e', '#ef4444', '#ec4899'];
      const stages = stageNames.map((name, idx) => ({
        id: crypto.randomUUID ? crypto.randomUUID() : `stage-${Date.now()}-${idx}`,
        name,
        order: idx,
        color: stageColors[idx % stageColors.length],
      }));

      await ax().post(`${API}/crm/pipelines`, {
        name: newPipelineForm.name,
        stages: stages,
      });
      toast.success('Pipeline created');
      setShowNewPipeline(false);
      setNewPipelineForm({ name: '', stages: '' });
      await fetchData();
    } catch (err) {
      toast.error('Failed to create pipeline');
    }
  };

  // Create deal
  const handleCreateDeal = async () => {
    if (!newDealForm.title.trim() || !newDealForm.contact_id || !newDealForm.pipeline_id) {
      toast.error('Title, contact, and pipeline are required');
      return;
    }
    try {
      const pipe = pipelines.find(p => p.id === newDealForm.pipeline_id);
      const firstStage = (pipe?.stages || []).sort((a, b) => (a.order || 0) - (b.order || 0))[0];
      await ax().post(`${API}/crm/deals`, {
        title: newDealForm.title,
        contact_id: newDealForm.contact_id,
        value: parseFloat(newDealForm.value) || 0,
        probability: parseInt(newDealForm.probability) || 50,
        assigned_to_user_id: newDealForm.assigned_to || null,
        pipeline_id: newDealForm.pipeline_id,
        stage_id: firstStage?.id || '',
      });
      toast.success('Deal created');
      setShowNewDeal(false);
      setNewDealForm({
        title: '',
        contact_id: '',
        value: '',
        probability: 50,
        assigned_to: '',
        pipeline_id: '',
      });
      await fetchData();
    } catch (err) {
      toast.error('Failed to create deal');
    }
  };

  // Move deal
  const handleMoveDeal = async (dealId, newStageId) => {
    try {
      await ax().patch(`${API}/crm/deals/${dealId}/move`, {
        stage_id: newStageId,
      });
      toast.success('Deal moved');
      await fetchData();
    } catch (err) {
      toast.error('Failed to move deal');
    }
  };

  // Get pipeline stages
  const getPipelineStages = () => {
    const pipe = pipelines.find(p => p.id === selectedPipeline);
    return (pipe?.stages || []).sort((a, b) => (a.order || 0) - (b.order || 0));
  };

  // Get deals for pipeline
  const pipelineDeals = selectedPipeline
    ? deals.filter(d => d.pipeline_id === selectedPipeline)
    : [];

  // Organize deals by stage_id
  const dealsByStage = useMemo(() => {
    const stages = getPipelineStages();
    const organized = {};
    stages.forEach(stage => {
      organized[stage.id] = pipelineDeals.filter(d => d.stage_id === stage.id);
    });
    return organized;
  }, [pipelineDeals, selectedPipeline]);

  // Calculate pipeline stats
  const pipelineStats = useMemo(() => {
    const won = pipelineDeals.filter(d => d.status === 'won').length;
    const lost = pipelineDeals.filter(d => d.status === 'lost').length;
    const total = pipelineDeals.reduce((sum, d) => sum + (d.value || 0), 0);
    const conversion = pipelineDeals.length > 0 ? ((won / pipelineDeals.length) * 100).toFixed(1) : 0;
    return { total, won, lost, conversion };
  }, [pipelineDeals]);

  if (loading) return <LoadingSpinner />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--tx-1)', marginBottom: 12 }}>
            Sales Pipeline
          </h2>
          <div style={{ display: 'flex', gap: 12 }}>
            <Select value={selectedPipeline || undefined} onValueChange={setSelectedPipeline}>
              <SelectTrigger style={{ minWidth: 200 }}>
                <SelectValue placeholder="Select pipeline" />
              </SelectTrigger>
              <SelectContent>
                {pipelines.map(pipe => (
                  <SelectItem key={pipe.id} value={pipe.id}>
                    {pipe.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Dialog open={showNewPipeline} onOpenChange={setShowNewPipeline}>
              <DialogTrigger asChild>
                <Button style={{ background: 'var(--border)', color: 'var(--tx-1)', gap: 8 }}>
                  <Plus size={18} /> New Pipeline
                </Button>
              </DialogTrigger>
              <DialogContent style={{ background: 'var(--card)' }}>
                <DialogHeader>
                  <DialogTitle style={{ color: 'var(--tx-1)' }}>Create New Pipeline</DialogTitle>
                </DialogHeader>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <Label style={{ color: 'var(--tx-2)', marginBottom: 6 }}>Pipeline Name *</Label>
                    <Input
                      value={newPipelineForm.name}
                      onChange={(e) => setNewPipelineForm(p => ({ ...p, name: e.target.value }))}
                      placeholder="e.g., Enterprise Sales"
                    />
                  </div>
                  <div>
                    <Label style={{ color: 'var(--tx-2)', marginBottom: 6 }}>
                      Stages (comma-separated) *
                    </Label>
                    <Input
                      value={newPipelineForm.stages}
                      onChange={(e) => setNewPipelineForm(p => ({ ...p, stages: e.target.value }))}
                      placeholder="Lead, Qualified, Proposal, Negotiation, Won"
                    />
                  </div>
                  <Button
                    onClick={handleCreatePipeline}
                    style={{ background: 'var(--accent)', color: '#fff', width: '100%' }}
                  >
                    Create Pipeline
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
        <Dialog open={showNewDeal} onOpenChange={setShowNewDeal}>
          <DialogTrigger asChild>
            <Button style={{ background: 'var(--accent)', color: '#fff', gap: 8 }}>
              <Plus size={18} /> New Deal
            </Button>
          </DialogTrigger>
          <DialogContent style={{ background: 'var(--card)' }}>
            <DialogHeader>
              <DialogTitle style={{ color: 'var(--tx-1)' }}>Create New Deal</DialogTitle>
            </DialogHeader>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <Label style={{ color: 'var(--tx-2)', marginBottom: 6 }}>Deal Title *</Label>
                <Input
                  value={newDealForm.title}
                  onChange={(e) => setNewDealForm(p => ({ ...p, title: e.target.value }))}
                  placeholder="e.g., Acme - Enterprise Contract"
                />
              </div>
              <div>
                <Label style={{ color: 'var(--tx-2)', marginBottom: 6 }}>Pipeline *</Label>
                <Select
                  value={newDealForm.pipeline_id || undefined}
                  onValueChange={(val) => setNewDealForm(p => ({ ...p, pipeline_id: val }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select pipeline" />
                  </SelectTrigger>
                  <SelectContent>
                    {pipelines.map(pipe => (
                      <SelectItem key={pipe.id} value={pipe.id}>
                        {pipe.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label style={{ color: 'var(--tx-2)', marginBottom: 6 }}>Contact *</Label>
                <Select
                  value={newDealForm.contact_id || undefined}
                  onValueChange={(val) => setNewDealForm(p => ({ ...p, contact_id: val }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select contact" />
                  </SelectTrigger>
                  <SelectContent>
                    {contacts.map(contact => (
                      <SelectItem key={contact.id} value={contact.id}>
                        {contact.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label style={{ color: 'var(--tx-2)', marginBottom: 6 }}>Deal Value (CAD)</Label>
                <Input
                  type="number"
                  value={newDealForm.value}
                  onChange={(e) => setNewDealForm(p => ({ ...p, value: e.target.value }))}
                  placeholder="0.00"
                />
              </div>
              <div>
                <Label style={{ color: 'var(--tx-2)', marginBottom: 6 }}>Probability (%)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={newDealForm.probability}
                  onChange={(e) => setNewDealForm(p => ({ ...p, probability: e.target.value }))}
                />
              </div>
              <div>
                <Label style={{ color: 'var(--tx-2)', marginBottom: 6 }}>Assigned To</Label>
                <Input
                  value={newDealForm.assigned_to}
                  onChange={(e) => setNewDealForm(p => ({ ...p, assigned_to: e.target.value }))}
                  placeholder="Your name"
                />
              </div>
              <Button
                onClick={handleCreateDeal}
                style={{ background: 'var(--accent)', color: '#fff', width: '100%' }}
              >
                Create Deal
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Bar */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 12,
      }}>
        <div style={{
          padding: 16,
          background: 'var(--card)',
          border: `1px solid var(--border)`,
          borderRadius: 8,
          display: 'flex',
          gap: 12,
          alignItems: 'center',
        }}>
          <div style={{ width: 40, height: 40, background: 'var(--accent)22', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <DollarSign size={20} color="var(--accent)" />
          </div>
          <div>
            <p style={{ fontSize: 11, color: 'var(--tx-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
              Pipeline Value
            </p>
            <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--tx-1)' }}>
              {formatCurrency(pipelineStats.total)}
            </p>
          </div>
        </div>
        <div style={{
          padding: 16,
          background: 'var(--card)',
          border: `1px solid var(--border)`,
          borderRadius: 8,
          display: 'flex',
          gap: 12,
          alignItems: 'center',
        }}>
          <div style={{ width: 40, height: 40, background: '#22c55e22', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CheckCircle2 size={20} color="#22c55e" />
          </div>
          <div>
            <p style={{ fontSize: 11, color: 'var(--tx-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
              Won
            </p>
            <p style={{ fontSize: 18, fontWeight: 700, color: '#22c55e' }}>
              {pipelineStats.won}
            </p>
          </div>
        </div>
        <div style={{
          padding: 16,
          background: 'var(--card)',
          border: `1px solid var(--border)`,
          borderRadius: 8,
          display: 'flex',
          gap: 12,
          alignItems: 'center',
        }}>
          <div style={{ width: 40, height: 40, background: '#ef444422', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <XCircle size={20} color="#ef4444" />
          </div>
          <div>
            <p style={{ fontSize: 11, color: 'var(--tx-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
              Lost
            </p>
            <p style={{ fontSize: 18, fontWeight: 700, color: '#ef4444' }}>
              {pipelineStats.lost}
            </p>
          </div>
        </div>
        <div style={{
          padding: 16,
          background: 'var(--card)',
          border: `1px solid var(--border)`,
          borderRadius: 8,
          display: 'flex',
          gap: 12,
          alignItems: 'center',
        }}>
          <div style={{ width: 40, height: 40, background: '#3b82f622', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <TrendingUp size={20} color="#3b82f6" />
          </div>
          <div>
            <p style={{ fontSize: 11, color: 'var(--tx-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
              Conversion
            </p>
            <p style={{ fontSize: 18, fontWeight: 700, color: '#3b82f6' }}>
              {pipelineStats.conversion}%
            </p>
          </div>
        </div>
      </div>

      {/* Kanban Board */}
      {selectedPipeline && (
        <div style={{
          overflowX: 'auto',
          overflowY: 'hidden',
          paddingBottom: 16,
          marginRight: -28,
          paddingRight: 28,
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${getPipelineStages().length}, minmax(300px, 1fr))`,
            gap: 16,
          }}>
            {getPipelineStages().map(stage => (
              <div key={stage.id}>
                <h3 style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: 'var(--tx-1)',
                  marginBottom: 12,
                  paddingBottom: 12,
                  borderBottom: `2px solid ${stage.color || 'var(--border)'}`,
                }}>
                  {stage.name} ({dealsByStage[stage.id]?.length || 0})
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {(dealsByStage[stage.id] || []).map(deal => {
                    const contact = contacts.find(c => c.id === deal.contact_id);
                    return (
                      <div
                        key={deal.id}
                        style={{
                          padding: 12,
                          background: 'var(--card)',
                          border: `1px solid var(--border)`,
                          borderRadius: 8,
                          cursor: 'grab',
                        }}
                      >
                        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                          <h4 style={{ fontSize: 13, fontWeight: 600, color: 'var(--tx-1)', flex: 1 }}>
                            {deal.title}
                          </h4>
                          {deal.status && deal.status !== 'open' && (
                            <div style={{
                              fontSize: 10,
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: 4,
                              background: (DEAL_STATUS[deal.status]?.color || '#666') + '22',
                              color: DEAL_STATUS[deal.status]?.color || 'var(--tx-2)',
                            }}>
                              {DEAL_STATUS[deal.status]?.label || deal.status}
                            </div>
                          )}
                        </div>
                        <p style={{ fontSize: 12, color: 'var(--tx-2)', marginBottom: 8 }}>
                          {deal.contact_name || contact?.name || 'Unknown'}
                        </p>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--tx-1)' }}>
                            {formatCurrency(deal.value || 0)}
                          </span>
                          <span style={{ fontSize: 11, color: 'var(--tx-3)', background: 'var(--border)', padding: '2px 8px', borderRadius: 4 }}>
                            {deal.probability || 0}%
                          </span>
                        </div>
                        {deal.assigned_to_name && (
                          <p style={{ fontSize: 11, color: 'var(--tx-3)', marginBottom: 8 }}>
                            👤 {deal.assigned_to_name}
                          </p>
                        )}
                        <Select
                          value={stage.id}
                          onValueChange={(newStageId) => handleMoveDeal(deal.id, newStageId)}
                        >
                          <SelectTrigger style={{ fontSize: 12 }}>
                            <SelectValue placeholder="Move to..." />
                          </SelectTrigger>
                          <SelectContent>
                            {getPipelineStages().map(s => (
                              <SelectItem key={s.id} value={s.id}>
                                Move to {s.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main CRM Component ────────────────────────────────────────────────────────
export default function CRM() {
  const { user } = useAuth();
  const token = localStorage.getItem('token');
  const [activeTab, setActiveTab] = useState('contacts');

  const tabStyle = (isActive) => ({
    padding: '8px 16px',
    fontSize: 14,
    fontWeight: 600,
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    color: isActive ? 'var(--accent)' : 'var(--tx-3)',
    borderBottom: isActive ? `2px solid var(--accent)` : `2px solid transparent`,
    transition: 'all 0.2s',
  });

  if (!user) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--tx-2)' }}>
        Please log in to access CRM.
      </div>
    );
  }

  return (
    <div style={{
      flex: 1,
      overflowY: 'auto',
      background: 'var(--bg)',
      padding: '24px 28px',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Page Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--tx-1)', marginBottom: 8 }}>
          CRM & Sales Pipeline
        </h1>
        <p style={{ fontSize: 14, color: 'var(--tx-2)' }}>
          Manage contacts, track deals, and monitor your sales pipeline
        </p>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        gap: 4,
        borderBottom: `1px solid var(--border)`,
        marginBottom: 28,
      }}>
        <button
          onClick={() => setActiveTab('contacts')}
          style={tabStyle(activeTab === 'contacts')}
        >
          <Users size={16} style={{ display: 'inline', marginRight: 6 }} />
          Contacts
        </button>
        <button
          onClick={() => setActiveTab('pipeline')}
          style={tabStyle(activeTab === 'pipeline')}
        >
          <Briefcase size={16} style={{ display: 'inline', marginRight: 6 }} />
          Pipeline
        </button>
      </div>

      {/* Tab Content */}
      <div style={{ flex: 1 }}>
        {activeTab === 'contacts' && <ContactsTab token={token} />}
        {activeTab === 'pipeline' && <PipelineTab token={token} />}
      </div>
    </div>
  );
}
