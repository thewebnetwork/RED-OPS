/**
 * FinanceImportModal — CSV upload + preview + commit flow.
 *
 * Two steps:
 *   1. Drop / pick a CSV. POSTs to /finance/transactions/preview-import.
 *      Backend auto-detects bank vs Wise and returns parsed rows +
 *      auto-categorized + duplicate flags + parsing errors.
 *   2. User reviews the preview table — can toggle which rows to import,
 *      adjust category inline. Clicks Confirm → commit-import endpoint.
 */
import { useState, useRef } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import {
  Upload, FileText, X, Check, AlertTriangle, Loader2, ChevronRight,
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const tok = () => localStorage.getItem('token');
const ax = () => axios.create({ headers: { Authorization: `Bearer ${tok()}` } });

const CATEGORIES = [
  'Real Estate Commission', 'RRM Revenue', 'Airbnb Income', 'Refund',
  'Wise International Transfer', 'Payroll', 'Cleaning Services',
  'Contractor Payment', 'Software Subscription', 'Loan Payment',
  'Real Estate Board Fees', 'Condo Fees', 'Travel', 'Food and Dining',
  'Shopping and Household', 'Transportation', 'Donation', 'Bank Fee',
  'Uncategorized',
];

export default function FinanceImportModal({ onClose, onImported }) {
  const [step, setStep] = useState('upload'); // upload | preview | committing
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [rows, setRows] = useState([]); // editable copy of preview.parsed
  const fileRef = useRef(null);

  const handleFile = async (f) => {
    if (!f) return;
    if (!f.name.toLowerCase().endsWith('.csv')) {
      toast.error('Please upload a .csv file.');
      return;
    }
    setFile(f);
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', f);
      const { data } = await ax().post(`${API}/finance/transactions/preview-import`, fd);
      setPreview(data);
      // Pre-mark all non-duplicate rows as selected; duplicates default OFF
      setRows((data.parsed || []).map(r => ({ ...r, _selected: !r._duplicate })));
      setStep('preview');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to parse CSV');
    } finally {
      setBusy(false);
    }
  };

  const handleCommit = async () => {
    const selected = rows.filter(r => r._selected);
    if (selected.length === 0) {
      toast.error('Nothing selected to import.');
      return;
    }
    setStep('committing');
    setBusy(true);
    try {
      const { data } = await ax().post(`${API}/finance/transactions/commit-import`, {
        transactions: selected,
      });
      toast.success(`Imported ${data.imported} transaction${data.imported === 1 ? '' : 's'}${data.skipped ? ` · skipped ${data.skipped} duplicate${data.skipped === 1 ? '' : 's'}` : ''}`);
      onImported?.();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Import failed');
      setStep('preview');
    } finally {
      setBusy(false);
    }
  };

  const totals = (() => {
    const sel = rows.filter(r => r._selected);
    const income = sel.filter(r => r.type === 'income').reduce((s, r) => s + (r.amount || 0), 0);
    const expense = sel.filter(r => r.type === 'expense').reduce((s, r) => s + (r.amount || 0), 0);
    return { count: sel.length, income, expense };
  })();

  return (
    <div style={overlay}>
      <div style={modal}>
        {/* Header */}
        <div style={header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Upload size={18} style={{ color: 'var(--accent)' }} />
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Import transactions</h2>
            {preview && <span style={badge}>{preview.format}</span>}
          </div>
          <button onClick={onClose} style={closeBtn}><X size={18} /></button>
        </div>

        {/* Step: upload */}
        {step === 'upload' && (
          <div style={{ padding: '40px 24px', flex: 1, overflow: 'auto' }}>
            <button
              onClick={() => fileRef.current?.click()}
              style={dropZone}
              onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--accent)'; }}
              onDragLeave={e => { e.currentTarget.style.borderColor = 'var(--border-hi)'; }}
              onDrop={e => {
                e.preventDefault();
                e.currentTarget.style.borderColor = 'var(--border-hi)';
                handleFile(e.dataTransfer.files?.[0]);
              }}
            >
              {busy ? <Loader2 size={24} className="spin" /> : <Upload size={24} />}
              <div style={{ marginTop: 12, fontSize: 14, fontWeight: 600 }}>
                {busy ? 'Parsing…' : 'Drop a CSV or click to choose'}
              </div>
              <div style={{ marginTop: 4, fontSize: 12, color: 'var(--tx-3)' }}>
                Bank statement or Wise transactions export. Format auto-detected.
              </div>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              style={{ display: 'none' }}
              onChange={e => handleFile(e.target.files?.[0])}
            />
            <div style={{ marginTop: 18, fontSize: 11.5, color: 'var(--tx-3)', textAlign: 'center', lineHeight: 1.6 }}>
              Nothing saves until you confirm.<br/>
              Duplicates are detected by Wise transaction ID, or by date + amount + description for bank rows.
            </div>
          </div>
        )}

        {/* Step: preview */}
        {step === 'preview' && preview && (
          <>
            <div style={summaryBar}>
              <span><strong style={{ color: 'var(--tx-1)' }}>{preview.total_rows}</strong> rows in file</span>
              <span><strong style={{ color: 'var(--accent)' }}>{rows.length}</strong> parsed</span>
              {preview.duplicate_count > 0 && (
                <span style={{ color: 'var(--yellow)' }}>
                  <AlertTriangle size={11} style={{ verticalAlign: '-1px' }} /> {preview.duplicate_count} duplicate{preview.duplicate_count === 1 ? '' : 's'}
                </span>
              )}
              {preview.errors?.length > 0 && (
                <span style={{ color: 'var(--red-status)' }}>
                  <AlertTriangle size={11} style={{ verticalAlign: '-1px' }} /> {preview.errors.length} skipped
                </span>
              )}
              <span style={{ marginLeft: 'auto' }}>
                Selected: <strong style={{ color: 'var(--green)' }}>+${totals.income.toFixed(0)}</strong>
                {' · '}
                <strong style={{ color: 'var(--red-status)' }}>−${totals.expense.toFixed(0)}</strong>
                {' · '}
                <strong style={{ color: 'var(--tx-1)' }}>{totals.count} rows</strong>
              </span>
            </div>

            <div style={{ flex: 1, overflow: 'auto', padding: '0 18px 18px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                <thead>
                  <tr style={{ position: 'sticky', top: 0, background: 'var(--surface-2)', zIndex: 1 }}>
                    <th style={th}>
                      <input
                        type="checkbox"
                        checked={rows.length > 0 && rows.every(r => r._selected)}
                        onChange={e => setRows(rs => rs.map(r => ({ ...r, _selected: e.target.checked })))}
                      />
                    </th>
                    <th style={th}>Date</th>
                    <th style={th}>Description</th>
                    <th style={th}>Category</th>
                    <th style={{ ...th, textAlign: 'right' }}>Amount</th>
                    <th style={th}>Currency</th>
                    <th style={th}></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} style={{
                      borderBottom: '1px solid var(--border)',
                      opacity: r._selected ? 1 : 0.5,
                      background: r._duplicate ? 'rgba(156,122,46,0.08)' : 'transparent',
                    }}>
                      <td style={td}>
                        <input
                          type="checkbox"
                          checked={!!r._selected}
                          onChange={e => setRows(rs => rs.map((x, j) => j === i ? { ...x, _selected: e.target.checked } : x))}
                        />
                      </td>
                      <td style={td}>{r.date}</td>
                      <td style={{ ...td, maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.description}>{r.description}</td>
                      <td style={td}>
                        <select
                          value={r.category}
                          onChange={e => setRows(rs => rs.map((x, j) => j === i ? { ...x, category: e.target.value } : x))}
                          style={catSelect}
                        >
                          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </td>
                      <td style={{ ...td, textAlign: 'right', color: r.type === 'income' ? 'var(--green)' : 'var(--red-status)', fontWeight: 600 }}>
                        {r.type === 'income' ? '+' : '−'}{(r.amount || 0).toFixed(2)}
                      </td>
                      <td style={td}>{r.original_currency || '—'}</td>
                      <td style={td}>
                        {r._duplicate && <span style={dupBadge} title="Already in your ledger">dup</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {preview.errors?.length > 0 && (
                <div style={{ marginTop: 14, padding: 12, borderRadius: 8, background: 'var(--color-red-soft)', fontSize: 12, color: 'var(--red-status)' }}>
                  <strong>{preview.errors.length} row{preview.errors.length === 1 ? '' : 's'} skipped</strong> — couldn't parse date or amount. They won't be imported.
                </div>
              )}
            </div>

            <div style={footer}>
              <button onClick={onClose} className="btn-ghost" disabled={busy}>Cancel</button>
              <button onClick={handleCommit} className="btn-primary" disabled={busy || totals.count === 0} style={{ gap: 6 }}>
                {busy ? <Loader2 size={13} className="spin" /> : <Check size={13} />}
                {busy ? 'Importing…' : `Import ${totals.count} transaction${totals.count === 1 ? '' : 's'}`}
                <ChevronRight size={12} />
              </button>
            </div>
          </>
        )}

        {step === 'committing' && (
          <div style={{ padding: 60, textAlign: 'center' }}>
            <Loader2 size={28} className="spin" style={{ color: 'var(--accent)' }} />
            <div style={{ marginTop: 12, fontSize: 13, color: 'var(--tx-2)' }}>Importing…</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Styles ──
const overlay = {
  position: 'fixed', inset: 0, zIndex: 1000,
  background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
};
const modal = {
  width: '100%', maxWidth: 920, maxHeight: '90vh',
  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16,
  display: 'flex', flexDirection: 'column', overflow: 'hidden',
};
const header = {
  padding: '14px 18px', borderBottom: '1px solid var(--border)',
  display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
};
const closeBtn = {
  background: 'none', border: 'none', cursor: 'pointer',
  color: 'var(--tx-3)', padding: 4, display: 'flex',
};
const badge = {
  fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
  background: 'var(--accent-soft)', color: 'var(--accent)', textTransform: 'uppercase',
};
const dropZone = {
  width: '100%', display: 'flex', flexDirection: 'column',
  alignItems: 'center', justifyContent: 'center',
  padding: '50px 24px', border: '2px dashed var(--border-hi)', borderRadius: 12,
  background: 'var(--surface-2)', color: 'var(--tx-2)',
  cursor: 'pointer', transition: 'border-color 0.15s',
};
const summaryBar = {
  padding: '10px 18px', borderBottom: '1px solid var(--border)',
  background: 'var(--surface-2)', display: 'flex', alignItems: 'center',
  gap: 16, fontSize: 12, color: 'var(--tx-3)', flexShrink: 0, flexWrap: 'wrap',
};
const th = {
  textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--tx-3)',
  textTransform: 'uppercase', letterSpacing: '.04em',
  padding: '10px 8px', borderBottom: '1px solid var(--border)',
};
const td = { padding: '8px', color: 'var(--tx-1)' };
const catSelect = {
  width: '100%', padding: '4px 6px', fontSize: 11.5,
  background: 'var(--bg-elevated)', color: 'var(--tx-1)',
  border: '1px solid var(--border)', borderRadius: 6, outline: 'none',
};
const dupBadge = {
  fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
  background: 'var(--color-yellow-soft)', color: 'var(--yellow)',
};
const footer = {
  padding: '12px 18px', borderTop: '1px solid var(--border)',
  display: 'flex', justifyContent: 'flex-end', gap: 10, flexShrink: 0,
};
