import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Megaphone } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function AnnouncementTicker() {
  const [ticker, setTicker] = useState(null);

  const fetchTicker = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/announcement-ticker`);
      setTicker(res.data);
    } catch (error) {
      // If 401, user not logged in yet - try again later
      console.log('Announcement ticker fetch skipped - user may not be logged in');
    }
  }, []);

  useEffect(() => {
    fetchTicker();
    // Refresh ticker every 5 minutes
    const interval = setInterval(fetchTicker, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchTicker]);

  // Don't render if no ticker or not active or no message
  if (!ticker || !ticker.is_active || !ticker.message) {
    return null;
  }

  return (
    <div 
      className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-lg mr-4 max-w-md overflow-hidden"
      data-testid="announcement-ticker"
    >
      <Megaphone size={16} className="shrink-0 text-black" />
      <div className="overflow-hidden whitespace-nowrap">
        <span 
          className="inline-block text-sm font-bold text-black animate-marquee"
          style={{
            animation: 'marquee 15s linear infinite',
          }}
        >
          {ticker.message}
        </span>
      </div>
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0%); }
          100% { transform: translateX(-100%); }
        }
        .animate-marquee {
          display: inline-block;
          padding-left: 100%;
          animation: marquee 15s linear infinite;
        }
      `}</style>
    </div>
  );
}
