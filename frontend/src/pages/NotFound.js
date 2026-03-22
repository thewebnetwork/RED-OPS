import { useNavigate } from 'react-router-dom';
import { Home, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg)',
      color: 'var(--tx-1)',
      fontFamily: "'Inter', sans-serif",
      padding: 40,
      textAlign: 'center',
    }}>
      <div style={{
        fontSize: 72,
        fontWeight: 800,
        color: 'var(--red)',
        lineHeight: 1,
        letterSpacing: '-0.04em',
        marginBottom: 12,
      }}>
        404
      </div>
      <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8, color: 'var(--tx-1)' }}>
        Page not found
      </h1>
      <p style={{ fontSize: 14, color: 'var(--tx-3)', maxWidth: 360, marginBottom: 28 }}>
        The page you're looking for doesn't exist or you don't have permission to access it.
      </p>
      <div style={{ display: 'flex', gap: 10 }}>
        <button
          onClick={() => navigate(-1)}
          className="btn-ghost"
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <ArrowLeft size={14} /> Go Back
        </button>
        <button
          onClick={() => navigate('/')}
          className="btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <Home size={14} /> Home
        </button>
      </div>
    </div>
  );
}
