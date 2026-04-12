/**
 * MentionHashtagInput — textarea with @mention and #command autocomplete
 *
 * Features:
 *   - Type @ → user dropdown (filtered by keystroke)
 *   - Type # → command dropdown (#createtask, #urgent, #status)
 *   - Arrow/Enter/Tab/Escape keyboard nav
 *   - Exposes getMentionedUserIds(), getMetadata(), resetState() via ref
 */
import React, { useState, useRef, useImperativeHandle, forwardRef } from 'react';

const AVATAR_COLORS = ['#c92a3e', '#7c3aed', '#2563eb', '#059669', '#d97706', '#0891b2', '#db2777'];
const avatarBg = (id) => AVATAR_COLORS[((id || '').charCodeAt?.(0) || 0) % AVATAR_COLORS.length];
const initials = (n) => (n || '?').split(' ').slice(0, 2).map(w => w[0]?.toUpperCase()).join('');

const MentionHashtagInput = forwardRef(function MentionHashtagInput({
  value,
  onChange,
  onSend,
  users = [],
  threadType = 'channel',
  onCommandExecute,
  placeholder,
  style,
  className,
}, ref) {
  const [popup, setPopup] = useState(null);
  const [urgent, setUrgent] = useState(false);
  const mentionedUsers = useRef(new Set());
  const textareaRef = useRef(null);

  useImperativeHandle(ref, () => ({
    getMentionedUserIds: () => Array.from(mentionedUsers.current),
    getMetadata: () => ({ urgent }),
    resetState: () => { mentionedUsers.current = new Set(); setUrgent(false); setPopup(null); },
  }));

  const handleChange = (e) => {
    const val = e.target.value;
    onChange(val);

    const cursor = e.target.selectionStart;
    const textBeforeCursor = val.slice(0, cursor);

    // Check for @ trigger
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);
    if (mentionMatch) {
      const query = mentionMatch[1].toLowerCase();
      const filtered = users
        .filter(u => u.name?.toLowerCase().includes(query))
        .slice(0, 6);
      setPopup({ type: 'mention', query, items: filtered, index: 0 });
      return;
    }

    // Check for # trigger
    const hashMatch = textBeforeCursor.match(/#(\w*)$/);
    if (hashMatch) {
      const query = hashMatch[1].toLowerCase();
      const allCommands = [
        { id: 'createtask', label: '#createtask', desc: 'Create a task from this message', icon: '\u2713' },
        { id: 'urgent', label: '#urgent', desc: 'Mark message as urgent', icon: '\u26A1' },
        ...(threadType === 'request' ? [{ id: 'status', label: '#status', desc: 'Show current request status', icon: '\u25C9' }] : []),
      ];
      const filtered = allCommands.filter(c => c.id.includes(query));
      setPopup({ type: 'command', query, items: filtered, index: 0 });
      return;
    }

    setPopup(null);
  };

  const selectItem = (item) => {
    if (popup.type === 'mention') {
      const newVal = value.replace(/@\w*$/, `@${item.name} `);
      onChange(newVal);
      mentionedUsers.current.add(item.id);
      setPopup(null);
    } else if (popup.type === 'command') {
      if (item.id === 'urgent') {
        setUrgent(true);
        onChange(value.replace(/#\w*$/, ''));
        setPopup(null);
      } else if (item.id === 'createtask') {
        const afterHash = value.replace(/#createtask\s*/i, '').replace(/#\w*$/, '');
        onChange(afterHash);
        setPopup(null);
        onCommandExecute?.('createtask', afterHash.trim());
      } else if (item.id === 'status') {
        onChange(value.replace(/#\w*$/, ''));
        setPopup(null);
        onCommandExecute?.('status', '');
      }
    }
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (popup && popup.items.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setPopup(p => ({ ...p, index: Math.min(p.index + 1, p.items.length - 1) }));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setPopup(p => ({ ...p, index: Math.max(p.index - 1, 0) }));
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        if (popup.items[popup.index]) selectItem(popup.items[popup.index]);
        return;
      }
      if (e.key === 'Escape') {
        setPopup(null);
        return;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend?.();
    }
  };

  return (
    <div style={{ position: 'relative', flex: 1, ...(style || {}) }} className={className}>
      {/* Urgent indicator strip */}
      {urgent && (
        <div style={{
          fontSize: 11, fontWeight: 600, color: 'var(--red-status, #ef4444)',
          background: 'var(--red-status, #ef4444)12', border: '1px solid var(--red-status, #ef4444)30',
          borderRadius: '6px 6px 0 0', padding: '4px 12px',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span>{'\u26A1'} Urgent</span>
          <span style={{ color: 'var(--tx-3)', fontSize: 10 }}>&mdash;</span>
          <button
            onClick={() => setUrgent(false)}
            style={{ background: 'none', border: 'none', color: 'var(--red-status, #ef4444)', cursor: 'pointer', fontSize: 11, padding: 0, textDecoration: 'underline' }}
          >
            remove
          </button>
        </div>
      )}

      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder || 'Type a message... Use @ to mention, # for commands'}
        rows={1}
        style={{
          width: '100%', resize: 'none',
          background: 'var(--surface-2)',
          border: `1px solid ${urgent ? '#ef444460' : 'var(--border-strong)'}`,
          borderRadius: urgent ? '0 0 8px 8px' : 8,
          padding: '10px 12px', fontSize: 13.5, color: 'var(--tx-1)',
          outline: 'none', fontFamily: 'inherit',
          minHeight: 40, maxHeight: 120, boxSizing: 'border-box',
        }}
      />

      {/* Autocomplete popup */}
      {popup && popup.items.length > 0 && (
        <div style={{
          position: 'absolute', bottom: '100%', left: 0, right: 0,
          background: 'var(--bg-card, #1a1a2e)', border: '1px solid var(--border)',
          borderRadius: 8, marginBottom: 4, maxHeight: 260, overflowY: 'auto',
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)', zIndex: 50,
        }}>
          {popup.type === 'mention' && (
            <div style={{ padding: '4px 0' }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--tx-3)', padding: '4px 12px 2px', textTransform: 'uppercase', letterSpacing: '.06em' }}>Mention a person</div>
              {popup.items.map((u, i) => (
                <div key={u.id} onClick={() => selectItem(u)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px',
                    cursor: 'pointer', background: i === popup.index ? 'var(--bg-elevated)' : 'transparent',
                  }}
                  onMouseEnter={() => setPopup(p => ({ ...p, index: i }))}>
                  <div style={{
                    width: 24, height: 24, borderRadius: '50%', background: avatarBg(u.id),
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, fontWeight: 700, color: '#fff', flexShrink: 0,
                  }}>
                    {initials(u.name)}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--tx-1)' }}>{u.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--tx-3)' }}>{u.role}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {popup.type === 'command' && (
            <div style={{ padding: '4px 0' }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--tx-3)', padding: '4px 12px 2px', textTransform: 'uppercase', letterSpacing: '.06em' }}>Commands</div>
              {popup.items.map((cmd, i) => (
                <div key={cmd.id} onClick={() => selectItem(cmd)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                    cursor: 'pointer', background: i === popup.index ? 'var(--bg-elevated)' : 'transparent',
                  }}
                  onMouseEnter={() => setPopup(p => ({ ...p, index: i }))}>
                  <span style={{ fontSize: 14 }}>{cmd.icon}</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)', fontFamily: 'monospace' }}>{cmd.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--tx-3)' }}>{cmd.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

export default MentionHashtagInput;
