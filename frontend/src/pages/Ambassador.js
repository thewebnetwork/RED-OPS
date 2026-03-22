import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import {
  BarChart3,
  Copy,
  Filter,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Star,
  TrendingUp,
  X,
  Grid,
  List,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// ============================================================================
// TAB 1: MY REFERRALS
// ============================================================================

function ReferralsTab() {
  const token = localStorage.getItem('token');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [referrals, setReferrals] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [copiedId, setCopiedId] = useState(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    referred_name: '',
    referred_email: '',
    referred_company: '',
    notes: '',
  });

  useEffect(() => {
    fetchReferralData();
  }, []);

  const fetchReferralData = async () => {
    try {
      const [statsRes, refRes] = await Promise.all([
        axios.get(`${API}/ambassador/referrals-stats`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`${API}/ambassador/referrals`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      setStats(statsRes.data);
      setReferrals(Array.isArray(refRes.data) ? refRes.data : refRes.data?.data || []);
    } catch (error) {
      toast.error('Failed to load referral data');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateReferral = async (e) => {
    e.preventDefault();
    if (!formData.referred_name || !formData.referred_email) {
      toast.error('Please fill in required fields');
      return;
    }

    setSaving(true);
    try {
      await axios.post(`${API}/ambassador/referrals`, formData, {
        headers: { Authorization: `Bearer ${token}` },
      });

      toast.success('Referral created successfully');
      setFormData({ referred_name: '', referred_email: '', referred_company: '', notes: '' });
      setShowForm(false);
      fetchReferralData();
    } catch (error) {
      toast.error('Failed to create referral');
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const copyReferralLink = (referralId) => {
    const link = `${window.location.origin}/ref/${referralId}`;
    navigator.clipboard.writeText(link);
    setCopiedId(referralId);
    setTimeout(() => setCopiedId(null), 2000);
    toast.success('Referral link copied to clipboard');
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: { bg: '#f59e0b22', color: '#f59e0b' },
      contacted: { bg: '#3b82f622', color: '#3b82f6' },
      converted: { bg: '#22c55e22', color: '#22c55e' },
      expired: { bg: '#ef444422', color: '#ef4444' },
    };
    return colors[status] || { bg: 'var(--border)', color: 'var(--tx-2)' };
  };

  const filteredReferrals =
    statusFilter === 'all'
      ? referrals
      : referrals.filter((r) => r.status === statusFilter);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 400 }}>
        <Loader2 size={24} style={{ color: 'var(--tx-3)', animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  return (
    <div>
      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 24 }}>
        <div className="card" style={{ padding: '16px 18px' }}>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--tx-3)', fontWeight: 600 }}>Total Referrals</p>
          <p style={{ margin: '8px 0 0', fontSize: 28, fontWeight: 800, color: 'var(--tx-1)' }}>
            {stats?.total_referrals || 0}
          </p>
        </div>

        <div className="card" style={{ padding: '16px 18px' }}>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--tx-3)', fontWeight: 600 }}>Converted</p>
          <p style={{ margin: '8px 0 0', fontSize: 28, fontWeight: 800, color: '#22c55e' }}>
            {stats?.converted_referrals || 0}
          </p>
        </div>

        <div className="card" style={{ padding: '16px 18px' }}>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--tx-3)', fontWeight: 600 }}>Pending Commission</p>
          <p style={{ margin: '8px 0 0', fontSize: 24, fontWeight: 800, color: 'var(--tx-1)' }}>
            ${(stats?.pending_commission || 0).toFixed(2)}
          </p>
        </div>

        <div className="card" style={{ padding: '16px 18px' }}>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--tx-3)', fontWeight: 600 }}>Paid Commission</p>
          <p style={{ margin: '8px 0 0', fontSize: 24, fontWeight: 800, color: '#22c55e' }}>
            ${(stats?.paid_commission || 0).toFixed(2)}
          </p>
        </div>
      </div>

      {/* Create New Referral */}
      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="btn-primary"
          style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 8 }}
        >
          <Plus size={16} /> Add Referral
        </button>
      ) : (
        <div className="card" style={{ padding: '20px', marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--tx-1)' }}>New Referral</h4>
            <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx-3)' }}>
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleCreateReferral}>
            <div style={{ display: 'grid', gap: 14, gridTemplateColumns: '1fr 1fr' }}>
              <div>
                <label style={{ fontSize: 12, color: 'var(--tx-2)', fontWeight: 600, display: 'block', marginBottom: 6 }}>
                  Name *
                </label>
                <input
                  type="text"
                  placeholder="Referred person's name"
                  value={formData.referred_name}
                  onChange={(e) => setFormData({ ...formData, referred_name: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: 6,
                    border: '1px solid var(--border)',
                    background: 'var(--card)',
                    color: 'var(--tx-1)',
                    fontSize: 13,
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, color: 'var(--tx-2)', fontWeight: 600, display: 'block', marginBottom: 6 }}>
                  Email *
                </label>
                <input
                  type="email"
                  placeholder="Email address"
                  value={formData.referred_email}
                  onChange={(e) => setFormData({ ...formData, referred_email: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: 6,
                    border: '1px solid var(--border)',
                    background: 'var(--card)',
                    color: 'var(--tx-1)',
                    fontSize: 13,
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, color: 'var(--tx-2)', fontWeight: 600, display: 'block', marginBottom: 6 }}>
                  Company
                </label>
                <input
                  type="text"
                  placeholder="Company name"
                  value={formData.referred_company}
                  onChange={(e) => setFormData({ ...formData, referred_company: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: 6,
                    border: '1px solid var(--border)',
                    background: 'var(--card)',
                    color: 'var(--tx-1)',
                    fontSize: 13,
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, color: 'var(--tx-2)', fontWeight: 600, display: 'block', marginBottom: 6 }}>
                  Notes
                </label>
                <input
                  type="text"
                  placeholder="Any notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: 6,
                    border: '1px solid var(--border)',
                    background: 'var(--card)',
                    color: 'var(--tx-1)',
                    fontSize: 13,
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button
                type="submit"
                disabled={saving}
                className="btn-primary"
              >
                {saving ? 'Saving...' : 'Create Referral'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                style={{
                  padding: '8px 14px',
                  borderRadius: 6,
                  border: '1px solid var(--border)',
                  background: 'transparent',
                  color: 'var(--tx-2)',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 500,
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filter */}
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
        <Filter size={16} style={{ color: 'var(--tx-3)' }} />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{
            padding: '6px 10px',
            borderRadius: 6,
            border: '1px solid var(--border)',
            background: 'var(--card)',
            color: 'var(--tx-1)',
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          <option value="all">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="contacted">Contacted</option>
          <option value="converted">Converted</option>
          <option value="expired">Expired</option>
        </select>
      </div>

      {/* Referrals Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {filteredReferrals.length === 0 ? (
          <p style={{ padding: '20px', color: 'var(--tx-3)', fontSize: 13 }}>No referrals yet.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Status</th>
                  <th>Commission</th>
                  <th>Date</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredReferrals.map((ref) => {
                  const statusColor = getStatusColor(ref.status);
                  return (
                    <tr key={ref.id || ref._id}>
                      <td style={{ fontWeight: 600 }}>{ref.referred_name}</td>
                      <td style={{ color: 'var(--tx-2)', fontSize: 12 }}>{ref.referred_email}</td>
                      <td>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            padding: '4px 8px',
                            borderRadius: 4,
                            background: statusColor.bg,
                            color: statusColor.color,
                            textTransform: 'capitalize',
                          }}
                        >
                          {ref.status}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600, color: 'var(--tx-1)' }}>
                        ${(ref.commission_amount || 0).toFixed(2)}
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--tx-3)' }}>
                        {new Date(ref.created_at || ref.createdAt).toLocaleDateString()}
                      </td>
                      <td>
                        <button
                          onClick={() => copyReferralLink(ref.id || ref._id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: copiedId === (ref.id || ref._id) ? '#22c55e' : 'var(--accent)',
                            cursor: 'pointer',
                            fontSize: 13,
                            fontWeight: 500,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <Copy size={14} />
                          {copiedId === (ref.id || ref._id) ? 'Copied' : 'Copy Link'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// TAB 2: MARKETPLACE
// ============================================================================

function MarketplaceTab() {
  const token = localStorage.getItem('token');
  const [loading, setLoading] = useState(true);
  const [listings, setListings] = useState([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [showMyListingsOnly, setShowMyListingsOnly] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'service',
    price: '',
    pricing_type: 'one-time',
    tags: '',
  });

  useEffect(() => {
    fetchListings();
  }, []);

  const fetchListings = async () => {
    try {
      const response = await axios.get(`${API}/ambassador/marketplace/listings`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setListings(Array.isArray(response.data) ? response.data : response.data?.data || []);
    } catch (error) {
      toast.error('Failed to load marketplace listings');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateListing = async (e) => {
    e.preventDefault();
    if (!formData.title || !formData.description || !formData.price) {
      toast.error('Please fill in all required fields');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...formData,
        price: parseFloat(formData.price),
        tags: formData.tags.split(',').map((t) => t.trim()).filter(Boolean),
      };

      await axios.post(`${API}/ambassador/marketplace/listings`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });

      toast.success('Listing created successfully');
      setFormData({
        title: '',
        description: '',
        category: 'service',
        price: '',
        pricing_type: 'one-time',
        tags: '',
      });
      setShowCreateModal(false);
      fetchListings();
    } catch (error) {
      toast.error('Failed to create listing');
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const filteredListings = listings.filter((listing) => {
    const matchesSearch =
      listing.title?.toLowerCase().includes(search.toLowerCase()) ||
      listing.description?.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || listing.category === categoryFilter;
    const matchesOwner = !showMyListingsOnly || listing.is_owner;

    return matchesSearch && matchesCategory && matchesOwner;
  });

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 400 }}>
        <Loader2 size={24} style={{ color: 'var(--tx-3)', animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  return (
    <div>
      {/* Header Row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, gap: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', background: 'var(--card)', borderRadius: 6, border: '1px solid var(--border)', padding: '8px 12px', gap: 8 }}>
            <Search size={16} style={{ color: 'var(--tx-3)' }} />
            <input
              type="text"
              placeholder="Search listings..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                flex: 1,
                background: 'none',
                border: 'none',
                color: 'var(--tx-1)',
                fontSize: 13,
                outline: 'none',
              }}
            />
          </div>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}
        >
          <Plus size={16} /> Create Listing
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 20, alignItems: 'center' }}>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          style={{
            padding: '6px 10px',
            borderRadius: 6,
            border: '1px solid var(--border)',
            background: 'var(--card)',
            color: 'var(--tx-1)',
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          <option value="all">All Categories</option>
          <option value="service">Service</option>
          <option value="template">Template</option>
          <option value="automation">Automation</option>
          <option value="consultation">Consultation</option>
        </select>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--tx-2)' }}>
          <input
            type="checkbox"
            checked={showMyListingsOnly}
            onChange={(e) => setShowMyListingsOnly(e.target.checked)}
            style={{ cursor: 'pointer' }}
          />
          My Listings Only
        </label>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 50,
        }}>
          <div className="card" style={{ width: '90%', maxWidth: 500, padding: '24px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--tx-1)' }}>Create New Listing</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx-3)' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateListing} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, color: 'var(--tx-2)', fontWeight: 600, display: 'block', marginBottom: 6 }}>
                  Title *
                </label>
                <input
                  type="text"
                  placeholder="Listing title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: 6,
                    border: '1px solid var(--border)',
                    background: 'var(--bg)',
                    color: 'var(--tx-1)',
                    fontSize: 13,
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, color: 'var(--tx-2)', fontWeight: 600, display: 'block', marginBottom: 6 }}>
                  Description *
                </label>
                <textarea
                  placeholder="Describe your listing"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: 6,
                    border: '1px solid var(--border)',
                    background: 'var(--bg)',
                    color: 'var(--tx-1)',
                    fontSize: 13,
                    minHeight: 80,
                    boxSizing: 'border-box',
                    resize: 'vertical',
                    fontFamily: 'inherit',
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--tx-2)', fontWeight: 600, display: 'block', marginBottom: 6 }}>
                    Category *
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: 6,
                      border: '1px solid var(--border)',
                      background: 'var(--bg)',
                      color: 'var(--tx-1)',
                      fontSize: 13,
                      boxSizing: 'border-box',
                      cursor: 'pointer',
                    }}
                  >
                    <option value="service">Service</option>
                    <option value="template">Template</option>
                    <option value="automation">Automation</option>
                    <option value="consultation">Consultation</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: 12, color: 'var(--tx-2)', fontWeight: 600, display: 'block', marginBottom: 6 }}>
                    Price Type *
                  </label>
                  <select
                    value={formData.pricing_type}
                    onChange={(e) => setFormData({ ...formData, pricing_type: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: 6,
                      border: '1px solid var(--border)',
                      background: 'var(--bg)',
                      color: 'var(--tx-1)',
                      fontSize: 13,
                      boxSizing: 'border-box',
                      cursor: 'pointer',
                    }}
                  >
                    <option value="one-time">One-time</option>
                    <option value="recurring">Recurring</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, color: 'var(--tx-2)', fontWeight: 600, display: 'block', marginBottom: 6 }}>
                  Price ($) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: 6,
                    border: '1px solid var(--border)',
                    background: 'var(--bg)',
                    color: 'var(--tx-1)',
                    fontSize: 13,
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, color: 'var(--tx-2)', fontWeight: 600, display: 'block', marginBottom: 6 }}>
                  Tags (comma-separated)
                </label>
                <input
                  type="text"
                  placeholder="e.g. wordpress, design, seo"
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: 6,
                    border: '1px solid var(--border)',
                    background: 'var(--bg)',
                    color: 'var(--tx-1)',
                    fontSize: 13,
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary"
                >
                  {saving ? 'Creating...' : 'Create Listing'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 6,
                    border: '1px solid var(--border)',
                    background: 'transparent',
                    color: 'var(--tx-2)',
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: 500,
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Listings Grid */}
      {filteredListings.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--tx-3)' }}>
          <p>No listings found.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {filteredListings.map((listing) => (
            <div key={listing.id || listing._id} className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ marginBottom: 12, flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 8 }}>
                  <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--tx-1)', flex: 1 }}>
                    {listing.title}
                  </h4>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      padding: '3px 8px',
                      borderRadius: 4,
                      background: 'var(--border)',
                      color: 'var(--tx-2)',
                      textTransform: 'capitalize',
                      whiteSpace: 'nowrap',
                      marginLeft: 8,
                    }}
                  >
                    {listing.category}
                  </span>
                </div>

                <p style={{
                  margin: '0 0 10px',
                  fontSize: 12,
                  color: 'var(--tx-2)',
                  lineHeight: 1.5,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}>
                  {listing.description}
                </p>

                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 10 }}>
                  {listing.tags && listing.tags.slice(0, 3).map((tag, i) => (
                    <span key={i} style={{
                      fontSize: 11,
                      padding: '2px 6px',
                      borderRadius: 3,
                      background: 'var(--border)',
                      color: 'var(--tx-3)',
                    }}>
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <p style={{ margin: 0, fontSize: 20, fontWeight: 800, color: 'var(--accent)' }}>
                    ${parseFloat(listing.price || 0).toFixed(2)}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Star size={14} style={{ color: '#f59e0b', fill: '#f59e0b' }} />
                    <span style={{ fontSize: 12, color: 'var(--tx-2)', fontWeight: 600 }}>
                      {listing.rating ? listing.rating.toFixed(1) : 'N/A'}
                    </span>
                  </div>
                </div>

                <p style={{ margin: 0, fontSize: 11, color: 'var(--tx-3)' }}>
                  By {listing.seller_name || 'Unknown'} • {listing.purchase_count || 0} purchases
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// TAB 3: EARNINGS / STATS
// ============================================================================

function EarningsTab() {
  const token = localStorage.getItem('token');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [earningsData, setEarningsData] = useState([]);

  useEffect(() => {
    fetchEarningsData();
  }, []);

  const fetchEarningsData = async () => {
    try {
      const [statsRes, ordersRes] = await Promise.all([
        axios.get(`${API}/ambassador/marketplace-stats`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`${API}/ambassador/marketplace/orders`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      setStats(statsRes.data);

      const orders = Array.isArray(ordersRes.data) ? ordersRes.data : ordersRes.data?.data || [];
      setTransactions(orders.slice(0, 10)); // Recent 10

      // Build monthly earnings data
      const monthlyMap = {};
      orders.forEach((order) => {
        const date = new Date(order.created_at || order.createdAt);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        monthlyMap[monthKey] = (monthlyMap[monthKey] || 0) + (order.revenue || 0);
      });

      const earningsArray = Object.entries(monthlyMap)
        .sort()
        .map(([month, revenue]) => ({
          month: new Date(`${month}-01`).toLocaleDateString('en-US', { year: 'numeric', month: 'short' }),
          revenue: parseFloat(revenue.toFixed(2)),
        }));

      setEarningsData(earningsArray);
    } catch (error) {
      toast.error('Failed to load earnings data');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 400 }}>
        <Loader2 size={24} style={{ color: 'var(--tx-3)', animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  return (
    <div>
      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 24 }}>
        <div className="card" style={{ padding: '18px 20px' }}>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--tx-3)', fontWeight: 600 }}>Total Earned</p>
          <p style={{ margin: '10px 0 0', fontSize: 28, fontWeight: 800, color: 'var(--tx-1)' }}>
            ${(stats?.total_earned || 0).toFixed(2)}
          </p>
        </div>

        <div className="card" style={{ padding: '18px 20px' }}>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--tx-3)', fontWeight: 600 }}>Pending Payouts</p>
          <p style={{ margin: '10px 0 0', fontSize: 28, fontWeight: 800, color: '#f59e0b' }}>
            ${(stats?.pending_payout || 0).toFixed(2)}
          </p>
        </div>

        <div className="card" style={{ padding: '18px 20px' }}>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--tx-3)', fontWeight: 600 }}>Marketplace Revenue</p>
          <p style={{ margin: '10px 0 0', fontSize: 28, fontWeight: 800, color: '#22c55e' }}>
            ${(stats?.marketplace_revenue || 0).toFixed(2)}
          </p>
        </div>

        <div className="card" style={{ padding: '18px 20px' }}>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--tx-3)', fontWeight: 600 }}>Referral Commissions</p>
          <p style={{ margin: '10px 0 0', fontSize: 28, fontWeight: 800, color: '#3b82f6' }}>
            ${(stats?.referral_commissions || 0).toFixed(2)}
          </p>
        </div>
      </div>

      {/* Earnings Over Time */}
      {earningsData.length > 0 && (
        <div className="card" style={{ padding: '20px', marginBottom: 24 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 700, color: 'var(--tx-1)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <BarChart3 size={16} /> Monthly Earnings
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 12 }}>
            {earningsData.map((data, i) => (
              <div key={i} style={{
                padding: '12px',
                borderRadius: 6,
                background: 'var(--bg)',
                border: '1px solid var(--border)',
              }}>
                <p style={{ margin: 0, fontSize: 11, color: 'var(--tx-3)', fontWeight: 600 }}>{data.month}</p>
                <p style={{ margin: '6px 0 0', fontSize: 18, fontWeight: 800, color: 'var(--accent)' }}>
                  ${data.revenue}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Transactions */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--tx-1)' }}>Recent Transactions</h3>
        </div>

        {transactions.length === 0 ? (
          <p style={{ padding: '20px', color: 'var(--tx-3)', fontSize: 13 }}>No transactions yet.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Listing</th>
                  <th>Buyer</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((txn) => (
                  <tr key={txn.id || txn._id}>
                    <td style={{ fontWeight: 600 }}>{txn.listing_title || 'Unknown'}</td>
                    <td style={{ color: 'var(--tx-2)', fontSize: 12 }}>{txn.buyer_name || txn.buyer_email || 'Unknown'}</td>
                    <td style={{ fontWeight: 600, color: 'var(--accent)' }}>
                      ${(txn.amount || 0).toFixed(2)}
                    </td>
                    <td>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          padding: '4px 8px',
                          borderRadius: 4,
                          background: txn.status === 'completed' ? '#22c55e22' : '#f59e0b22',
                          color: txn.status === 'completed' ? '#22c55e' : '#f59e0b',
                          textTransform: 'capitalize',
                        }}
                      >
                        {txn.status || 'pending'}
                      </span>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--tx-3)' }}>
                      {new Date(txn.created_at || txn.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function Ambassador() {
  const [activeTab, setActiveTab] = useState('referrals');

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)', padding: '24px 28px' }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--tx-1)', margin: 0 }}>Ambassador & Marketplace</h1>
        <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--tx-3)' }}>
          Manage referrals, sell in the marketplace, and track your earnings
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, borderBottom: '1px solid var(--border)' }}>
        {[
          { id: 'referrals', label: 'My Referrals' },
          { id: 'marketplace', label: 'Marketplace' },
          { id: 'earnings', label: 'Earnings & Stats' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '12px 16px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid var(--accent)' : 'none',
              color: activeTab === tab.id ? 'var(--accent)' : 'var(--tx-3)',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 600,
              transition: 'color 0.2s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'referrals' && <ReferralsTab />}
      {activeTab === 'marketplace' && <MarketplaceTab />}
      {activeTab === 'earnings' && <EarningsTab />}
    </div>
  );
}
