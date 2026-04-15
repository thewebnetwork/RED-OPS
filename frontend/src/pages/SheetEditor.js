/**
 * SheetEditor — basic in-app spreadsheet.
 *
 * Intentionally simple: a row/column grid with editable cells, a
 * name at the top, add/remove rows and columns, autosave on blur
 * (debounced). Nothing fancy — just enough to track data without
 * leaving RED OPS.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import {
  ArrowLeft, Plus, Trash2, Loader2, Save, CheckCircle2,
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const tok = () => localStorage.getItem('token');
const ax = () => axios.create({ headers: { Authorization: `Bearer ${tok()}` } });

function uid() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export default function SheetEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [sheet, setSheet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const saveTimerRef = useRef(null);

  // Initial load
  useEffect(() => {
    let cancel = false;
    ax().get(`${API}/sheets/${id}`)
      .then(r => { if (!cancel) setSheet(r.data); })
      .catch(() => { toast.error('Failed to load sheet'); navigate('/drive'); })
      .finally(() => { if (!cancel) setLoading(false); });
    return () => { cancel = true; };
  }, [id, navigate]);

  const save = useCallback(async (patch) => {
    setSaving(true);
    try {
      const { data } = await ax().patch(`${API}/sheets/${id}`, patch);
      setSheet(data);
      setSavedAt(Date.now());
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Save failed');
    } finally {
      setSaving(false);
    }
  }, [id]);

  // Debounced autosave when the local sheet state changes via cell edits.
  // Name/column-structure changes call save() directly, not this path.
  const scheduleAutoSave = useCallback((nextRows) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      save({ rows: nextRows });
    }, 600);
  }, [save]);

  // ── Handlers ──────────────────────────────────────────────────
  const handleCellChange = (rowIdx, colIdx, value) => {
    setSheet(prev => {
      const rows = prev.rows.map((r, i) =>
        i === rowIdx ? r.map((c, j) => (j === colIdx ? value : c)) : r
      );
      scheduleAutoSave(rows);
      return { ...prev, rows };
    });
  };

  const addRow = () => {
    const newRow = sheet.columns.map(() => '');
    const rows = [...sheet.rows, newRow];
    setSheet(s => ({ ...s, rows }));
    save({ rows });
  };

  const removeRow = (rowIdx) => {
    if (!window.confirm('Delete this row?')) return;
    const rows = sheet.rows.filter((_, i) => i !== rowIdx);
    setSheet(s => ({ ...s, rows }));
    save({ rows });
  };

  const addColumn = () => {
    const name = window.prompt('Column name', `Column ${sheet.columns.length + 1}`);
    if (!name) return;
    const columns = [...sheet.columns, { id: uid(), name: name.trim(), type: 'text' }];
    const rows = sheet.rows.map(r => [...r, '']);
    setSheet(s => ({ ...s, columns, rows }));
    save({ columns, rows });
  };

  const renameColumn = (colIdx) => {
    const current = sheet.columns[colIdx];
    const name = window.prompt('Rename column', current.name);
    if (!name || name === current.name) return;
    const columns = sheet.columns.map((c, i) => i === colIdx ? { ...c, name: name.trim() } : c);
    setSheet(s => ({ ...s, columns }));
    save({ columns });
  };

  const removeColumn = (colIdx) => {
    if (sheet.columns.length <= 1) {
      toast.error('A sheet needs at least one column');
      return;
    }
    if (!window.confirm(`Delete column "${sheet.columns[colIdx].name}"? Data in this column is lost.`)) return;
    const columns = sheet.columns.filter((_, i) => i !== colIdx);
    const rows = sheet.rows.map(r => r.filter((_, i) => i !== colIdx));
    setSheet(s => ({ ...s, columns, rows }));
    save({ columns, rows });
  };

  const renameSheet = (nextName) => {
    const name = (nextName || '').trim() || 'Untitled sheet';
    if (name === sheet.name) return;
    setSheet(s => ({ ...s, name }));
    save({ name });
  };

  // ── Render ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="page-fill" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 size={20} className="spin" style={{ color: 'var(--tx-3)' }} />
      </div>
    );
  }
  if (!sheet) return null;

  const statusLabel = saving
    ? 'Saving…'
    : savedAt
      ? `Saved ${new Date(savedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
      : 'All changes saved';

  return (
    <div className="page-fill" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        padding: '12px 20px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
        background: 'var(--surface)',
      }}>
        <button
          onClick={() => navigate('/drive')}
          style={{
            background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx-3)',
            display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, padding: 0,
          }}
        >
          <ArrowLeft size={14} /> Drive
        </button>
        <div style={{ width: 1, height: 16, background: 'var(--border)' }} />
        <input
          defaultValue={sheet.name}
          onBlur={(e) => renameSheet(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
          style={{
            flex: 1, background: 'none', border: 'none', outline: 'none',
            fontSize: 17, fontWeight: 700, color: 'var(--tx-1)', letterSpacing: '-0.02em',
            padding: '2px 6px', borderRadius: 6, minWidth: 0,
          }}
        />
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: 'var(--tx-3)' }}>
          {saving
            ? <Loader2 size={12} className="spin" />
            : <CheckCircle2 size={12} style={{ color: 'var(--green)' }} />}
          {statusLabel}
        </div>
      </div>

      {/* Toolbar */}
      <div style={{
        padding: '8px 20px', borderBottom: '1px solid var(--border)',
        display: 'flex', gap: 6, flexShrink: 0, background: 'var(--surface-2)',
      }}>
        <button onClick={addRow} style={btn}><Plus size={12} /> Row</button>
        <button onClick={addColumn} style={btn}><Plus size={12} /> Column</button>
        <div style={{ flex: 1 }} />
        <button
          onClick={() => save({ rows: sheet.rows, columns: sheet.columns })}
          style={{ ...btn, color: 'var(--accent)' }}
          title="Force save now"
        >
          <Save size={12} /> Save
        </button>
      </div>

      {/* Grid */}
      <div style={{ flex: 1, overflow: 'auto', background: 'var(--bg)' }}>
        <table
          style={{
            borderCollapse: 'separate', borderSpacing: 0,
            fontSize: 13, color: 'var(--tx-1)',
            minWidth: '100%',
          }}
        >
          <thead>
            <tr>
              <th style={{ ...cornerCell }}>#</th>
              {sheet.columns.map((col, ci) => (
                <th
                  key={col.id}
                  onClick={(e) => {
                    // click the header text to rename; the × button handles delete
                    if (e.target.tagName !== 'BUTTON') renameColumn(ci);
                  }}
                  style={headerCell}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'space-between' }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {col.name || `Column ${ci + 1}`}
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); removeColumn(ci); }}
                      title="Delete column"
                      style={colDeleteBtn}
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                </th>
              ))}
              <th style={{ ...headerCell, width: 40, textAlign: 'center' }}>
                <button onClick={addColumn} title="Add column" style={{ ...btn, padding: 4 }}>
                  <Plus size={12} />
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {sheet.rows.map((row, ri) => (
              <tr key={ri}>
                <td style={rowNumCell}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                    <span>{ri + 1}</span>
                    <button
                      onClick={() => removeRow(ri)}
                      title="Delete row"
                      style={rowDeleteBtn}
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                </td>
                {row.map((cell, ci) => (
                  <td key={ci} style={bodyCell}>
                    <input
                      defaultValue={cell ?? ''}
                      onBlur={(e) => handleCellChange(ri, ci, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') { e.currentTarget.blur(); }
                      }}
                      style={cellInput}
                    />
                  </td>
                ))}
                <td style={{ ...bodyCell, background: 'var(--bg)' }} />
              </tr>
            ))}
            <tr>
              <td colSpan={sheet.columns.length + 2} style={{ padding: 0 }}>
                <button
                  onClick={addRow}
                  style={{
                    width: '100%', textAlign: 'left',
                    padding: '8px 12px', fontSize: 12, fontWeight: 500,
                    background: 'none', border: 'none', color: 'var(--tx-3)',
                    cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5,
                  }}
                >
                  <Plus size={11} /> Add row
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Styles ──────────────────────────────────────────────────────────
const btn = {
  display: 'inline-flex', alignItems: 'center', gap: 4,
  padding: '5px 10px', fontSize: 12, fontWeight: 600,
  background: 'var(--surface)', border: '1px solid var(--border)',
  color: 'var(--tx-2)', borderRadius: 6, cursor: 'pointer',
};

