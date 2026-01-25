import { useState, useEffect } from 'react';
import axios from 'axios';
import { Megaphone, X } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function AnnouncementTicker() {
  const [ticker, setTicker] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    fetchTicker();
    // Refresh ticker every 5 minutes
    const interval = setInterval(fetchTicker, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchTicker = async () => {
    try {
      const res = await axios.get(`${API}/announcement-ticker`);
      setTicker(res.data);
      // Reset dismissed state if message changed
      const storedMessage = sessionStorage.getItem('ticker_dismissed_message');
      if (storedMessage !== res.data.message) {
        setDismissed(false);
      }
    } catch (error) {
      console.error('Failed to fetch ticker');
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem('ticker_dismissed_message', ticker?.message || '');
  };

  if (!ticker || !ticker.is_active || !ticker.message || dismissed) {
    return null;
  }

  return (
    <div 
      className="relative overflow-hidden"
      style={{ 
        backgroundColor: ticker.background_color,
        color: ticker.text_color 
      }}
      data-testid="announcement-ticker"
    >
      <div className="flex items-center h-10 px-4">
        <Megaphone size={16} className="shrink-0 mr-3" />
        <div className="flex-1 overflow-hidden">
          <div className="ticker-scroll whitespace-nowrap">
            <span className="text-sm font-medium">{ticker.message}</span>
            <span className="mx-16 text-sm font-medium">{ticker.message}</span>
          </div>
        </div>
        <button 
          onClick={handleDismiss}
          className="shrink-0 ml-3 p-1 rounded hover:bg-white/20 transition-colors"
          aria-label="Dismiss announcement"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
