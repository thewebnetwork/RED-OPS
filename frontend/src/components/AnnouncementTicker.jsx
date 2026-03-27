import { useState, useEffect } from 'react';
import axios from 'axios';
import { Megaphone } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function AnnouncementTicker() {
  const [announcements, setAnnouncements] = useState([]);

  useEffect(() => {
    let isMounted = true;
    
    const fetchActiveAnnouncements = async () => {
      try {
        // Fetch ALL active announcements for the user (sorted by priority)
        const res = await axios.get(`${API}/announcements/active/all`);
        if (isMounted) {
          setAnnouncements(res.data || []);
        }
      } catch (error) {
        // If 401, user not logged in yet - try again later
        // user may not be logged in yet — retry later
        if (isMounted) {
          setAnnouncements([]);
        }
      }
    };
    
    fetchActiveAnnouncements();
    // Refresh announcements every 10 seconds for instant updates when deleted
    const interval = setInterval(fetchActiveAnnouncements, 10 * 1000);
    
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Don't render if no active announcements
  if (!announcements || announcements.length === 0) {
    return null;
  }

  // Single announcement - full width banner
  if (announcements.length === 1) {
    const ann = announcements[0];
    const bgColor = ann.background_color || '#A2182C';
    const textColor = ann.text_color || '#FFFFFF';

    return (
      <div 
        className="flex-1 flex items-center gap-2 px-4 py-1.5 rounded-lg mr-4 overflow-hidden"
        style={{ backgroundColor: bgColor }}
        data-testid="announcement-ticker"
      >
        <Megaphone size={18} className="shrink-0" style={{ color: textColor }} />
        <div className="flex-1 overflow-hidden whitespace-nowrap">
          <span 
            className="inline-block text-sm font-bold animate-marquee-single"
            style={{ color: textColor }}
          >
            {ann.message}
          </span>
        </div>
        <style>{`
          @keyframes marquee-single {
            0% { transform: translateX(100%); }
            100% { transform: translateX(-100%); }
          }
          .animate-marquee-single {
            display: inline-block;
            animation: marquee-single 20s linear infinite;
          }
        `}</style>
      </div>
    );
  }

  // Multiple announcements - split evenly based on count
  return (
    <div 
      className="flex-1 flex items-center gap-2 mr-4"
      data-testid="announcement-ticker"
    >
      {announcements.map((ann, index) => {
        const bgColor = ann.background_color || '#A2182C';
        const textColor = ann.text_color || '#FFFFFF';
        
        return (
          <div
            key={ann.id}
            className="flex-1 flex items-center gap-2 px-3 py-1.5 rounded-lg overflow-hidden"
            style={{ backgroundColor: bgColor }}
            data-testid={`announcement-${index}`}
          >
            <Megaphone size={16} className="shrink-0" style={{ color: textColor }} />
            <div className="flex-1 overflow-hidden whitespace-nowrap">
              <span 
                className={`inline-block text-sm font-bold animate-marquee-${index}`}
                style={{ color: textColor }}
              >
                {ann.message}
              </span>
            </div>
          </div>
        );
      })}
      <style>{`
        ${announcements.map((_, index) => `
          @keyframes marquee-${index} {
            0% { transform: translateX(100%); }
            100% { transform: translateX(-100%); }
          }
          .animate-marquee-${index} {
            display: inline-block;
            animation: marquee-${index} ${15 + index * 2}s linear infinite;
          }
        `).join('\n')}
      `}</style>
    </div>
  );
}
