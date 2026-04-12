import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
/**
 * Report an Issue page - Redirects to Command Center with issue type pre-selected
 */
export default function ReportIssue() {
const navigate = useNavigate();

  useEffect(() => {
    // Redirect to Command Center with issue/bug type pre-selected
    navigate('/command-center?type=issue', { replace: true });
  }, [navigate]);

  return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent)]"></div>
    </div>
  );
}
