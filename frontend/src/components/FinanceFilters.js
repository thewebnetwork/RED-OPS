/**
 * FinanceFilters — universal filter bar reused across the ledger,
 * income breakdown, expense breakdown, and contractor pages.
 *
 * Controlled component: pass { value, onChange }. The value is a flat
 * object — easy to serialize to URL params if a parent wants to.
 *
 * Active filters render as removable chips below the bar.
 */
import { useState, useEffect, useRef } from 'react';
import { Calendar, Filter, X, Search, ChevronDown } from 'lucide-react';

const PERIODS = [
  { id: 'this_month',    label: 'This month' },
  { id: 'last_month',    label: 'Last month' },
  { id: 'this_quarter',  label: 'This quarter' },
  { id: 'last_quarter',  label: 'Last quarter' },
  { id: 'this_year',     label: 'This year' },
  { id: 'last_year',     label: 'Last year' },
  { id: 'all',           label: 'All time' },
  { id: 'custom',        label: 'Custom…' },
];

const TYPES = [
  { id: 'all',     label: 'All' },
  { id: 'income',  label: 'Income' },
  { id: 'expense', label: 'Expense' },
];

export const DEFAULT_FILTERS = {
  period: 'this_month',
  date_from: '',
  date_to: '',
  type: 'all',
  categories: [],   // multi-select
  account: 'all',   // bank | wise | stripe | manual | all
  currency: 'all',  // CAD | USD | BRL | all
  status: 'all',    // paid | pending | all (for invoices later)
  search: '',
};

