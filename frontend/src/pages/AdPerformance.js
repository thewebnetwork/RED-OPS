/**
 * Ad Performance Dashboard — Hyros Lite
 * Client and Admin views for advertising campaign performance tracking
 *
 * Features:
 *   • ClientAdDashboard: Personal ad metrics, monthly trends, recent snapshots
 *   • AdminAdDashboard: Agency overview, client performance table, snapshot management
 *   • KPI cards with delta indicators (green/red)
 *   • Custom CSS bar charts (no external library)
 *   • Modal for adding ad performance snapshots
 *   • Responsive grid layouts
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';
import axios from 'axios';
import {
  BarChart2, TrendingUp, TrendingDown, Plus, X, ChevronDown,
  Loader2, AlertCircle, CheckCircle2, Activity
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const tok = () => localStorage.getItem('token');
const ax = () => axios.create({ headers: { Authorization: `Bearer ${tok()}` } });

/* ────────────────────────────────────────────────────────────────────────────
   UTILITIES
   ──────────────────────────────────────────────────────────────────────────── */

const formatCurrency = (val) => {
  if (!val && val !== 0) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val);
};

const formatNumber = (val) => {
  if (!val && val !== 0) return '—';
  return new Intl.NumberFormat('en-US').format(Math.round(val));
};

const formatPercent = (val) => {
  if (!val && val !== 0) return '—';
  return (val * 100).toFixed(1) + '%';
};

const getMonthName = (d) => {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
};

const getLastNMonths = (n) => {
  const months = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    months.push({ label: d.toLocaleDateString('en-US', { month: 'short' }), date: d });
  }
  return months;
};

const getDeltaColor = (isPositive) => {
  return isPositive ? '#22c55e' : '#ef4444';
};

const getDeltaIcon = (isPositive) => {
  return isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />;
};

/* ────────────────────────────────────────────────────────────────────────────
   COMPONENTS
   ──────────────────────────────────────────────────────────────────────────── */

/* KPI Card — shows value with delta */
function KPICard({ label, value, formattedValue, delta, isPositiveDelta = true, subtitle = '' }) {
  return (
    <div
      className="card"
      style={{
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}
    >
      <div style={{ fontSize: '12px', color: 'var(--tx-3)', fontWeight: 500 }}>
        {label}
      </div>
      <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--tx-1)', letterSpacing: '-0.02em' }}>
        {formattedValue}
      </div>
      {delta !== null && delta !== undefined && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '12px',
            color: getDeltaColor(isPositiveDelta),
            fontWeight: 500,
          }}
        >
          {getDeltaIcon(isPositiveDelta)}
          <span>{Math.abs(delta).toFixed(1)}% from prev month</span>
        </div>
      )}
      {subtitle && (
        <div style={{ fontSize: '11px', color: 'var(--tx-3)', marginTop: '2px' }}>
          {subtitle}
        </div>
      )}
    </div>
  );
}

