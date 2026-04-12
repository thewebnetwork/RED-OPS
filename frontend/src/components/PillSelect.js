/**
 * PillSelect — custom dropdown that displays as a colored pill
 *
 * Used for task status / priority fields. Pass `options` as
 *   [{ value, label, color }, ...]
 *
 * Dropdown is portaled to document.body so it escapes overflow:hidden
 * ancestors (modals, kanban columns). Closes on outside click.
 */
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

// ── Canonical option sets for task status / priority ─────────────────
// Two schemas live in the app:
//   Tasks.js uses display-label values ('Backlog', 'Todo', …)
//   TaskBoard.js uses backend lowercase IDs ('backlog', 'todo', …)
// Both sets of constants are exported so each call site can pick.

export const STATUS_OPTIONS_LABEL = [
  { value: 'Backlog',     label: 'Backlog',     color: '#6B7280' },
  { value: 'Todo',        label: 'To Do',       color: '#3B82F6' },
  { value: 'In Progress', label: 'In Progress', color: '#8B5CF6' },
  { value: 'In Review',   label: 'Review',      color: '#06B6D4' },
  { value: 'Done',        label: 'Done',        color: '#10B981' },
];

export const STATUS_OPTIONS_ID = [
  { value: 'backlog',           label: 'Backlog',     color: '#6B7280' },
  { value: 'todo',              label: 'To Do',       color: '#3B82F6' },
  { value: 'doing',             label: 'In Progress', color: '#8B5CF6' },
  { value: 'waiting_on_client', label: 'Waiting',     color: '#F59E0B' },
  { value: 'review',            label: 'Review',      color: '#06B6D4' },
  { value: 'done',              label: 'Done',        color: '#10B981' },
];

export const PRIORITY_OPTIONS_LABEL = [
  { value: 'Urgent', label: 'Urgent', color: '#EF4444' },
  { value: 'High',   label: 'High',   color: '#F97316' },
  { value: 'Normal', label: 'Normal', color: '#3B82F6' },
  { value: 'Low',    label: 'Low',    color: '#6B7280' },
];

export const PRIORITY_OPTIONS_ID = [
  { value: 'urgent', label: 'Urgent', color: '#EF4444' },
  { value: 'high',   label: 'High',   color: '#F97316' },
  { value: 'medium', label: 'Medium', color: '#3B82F6' },
  { value: 'low',    label: 'Low',    color: '#6B7280' },
];

export default function PillSelect({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  size = 'md',   // 'sm' | 'md'
  minWidth = 140,
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const selected = options.find(o => o.value === value);

  useEffect(() => {
    if (!open) return;
    function handleOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  const pad = size === 'sm' ? '4px 10px' : '6px 14px';
  const fs = size === 'sm' ? 11 : 13;

  const rect = open && ref.current ? ref.current.getBoundingClientRect() : null;
  // Drop downward by default; flip upward if near the bottom of the viewport
  const spaceBelow = rect ? window.innerHeight - rect.bottom : 999;
  const flipUp = spaceBelow < 220;

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block', minWidth }}>
      <div
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, padding: pad,
          borderRadius: 20, cursor: 'pointer', userSelect: 'none',
          background: selected ? selected.color + '22' : 'var(--bg-elevated, #2a2a3e)',
          border: `1px solid ${selected ? selected.color + '88' : 'var(--border, #444)'}`,
          color: selected ? selected.color : 'var(--tx-3, #aaa)',
          fontSize: fs, fontWeight: 600,
          transition: 'background .12s, border-color .12s, box-shadow .12s',
        }}
        onMouseEnter={e => { e.currentTarget.style.boxShadow = `0 0 0 2px ${selected ? selected.color + '33' : 'var(--border)'}` ; }}
        onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; }}
      >
        {selected ? (
          <>
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              background: selected.color, display: 'inline-block',
            }} />
            {selected.label}
          </>
        ) : placeholder}
        <span style={{ marginLeft: 4, opacity: 0.6, fontSize: 10 }}>▾</span>
      </div>
      {open && rect && createPortal(
        <div
          onClick={e => e.stopPropagation()}
          style={{
            position: 'fixed',
            ...(flipUp
              ? { bottom: window.innerHeight - rect.top + 4, left: rect.left }
              : { top: rect.bottom + 4, left: rect.left }),
            background: 'var(--surface, #1e1e2e)',
            border: '1px solid var(--border, #333)',
            borderRadius: 10,
            padding: 6,
            zIndex: 99999,
            minWidth: Math.max(rect.width, 160),
            maxHeight: 280,
            overflowY: 'auto',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          }}
        >
          {options.map(opt => (
            <div
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px',
                borderRadius: 7, cursor: 'pointer', fontSize: 13, fontWeight: 500,
                color: opt.color, transition: 'background .1s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = opt.color + '22')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: opt.color }} />
              {opt.label}
            </div>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}