export default function FinanceFilters({ value, onChange, categories = [], accounts = ['bank', 'wise', 'stripe', 'manual'] }) {
  const v = { ...DEFAULT_FILTERS, ...value };
  const set = (patch) => onChange({ ...v, ...patch });
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Active filter count for the badge
  const activeCount = [
    v.period !== 'this_month',
    v.type !== 'all',
    v.categories.length > 0,
    v.account !== 'all',
    v.currency !== 'all',
    v.status !== 'all',
    !!v.search,
    v.period === 'custom' && (v.date_from || v.date_to),
  ].filter(Boolean).length;

  const resetAll = () => onChange(DEFAULT_FILTERS);

  return (
    <div style={{ marginBottom: 14 }}>
      {/* Top bar: search + period + type + advanced toggle */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 220px', minWidth: 180 }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--tx-3)', pointerEvents: 'none' }} />
          <input
            value={v.search}
            onChange={e => set({ search: e.target.value })}
            placeholder="Search description, reference…"
            style={{
              width: '100%', padding: '7px 10px 7px 30px',
              fontSize: 12.5, borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--bg-elevated)', color: 'var(--tx-1)', outline: 'none',
            }}
          />
        </div>

        <Pill
          icon={Calendar}
          label={PERIODS.find(p => p.id === v.period)?.label || 'This month'}
        >
          <select
            value={v.period}
            onChange={e => set({ period: e.target.value })}
            style={selectStyle}
          >
            {PERIODS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </Pill>

        {v.period === 'custom' && (
          <>
            <input type="date" value={v.date_from} onChange={e => set({ date_from: e.target.value })} style={dateInput} />
            <span style={{ color: 'var(--tx-3)', fontSize: 11 }}>→</span>
            <input type="date" value={v.date_to} onChange={e => set({ date_to: e.target.value })} style={dateInput} />
          </>
        )}

        <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
          {TYPES.map(t => (
            <button
              key={t.id}
              onClick={() => set({ type: t.id })}
              style={{
                padding: '6px 12px', fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
                background: v.type === t.id ? 'var(--accent)' : 'var(--bg-elevated)',
                color: v.type === t.id ? '#fff' : 'var(--tx-3)',
                border: 'none', borderRight: t.id !== 'expense' ? '1px solid var(--border)' : 'none',
              }}
            >{t.label}</button>
          ))}
        </div>

        <button
          onClick={() => setShowAdvanced(s => !s)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '6px 12px', fontSize: 12, fontWeight: 600,
            borderRadius: 8, border: '1px solid var(--border)',
            background: showAdvanced || activeCount > 0 ? 'var(--accent-soft)' : 'var(--bg-elevated)',
            color: showAdvanced || activeCount > 0 ? 'var(--accent)' : 'var(--tx-3)',
            cursor: 'pointer',
          }}
        >
          <Filter size={12} /> Filters {activeCount > 0 && <span style={{ fontWeight: 800 }}>({activeCount})</span>}
        </button>

        {activeCount > 0 && (
          <button
            onClick={resetAll}
            style={{
              fontSize: 12, fontWeight: 600, color: 'var(--red-status)',
              background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px',
            }}
          >Clear all</button>
        )}
      </div>

      {/* Advanced row */}
      {showAdvanced && (
        <div style={{
          marginTop: 10, padding: '12px 14px',
          background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10,
          display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center',
        }}>
          {/* Categories multi-select */}
          <CategoryPicker
            value={v.categories}
            options={categories}
            onChange={(next) => set({ categories: next })}
          />

          <Field label="Source">
            <select value={v.account} onChange={e => set({ account: e.target.value })} style={selectStyle}>
              <option value="all">All sources</option>
              {accounts.map(a => <option key={a} value={a}>{a[0].toUpperCase() + a.slice(1)}</option>)}
            </select>
          </Field>

          <Field label="Currency">
            <select value={v.currency} onChange={e => set({ currency: e.target.value })} style={selectStyle}>
              <option value="all">All</option>
              <option value="CAD">CAD</option>
              <option value="USD">USD</option>
              <option value="BRL">BRL</option>
            </select>
          </Field>

          <Field label="Status">
            <select value={v.status} onChange={e => set({ status: e.target.value })} style={selectStyle}>
              <option value="all">All</option>
              <option value="paid">Paid</option>
              <option value="pending">Pending</option>
            </select>
          </Field>
        </div>
      )}

      {/* Active chips */}
      {activeCount > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
          {v.period !== 'this_month' && (
            <Chip label={`Period: ${PERIODS.find(p => p.id === v.period)?.label}`} onRemove={() => set({ period: 'this_month', date_from: '', date_to: '' })} />
          )}
          {v.type !== 'all' && (
            <Chip label={`Type: ${v.type}`} onRemove={() => set({ type: 'all' })} />
          )}
          {v.categories.map(c => (
            <Chip key={c} label={c} onRemove={() => set({ categories: v.categories.filter(x => x !== c) })} />
          ))}
          {v.account !== 'all' && <Chip label={`Source: ${v.account}`} onRemove={() => set({ account: 'all' })} />}
          {v.currency !== 'all' && <Chip label={`Currency: ${v.currency}`} onRemove={() => set({ currency: 'all' })} />}
          {v.status !== 'all' && <Chip label={`Status: ${v.status}`} onRemove={() => set({ status: 'all' })} />}
          {v.search && <Chip label={`Search: "${v.search}"`} onRemove={() => set({ search: '' })} />}
        </div>
      )}
    </div>
  );
}

// ── Sub-components ──
function Pill({ icon: Icon, label, children }) {
  // children = the actual <select> rendered transparently behind the pill chrome
  return (
    <label style={{
      position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '6px 10px', fontSize: 12, fontWeight: 600,
      background: 'var(--bg-elevated)', color: 'var(--tx-2)',
      border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer',
    }}>
      <Icon size={12} style={{ color: 'var(--tx-3)' }} />
      <span>{label}</span>
      <ChevronDown size={11} style={{ color: 'var(--tx-3)' }} />
      <div style={{ position: 'absolute', inset: 0, opacity: 0 }}>{children}</div>
    </label>
  );
}

function Field({ label, children }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</span>
      {children}
    </label>
  );
}

