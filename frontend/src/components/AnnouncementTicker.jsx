import { useState, useEffect } from 'react';
import axios from 'axios';
import { Megaphone } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function AnnouncementTicker() {
  const [announcement, setAnnouncement] = useState(null);

  useEffect(() => {
    let isMounted = true;
    
    const fetchActiveAnnouncement = async () => {
      try {
        // Use the new multi-announcement endpoint that returns the highest priority active announcement
        const res = await axios.get(`${API}/announcements/active`);
        if (isMounted) {
          setAnnouncement(res.data);
        }
      } catch (error) {
        // If 401, user not logged in yet - try again later
        console.log('Announcement fetch skipped - user may not be logged in');
        if (isMounted) {
          setAnnouncement(null);
        }
      }
    };
    
    fetchActiveAnnouncement();
    // Refresh announcement every 60 seconds for better responsiveness
    const interval = setInterval(fetchActiveAnnouncement, 60 * 1000);
    
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Don't render if no active announcement
  if (!announcement || !announcement.message) {
    return null;
  }

  // Use the announcement's custom colors or fallback to defaults
  const bgColor = announcement.background_color || '#A2182C';
  const textColor = announcement.text_color || '#FFFFFF';

  return (
    <div 
      className="flex items-center gap-2 px-3 py-1.5 rounded-lg mr-4 max-w-md overflow-hidden"
      style={{ backgroundColor: bgColor }}
      data-testid="announcement-ticker"
    >
      <Megaphone size={16} className="shrink-0" style={{ color: textColor }} />
      <div className="overflow-hidden whitespace-nowrap">
        <span 
          className="inline-block text-sm font-bold animate-marquee"
          style={{
            color: textColor,
            animation: 'marquee 15s linear infinite',
          }}
        >
          {announcement.message}
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