/* Custom Bar Chart Component */
function BarChart({ data, height = 200 }) {
  if (!data || data.length === 0) {
    return (
      <div
        style={{
          padding: '40px 20px',
          textAlign: 'center',
          color: 'var(--tx-3)',
          fontSize: '13px',
        }}
      >
        No data available
      </div>
    );
  }

  const maxValue = Math.max(...data.flatMap((d) => [d.spend || 0, d.leads || 0]));
  const scale = maxValue > 0 ? height / maxValue : 1;

  return (
    <div
      style={{
        height: height + 60,
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        position: 'relative',
      }}
    >
      {/* Chart Area */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-around',
          gap: '16px',
          paddingBottom: '8px',
          borderBottom: '1px solid var(--border)',
        }}
      >
        {data.map((item, idx) => (
          <div
            key={idx}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '8px',
              position: 'relative',
            }}
          >
            {/* Bar Group */}
            <div
              style={{
                display: 'flex',
                gap: '4px',
                alignItems: 'flex-end',
                height: height,
              }}
            >
              {/* Spend Bar (gray) */}
              {item.spend && (
                <div
                  style={{
                    width: '12px',
                    height: Math.max(2, item.spend * scale),
                    backgroundColor: '#606060',
                    borderRadius: '3px 3px 0 0',
                    position: 'relative',
                    cursor: 'pointer',
                  }}
                  title={`Spend: ${formatCurrency(item.spend)}`}
                />
              )}
              {/* Leads Bar (accent) */}
              {item.leads && (
                <div
                  style={{
                    width: '12px',
                    height: Math.max(2, item.leads * scale),
                    backgroundColor: 'var(--red)',
                    borderRadius: '3px 3px 0 0',
                    position: 'relative',
                    cursor: 'pointer',
                  }}
                  title={`Leads: ${formatNumber(item.leads)}`}
                />
              )}
            </div>
            {/* Label */}
            <div
              style={{
                fontSize: '11px',
                color: 'var(--tx-3)',
                fontWeight: 500,
                whiteSpace: 'nowrap',
              }}
            >
              {item.label}
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div
        style={{
          display: 'flex',
          gap: '24px',
          justifyContent: 'flex-start',
          fontSize: '12px',
          paddingTop: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--tx-2)' }}>
          <div style={{ width: '10px', height: '10px', backgroundColor: '#606060', borderRadius: '2px' }} />
          Spend
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--tx-2)' }}>
          <div style={{ width: '10px', height: '10px', backgroundColor: 'var(--red)', borderRadius: '2px' }} />
          Leads
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   CLIENT DASHBOARD
   ──────────────────────────────────────────────────────────────────────────── */

function ClientAdDashboard() {
  const { user } = useAuth();
  const [summary, setSummary] = useState(null);
  const [snapshots, setSnapshots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // In preview-as-client mode, use the preview client's ID
  const isPreview = typeof window !== 'undefined' && localStorage.getItem('preview_as_client') === 'true';
  const clientId = isPreview ? localStorage.getItem('preview_client_id') : user?.id;

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        if (!clientId) {
          setError('User not authenticated');
          return;
        }

        // Fetch summary
        const summRes = await ax().get(`${API}/ad-performance/summary/${clientId}`);
        setSummary(summRes.data);

        // Fetch snapshots
        const snapsRes = await ax().get(`${API}/ad-performance/snapshots?client_id=${clientId}`);
        setSnapshots(snapsRes.data || []);
      } catch (err) {
        console.error('Error fetching ad performance data:', err);
        // Don't show error toast for empty data (404)
        if (err.response?.status === 404) {
          setSummary(null);
          setSnapshots([]);
        } else {
          setError(err.response?.data?.message || 'Failed to load data');
          toast.error('Failed to load ad performance data');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [clientId]);

  if (loading) {
    return (
      <div className="page-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 size={32} className="spin" style={{ color: 'var(--red)' }} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-content">
        <div className="page-header">
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '2px' }}>Ad Performance</h1>
            <p style={{ fontSize: '13px', color: 'var(--tx-2)' }}>Track your advertising results</p>
          </div>
        </div>
        <div
          className="insight danger"
          style={{
            marginTop: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <AlertCircle size={20} />
          <div>
            <div style={{ fontWeight: 600, marginBottom: '2px' }}>Error Loading Data</div>
            <div style={{ fontSize: '12px', color: 'var(--tx-2)' }}>{error}</div>
          </div>
        </div>
      </div>
    );
  }

  const hasData = snapshots && snapshots.length > 0;
  const currentMonth = summary?.current_month || {};
  const previousMonth = summary?.previous_month || {};
  const monthlyTrend = summary?.monthly_trends || [];

  // Calculate deltas
  const spendDelta =
    currentMonth.ad_spend && previousMonth.ad_spend
      ? ((currentMonth.ad_spend - previousMonth.ad_spend) / previousMonth.ad_spend) * 100
      : 0;
  const leadsDelta =
    currentMonth.leads && previousMonth.leads
      ? ((currentMonth.leads - previousMonth.leads) / previousMonth.leads) * 100
      : 0;
  const cplDelta =
    currentMonth.cpl && previousMonth.cpl
      ? ((currentMonth.cpl - previousMonth.cpl) / previousMonth.cpl) * 100
      : 0;
  const roasDelta =
    currentMonth.roas && previousMonth.roas
      ? ((currentMonth.roas - previousMonth.roas) / previousMonth.roas) * 100
      : 0;

  // Prepare chart data
  const chartData = getLastNMonths(6).map((m) => {
    const trend = monthlyTrend?.find(
      (t) => {
        const d = new Date(t.period + '-01');
        return d.getMonth() === m.date.getMonth() && d.getFullYear() === m.date.getFullYear();
      }
    );
    return {
      label: m.label,
      spend: trend?.total_spend || 0,
      leads: trend?.total_leads || 0,
    };
  });

  // Prepare platforms (rich objects with metrics from backend)
  const platforms = summary?.platforms || [];

  // Recent snapshots (last 12)
  const recentSnapshots = snapshots.slice(0, 12);

  return (
    <div className="page-content">
      {/* Header */}
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <BarChart2 size={28} style={{ color: 'var(--red)' }} />
            <h1 style={{ fontSize: '22px', fontWeight: 700 }}>Ad Performance</h1>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--tx-2)' }}>Track your advertising results</p>
        </div>
      </div>

      {!hasData ? (
        /* Empty State */
        <div
          className="card"
          style={{
            padding: '60px 20px',
            textAlign: 'center',
            marginTop: '20px',
          }}
        >
          <Activity size={48} style={{ color: 'var(--tx-3)', margin: '0 auto 12px' }} />
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--tx-1)', marginBottom: '4px' }}>
            No ad performance data yet
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--tx-2)', marginBottom: '16px' }}>
            Your ad performance data will appear here once your account manager uploads your campaign results.
          </p>
        </div>
      ) : (
        <>
          {/* KPI Row */}
          <div className="metrics-grid-4">
            <KPICard
              label="Total Spend"
              value={currentMonth.ad_spend}
              formattedValue={formatCurrency(currentMonth.ad_spend)}
              delta={spendDelta}
              isPositiveDelta={false}
              subtitle="Current month"
            />
            <KPICard
              label="Total Leads"
              value={currentMonth.leads}
              formattedValue={formatNumber(currentMonth.leads)}
              delta={leadsDelta}
              isPositiveDelta={true}
              subtitle="Current month"
            />
            <KPICard
              label="Cost Per Lead"
              value={currentMonth.cpl}
              formattedValue={formatCurrency(currentMonth.cpl)}
              delta={cplDelta}
              isPositiveDelta={false}
              subtitle="Lower is better"
            />
            <KPICard
              label="ROAS"
              value={currentMonth.roas}
              formattedValue={currentMonth.roas?.toFixed(2) + 'x' || '—'}
              delta={roasDelta}
              isPositiveDelta={true}
              subtitle="Return on ad spend"
            />
          </div>

          {/* Monthly Trend Chart */}
          <div
            className="card"
            style={{
              padding: '20px',
              marginTop: '20px',
            }}
          >
            <h2 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '16px', color: 'var(--tx-1)' }}>
              6-Month Trend
            </h2>
            <BarChart data={chartData} height={160} />
          </div>

          {/* Platform Breakdown */}
          {platforms.length > 1 && (
            <div className="responsive-grid-3" style={{ marginTop: '20px' }}>
              {platforms.map((plat, idx) => (
                <div key={idx} className="card" style={{ padding: '16px' }}>
                  <h3 style={{ fontSize: '13px', fontWeight: 600, marginBottom: '12px', color: 'var(--tx-1)' }}>
                    {plat.platform}
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--tx-2)' }}>Spend:</span>
                      <span style={{ color: 'var(--tx-1)', fontWeight: 600 }}>{formatCurrency(plat.ad_spend)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--tx-2)' }}>Leads:</span>
                      <span style={{ color: 'var(--tx-1)', fontWeight: 600 }}>{formatNumber(plat.leads)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--tx-2)' }}>CTR:</span>
                      <span style={{ color: 'var(--tx-1)', fontWeight: 600 }}>{formatPercent(plat.ctr)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Recent Snapshots Table */}
          {recentSnapshots.length > 0 && (
            <div
              className="card"
              style={{
                marginTop: '20px',
                overflow: 'hidden',
              }}
            >
              <div
                className="card-header"
                style={{
                  padding: '12px 16px',
                }}
              >
                <h2 style={{ fontSize: '14px', fontWeight: 600 }}>Recent Campaign Results</h2>
              </div>
              <div className="mobile-scroll-x">
                <table className="data-table" style={{ fontSize: '12px' }}>
                  <thead>
                    <tr>
                      <th>Period</th>
                      <th>Platform</th>
                      <th>Spend</th>
                      <th>Leads</th>
                      <th>CPL</th>
                      <th>CTR</th>
                      <th>ROAS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentSnapshots.map((snap) => (
                      <tr key={snap.id}>
                        <td>{getMonthName(snap.period)}</td>
                        <td>{snap.platform}</td>
                        <td>{formatCurrency(snap.metrics?.ad_spend)}</td>
                        <td>{formatNumber(snap.metrics?.leads)}</td>
                        <td>{formatCurrency(snap.metrics?.cpl)}</td>
                        <td>{formatPercent(snap.metrics?.ctr)}</td>
                        <td>{snap.metrics?.roas?.toFixed(2)}x</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   ADD SNAPSHOT MODAL
   ──────────────────────────────────────────────────────────────────────────── */

function AddSnapshotModal({ open, onClose, onSave, clients }) {
  const [formData, setFormData] = useState({
    client_id: '',
    platform: 'Meta',
    period: new Date().toISOString().split('T')[0],
    ad_spend: '',
    impressions: '',
    clicks: '',
    leads: '',
    conversions: '',
    roas: '',
    campaigns: [],
    notes: '',
  });

  const [newCampaign, setNewCampaign] = useState({
    name: '',
    status: 'active',
    spend: '',
    leads: '',
  });

  const [saving, setSaving] = useState(false);

  const handleFieldChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleAddCampaign = () => {
    if (!newCampaign.name.trim()) {
      toast.error('Campaign name is required');
      return;
    }
    setFormData((prev) => ({
      ...prev,
      campaigns: [...prev.campaigns, { ...newCampaign }],
    }));
    setNewCampaign({ name: '', status: 'active', spend: '', leads: '' });
  };

  const handleRemoveCampaign = (idx) => {
    setFormData((prev) => ({
      ...prev,
      campaigns: prev.campaigns.filter((_, i) => i !== idx),
    }));
  };

  const calculateCPL = () => {
    const spend = parseFloat(formData.ad_spend) || 0;
    const leads = parseFloat(formData.leads) || 0;
    return leads > 0 ? (spend / leads).toFixed(2) : '—';
  };

  const calculateCTR = () => {
    const clicks = parseFloat(formData.clicks) || 0;
    const impressions = parseFloat(formData.impressions) || 0;
    return impressions > 0 ? ((clicks / impressions) * 100).toFixed(2) + '%' : '—';
  };

  const calculateCPC = () => {
    const spend = parseFloat(formData.ad_spend) || 0;
    const clicks = parseFloat(formData.clicks) || 0;
    return clicks > 0 ? (spend / clicks).toFixed(2) : '—';
  };

  const handleSave = async () => {
    if (!formData.client_id) {
      toast.error('Client is required');
      return;
    }
    if (!formData.ad_spend || !formData.leads) {
      toast.error('Spend and Leads are required');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        client_id: formData.client_id,
        platform: formData.platform,
        period: formData.period.slice(0, 7),  // YYYY-MM format for backend
        metrics: {
          ad_spend: parseFloat(formData.ad_spend),
          impressions: parseFloat(formData.impressions) || 0,
          clicks: parseFloat(formData.clicks) || 0,
          leads: parseFloat(formData.leads),
          conversions: parseFloat(formData.conversions) || 0,
          roas: parseFloat(formData.roas) || 1,
          cpl: parseFloat(calculateCPL()) || 0,
          ctr: (parseFloat(calculateCTR()) / 100) || 0,
          cpc: parseFloat(calculateCPC()) || 0,
        },
        campaigns: formData.campaigns,
        notes: formData.notes,
      };

      await ax().post(`${API}/ad-performance/snapshots`, payload);
      toast.success('Snapshot added successfully');
      onSave();
      setFormData({
        client_id: '',
        platform: 'Meta',
        period: new Date().toISOString().split('T')[0],
        ad_spend: '',
        impressions: '',
        clicks: '',
        leads: '',
        conversions: '',
        roas: '',
        campaigns: [],
        notes: '',
      });
    } catch (err) {
      console.error('Error saving snapshot:', err);
      toast.error(err.response?.data?.message || 'Failed to save snapshot');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-box" style={{ maxWidth: '600px', maxHeight: '85vh', overflowY: 'auto' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px',
          }}
        >
          <h2 style={{ fontSize: '16px', fontWeight: 600 }}>Add Ad Performance Snapshot</h2>
          <button
            onClick={onClose}
            className="btn-ghost btn-sm"
            style={{ border: 'none', padding: '4px' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Client Select */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--tx-2)', marginBottom: '4px', display: 'block' }}>
            Client
          </label>
          <select
            className="input-field"
            value={formData.client_id}
            onChange={(e) => handleFieldChange('client_id', e.target.value)}
          >
            <option value="">Select a client...</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* Platform + Period Row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--tx-2)', marginBottom: '4px', display: 'block' }}>
              Platform
            </label>
            <select
              className="input-field"
              value={formData.platform}
              onChange={(e) => handleFieldChange('platform', e.target.value)}
            >
              <option value="Meta">Meta (Facebook/Instagram)</option>
              <option value="Google">Google Ads</option>
              <option value="TikTok">TikTok</option>
              <option value="LinkedIn">LinkedIn</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--tx-2)', marginBottom: '4px', display: 'block' }}>
              Period (Month)
            </label>
            <input
              type="month"
              className="input-field"
              value={formData.period.slice(0, 7)}
              onChange={(e) => handleFieldChange('period', new Date(e.target.value).toISOString().split('T')[0])}
            />
          </div>
        </div>

        {/* Metrics Grid */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--tx-2)', marginBottom: '8px', display: 'block' }}>
            Campaign Metrics
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
            <input
              type="number"
              className="input-field"
              placeholder="Ad Spend ($)"
              value={formData.ad_spend}
              onChange={(e) => handleFieldChange('ad_spend', e.target.value)}
            />
            <input
              type="number"
              className="input-field"
              placeholder="Impressions"
              value={formData.impressions}
              onChange={(e) => handleFieldChange('impressions', e.target.value)}
            />
            <input
              type="number"
              className="input-field"
              placeholder="Clicks"
              value={formData.clicks}
              onChange={(e) => handleFieldChange('clicks', e.target.value)}
            />
            <input
              type="number"
              className="input-field"
              placeholder="Leads"
              value={formData.leads}
              onChange={(e) => handleFieldChange('leads', e.target.value)}
            />
            <input
              type="number"
              className="input-field"
              placeholder="Conversions"
              value={formData.conversions}
              onChange={(e) => handleFieldChange('conversions', e.target.value)}
            />
            <input
              type="number"
              className="input-field"
              placeholder="ROAS"
              step="0.01"
              value={formData.roas}
              onChange={(e) => handleFieldChange('roas', e.target.value)}
            />
          </div>

          {/* Calculated Fields */}
          <div
            style={{
              padding: '12px',
              backgroundColor: 'var(--bg-elevated)',
              borderRadius: '6px',
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: '8px',
              fontSize: '12px',
            }}
          >
            <div>
              <div style={{ color: 'var(--tx-3)', fontSize: '11px', marginBottom: '2px' }}>CPL</div>
              <div style={{ color: 'var(--tx-1)', fontWeight: 600 }}>{calculateCPL()}</div>
            </div>
            <div>
              <div style={{ color: 'var(--tx-3)', fontSize: '11px', marginBottom: '2px' }}>CTR</div>
              <div style={{ color: 'var(--tx-1)', fontWeight: 600 }}>{calculateCTR()}</div>
            </div>
            <div>
              <div style={{ color: 'var(--tx-3)', fontSize: '11px', marginBottom: '2px' }}>CPC</div>
              <div style={{ color: 'var(--tx-1)', fontWeight: 600 }}>{calculateCPC()}</div>
            </div>
          </div>
        </div>

        {/* Campaign Breakdown Section */}
        <div style={{ marginBottom: '16px' }}>
          <details
            style={{
              padding: '12px',
              backgroundColor: 'var(--bg-elevated)',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
          >
            <summary style={{ fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>
              Campaign Breakdown (Optional)
            </summary>
            <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 100px 80px 80px',
                  gap: '8px',
                  marginBottom: '12px',
                }}
              >
                <input
                  type="text"
                  className="input-field"
                  placeholder="Campaign name"
                  value={newCampaign.name}
                  onChange={(e) => setNewCampaign({ ...newCampaign, name: e.target.value })}
                />
                <select
                  className="input-field"
                  value={newCampaign.status}
                  onChange={(e) => setNewCampaign({ ...newCampaign, status: e.target.value })}
                >
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                  <option value="completed">Completed</option>
                </select>
                <input
                  type="number"
                  className="input-field"
                  placeholder="Spend"
                  value={newCampaign.spend}
                  onChange={(e) => setNewCampaign({ ...newCampaign, spend: e.target.value })}
                />
                <input
                  type="number"
                  className="input-field"
                  placeholder="Leads"
                  value={newCampaign.leads}
                  onChange={(e) => setNewCampaign({ ...newCampaign, leads: e.target.value })}
                />
              </div>
              <button onClick={handleAddCampaign} className="btn-ghost btn-sm">
                <Plus size={14} /> Add Campaign
              </button>

              {/* Campaign List */}
              {formData.campaigns.length > 0 && (
                <div style={{ marginTop: '12px' }}>
                  {formData.campaigns.map((camp, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '8px',
                        backgroundColor: 'var(--bg-card)',
                        borderRadius: '4px',
                        marginBottom: '6px',
                        fontSize: '12px',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--tx-1)' }}>{camp.name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--tx-3)' }}>
                          {camp.status} • {formatCurrency(camp.spend)} • {formatNumber(camp.leads)} leads
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveCampaign(idx)}
                        className="btn-ghost btn-xs"
                        style={{ border: 'none', padding: '2px' }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </details>
        </div>

        {/* Notes */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--tx-2)', marginBottom: '4px', display: 'block' }}>
            Notes (Optional)
          </label>
          <textarea
            className="input-field"
            placeholder="Add any notes about this data..."
            value={formData.notes}
            onChange={(e) => handleFieldChange('notes', e.target.value)}
            style={{ minHeight: '60px' }}
          />
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button onClick={onClose} className="btn-ghost">
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="btn-primary"
            disabled={saving}
          >
            {saving && <Loader2 size={14} className="spin" />}
            Save Snapshot
          </button>
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   ADMIN DASHBOARD
   ──────────────────────────────────────────────────────────────────────────── */

function AdminAdDashboard() {
  const [overview, setOverview] = useState(null);
  const [monthlyTrend, setMonthlyTrend] = useState([]);
  const [snapshots, setSnapshots] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [expandedClient, setExpandedClient] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch agency overview
        try {
          const ovRes = await ax().get(`${API}/ad-performance/agency-overview`);
          setOverview(ovRes.data);
          setMonthlyTrend(ovRes.data?.monthly_totals || []);
        } catch (ovErr) {
          // Empty state is fine — no snapshots yet
          console.log('No agency overview data yet');
          setOverview(null);
          setMonthlyTrend([]);
        }

        // Fetch all snapshots (admin can see all)
        try {
          const snapsRes = await ax().get(`${API}/ad-performance/snapshots`);
          setSnapshots(snapsRes.data || []);
        } catch (snapsErr) {
          setSnapshots([]);
        }

        // Fetch clients
        const clientRes = await ax().get(`${API}/users?account_type=Media+Client`);
        setClients(clientRes.data || []);
      } catch (err) {
        console.error('Error fetching admin data:', err);
        setError(err.response?.data?.message || 'Failed to load data');
        toast.error('Failed to load admin dashboard');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleSnapshotAdded = async () => {
    setShowAddModal(false);
    // Refetch data
    try {
      const ovRes = await ax().get(`${API}/ad-performance/agency-overview`);
      setOverview(ovRes.data);
      setMonthlyTrend(ovRes.data?.monthly_totals || []);

      const snapsRes = await ax().get(`${API}/ad-performance/snapshots`);
      setSnapshots(snapsRes.data || []);
    } catch (err) {
      console.error('Error refreshing data:', err);
    }
  };

  if (loading) {
    return (
      <div className="page-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 size={32} className="spin" style={{ color: 'var(--red)' }} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-content">
        <div className="page-header">
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '2px' }}>Ad Performance — Agency View</h1>
          </div>
        </div>
        <div
          className="insight danger"
          style={{
            marginTop: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <AlertCircle size={20} />
          <div>
            <div style={{ fontWeight: 600, marginBottom: '2px' }}>Error Loading Data</div>
            <div style={{ fontSize: '12px', color: 'var(--tx-2)' }}>{error}</div>
          </div>
        </div>
      </div>
    );
  }

  const kpis = overview || {};

  // Prepare chart data for agency
  const chartData = getLastNMonths(6).map((m) => {
    const trend = monthlyTrend?.find(
      (t) => {
        const d = new Date(t.period + '-01');
        return d.getMonth() === m.date.getMonth() && d.getFullYear() === m.date.getFullYear();
      }
    );
    return {
      label: m.label,
      spend: trend?.total_spend || 0,
      leads: trend?.total_leads || 0,
    };
  });

  // Client performance table data
  const clientData = (kpis.per_client_summary || []).map((item) => ({
    ...item,
    clientSnapshot: snapshots.filter((s) => s.client_id === item.client_id).slice(0, 5),
  }));

  return (
    <div className="page-content">
      {/* Header */}
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <BarChart2 size={28} style={{ color: 'var(--red)' }} />
            <h1 style={{ fontSize: '22px', fontWeight: 700 }}>Ad Performance — Agency View</h1>
          </div>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="btn-primary"
        >
          <Plus size={16} /> Add Snapshot
        </button>
      </div>

      {/* Agency KPI Row */}
      <div className="metrics-grid-4" style={{ marginTop: '20px' }}>
        <KPICard
          label="Clients with Data"
          value={kpis.total_clients_with_data}
          formattedValue={formatNumber(kpis.total_clients_with_data)}
        />
        <KPICard
          label="Total Spend (MTD)"
          value={kpis.current_month_total_spend}
          formattedValue={formatCurrency(kpis.current_month_total_spend)}
        />
        <KPICard
          label="Total Leads (MTD)"
          value={kpis.current_month_total_leads}
          formattedValue={formatNumber(kpis.current_month_total_leads)}
        />
        <KPICard
          label="Avg CPL"
          value={kpis.avg_cpl}
          formattedValue={formatCurrency(kpis.avg_cpl)}
        />
        <KPICard
          label="Avg ROAS"
          value={kpis.avg_roas}
          formattedValue={kpis.avg_roas?.toFixed(2) + 'x' || '—'}
        />
      </div>

      {/* Monthly Trend Chart */}
      <div
        className="card"
        style={{
          padding: '20px',
          marginTop: '20px',
        }}
      >
        <h2 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '16px', color: 'var(--tx-1)' }}>
          Agency 6-Month Trend
        </h2>
        <BarChart data={chartData} height={160} />
      </div>

      {/* Client Performance Table */}
      <div
        className="card"
        style={{
          marginTop: '20px',
          overflow: 'hidden',
        }}
      >
        <div
          className="card-header"
          style={{
            padding: '12px 16px',
          }}
        >
          <h2 style={{ fontSize: '14px', fontWeight: 600 }}>Client Performance Summary</h2>
        </div>
        {clientData.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--tx-3)' }}>
            No client data available yet
          </div>
        ) : (
          <div className="mobile-scroll-x">
            <table className="data-table" style={{ fontSize: '12px', minWidth: '800px' }}>
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Current Spend</th>
                  <th>Current Leads</th>
                  <th>CPL</th>
                  <th>Platforms</th>
                  <th>Health</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {clientData.map((client) => (
                  <React.Fragment key={client.client_id}>
                    <tr
                      onClick={() => setExpandedClient(expandedClient === client.client_id ? null : client.client_id)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td style={{ fontWeight: 600 }}>{client.client_name}</td>
                      <td>{formatCurrency(client.current_month_spend)}</td>
                      <td>{formatNumber(client.current_month_leads)}</td>
                      <td>{formatCurrency(client.current_month_cpl)}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                          {(client.platforms || []).map((p) => (
                            <span
                              key={p}
                              className="pill pill-gray"
                              style={{ fontSize: '10px' }}
                            >
                              {p}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td>
                        <span
                          className="pill"
                          style={{
                            backgroundColor:
                              client.health === 'strong'
                                ? '#22c55e18'
                                : client.health === 'ok'
                                ? '#f59e0b18'
                                : '#ef444418',
                            color:
                              client.health === 'strong'
                                ? '#22c55e'
                                : client.health === 'ok'
                                ? '#f59e0b'
                                : '#ef4444',
                          }}
                        >
                          {client.health === 'strong'
                            ? 'Strong'
                            : client.health === 'ok'
                            ? 'Fair'
                            : 'Attention'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <ChevronDown
                          size={16}
                          style={{
                            transform: expandedClient === client.client_id ? 'rotate(180deg)' : 'rotate(0deg)',
                            transition: 'transform 0.15s',
                          }}
                        />
                      </td>
                    </tr>
                    {expandedClient === client.client_id && (
                      <tr>
                        <td colSpan="7" style={{ padding: '12px 16px', backgroundColor: 'var(--bg-elevated)' }}>
                          <div style={{ fontSize: '11px', fontWeight: 600, marginBottom: '8px', color: 'var(--tx-2)' }}>
                            Recent Snapshots
                          </div>
                          {client.clientSnapshot.length === 0 ? (
                            <div style={{ fontSize: '12px', color: 'var(--tx-3)' }}>No snapshots yet</div>
                          ) : (
                            <div className="responsive-grid-3" style={{ gap: '8px' }}>
                              {client.clientSnapshot.map((snap) => (
                                <div
                                  key={snap.id}
                                  style={{
                                    padding: '8px',
                                    backgroundColor: 'var(--bg-card)',
                                    borderRadius: '4px',
                                    fontSize: '11px',
                                  }}
                                >
                                  <div style={{ fontWeight: 600, marginBottom: '4px' }}>
                                    {snap.platform} • {getMonthName(snap.period)}
                                  </div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--tx-2)' }}>
                                    <span>{formatCurrency(snap.metrics?.ad_spend)}</span>
                                    <span>{formatNumber(snap.metrics?.leads)} leads</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Snapshot Modal */}
      <AddSnapshotModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSave={handleSnapshotAdded}
        clients={clients}
      />
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   MAIN ROUTER
   ──────────────────────────────────────────────────────────────────────────── */

export default function AdPerformancePage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'Administrator' || user?.role === 'Admin';
  const isPreview = typeof window !== 'undefined' && localStorage.getItem('preview_as_client') === 'true';

  if (isAdmin && !isPreview) {
    return <AdminAdDashboard />;
  }

  return <ClientAdDashboard />;
}