function CategoryPicker({ value = [], options = [], onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const toggle = (cat) => {
    onChange(value.includes(cat) ? value.filter(c => c !== cat) : [...value, cat]);
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <Field label="Categories">
        <button
          onClick={() => setOpen(o => !o)}
          style={{
            ...selectStyle, minWidth: 180, textAlign: 'left',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'space-between',
            cursor: 'pointer',
          }}
        >
          <span>{value.length === 0 ? 'All categories' : `${value.length} selected`}</span>
          <ChevronDown size={11} style={{ color: 'var(--tx-3)' }} />
        </button>
      </Field>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, marginTop: 4,
          zIndex: 50, minWidth: 240, maxHeight: 280, overflowY: 'auto',
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.4)', padding: 6,
        }}>
          {options.map(c => {
            const on = value.includes(c);
            return (
              <button key={c}
                onClick={() => toggle(c)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                  padding: '7px 9px', fontSize: 12, color: 'var(--tx-1)',
                  background: on ? 'var(--accent-soft)' : 'none',
                  border: 'none', cursor: 'pointer', textAlign: 'left', borderRadius: 6,
                }}>
                <span style={{
                  width: 14, height: 14, borderRadius: 4, border: '1px solid var(--border-hi)',
                  background: on ? 'var(--accent)' : 'transparent',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontSize: 10, flexShrink: 0,
                }}>{on && '✓'}</span>
                {c}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Chip({ label, onRemove }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 4px 3px 10px', fontSize: 11.5, fontWeight: 600,
      background: 'var(--accent-soft)', color: 'var(--accent)',
      border: '1px solid var(--border)', borderRadius: 12,
    }}>
      {label}
      <button onClick={onRemove} style={{
        background: 'none', border: 'none', cursor: 'pointer',
        color: 'var(--accent)', padding: 2, display: 'flex',
      }}>
        <X size={10} />
      </button>
    </span>
  );
}

const selectStyle = {
  padding: '5px 10px', fontSize: 12,
  background: 'var(--bg-elevated)', color: 'var(--tx-1)',
  border: '1px solid var(--border)', borderRadius: 6, outline: 'none',
};

const dateInput = {
  padding: '6px 8px', fontSize: 12,
  background: 'var(--bg-elevated)', color: 'var(--tx-1)',
  border: '1px solid var(--border)', borderRadius: 8, outline: 'none',
  colorScheme: 'dark',
};


// ── Helper: turn a filter value into a predicate for in-memory filtering ──
export function filterTransactions(txs, f) {
  if (!f) return txs;
  const { period, date_from, date_to, type, categories, account, currency, search } = { ...DEFAULT_FILTERS, ...f };
  const range = computeDateRange(period, date_from, date_to);

  return (txs || []).filter(t => {
    if (range && t.date) {
      const d = (t.date || '').slice(0, 10);
      if (range.from && d < range.from) return false;
      if (range.to && d > range.to) return false;
    }
    if (type !== 'all' && t.type !== type) return false;
    if (categories.length > 0 && !categories.includes(t.category)) return false;
    if (account !== 'all' && (t.account || 'manual') !== account) return false;
    if (currency !== 'all' && (t.original_currency || 'CAD') !== currency) return false;
    if (search) {
      const q = search.toLowerCase();
      const hay = [t.description, t.category, t.subcategory, t.reference, t.client_name].filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export function computeDateRange(period, date_from, date_to) {
  if (period === 'all') return null;
  if (period === 'custom') return { from: date_from || null, to: date_to || null };
  const today = new Date();
  const y = today.getFullYear();
  const m = today.getMonth();
  const iso = (d) => d.toISOString().slice(0, 10);
  const startOfMonth = (yr, mo) => iso(new Date(yr, mo, 1));
  const endOfMonth = (yr, mo) => iso(new Date(yr, mo + 1, 0));
  switch (period) {
    case 'this_month':   return { from: startOfMonth(y, m), to: endOfMonth(y, m) };
    case 'last_month':   return { from: startOfMonth(y, m - 1), to: endOfMonth(y, m - 1) };
    case 'this_quarter': {
      const qStart = Math.floor(m / 3) * 3;
      return { from: startOfMonth(y, qStart), to: endOfMonth(y, qStart + 2) };
    }
    case 'last_quarter': {
      const qStart = Math.floor(m / 3) * 3 - 3;
      const yr = qStart < 0 ? y - 1 : y;
      const mo = (qStart + 12) % 12;
      return { from: startOfMonth(yr, mo), to: endOfMonth(yr, mo + 2) };
    }
    case 'this_year':    return { from: `${y}-01-01`, to: `${y}-12-31` };
    case 'last_year':    return { from: `${y - 1}-01-01`, to: `${y - 1}-12-31` };
    default:             return null;
  }
}
