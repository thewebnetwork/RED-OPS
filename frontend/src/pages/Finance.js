import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp, TrendingDown, DollarSign, Users, AlertCircle,
  Calendar, BarChart2, RefreshCw, Loader2,
} from 'lucide-react';
import {
  LineChart, BarChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import axios from 'axios';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const getStatusColor = (status) => {
  switch (status) {
    case 'on-track': return '#22c55e';
    case 'at-risk':  return '#f59e0b';
    case 'critical': return '#c92a3e';
    default:         return '#606060';
  }
};

const getStatusLabel = (status) => {
  switch (status) {
    case 'on-track': return 'On track';
    case 'at-risk':  return 'At risk';
    case 'critical': return 'Critical';
    default:         return status;
  }
};

const Finance = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Real data from API
  const [financials, setFinancials] = useState(null);
  const [clients, setClients] = useState([]);

  const fetchData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const [finRes, usersRes] = await Promise.allSettled([
        axios.get(`${API}/dashboard/financial-stats`),
        axios.get(`${API}/users`),
      ]);

      if (finRes.status === 'fulfilled') {
        setFinancials(finRes.value.data);
      }

      if (usersRes.status === 'fulfilled') {
        const all = Array.isArray(usersRes.value.data) ? usersRes.value.data : usersRes.value.data?.items || [];
        const mediaClients = all.filter(u => u.account_type === 'Media Client');
        setClients(mediaClients);
      }
    } catch (err) {
      toast.error('Failed to load financial data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleRefresh = () => fetchData(true);

  // Compute metrics from real data
  const mrr = financials?.mrr || 0;
  const arr = mrr * 12;
  const activeClients = financials?.active_subscribers || financials?.total_clients || clients.length;
  const newClientsMtd = financials?.new_clients_mtd || 0;
  const requestsMtd = financials?.requests_mtd || 0;
  const requestsPrev = financials?.requests_prev_month || 0;
  const deliveredMtd = financials?.delivered_mtd || 0;

  if (loading) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <Loader2 size={24} className="spin" style={{ color: 'var(--tx-3)' }} />
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)', padding: '24px 28px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--tx-1)', margin: 0 }}>Financial Overview</h1>
          <p style={{ margin: '3px 0 0', fontSize: 13, color: 'var(--tx-3)' }}>Retainer business health monitor</p>
        </div>
        <button onClick={handleRefresh} className="btn-primary btn-sm" disabled={refreshing} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <RefreshCw size={14} className={refreshing ? 'spin' : ''} />
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Top Metrics Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14, marginBottom: 24 }}>
        {/* MRR */}
        <div className="card" style={{ padding: '18px 20px' }}>
          <span style={{ fontSize: 11, color: 'var(--tx-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Monthly Recurring Revenue</span>
          <p style={{ margin: '10px 0 4px', fontSize: 28, fontWeight: 800, color: 'var(--tx-1)', lineHeight: 1 }}>
            ${mrr.toLocaleString()}
          </p>
          <span style={{ fontSize: 11, color: 'var(--tx-3)' }}>Billed monthly</span>
        </div>

        {/* ARR */}
        <div className="card" style={{ padding: '18px 20px' }}>
          <span style={{ fontSize: 11, color: 'var(--tx-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Annual Recurring Revenue</span>
          <p style={{ margin: '10px 0 4px', fontSize: 28, fontWeight: 800, color: 'var(--tx-1)', lineHeight: 1 }}>
            ${arr.toLocaleString()}
          </p>
          <span style={{ fontSize: 11, color: 'var(--tx-3)' }}>Annualized from MRR</span>
        </div>

        {/* Active Clients */}
        <div className="card" style={{ padding: '18px 20px' }}>
          <span style={{ fontSize: 11, color: 'var(--tx-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Active Clients</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, margin: '10px 0 4px' }}>
            <span style={{ fontSize: 28, fontWeight: 800, color: 'var(--tx-1)', lineHeight: 1 }}>{activeClients}</span>
            {newClientsMtd > 0 && (
              <span style={{ fontSize: 12, fontWeight: 600, color: '#22c55e', display: 'flex', alignItems: 'center', gap: 3 }}>
                <TrendingUp size={12} /> +{newClientsMtd} this month
              </span>
            )}
          </div>
          <span style={{ fontSize: 11, color: 'var(--tx-3)' }}>Paying accounts</span>
        </div>

        {/* Requests This Month */}
        <div className="card" style={{ padding: '18px 20px' }}>
          <span style={{ fontSize: 11, color: 'var(--tx-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Requests This Month</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, margin: '10px 0 4px' }}>
            <span style={{ fontSize: 28, fontWeight: 800, color: 'var(--tx-1)', lineHeight: 1 }}>{requestsMtd}</span>
            {requestsPrev > 0 && (
              <span style={{ fontSize: 12, fontWeight: 600, color: requestsMtd >= requestsPrev ? '#22c55e' : '#ef4444', display: 'flex', alignItems: 'center', gap: 3 }}>
                {requestsMtd >= requestsPrev ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                {requestsPrev > 0 ? `${Math.round(((requestsMtd - requestsPrev) / requestsPrev) * 100)}%` : '—'} vs prev
              </span>
            )}
          </div>
          <span style={{ fontSize: 11, color: 'var(--tx-3)' }}>{deliveredMtd} delivered</span>
        </div>
      </div>

      {/* Client Portfolio Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--tx-1)' }}>Client Portfolio</h3>
          <span style={{ fontSize: 11, color: 'var(--tx-3)' }}>{clients.length} clients</span>
        </div>
        {clients.length === 0 ? (
          <p style={{ padding: 20, color: 'var(--tx-3)', fontSize: 13 }}>No client accounts found. Create clients from the Clients page.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Client</th>
                <th>Email</th>
                <th>Plan</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {clients.map(c => (
                <tr key={c.id || c._id}>
                  <td style={{ fontWeight: 600 }}>{c.name}</td>
                  <td style={{ color: 'var(--tx-2)', fontSize: 12 }}>{c.email}</td>
                  <td>{c.subscription_plan_name || '—'}</td>
                  <td>
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 5,
                      background: c.active ? '#22c55e22' : '#ef444422',
                      color: c.active ? '#22c55e' : '#ef4444'
                    }}>
                      {c.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default Finance;
