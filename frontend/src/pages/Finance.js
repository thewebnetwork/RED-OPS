import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import {
  DollarSign, TrendingUp, TrendingDown, Plus, Search, RefreshCw, Loader2,
  ArrowUpDown, Pencil, Trash2, X, Calendar, Receipt, PiggyBank, Wallet,
  ChevronLeft, ChevronRight, Download, Filter,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const tok = () => localStorage.getItem('token');
const ax = () => axios.create({ headers: { Authorization: `Bearer ${tok()}` } });

const fmt = (n) => {
  if (n == null) return '$0';
  return '$' + Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const fmtDate = (d) => {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[parseInt(m)-1]} ${parseInt(day)}, ${y}`;
};

const monthLabel = (ym) => {
  if (!ym) return '';
  const [y, m] = ym.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[parseInt(m)-1]} ${y}`;
};

// ── Transaction Form ────────────────────────────────────────────────────────

function TransactionDialog({ tx, categories, clients, onSave, onClose, saving }) {
  const isEdit = !!tx?.id;
  const [form, setForm] = useState({
    type: tx?.type || 'income',
    category: tx?.category || '',
    description: tx?.description || '',
    amount: tx?.amount || '',
    date: tx?.date || new Date().toISOString().slice(0, 10),
    client_id: tx?.client_id || '',
    client_name: tx?.client_name || '',
    reference: tx?.reference || '',
    recurring: tx?.recurring || false,
    recurring_interval: tx?.recurring_interval || 'monthly',
    notes: tx?.notes || '',
  });
  const [customCat, setCustomCat] = useState('');

  const cats = form.type === 'income' ? (categories?.income || []) : (categories?.expense || []);

  const handleClientSelect = (cid) => {
    const c = clients.find(cl => (cl.id || cl._id) === cid);
    setForm(f => ({ ...f, client_id: cid, client_name: c?.name || '' }));
  };

  const handleSubmit = () => {
    const cat = form.category === '__custom__' ? customCat.trim() : form.category;
    if (!cat) return toast.error('Category is required');
    if (!form.description.trim()) return toast.error('Description is required');
    if (!form.amount || Number(form.amount) <= 0) return toast.error('Amount must be greater than 0');
    if (!form.date) return toast.error('Date is required');
    onSave({ ...form, category: cat, amount: Number(form.amount) });
  };

  const lblStyle = { display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--tx-3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.04em' };
  const inpStyle = { width: '100%', padding: '8px 10px', fontSize: 13, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--tx-1)', outline: 'none', boxSizing: 'border-box' };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }} />
      <div style={{ position: 'relative', width: 520, maxHeight: '85vh', overflowY: 'auto', background: 'var(--bg-card)', borderRadius: 14, border: '1px solid var(--border)', padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--tx-1)' }}>{isEdit ? 'Edit Transaction' : 'Add Transaction'}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx-3)', padding: 4 }}><X size={18} /></button>
        </div>

        {/* Type toggle */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {['income', 'expense'].map(t => (
            <button key={t} onClick={() => setForm(f => ({ ...f, type: t, category: '' }))}
              style={{
                flex: 1, padding: '10px 0', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', border: '1px solid var(--border)', textTransform: 'capitalize',
                background: form.type === t ? (t === 'income' ? '#22c55e' : '#ef4444') : 'var(--bg-elevated)',
                color: form.type === t ? '#fff' : 'var(--tx-2)',
              }}>
              {t === 'income' ? <TrendingUp size={13} style={{ marginRight: 6, verticalAlign: -2 }} /> : <TrendingDown size={13} style={{ marginRight: 6, verticalAlign: -2 }} />}
              {t}
            </button>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={lblStyle}>Category *</label>
            <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} style={inpStyle}>
              <option value="">Select...</option>
              {cats.map(c => <option key={c} value={c}>{c}</option>)}
              <option value="__custom__">+ Custom</option>
            </select>
            {form.category === '__custom__' && (
              <input style={{ ...inpStyle, marginTop: 6 }} placeholder="Custom category" value={customCat} onChange={e => setCustomCat(e.target.value)} autoFocus />
            )}
          </div>
          <div>
            <label style={lblStyle}>Amount *</label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--tx-3)', fontSize: 13, fontWeight: 700 }}>$</span>
              <input type="number" step="0.01" min="0" style={{ ...inpStyle, paddingLeft: 24 }} value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" />
            </div>
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={lblStyle}>Description *</label>
          <input style={inpStyle} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="e.g. Monthly retainer payment from Acme Corp" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={lblStyle}>Date *</label>
            <input type="date" style={inpStyle} value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
          </div>
          <div>
            <label style={lblStyle}>Client (optional)</label>
            <select style={inpStyle} value={form.client_id} onChange={e => handleClientSelect(e.target.value)}>
              <option value="">No client</option>
              {clients.map(c => <option key={c.id || c._id} value={c.id || c._id}>{c.name}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={lblStyle}>Reference / Invoice #</label>
            <input style={inpStyle} value={form.reference} onChange={e => setForm(f => ({ ...f, reference: e.target.value }))} placeholder="INV-001" />
          </div>
          <div>
            <label style={lblStyle}>Recurring</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button onClick={() => setForm(f => ({ ...f, recurring: !f.recurring }))}
                style={{
                  padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  background: form.recurring ? 'var(--red)' : 'var(--bg-elevated)',
                  color: form.recurring ? '#fff' : 'var(--tx-3)',
                  border: '1px solid var(--border)',
                }}>
                {form.recurring ? 'Yes' : 'No'}
              </button>
              {form.recurring && (
                <select style={{ ...inpStyle, width: 'auto' }} value={form.recurring_interval} onChange={e => setForm(f => ({ ...f, recurring_interval: e.target.value }))}>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="yearly">Yearly</option>
                </select>
              )}
            </div>
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={lblStyle}>Notes</label>
          <textarea style={{ ...inpStyle, minHeight: 60, resize: 'vertical' }} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional notes..." />
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: 'var(--bg-elevated)', color: 'var(--tx-2)', border: '1px solid var(--border)' }}>Cancel</button>
          <button onClick={handleSubmit} disabled={saving}
            style={{ padding: '9px 22px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', background: form.type === 'income' ? '#22c55e' : '#ef4444', color: '#fff', border: 'none', opacity: saving ? 0.6 : 1, display: 'flex', alignItems: 'center', gap: 6 }}>
            {saving && <Loader2 size={13} className="spin" />}
            {isEdit ? 'Save Changes' : 'Add Transaction'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Sort Header ─────────────────────────────────────────────────────────────

function SortHeader({ label, sortKey, sort, setSort }) {
  const active = sort.key === sortKey;
  return (
    <button
      onClick={() => setSort(s => ({ key: sortKey, dir: s.key === sortKey && s.dir === 'asc' ? 'desc' : 'asc' }))}
      style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', color: active ? 'var(--red)' : 'inherit', fontSize: 'inherit', fontWeight: 'inherit', textTransform: 'inherit', letterSpacing: 'inherit', padding: 0 }}
    >
      {label} <ArrowUpDown size={10} style={{ opacity: active ? 1 : 0.3 }} />
    </button>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────────

export default function Finance() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [totalTx, setTotalTx] = useState(0);
  const [categories, setCategories] = useState({ income: [], expense: [] });
  const [clients, setClients] = useState([]);

  const [period, setPeriod] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTx, setEditingTx] = useState(null);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('');
  const [sort, setSort] = useState({ key: 'date', dir: 'desc' });

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [sumRes, txRes, catRes, usersRes] = await Promise.allSettled([
        ax().get(`${API}/finance/summary`, { params: { period } }),
        ax().get(`${API}/finance/transactions`, { params: { date_from: `${period}-01`, date_to: `${period}-31` } }),
        ax().get(`${API}/finance/categories`),
        ax().get(`${API}/users`),
      ]);
      if (sumRes.status === 'fulfilled') setSummary(sumRes.value.data);
      if (txRes.status === 'fulfilled') {
        setTransactions(txRes.value.data.items || []);
        setTotalTx(txRes.value.data.total || 0);
      }
      if (catRes.status === 'fulfilled') setCategories(catRes.value.data);
      if (usersRes.status === 'fulfilled') {
        const all = Array.isArray(usersRes.value.data) ? usersRes.value.data : usersRes.value.data?.items || [];
        setClients(all.filter(u => u.account_type === 'Media Client'));
      }
    } catch { toast.error('Failed to load financial data'); }
    finally { setLoading(false); }
  }, [period]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleSave = async (data) => {
    setSaving(true);
    try {
      if (editingTx?.id) {
        await ax().patch(`${API}/finance/transactions/${editingTx.id}`, data);
        toast.success('Transaction updated');
      } else {
        await ax().post(`${API}/finance/transactions`, data);
        toast.success('Transaction added');
      }
      setDialogOpen(false);
      setEditingTx(null);
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save');
    } finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this transaction?')) return;
    try {
      await ax().delete(`${API}/finance/transactions/${id}`);
      toast.success('Deleted');
      fetchAll();
    } catch { toast.error('Failed to delete'); }
  };

  const shiftPeriod = (dir) => {
    const [y, m] = period.split('-').map(Number);
    const d = new Date(y, m - 1 + dir, 1);
    setPeriod(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  const exportCSV = () => {
    const rows = [['Date','Type','Category','Description','Amount','Client','Reference','Recurring','Notes']];
    filtered.forEach(t => rows.push([t.date, t.type, t.category, t.description, t.amount, t.client_name || '', t.reference || '', t.recurring ? 'Yes' : '', t.notes || '']));
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `finance-${period}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  // Filter + sort
  const filtered = transactions
    .filter(t => {
      if (filterType && t.type !== filterType) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (t.description?.toLowerCase().includes(q) || t.category?.toLowerCase().includes(q) || t.client_name?.toLowerCase().includes(q) || t.reference?.toLowerCase().includes(q));
      }
      return true;
    })
    .sort((a, b) => {
      const dir = sort.dir === 'asc' ? 1 : -1;
      switch (sort.key) {
        case 'date': return dir * (a.date || '').localeCompare(b.date || '');
        case 'amount': return dir * ((a.amount || 0) - (b.amount || 0));
        case 'category': return dir * (a.category || '').localeCompare(b.category || '');
        case 'description': return dir * (a.description || '').localeCompare(b.description || '');
        case 'type': return dir * (a.type || '').localeCompare(b.type || '');
        default: return 0;
      }
    });

  const income = summary?.income || 0;
  const expenses = summary?.expenses || 0;
  const net = summary?.net || 0;
  const ytdNet = summary?.ytd_net || 0;
  const trend = summary?.monthly_trend || [];

  if (loading) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, color: 'var(--tx-3)' }}>
          <div className="spinner-ring" />
          <p style={{ fontSize: 13 }}>Loading finances...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)', padding: '24px 28px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--tx-1)', margin: 0 }}>Finance Dashboard</h1>
          <p style={{ margin: '3px 0 0', fontSize: 13, color: 'var(--tx-3)' }}>Track income, expenses, and profitability</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Period Nav */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 2, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '2px 4px' }}>
            <button onClick={() => shiftPeriod(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, color: 'var(--tx-3)', display: 'flex' }}><ChevronLeft size={16} /></button>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--tx-1)', minWidth: 90, textAlign: 'center' }}>{monthLabel(period)}</span>
            <button onClick={() => shiftPeriod(1)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, color: 'var(--tx-3)', display: 'flex' }}><ChevronRight size={16} /></button>
          </div>
          <button onClick={exportCSV} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', fontSize: 12, fontWeight: 600, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--tx-2)', cursor: 'pointer' }}>
            <Download size={13} /> Export
          </button>
          <button onClick={() => { setEditingTx(null); setDialogOpen(true); }}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', fontSize: 12, fontWeight: 700, borderRadius: 8, background: 'var(--red)', color: '#fff', border: 'none', cursor: 'pointer' }}>
            <Plus size={14} /> Add Transaction
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 14, marginBottom: 24 }}>
        <div style={{ padding: '18px 20px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: '#22c55e18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><TrendingUp size={16} color="#22c55e" /></div>
            <span style={{ fontSize: 11, color: 'var(--tx-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>Income</span>
          </div>
          <p style={{ margin: 0, fontSize: 26, fontWeight: 800, color: '#22c55e', lineHeight: 1 }}>{fmt(income)}</p>
          <span style={{ fontSize: 11, color: 'var(--tx-3)', marginTop: 4, display: 'block' }}>{monthLabel(period)}</span>
        </div>

        <div style={{ padding: '18px 20px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: '#ef444418', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><TrendingDown size={16} color="#ef4444" /></div>
            <span style={{ fontSize: 11, color: 'var(--tx-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>Expenses</span>
          </div>
          <p style={{ margin: 0, fontSize: 26, fontWeight: 800, color: '#ef4444', lineHeight: 1 }}>{fmt(expenses)}</p>
          <span style={{ fontSize: 11, color: 'var(--tx-3)', marginTop: 4, display: 'block' }}>{monthLabel(period)}</span>
        </div>

        <div style={{ padding: '18px 20px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: net >= 0 ? '#22c55e18' : '#ef444418', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Wallet size={16} color={net >= 0 ? '#22c55e' : '#ef4444'} /></div>
            <span style={{ fontSize: 11, color: 'var(--tx-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>Net Profit</span>
          </div>
          <p style={{ margin: 0, fontSize: 26, fontWeight: 800, color: net >= 0 ? '#22c55e' : '#ef4444', lineHeight: 1 }}>{fmt(net)}</p>
          <span style={{ fontSize: 11, color: 'var(--tx-3)', marginTop: 4, display: 'block' }}>{monthLabel(period)}</span>
        </div>

        <div style={{ padding: '18px 20px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: '#6366f118', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><PiggyBank size={16} color="#6366f1" /></div>
            <span style={{ fontSize: 11, color: 'var(--tx-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>YTD Net</span>
          </div>
          <p style={{ margin: 0, fontSize: 26, fontWeight: 800, color: ytdNet >= 0 ? '#22c55e' : '#ef4444', lineHeight: 1 }}>{fmt(ytdNet)}</p>
          <span style={{ fontSize: 11, color: 'var(--tx-3)', marginTop: 4, display: 'block' }}>Year to date</span>
        </div>
      </div>

      {/* Chart + Category Breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14, marginBottom: 24 }}>
        {/* Revenue vs Expenses Chart */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 700, color: 'var(--tx-1)' }}>Monthly Trend</h3>
          {trend.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={trend} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month" tickFormatter={m => m?.slice(5)} tick={{ fontSize: 11, fill: 'var(--tx-3)' }} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--tx-3)' }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                  formatter={(value) => fmt(value)}
                  labelFormatter={monthLabel}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="income" name="Income" fill="#22c55e" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expense" name="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--tx-3)', fontSize: 13 }}>
              No data yet — add transactions to see trends
            </div>
          )}
        </div>

        {/* Category Breakdown */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 700, color: 'var(--tx-1)' }}>Breakdown by Category</h3>
          {(summary?.categories || []).length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(summary?.categories || []).slice(0, 8).map((c, i) => {
                const maxAmt = Math.max(...(summary?.categories || []).map(x => x.total));
                const pct = maxAmt > 0 ? (c.total / maxAmt) * 100 : 0;
                const isIncome = c.type === 'income';
                return (
                  <div key={i}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                      <span style={{ color: 'var(--tx-2)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: isIncome ? '#22c55e' : '#ef4444' }} />
                        {c.category}
                      </span>
                      <span style={{ fontWeight: 700, color: isIncome ? '#22c55e' : '#ef4444' }}>{fmt(c.total)}</span>
                    </div>
                    <div style={{ height: 4, borderRadius: 2, background: 'var(--bg-elevated)' }}>
                      <div style={{ height: '100%', borderRadius: 2, width: `${pct}%`, background: isIncome ? '#22c55e' : '#ef4444', transition: 'width 0.3s' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--tx-3)', fontSize: 13 }}>
              No categories yet
            </div>
          )}
        </div>
      </div>

      {/* Transactions Table */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        {/* Table Header */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--tx-1)' }}>Transactions</h3>
            <span style={{ fontSize: 11, color: 'var(--tx-3)', background: 'var(--bg-elevated)', padding: '2px 8px', borderRadius: 10, fontWeight: 600 }}>{filtered.length}</span>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ position: 'relative' }}>
              <Search size={13} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--tx-3)' }} />
              <input
                value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search..."
                style={{ paddingLeft: 28, paddingRight: 10, paddingTop: 6, paddingBottom: 6, fontSize: 12, borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--tx-1)', outline: 'none', width: 160 }}
              />
            </div>
            <select value={filterType} onChange={e => setFilterType(e.target.value)}
              style={{ padding: '6px 10px', fontSize: 12, borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--tx-2)', cursor: 'pointer', outline: 'none' }}>
              <option value="">All Types</option>
              <option value="income">Income</option>
              <option value="expense">Expenses</option>
            </select>
          </div>
        </div>

        {/* Column Headers */}
        <div style={{
          display: 'grid', gridTemplateColumns: '100px 2fr 140px 120px 120px 80px',
          padding: '8px 16px', fontSize: 11, fontWeight: 700, color: 'var(--tx-3)',
          textTransform: 'uppercase', letterSpacing: '.06em', borderBottom: '1px solid var(--border)',
          background: 'var(--bg-elevated)',
        }}>
          <SortHeader label="Date" sortKey="date" sort={sort} setSort={setSort} />
          <SortHeader label="Description" sortKey="description" sort={sort} setSort={setSort} />
          <SortHeader label="Category" sortKey="category" sort={sort} setSort={setSort} />
          <SortHeader label="Type" sortKey="type" sort={sort} setSort={setSort} />
          <SortHeader label="Amount" sortKey="amount" sort={sort} setSort={setSort} />
          <span />
        </div>

        {/* Rows */}
        {filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <Receipt size={32} style={{ color: 'var(--tx-3)', marginBottom: 8, opacity: 0.4 }} />
            <p style={{ fontSize: 13, color: 'var(--tx-3)', margin: '0 0 12px' }}>
              {transactions.length === 0 ? 'No transactions yet for this month' : 'No transactions match your filters'}
            </p>
            {transactions.length === 0 && (
              <button onClick={() => { setEditingTx(null); setDialogOpen(true); }}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '8px 16px', fontSize: 12, fontWeight: 700, borderRadius: 8, background: 'var(--red)', color: '#fff', border: 'none', cursor: 'pointer' }}>
                <Plus size={13} /> Add First Transaction
              </button>
            )}
          </div>
        ) : (
          filtered.map(tx => (
            <div
              key={tx.id}
              style={{
                display: 'grid', gridTemplateColumns: '100px 2fr 140px 120px 120px 80px',
                padding: '10px 16px', borderBottom: '1px solid var(--border)',
                alignItems: 'center', transition: 'background 0.1s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-elevated)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              {/* Date */}
              <span style={{ fontSize: 12, color: 'var(--tx-2)' }}>{fmtDate(tx.date)}</span>

              {/* Description */}
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--tx-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.description}</div>
                {(tx.client_name || tx.reference) && (
                  <div style={{ fontSize: 11, color: 'var(--tx-3)', marginTop: 1 }}>
                    {tx.client_name && <span>{tx.client_name}</span>}
                    {tx.client_name && tx.reference && <span> · </span>}
                    {tx.reference && <span>{tx.reference}</span>}
                  </div>
                )}
              </div>

              {/* Category */}
              <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 6, background: tx.type === 'income' ? '#22c55e18' : '#ef444418', color: tx.type === 'income' ? '#22c55e' : '#ef4444', display: 'inline-block', maxWidth: 'fit-content' }}>
                {tx.category}
              </span>

              {/* Type */}
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: tx.type === 'income' ? '#22c55e' : '#ef4444', display: 'flex', alignItems: 'center', gap: 4 }}>
                {tx.type === 'income' ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                {tx.type}
                {tx.recurring && <span style={{ fontSize: 9, background: 'var(--bg-elevated)', padding: '1px 4px', borderRadius: 3, color: 'var(--tx-3)', fontWeight: 600, textTransform: 'none' }}>recurring</span>}
              </span>

              {/* Amount */}
              <span style={{ fontSize: 13, fontWeight: 700, color: tx.type === 'income' ? '#22c55e' : '#ef4444' }}>
                {tx.type === 'income' ? '+' : '-'}{fmt(tx.amount)}
              </span>

              {/* Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
                <button
                  onClick={() => { setEditingTx(tx); setDialogOpen(true); }}
                  style={{ padding: 4, borderRadius: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx-3)', display: 'flex' }}
                ><Pencil size={13} /></button>
                <button
                  onClick={() => handleDelete(tx.id)}
                  style={{ padding: 4, borderRadius: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx-3)', display: 'flex' }}
                ><Trash2 size={13} /></button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Top Clients */}
      {(summary?.top_clients || []).length > 0 && (
        <div style={{ marginTop: 14, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: 'var(--tx-1)' }}>Top Clients by Revenue</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
            {(summary?.top_clients || []).map((c, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--bg-elevated)', borderRadius: 8 }}>
                <span style={{ width: 28, height: 28, borderRadius: '50%', background: '#22c55e18', color: '#22c55e', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {c.name?.charAt(0)?.toUpperCase()}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--tx-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#22c55e' }}>{fmt(c.revenue)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dialog */}
      {dialogOpen && (
        <TransactionDialog
          tx={editingTx}
          categories={categories}
          clients={clients}
          onSave={handleSave}
          onClose={() => { setDialogOpen(false); setEditingTx(null); }}
          saving={saving}
        />
      )}
    </div>
  );
}
