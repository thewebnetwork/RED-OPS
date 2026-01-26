import { useState, useEffect } from 'react';
import axios from 'axios';
import { Megaphone } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function AnnouncementTicker() {
  const [ticker, setTicker] = useState(null);

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
    } catch (error) {
      console.error('Failed to fetch ticker');
    }
  };

  // Don't render if no ticker or not active
  if (!ticker || !ticker.is_active || !ticker.message) {
    return null;
  }

  return (
    <div 
      className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-lg mr-4 max-w-md"
      data-testid="announcement-ticker"
    >
      <Megaphone size={16} className="shrink-0 text-black" />
      <span className="text-sm font-bold text-black truncate">{ticker.message}</span>
    </div>
  );
}