const cornerCell = {
  position: 'sticky', left: 0, top: 0, zIndex: 3,
  background: 'var(--surface-2)', color: 'var(--tx-3)',
  fontSize: 11, fontWeight: 700, padding: '6px 8px',
  borderRight: '1px solid var(--border)', borderBottom: '1px solid var(--border)',
  width: 48,
};
const headerCell = {
  position: 'sticky', top: 0, zIndex: 2,
  background: 'var(--surface-2)', color: 'var(--tx-1)',
  fontSize: 12, fontWeight: 700, textAlign: 'left',
  padding: '6px 10px', borderRight: '1px solid var(--border)', borderBottom: '1px solid var(--border)',
  minWidth: 140, cursor: 'pointer',
};
const rowNumCell = {
  position: 'sticky', left: 0, zIndex: 1,
  background: 'var(--surface-2)', color: 'var(--tx-3)',
  fontSize: 11, fontWeight: 600, padding: '0 6px 0 10px',
  borderRight: '1px solid var(--border)', borderBottom: '1px solid var(--border)',
  width: 48,
};
const bodyCell = {
  padding: 0, background: 'var(--surface)',
  borderRight: '1px solid var(--border)', borderBottom: '1px solid var(--border)',
  minWidth: 140,
};
const cellInput = {
  width: '100%', padding: '8px 10px',
  background: 'transparent', border: 'none', outline: 'none',
  color: 'var(--tx-1)', fontSize: 13, fontFamily: 'inherit',
};
const colDeleteBtn = {
  background: 'none', border: 'none', cursor: 'pointer',
  color: 'var(--tx-3)', padding: 2, display: 'flex', opacity: 0.5,
};
const rowDeleteBtn = {
  background: 'none', border: 'none', cursor: 'pointer',
  color: 'var(--tx-3)', padding: 0, display: 'flex', opacity: 0.4,
};
