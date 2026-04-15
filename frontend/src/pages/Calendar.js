/**
 * Calendar — unified calendar with Month / Week / Year views.
 *
 * Shows two kinds of items:
 *   - Events (from /api/events, internal + future external sync)
 *   - Scheduled tasks (tasks with calendar_date set, from /api/tasks)
 *
 * Click any day to open a modal that creates either an event or a task.
 *
 * External calendar sync (Google, Outlook) is not wired yet — the
 * "Connect" button in the header points to /integrations where the
 * OAuth flow will live once implemented. Events synced from there
 * arrive via /api/events with source='google'|'outlook' and render
 * on the same grid.
 */
import { useEffect, useMemo, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import {
  Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, X,
  CheckSquare, CalendarPlus, Link2,
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const tok = () => localStorage.getItem('token');
const ax = () => axios.create({ headers: { Authorization: `Bearer ${tok()}` } });

// ── Date helpers ──────────────────────────────────────────────────────────────
const dayKey = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const addMonths = (d, n) => { const x = new Date(d); x.setMonth(x.getMonth() + n); return x; };
const addYears = (d, n) => { const x = new Date(d); x.setFullYear(x.getFullYear() + n); return x; };

const startOfWeek = (d) => { const x = new Date(d); x.setDate(x.getDate() - x.getDay()); x.setHours(0,0,0,0); return x; };
const startOfMonth = (d) => { const x = new Date(d.getFullYear(), d.getMonth(), 1); x.setHours(0,0,0,0); return x; };

function monthMatrix(cursor) {
  const first = startOfMonth(cursor);
  const startWeekday = first.getDay();
  const grid = [];
  const gridStart = addDays(first, -startWeekday);
  for (let i = 0; i < 42; i++) grid.push(addDays(gridStart, i));
  return grid;
}

function weekDays(cursor) {
  const start = startOfWeek(cursor);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function Calendar() {
  const [view, setView] = useState(() => localStorage.getItem('calendar_view') || 'month');
  const [cursor, setCursor] = useState(() => new Date());
  const [events, setEvents] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addForDate, setAddForDate] = useState(null); // Date clicked → opens modal
  const [editItem, setEditItem] = useState(null);     // { kind: 'event'|'task', data }

  useEffect(() => { localStorage.setItem('calendar_view', view); }, [view]);

  // Window that covers the current visible view (generous padding)
  const window = useMemo(() => {
    if (view === 'year') {
      return { from: new Date(cursor.getFullYear(), 0, 1), to: new Date(cursor.getFullYear() + 1, 0, 1) };
    }
    if (view === 'week') {
      const s = startOfWeek(cursor); return { from: s, to: addDays(s, 7) };
    }
    // month
    const m = startOfMonth(cursor);
    return { from: addDays(m, -7), to: addDays(m, 42) };
  }, [view, cursor]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const fromIso = window.from.toISOString();
      const toIso = window.to.toISOString();
      const [evRes, tkRes] = await Promise.all([
        ax().get(`${API}/events?from=${encodeURIComponent(fromIso)}&to=${encodeURIComponent(toIso)}`),
        ax().get(`${API}/tasks`),
      ]);
      setEvents(Array.isArray(evRes.data) ? evRes.data : []);
      setTasks((Array.isArray(tkRes.data) ? tkRes.data : []).filter(t => t.calendar_date));
    } catch {
      toast.error('Failed to load calendar');
    } finally { setLoading(false); }
  }, [window.from, window.to]);

  useEffect(() => { loadData(); }, [loadData]);

  // Group items by YYYY-MM-DD
  const itemsByDay = useMemo(() => {
    const map = {};
    events.forEach(e => {
      const d = new Date(e.starts_at);
      const k = dayKey(d);
      (map[k] = map[k] || []).push({ kind: 'event', data: e, sortAt: d.getTime() });
    });
    tasks.forEach(t => {
      const k = t.calendar_date; // already YYYY-MM-DD
      (map[k] = map[k] || []).push({ kind: 'task', data: t, sortAt: 0 });
    });
    for (const k of Object.keys(map)) map[k].sort((a, b) => a.sortAt - b.sortAt);
    return map;
  }, [events, tasks]);

  function goToday() { setCursor(new Date()); }
  function shift(delta) {
    if (view === 'month') setCursor(c => addMonths(c, delta));
    else if (view === 'week') setCursor(c => addDays(c, delta * 7));
    else setCursor(c => addYears(c, delta));
  }

  const titleText = (() => {
    if (view === 'year') return String(cursor.getFullYear());
    if (view === 'week') {
      const s = startOfWeek(cursor); const e = addDays(s, 6);
      const sameMonth = s.getMonth() === e.getMonth();
      if (sameMonth) return `${s.toLocaleDateString('en-US', { month: 'long' })} ${s.getDate()}–${e.getDate()}, ${e.getFullYear()}`;
      return `${s.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${e.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${e.getFullYear()}`;
    }
    return cursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  })();

  return (
    <div className="page-fill" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        padding: '14px 20px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', flexShrink: 0,
        background: 'var(--surface)',
      }}>
        <CalendarIcon size={20} style={{ color: 'var(--accent)' }} />
        <h1 className="page-title" style={{ margin: 0 }}>Calendar</h1>

        <div style={{ marginLeft: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
          <button onClick={() => shift(-1)} title="Previous" style={navBtn}><ChevronLeft size={16} /></button>
          <button onClick={goToday} style={{ ...navBtn, width: 'auto', padding: '6px 12px', fontSize: 12, fontWeight: 600, color: 'var(--tx-2)' }}>Today</button>
          <button onClick={() => shift(1)} title="Next" style={navBtn}><ChevronRight size={16} /></button>
        </div>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--tx-1)', marginLeft: 4 }}>{titleText}</div>

        <div style={{ flex: 1 }} />

        {/* View toggle */}
        <div style={{ display: 'flex', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
          {['week', 'month', 'year'].map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              style={{
                padding: '6px 12px', fontSize: 12, fontWeight: 600, textTransform: 'capitalize',
                background: view === v ? 'var(--accent)' : 'transparent',
                color: view === v ? '#fff' : 'var(--tx-2)',
                border: 'none', cursor: 'pointer',
              }}
            >{v}</button>
          ))}
        </div>

        <Link
          to="/integrations"
          title="Connect Google Calendar or Outlook"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '6px 12px', fontSize: 12, fontWeight: 600, borderRadius: 8,
            border: '1px solid var(--border)', background: 'var(--surface-2)',
            color: 'var(--tx-2)', textDecoration: 'none',
          }}
        >
          <Link2 size={13} /> Connect
        </Link>

        <button
          onClick={() => setAddForDate(new Date())}
          className="btn-primary"
          style={{ gap: 6, padding: '7px 14px', fontSize: 13 }}
        >
          <Plus size={14} /> New
        </button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {loading ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--tx-3)', fontSize: 13 }}>Loading…</div>
        ) : view === 'month' ? (
          <MonthView cursor={cursor} itemsByDay={itemsByDay} onDayClick={(d) => setAddForDate(d)} onItemClick={setEditItem} />
        ) : view === 'week' ? (
          <WeekView cursor={cursor} itemsByDay={itemsByDay} onDayClick={(d) => setAddForDate(d)} onItemClick={setEditItem} />
        ) : (
          <YearView cursor={cursor} itemsByDay={itemsByDay} onMonthClick={(d) => { setCursor(d); setView('month'); }} />
        )}
      </div>

      {/* Add modal */}
      {addForDate && (
        <AddModal
          date={addForDate}
          onClose={() => setAddForDate(null)}
          onSaved={() => { setAddForDate(null); loadData(); }}
        />
      )}

      {/* Edit modal */}
      {editItem && (
        <EditModal
          item={editItem}
          onClose={() => setEditItem(null)}
          onSaved={() => { setEditItem(null); loadData(); }}
        />
      )}
    </div>
  );
}

