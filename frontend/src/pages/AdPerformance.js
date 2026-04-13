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
  Loader2, AlertCircle, CheckCircle2, Activity, Upload, FileText, Download, Pencil, Trash2
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const tok = () => localStorage.getItem('token');
const ax = () => axios.create({ headers: { Authorization: `Bearer ${tok()}` } });

/* ────────────────────────────────────────────────────────────────────────────
   UTILITIES
   ──────────────────────────────────────────────────────────────────────────── */

const formatCurrency = (val, currency = 'USD') => {
  if (!val && val !== 0) return '—';
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: (currency || 'USD').toUpperCase(),
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(val);
  } catch {
    return `$${Number(val).toFixed(2)}`;
  }
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
  const [downloadingReport, setDownloadingReport] = useState(false);

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
  const currency = summary?.currency || currentMonth?.currency || 'USD';
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

  // Current period for report download (latest snapshot period)
  const latestPeriod = snapshots.length > 0 ? snapshots[0].period : null;

  const handleDownloadReport = async () => {
    if (!clientId || !latestPeriod) return;
    setDownloadingReport(true);
    try {
      const res = await ax().get(`${API}/ad-performance/report/${clientId}/${latestPeriod}`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = res.headers['content-disposition']?.split('filename=')[1]?.replace(/"/g, '') || `AdReport_${latestPeriod}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Report download error:', err);
      toast.error(err.response?.data?.detail || 'Failed to download report');
    } finally {
      setDownloadingReport(false);
    }
  };

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
        {hasData && latestPeriod && (
          <button
            className="btn-ghost"
            onClick={handleDownloadReport}
            disabled={downloadingReport}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            {downloadingReport ? <Loader2 size={14} className="spin" /> : <Download size={14} />}
            {downloadingReport ? 'Generating...' : 'Download Report'}
          </button>
        )}
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
              formattedValue={formatCurrency(currentMonth.ad_spend, currency)}
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
              formattedValue={formatCurrency(currentMonth.cpl, currency)}
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
                      <span style={{ color: 'var(--tx-1)', fontWeight: 600 }}>{formatCurrency(plat.ad_spend, plat.currency || currency)}</span>
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
                      <th>Impr.</th>
                      <th>Reach</th>
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
                        <td>{formatCurrency(snap.metrics?.ad_spend, snap.metrics?.currency || currency)}</td>
                        <td>{formatNumber(snap.metrics?.impressions)}</td>
                        <td>{formatNumber(snap.metrics?.reach)}</td>
                        <td>{formatNumber(snap.metrics?.leads)}</td>
                        <td>{formatCurrency(snap.metrics?.cpl, snap.metrics?.currency || currency)}</td>
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
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvResults, setCsvResults] = useState(null);

  // Parse a CSV line handling quoted fields with commas inside
  const parseCsvLine = (line) => {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') { current += '"'; i++; }
        else if (ch === '"') { inQuotes = false; }
        else { current += ch; }
      } else {
        if (ch === '"') { inQuotes = true; }
        else if (ch === ',') { result.push(current.trim()); current = ''; }
        else { current += ch; }
      }
    }
    result.push(current.trim());
    return result;
  };

  const cleanNumber = (val) => {
    if (!val || val === '') return 0;
    // Strip currency symbols, commas, spaces
    const cleaned = String(val).replace(/[$€£¥,\s]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  };

  const handleCsvImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    const text = await file.text();
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) { toast.error('CSV must have a header row and at least one data row'); return; }

    const headers = parseCsvLine(lines[0]).map(h => h.toLowerCase().replace(/[^a-z0-9_]/g, '_'));
    const rows = lines.slice(1).map(line => {
      const vals = parseCsvLine(line);
      const obj = {};
      headers.forEach((h, i) => { obj[h] = vals[i] || ''; });
      return obj;
    });

    setCsvImporting(true);
    let success = 0, failed = 0;
    const failedRows = [];
    for (let idx = 0; idx < rows.length; idx++) {
      const row = rows[idx];
      // Match client by name (case-insensitive, trimmed)
      const clientName = (row.client || row.client_name || row.client_id || '').trim();
      const client = clients.find(c => c.name?.toLowerCase().trim() === clientName.toLowerCase() || c.id === clientName);
      if (!client) { failed++; failedRows.push(`Row ${idx + 2}: client "${clientName}" not found`); continue; }

      const platform = row.platform || 'Meta';
      const period = row.period || row.month || new Date().toISOString().slice(0, 7);
      const spend = cleanNumber(row.ad_spend || row.spend);
      const leads = cleanNumber(row.leads);
      const clicks = cleanNumber(row.clicks);
      const impressions = cleanNumber(row.impressions);
      const conversions = cleanNumber(row.conversions);
      const roas = cleanNumber(row.roas);

      try {
        await ax().post(`${API}/ad-performance/snapshots`, {
          client_id: client.id,
          platform,
          period: period.slice(0, 7),
          metrics: {
            ad_spend: spend, impressions, clicks, leads, conversions,
            roas: roas || (spend > 0 ? 1 : 0),
            cpl: leads > 0 ? spend / leads : 0,
            ctr: impressions > 0 ? clicks / impressions : 0,
            cpc: clicks > 0 ? spend / clicks : 0,
          },
          campaigns: [],
          notes: row.notes || '',
        });
        success++;
      } catch (err) {
        failed++;
        failedRows.push(`Row ${idx + 2}: ${err.response?.data?.detail || 'API error'}`);
      }
    }
    setCsvImporting(false);
    setCsvResults({ success, failed, total: rows.length });
    if (success > 0) { toast.success(`Imported ${success} of ${rows.length} snapshots`); onSave(); }
    if (failed > 0) {
      const msg = failedRows.length <= 3 ? failedRows.join('; ') : `${failedRows.slice(0, 3).join('; ')} (+${failedRows.length - 3} more)`;
      toast.error(success === 0 ? `All ${failed} rows failed: ${msg}` : `${failed} rows failed: ${msg}`);
    }
  };

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

        {/* CSV Import Section */}
        <div style={{ marginBottom: 16, padding: '12px 14px', background: 'var(--bg-elevated)', borderRadius: 8, border: '1px dashed var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Upload size={14} color="var(--accent)" />
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--tx-1)' }}>Import from CSV</span>
            </div>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 6, background: 'var(--accent)', color: '#fff', fontSize: 11, fontWeight: 600, cursor: csvImporting ? 'wait' : 'pointer', opacity: csvImporting ? 0.6 : 1 }}>
              {csvImporting ? <Loader2 size={12} className="spin" /> : <FileText size={12} />}
              {csvImporting ? 'Importing...' : 'Choose File'}
              <input type="file" accept=".csv" onChange={handleCsvImport} hidden disabled={csvImporting} />
            </label>
          </div>
          <p style={{ fontSize: 11, color: 'var(--tx-3)', margin: 0, lineHeight: 1.5 }}>
            CSV columns: <strong>client</strong>, platform, period (YYYY-MM), ad_spend, impressions, clicks, leads, conversions, roas, notes
          </p>
          {csvResults && (
            <div style={{ marginTop: 8, fontSize: 11, display: 'flex', gap: 10 }}>
              <span style={{ color: '#22c55e', fontWeight: 600 }}>{csvResults.success} imported</span>
              {csvResults.failed > 0 && <span style={{ color: '#ef4444', fontWeight: 600 }}>{csvResults.failed} failed</span>}
            </div>
          )}
        </div>

        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--tx-3)', textAlign: 'center', marginBottom: 12 }}>— or add manually —</div>

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
   IMPORT CSV MODAL — Meta Ads Manager CSV import
   ──────────────────────────────────────────────────────────────────────────── */

