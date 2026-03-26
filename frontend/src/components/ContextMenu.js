import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

/**
 * Global Context Menu
 * 
 * @param {number} x - X coordinate of the click
 * @param {number} y - Y coordinate of the click
 * @param {Array} options - [{ label, icon, onClick, danger, separator }]
 * @param {Function} onClose - Called when clicking outside or selecting an option
 */
export default function ContextMenu({ x, y, options, onClose }) {
  const menuRef = useRef(null);

  // Close on click outside or escape key
  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose();
      }
    }
    
    function handleKeyDown(e) {
      if (e.key === 'Escape') onClose();
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  // Adjust position if it goes off-screen
  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const winWidth = window.innerWidth;
      const winHeight = window.innerHeight;

      if (x + rect.width > winWidth) {
        menuRef.current.style.left = `${winWidth - rect.width - 10}px`;
      }
      if (y + rect.height > winHeight) {
        menuRef.current.style.top = `${winHeight - rect.height - 10}px`;
      }
    }
  }, [x, y]);

  return createPortal(
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        top: y,
        left: x,
        zIndex: 9999,
        background: 'var(--bg-overlay, #252525)',
        border: '1px solid var(--border-hi, #3a3a3a)',
        borderRadius: 10,
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        minWidth: 180,
        padding: 6,
        animation: 'dropdownEnter 0.15s ease both',
        display: 'flex',
        flexDirection: 'column',
      }}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      {options.map((opt, i) => {
        if (opt.separator) {
          return <div key={`sep-${i}`} style={{ height: 1, background: 'var(--border, #2a2a2a)', margin: '4px 0' }} />;
        }
        
        return (
          <button
            key={i}
            onClick={(e) => {
              e.stopPropagation();
              opt.onClick();
              onClose();
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              width: '100%',
              padding: '6px 10px',
              border: 'none',
              background: 'none',
              color: opt.danger ? 'var(--red-status, #ef4444)' : 'var(--tx-1, #f0f0f0)',
              fontSize: 13,
              fontWeight: 500,
              borderRadius: 6,
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'background 0.1s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = opt.danger 
                ? 'rgba(239, 68, 68, 0.15)' 
                : 'var(--bg-elevated, #1e1e1e)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'none';
            }}
          >
            {opt.icon && (
              <span style={{ 
                display: 'flex', 
                alignItems: 'center', 
                opacity: 0.8,
                width: 14,
              }}>
                {opt.icon}
              </span>
            )}
            {opt.label}
          </button>
        );
      })}
    </div>,
    document.body
  );
}
