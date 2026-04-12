import { useState, useEffect, useRef } from 'react';

/**
 * useCountUp — animates a number from 0 to target over `duration` ms.
 *
 * Usage:
 *   const display = useCountUp(metrics.total, 600);
 *   <div>{display}</div>
 *
 * Handles: integers, floats (1 decimal), strings with $ prefix, strings with % suffix.
 * Returns the animated number as a formatted string matching the input format.
 */
export default function useCountUp(target, duration = 600) {
  const [value, setValue] = useState(0);
  const rafRef = useRef(null);
  const startRef = useRef(null);

  // Parse numeric value from target (could be "12", "$3,500", "78%", or plain number)
  const isString = typeof target === 'string';
  const prefix = isString && target.startsWith('$') ? '$' : '';
  const suffix = isString && target.endsWith('%') ? '%' : '';
  const cleaned = isString ? target.replace(/[$,%\s]/g, '') : String(target);
  const numTarget = parseFloat(cleaned) || 0;
  const isFloat = cleaned.includes('.');

  useEffect(() => {
    if (numTarget === 0) { setValue(0); return; }
    startRef.current = performance.now();

    const animate = (now) => {
      const elapsed = now - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(eased * numTarget);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        setValue(numTarget);
      }
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [numTarget, duration]);

  // Format output to match input style
  const rounded = isFloat ? value.toFixed(1) : Math.round(value);
  const formatted = prefix
    ? `${prefix}${Number(rounded).toLocaleString()}`
    : `${rounded}${suffix}`;

  return formatted;
}