function ImportCSVModal({ open, onClose, onSuccess, clients }) {
  const [file, setFile] = useState(null);
  const [clientId, setClientId] = useState('');
  const [period, setPeriod] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    if (f) setFile(f);
  };

  const handleImport = async () => {
    if (!file) { toast.error('Please select a CSV file'); return; }
    if (!clientId) { toast.error('Please select a client'); return; }
    if (!period) { toast.error('Please select a period'); return; }

    setImporting(true);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('client_id', clientId);
      fd.append('period', period);

      const res = await ax().post(`${API}/ad-performance/import-csv`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResult(res.data);
      toast.success(`Imported ${res.data.campaigns_found} campaigns`);
      onSuccess();
    } catch (err) {
      console.error('CSV import error:', err);
      toast.error(err.response?.data?.detail || 'CSV import failed');
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setClientId('');
    setResult(null);
    onClose();
  };

  if (!open) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-box" style={{ maxWidth: '500px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600 }}>Import Meta Ads CSV</h2>
          <button onClick={handleClose} className="btn-ghost btn-sm" style={{ border: 'none', padding: '4px' }}>
            <X size={18} />
          </button>
        </div>

        {result ? (
          /* Success state */
          <div>
            <div style={{ padding: '20px', textAlign: 'center', background: 'var(--bg-elevated)', borderRadius: '8px', marginBottom: '16px' }}>
              <CheckCircle2 size={36} style={{ color: '#22c55e', marginBottom: '8px' }} />
              <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '8px', color: 'var(--tx-1)' }}>Import Successful</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px', textAlign: 'left', maxWidth: '280px', margin: '0 auto' }}>
                <div>
                  <div style={{ color: 'var(--tx-3)', fontSize: '11px' }}>Campaigns</div>
                  <div style={{ fontWeight: 600, color: 'var(--tx-1)' }}>{result.campaigns_found}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--tx-3)', fontSize: '11px' }}>Total Spend</div>
                  <div style={{ fontWeight: 600, color: 'var(--tx-1)' }}>{formatCurrency(result.total_spend)}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--tx-3)', fontSize: '11px' }}>Total Leads</div>
                  <div style={{ fontWeight: 600, color: 'var(--tx-1)' }}>{formatNumber(result.total_leads)}</div>
                </div>
              </div>
            </div>
            {result.warnings?.length > 0 && (
              <div style={{ padding: '10px 12px', background: '#f59e0b12', border: '1px solid #f59e0b30', borderRadius: '6px', marginBottom: '16px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#f59e0b', marginBottom: '4px' }}>Warnings</div>
                {result.warnings.map((w, i) => (
                  <div key={i} style={{ fontSize: '11px', color: 'var(--tx-2)', lineHeight: 1.5 }}>{w}</div>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={handleClose} className="btn-primary">Done</button>
            </div>
          </div>
        ) : (
          /* Upload form */
          <div>
            {/* File upload */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--tx-2)', marginBottom: '4px', display: 'block' }}>
                CSV File
              </label>
              <div
                style={{
                  border: '2px dashed var(--border)',
                  borderRadius: '8px',
                  padding: '20px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  background: file ? 'var(--bg-elevated)' : 'transparent',
                }}
                onClick={() => document.getElementById('csv-import-input').click()}
              >
                {file ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    <FileText size={18} style={{ color: 'var(--accent)' }} />
                    <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--tx-1)' }}>{file.name}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); setFile(null); }}
                      className="btn-ghost btn-xs"
                      style={{ border: 'none', padding: '2px', marginLeft: '4px' }}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <>
                    <Upload size={24} style={{ color: 'var(--tx-3)', marginBottom: '6px' }} />
                    <div style={{ fontSize: '13px', color: 'var(--tx-2)' }}>Click to select a .csv file</div>
                    <div style={{ fontSize: '11px', color: 'var(--tx-3)', marginTop: '2px' }}>Exported from Meta Ads Manager</div>
                  </>
                )}
                <input
                  id="csv-import-input"
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                />
              </div>
            </div>

            {/* Client select */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--tx-2)', marginBottom: '4px', display: 'block' }}>
                Client
              </label>
              <select
                className="input-field"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
              >
                <option value="">Select a client...</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Period picker */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--tx-2)', marginBottom: '4px', display: 'block' }}>
                Period (Month)
              </label>
              <input
                type="month"
                className="input-field"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
              />
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button onClick={handleClose} className="btn-ghost">Cancel</button>
              <button onClick={handleImport} className="btn-primary" disabled={importing}>
                {importing ? <Loader2 size={14} className="spin" /> : <Upload size={14} />}
                {importing ? 'Importing...' : 'Import'}
              </button>
            </div>
          </div>
        )}
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
  const [showImportModal, setShowImportModal] = useState(false);
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
          // Empty state is expected when no snapshots exist
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

  const refreshData = async () => {
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

  const handleSnapshotAdded = async () => {
    setShowAddModal(false);
    await refreshData();
  };

  const handleImportSuccess = async () => {
    await refreshData();
  };

  // Edit/Delete snapshot state
  const [editingSnap, setEditingSnap] = useState(null);
  const [editSnapForm, setEditSnapForm] = useState({});
  const [editSnapSaving, setEditSnapSaving] = useState(false);

  const openEditSnap = (snap) => {
    setEditSnapForm({
      ad_spend: snap.metrics?.ad_spend || 0,
      impressions: snap.metrics?.impressions || 0,
      clicks: snap.metrics?.clicks || 0,
      leads: snap.metrics?.leads || 0,
      cpl: snap.metrics?.cpl || 0,
      ctr: snap.metrics?.ctr || 0,
      notes: snap.notes || '',
    });
    setEditingSnap(snap);
  };

  const saveEditSnap = async () => {
    if (!editingSnap) return;
    setEditSnapSaving(true);
    try {
      await ax().patch(`${API}/ad-performance/snapshots/${editingSnap.id}`, {
        metrics: {
          ad_spend: parseFloat(editSnapForm.ad_spend) || 0,
          impressions: parseInt(editSnapForm.impressions) || 0,
          clicks: parseInt(editSnapForm.clicks) || 0,
          leads: parseInt(editSnapForm.leads) || 0,
          cpl: parseFloat(editSnapForm.cpl) || 0,
          ctr: parseFloat(editSnapForm.ctr) || 0,
        },
        notes: editSnapForm.notes || null,
      });
      toast.success('Snapshot updated');
      setEditingSnap(null);
      refreshData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update snapshot');
    } finally { setEditSnapSaving(false); }
  };

  const deleteSnapshot = async (snap) => {
    if (!window.confirm(`Delete snapshot for ${snap.client_name} — ${snap.period}? This cannot be undone.`)) return;
    try {
      await ax().delete(`${API}/ad-performance/snapshots/${snap.id}`);
      toast.success('Snapshot deleted');
      refreshData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to delete snapshot');
    }
  };

  const [downloadingReportFor, setDownloadingReportFor] = useState(null);

  const handleDownloadClientReport = async (clientId, clientName) => {
    // Find the latest period for this client from snapshots
    const clientSnaps = snapshots.filter(s => s.client_id === clientId);
    if (clientSnaps.length === 0) {
      toast.error('No snapshot data for this client');
      return;
    }
    const latestPeriod = clientSnaps.sort((a, b) => b.period.localeCompare(a.period))[0].period;

    setDownloadingReportFor(clientId);
    try {
      const res = await ax().get(`${API}/ad-performance/report/${clientId}/${latestPeriod}`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = res.headers['content-disposition']?.split('filename=')[1]?.replace(/"/g, '') || `AdReport_${clientName}_${latestPeriod}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Report download error:', err);
      toast.error(err.response?.data?.detail || 'Failed to download report');
    } finally {
      setDownloadingReportFor(null);
    }
  };

  const [generatingAll, setGeneratingAll] = useState(false);

  const handleGenerateAllReports = async () => {
    setGeneratingAll(true);
    try {
      const res = await ax().post(`${API}/ad-performance/reports/generate-all`, {});
      toast.success(`Generated ${res.data.reports_generated} report(s)`);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to generate reports');
    } finally {
      setGeneratingAll(false);
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
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={handleGenerateAllReports}
            disabled={generatingAll}
            className="btn-ghost"
          >
            {generatingAll ? <Loader2 size={14} className="spin" /> : <FileText size={14} />}
            {generatingAll ? 'Generating...' : 'Generate All Reports'}
          </button>
          <button
            onClick={() => setShowImportModal(true)}
            className="btn-ghost"
          >
            <Upload size={16} /> Import CSV
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="btn-primary"
          >
            <Plus size={16} /> Add Snapshot
          </button>
        </div>
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
                            <>
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
                                    <div style={{ display: 'flex', gap: 4, marginTop: 6, justifyContent: 'flex-end' }}>
                                      <button onClick={(e) => { e.stopPropagation(); openEditSnap(snap); }}
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', padding: 2 }}>
                                        <Pencil size={11} />
                                      </button>
                                      <button onClick={(e) => { e.stopPropagation(); deleteSnapshot(snap); }}
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 2 }}>
                                        <Trash2 size={11} />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                              <button
                                className="btn-ghost btn-sm"
                                onClick={(e) => { e.stopPropagation(); handleDownloadClientReport(client.client_id, client.client_name); }}
                                disabled={downloadingReportFor === client.client_id}
                                style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px' }}
                              >
                                {downloadingReportFor === client.client_id
                                  ? <><Loader2 size={12} className="spin" /> Generating...</>
                                  : <><Download size={12} /> Download Report</>
                                }
                              </button>
                            </>
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

      {/* Edit Snapshot Modal */}
      {editingSnap && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth: 440 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Edit Snapshot</h2>
              <button onClick={() => setEditingSnap(null)} className="btn-ghost btn-sm" style={{ border: 'none', padding: 4 }}><X size={18} /></button>
            </div>
            <div style={{ fontSize: 12, color: 'var(--tx-3)', marginBottom: 16, display: 'flex', gap: 8 }}>
              <span className="pill pill-gray">{editingSnap.platform}</span>
              <span className="pill pill-gray">{getMonthName(editingSnap.period)}</span>
              <span style={{ color: 'var(--tx-2)' }}>{editingSnap.client_name}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              {[
                { key: 'ad_spend', label: 'Ad Spend ($)', type: 'number', step: '0.01' },
                { key: 'impressions', label: 'Impressions', type: 'number', step: '1' },
                { key: 'clicks', label: 'Clicks', type: 'number', step: '1' },
                { key: 'leads', label: 'Leads', type: 'number', step: '1' },
                { key: 'cpl', label: 'CPL ($)', type: 'number', step: '0.01' },
                { key: 'ctr', label: 'CTR (%)', type: 'number', step: '0.01' },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--tx-2)', display: 'block', marginBottom: 4 }}>{f.label}</label>
                  <input className="input-field" type={f.type} step={f.step}
                    value={editSnapForm[f.key] ?? ''} onChange={e => setEditSnapForm(p => ({ ...p, [f.key]: e.target.value }))} />
                </div>
              ))}
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--tx-2)', display: 'block', marginBottom: 4 }}>Notes</label>
              <textarea className="input-field" rows={2} value={editSnapForm.notes || ''} onChange={e => setEditSnapForm(p => ({ ...p, notes: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setEditingSnap(null)} className="btn-ghost">Cancel</button>
              <button onClick={saveEditSnap} className="btn-primary" disabled={editSnapSaving}>
                {editSnapSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Snapshot Modal */}
      <AddSnapshotModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSave={handleSnapshotAdded}
        clients={clients}
      />

      {/* Import CSV Modal */}
      <ImportCSVModal
        open={showImportModal}
        onClose={() => setShowImportModal(false)}
        onSuccess={handleImportSuccess}
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