const navBtn = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  width: 30, height: 30, borderRadius: 7, border: '1px solid var(--border)',
  background: 'var(--surface-2)', color: 'var(--tx-2)', cursor: 'pointer',
};

// ── Month View ────────────────────────────────────────────────────────────────
function MonthView({ cursor, itemsByDay, onDayClick, onItemClick }) {
  const month = cursor.getMonth();
  const grid = monthMatrix(cursor);
  const todayKey = dayKey(new Date());

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 6 }}>
        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
          <div key={d} style={{ fontSize: 11, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '.06em', padding: '0 6px' }}>{d}</div>
        ))}
      </div>
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gridAutoRows: '1fr', gap: 4, overflow: 'hidden' }}>
        {grid.map((d, i) => {
          const inMonth = d.getMonth() === month;
          const k = dayKey(d);
          const isToday = k === todayKey;
          const items = itemsByDay[k] || [];
          return (
            <div
              key={i}
              onClick={() => onDayClick(d)}
              style={{
                background: inMonth ? 'var(--surface)' : 'var(--surface-2)',
                border: `1px solid ${isToday ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: 8, padding: 6,
                display: 'flex', flexDirection: 'column', gap: 3,
                opacity: inMonth ? 1 : 0.55, overflow: 'hidden', minHeight: 0,
                cursor: 'pointer',
              }}
            >
              <div style={{
                fontSize: 11, fontWeight: 700,
                color: isToday ? 'var(--accent)' : (inMonth ? 'var(--tx-1)' : 'var(--tx-3)'),
                marginBottom: 2,
              }}>{d.getDate()}</div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto', minHeight: 0 }}>
                {items.slice(0, 4).map((it, idx) => (
                  <ItemPill key={idx} item={it} onClick={(e) => { e.stopPropagation(); onItemClick(it); }} />
                ))}
                {items.length > 4 && (
                  <div style={{ fontSize: 10, color: 'var(--tx-3)', padding: '0 4px' }}>+{items.length - 4} more</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Week View ─────────────────────────────────────────────────────────────────
function WeekView({ cursor, itemsByDay, onDayClick, onItemClick }) {
  const days = weekDays(cursor);
  const todayKey = dayKey(new Date());

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, flex: 1, overflow: 'hidden' }}>
        {days.map((d, i) => {
          const k = dayKey(d);
          const isToday = k === todayKey;
          const items = itemsByDay[k] || [];
          return (
            <div
              key={i}
              onClick={() => onDayClick(d)}
              style={{
                background: 'var(--surface)',
                border: `1px solid ${isToday ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: 10, padding: 10,
                display: 'flex', flexDirection: 'column', gap: 6,
                overflow: 'hidden', cursor: 'pointer', minHeight: 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                  {d.toLocaleDateString('en-US', { weekday: 'short' })}
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, color: isToday ? 'var(--accent)' : 'var(--tx-1)' }}>
                  {d.getDate()}
                </div>
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4, overflowY: 'auto', minHeight: 0 }}>
                {items.map((it, idx) => (
                  <ItemPill key={idx} item={it} expanded onClick={(e) => { e.stopPropagation(); onItemClick(it); }} />
                ))}
                {items.length === 0 && (
                  <div style={{ fontSize: 11, color: 'var(--tx-3)', fontStyle: 'italic' }}>Click to add</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Year View ─────────────────────────────────────────────────────────────────
function YearView({ cursor, itemsByDay, onMonthClick }) {
  const year = cursor.getFullYear();
  const todayKey = dayKey(new Date());

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        {Array.from({ length: 12 }, (_, m) => {
          const monthCursor = new Date(year, m, 1);
          const grid = monthMatrix(monthCursor);
          return (
            <div
              key={m}
              onClick={() => onMonthClick(monthCursor)}
              style={{
                background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10,
                padding: 12, cursor: 'pointer', transition: 'border-color 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
            >
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--tx-1)', marginBottom: 8 }}>
                {monthCursor.toLocaleDateString('en-US', { month: 'long' })}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
                {['S','M','T','W','T','F','S'].map((d, i) => (
                  <div key={i} style={{ fontSize: 9, fontWeight: 600, color: 'var(--tx-3)', textAlign: 'center' }}>{d}</div>
                ))}
                {grid.map((d, i) => {
                  const inMonth = d.getMonth() === m;
                  const k = dayKey(d);
                  const isToday = k === todayKey;
                  const count = (itemsByDay[k] || []).length;
                  return (
                    <div key={i} style={{
                      position: 'relative', textAlign: 'center', fontSize: 10,
                      padding: '2px 0', borderRadius: 3,
                      color: isToday ? '#fff' : inMonth ? 'var(--tx-1)' : 'var(--tx-3)',
                      background: isToday ? 'var(--accent)' : 'transparent',
                      fontWeight: isToday ? 700 : 400,
                      opacity: inMonth ? 1 : 0.35,
                    }}>
                      {d.getDate()}
                      {count > 0 && !isToday && (
                        <span style={{
                          position: 'absolute', bottom: 1, left: '50%', transform: 'translateX(-50%)',
                          width: 3, height: 3, borderRadius: '50%', background: 'var(--accent)',
                        }} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Item Pill ─────────────────────────────────────────────────────────────────
function ItemPill({ item, expanded, onClick }) {
  const isEvent = item.kind === 'event';
  const d = item.data;
  const color = isEvent ? (d.color || 'var(--accent)') : '#3b82f6';

  if (isEvent) {
    const time = !d.all_day ? new Date(d.starts_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : null;
    return (
      <button
        onClick={onClick}
        title={d.title}
        style={{
          textAlign: 'left', background: `${color}18`, color, border: `1px solid ${color}33`,
          borderRadius: 4, padding: '2px 6px', fontSize: 10.5, fontWeight: 600,
          cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis',
          whiteSpace: expanded ? 'normal' : 'nowrap', display: 'flex', alignItems: 'center', gap: 4,
        }}
      >
        <CalendarPlus size={9} style={{ flexShrink: 0 }} />
        {time && <span style={{ opacity: 0.75, flexShrink: 0 }}>{time}</span>}
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.title}</span>
      </button>
    );
  }
  // Task pill
  return (
    <button
      onClick={onClick}
      title={`Task: ${d.title}`}
      style={{
        textAlign: 'left', background: 'rgba(59,130,246,0.15)', color: '#3b82f6',
        border: '1px solid rgba(59,130,246,0.3)', borderRadius: 4,
        padding: '2px 6px', fontSize: 10.5, fontWeight: 600, cursor: 'pointer',
        overflow: 'hidden', textOverflow: 'ellipsis',
        whiteSpace: expanded ? 'normal' : 'nowrap', display: 'flex', alignItems: 'center', gap: 4,
      }}
    >
      <CheckSquare size={9} style={{ flexShrink: 0 }} />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.title}</span>
    </button>
  );
}

// ── Add Modal ─────────────────────────────────────────────────────────────────
function AddModal({ date, onClose, onSaved }) {
  const [kind, setKind] = useState('event');
  const [saving, setSaving] = useState(false);

  // Event fields
  const [title, setTitle] = useState('');
  const [allDay, setAllDay] = useState(true);
  const [startsAt, setStartsAt] = useState(() => {
    const d = new Date(date);
    if (!d.getHours() && !d.getMinutes()) d.setHours(9, 0, 0, 0);
    return toLocalInputValue(d);
  });
  const [endsAt, setEndsAt] = useState(() => {
    const d = new Date(date);
    if (!d.getHours() && !d.getMinutes()) d.setHours(10, 0, 0, 0);
    else d.setHours(d.getHours() + 1);
    return toLocalInputValue(d);
  });
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');

  // Task fields
  const [taskTitle, setTaskTitle] = useState('');
  const [priority, setPriority] = useState('medium');

  async function submit(e) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      if (kind === 'event') {
        if (!title.trim()) { toast.error('Title required'); setSaving(false); return; }
        const payload = {
          title: title.trim(),
          description: description || null,
          all_day: allDay,
          starts_at: allDay ? new Date(dayKey(date) + 'T00:00:00').toISOString() : new Date(startsAt).toISOString(),
          ends_at: allDay ? null : new Date(endsAt).toISOString(),
          location: location || null,
        };
        await ax().post(`${API}/events`, payload);
        toast.success('Event created');
      } else {
        if (!taskTitle.trim()) { toast.error('Title required'); setSaving(false); return; }
        await ax().post(`${API}/tasks`, {
          title: taskTitle.trim(),
          status: 'todo',
          priority,
          visibility: 'internal',
          calendar_date: dayKey(date),
        });
        toast.success('Task created');
      }
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create');
    } finally { setSaving(false); }
  }

  const labelStyle = { fontSize: 11, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', marginBottom: 6 };
  const inputStyle = {
    width: '100%', padding: '9px 12px', background: 'var(--surface-2)',
    border: '1px solid var(--border)', borderRadius: 8, color: 'var(--tx-1)',
    fontSize: 13, outline: 'none', boxSizing: 'border-box',
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', padding: 16 }}>
      <div className="modal-box" style={{ width: '100%', maxWidth: 480, background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>
            Add to {date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx-3)', padding: 4, display: 'flex' }}><X size={18} /></button>
        </div>

        {/* Kind toggle */}
        <div style={{ display: 'flex', gap: 0, padding: '12px 18px 0', borderBottom: '1px solid var(--border)' }}>
          {[{ id: 'event', label: 'Event', icon: CalendarPlus }, { id: 'task', label: 'Task', icon: CheckSquare }].map(opt => (
            <button key={opt.id} onClick={() => setKind(opt.id)}
              style={{
                flex: 1, padding: '10px 16px', background: 'none', border: 'none', cursor: 'pointer',
                color: kind === opt.id ? 'var(--accent)' : 'var(--tx-3)',
                fontSize: 13, fontWeight: kind === opt.id ? 700 : 500,
                borderBottom: `2px solid ${kind === opt.id ? 'var(--accent)' : 'transparent'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                marginBottom: -1,
              }}>
              <opt.icon size={13} /> {opt.label}
            </button>
          ))}
        </div>

        <form onSubmit={submit} style={{ flex: 1, overflowY: 'auto', padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {kind === 'event' ? (
            <>
              <div>
                <label style={labelStyle}>Title *</label>
                <input autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder="What's happening?" style={inputStyle} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" id="allday" checked={allDay} onChange={e => setAllDay(e.target.checked)} />
                <label htmlFor="allday" style={{ fontSize: 13, color: 'var(--tx-2)' }}>All day</label>
              </div>
              {!allDay && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>Starts</label>
                    <input type="datetime-local" value={startsAt} onChange={e => setStartsAt(e.target.value)} style={{ ...inputStyle, colorScheme: 'dark' }} />
                  </div>
                  <div>
                    <label style={labelStyle}>Ends</label>
                    <input type="datetime-local" value={endsAt} onChange={e => setEndsAt(e.target.value)} style={{ ...inputStyle, colorScheme: 'dark' }} />
                  </div>
                </div>
              )}
              <div>
                <label style={labelStyle}>Location</label>
                <input value={location} onChange={e => setLocation(e.target.value)} placeholder="Optional" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Notes</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional" rows={3} style={{ ...inputStyle, resize: 'none' }} />
              </div>
            </>
          ) : (
            <>
              <div>
                <label style={labelStyle}>Task title *</label>
                <input autoFocus value={taskTitle} onChange={e => setTaskTitle(e.target.value)} placeholder="What needs to be done?" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Priority</label>
                <select value={priority} onChange={e => setPriority(e.target.value)} style={inputStyle}>
                  <option value="urgent">Urgent</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
              <div style={{ fontSize: 11, color: 'var(--tx-3)' }}>
                Scheduled for {date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}. Opens in the task board once created.
              </div>
            </>
          )}
        </form>

        <div style={{ padding: '12px 18px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} style={{ padding: '9px 14px', fontSize: 13, fontWeight: 600, borderRadius: 10, background: 'var(--surface-2)', color: 'var(--tx-2)', border: '1px solid var(--border)', cursor: 'pointer' }}>Cancel</button>
          <button type="button" onClick={submit} disabled={saving} className="btn-primary" style={{ gap: 6, opacity: saving ? 0.6 : 1 }}>
            <Plus size={13} /> {saving ? 'Saving…' : `Create ${kind}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Edit Modal (events only — tasks route to the task board) ──────────────────
function EditModal({ item, onClose, onSaved }) {
  const isEvent = item.kind === 'event';
  const d = item.data;
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState(d.title || '');
  const [description, setDescription] = useState(d.description || '');
  const [location, setLocation] = useState(d.location || '');
  const [allDay, setAllDay] = useState(!!d.all_day);
  const [startsAt, setStartsAt] = useState(() => toLocalInputValue(new Date(d.starts_at)));
  const [endsAt, setEndsAt] = useState(() => d.ends_at ? toLocalInputValue(new Date(d.ends_at)) : '');

  const readOnly = isEvent && d.source && d.source !== 'internal';

  async function save() {
    if (!isEvent) { toast.info('Open the task in the Task Board to edit.'); return; }
    if (readOnly) return;
    if (!title.trim()) { toast.error('Title required'); return; }
    setSaving(true);
    try {
      await ax().patch(`${API}/events/${d.id}`, {
        title: title.trim(),
        description: description || null,
        all_day: allDay,
        starts_at: new Date(startsAt).toISOString(),
        ends_at: allDay ? null : (endsAt ? new Date(endsAt).toISOString() : null),
        location: location || null,
      });
      toast.success('Event updated');
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update');
    } finally { setSaving(false); }
  }

  async function remove() {
    if (!isEvent) return;
    if (readOnly) return;
    if (!window.confirm('Delete this event?')) return;
    try {
      await ax().delete(`${API}/events/${d.id}`);
      toast.success('Event deleted');
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to delete');
    }
  }

  const labelStyle = { fontSize: 11, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', marginBottom: 6 };
  const inputStyle = {
    width: '100%', padding: '9px 12px', background: 'var(--surface-2)',
    border: '1px solid var(--border)', borderRadius: 8, color: 'var(--tx-1)',
    fontSize: 13, outline: 'none', boxSizing: 'border-box',
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', padding: 16 }}>
      <div className="modal-box" style={{ width: '100%', maxWidth: 480, background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>{isEvent ? 'Edit Event' : 'Task'}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx-3)', padding: 4, display: 'flex' }}><X size={18} /></button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {!isEvent ? (
            <>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx-1)' }}>{d.title}</div>
              <div style={{ fontSize: 12, color: 'var(--tx-2)' }}>Status: {d.status} · Priority: {d.priority}</div>
              <Link to="/task-board" onClick={onClose} style={{ color: 'var(--accent)', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
                Open in Task Board →
              </Link>
            </>
          ) : readOnly ? (
            <>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx-1)' }}>{d.title}</div>
              {d.location && <div style={{ fontSize: 12, color: 'var(--tx-2)' }}>📍 {d.location}</div>}
              {d.description && <div style={{ fontSize: 13, color: 'var(--tx-2)', whiteSpace: 'pre-wrap' }}>{d.description}</div>}
              <div style={{ fontSize: 11, color: 'var(--tx-3)', fontStyle: 'italic' }}>Synced from {d.source} — read-only. Edit in the source calendar.</div>
            </>
          ) : (
            <>
              <div>
                <label style={labelStyle}>Title *</label>
                <input autoFocus value={title} onChange={e => setTitle(e.target.value)} style={inputStyle} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" id="edit-allday" checked={allDay} onChange={e => setAllDay(e.target.checked)} />
                <label htmlFor="edit-allday" style={{ fontSize: 13, color: 'var(--tx-2)' }}>All day</label>
              </div>
              {!allDay && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>Starts</label>
                    <input type="datetime-local" value={startsAt} onChange={e => setStartsAt(e.target.value)} style={{ ...inputStyle, colorScheme: 'dark' }} />
                  </div>
                  <div>
                    <label style={labelStyle}>Ends</label>
                    <input type="datetime-local" value={endsAt} onChange={e => setEndsAt(e.target.value)} style={{ ...inputStyle, colorScheme: 'dark' }} />
                  </div>
                </div>
              )}
              <div>
                <label style={labelStyle}>Location</label>
                <input value={location} onChange={e => setLocation(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Notes</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} style={{ ...inputStyle, resize: 'none' }} />
              </div>
            </>
          )}
        </div>
        {isEvent && !readOnly && (
          <div style={{ padding: '12px 18px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10, justifyContent: 'space-between' }}>
            <button onClick={remove} style={{ padding: '9px 14px', fontSize: 13, fontWeight: 600, borderRadius: 10, background: 'transparent', color: 'var(--red)', border: '1px solid var(--red)', cursor: 'pointer' }}>Delete</button>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={onClose} style={{ padding: '9px 14px', fontSize: 13, fontWeight: 600, borderRadius: 10, background: 'var(--surface-2)', color: 'var(--tx-2)', border: '1px solid var(--border)', cursor: 'pointer' }}>Cancel</button>
              <button onClick={save} disabled={saving} className="btn-primary" style={{ opacity: saving ? 0.6 : 1 }}>{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Utility: Date → <input type="datetime-local"> value in local tz ───────────
function toLocalInputValue(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
