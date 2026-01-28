import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { 
  FileText, 
  Download, 
  RefreshCw, 
  Search,
  Server,
  Globe,
  Activity,
  Users,
  AlertCircle,
  CheckCircle,
  Info,
  AlertTriangle,
  Radio,
  Pause
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const LOG_LEVELS = {
  'ERROR': { color: 'bg-red-100 text-red-700', icon: AlertCircle },
  'WARNING': { color: 'bg-amber-100 text-amber-700', icon: AlertTriangle },
  'INFO': { color: 'bg-blue-100 text-blue-700', icon: Info },
  'SUCCESS': { color: 'bg-green-100 text-green-700', icon: CheckCircle },
  'DEBUG': { color: 'bg-slate-100 text-slate-700', icon: Activity }
};

export default function Logs() {
  const [activeTab, setActiveTab] = useState('system');
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState('all');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingLogs, setStreamingLogs] = useState([]);
  const logContainerRef = useRef(null);
  const eventSourceRef = useRef(null);

  useEffect(() => {
    fetchLogs(activeTab);
  }, [activeTab]);

  useEffect(() => {
    let interval;
    if (autoRefresh && !isStreaming) {
      interval = setInterval(() => fetchLogs(activeTab, true), 5000);
    }
    return () => clearInterval(interval);
  }, [autoRefresh, activeTab, isStreaming]);

  // Start/stop streaming when isStreaming changes
  useEffect(() => {
    if (isStreaming) {
      startStreaming();
    } else {
      stopStreaming();
    }
    return () => stopStreaming();
  }, [isStreaming, activeTab]);

  const startStreaming = () => {
    stopStreaming(); // Close any existing connection
    
    const token = localStorage.getItem('token');
    if (!token) {
      toast.error('Authentication required for log streaming');
      setIsStreaming(false);
      return;
    }
    
    // Note: EventSource doesn't support custom headers, so we use a workaround
    // For production, you'd want to use a library like eventsource or fetch with ReadableStream
    const streamUrl = `${API}/logs/stream/${activeTab}`;
    
    try {
      eventSourceRef.current = new EventSource(streamUrl);
      
      eventSourceRef.current.onmessage = (event) => {
        try {
          const logEntry = JSON.parse(event.data);
          if (!logEntry.error) {
            setStreamingLogs(prev => {
              const newLogs = [logEntry, ...prev].slice(0, 100); // Keep last 100
              return newLogs;
            });
            // Auto-scroll to top when new logs arrive
            if (logContainerRef.current) {
              logContainerRef.current.scrollTop = 0;
            }
          }
        } catch (e) {
          console.error('Error parsing log:', e);
        }
      };
      
      eventSourceRef.current.onerror = () => {
        console.log('SSE connection error, falling back to polling');
        stopStreaming();
        setIsStreaming(false);
        setAutoRefresh(true);
      };
      
      toast.success('Real-time streaming started');
    } catch (error) {
      console.error('Failed to start streaming:', error);
      setIsStreaming(false);
    }
  };

  const stopStreaming = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  };

  const toggleStreaming = () => {
    if (isStreaming) {
      setIsStreaming(false);
      setAutoRefresh(false);
      toast.info('Streaming stopped');
    } else {
      setAutoRefresh(false);
      setIsStreaming(true);
    }
  };

  const fetchLogs = async (logType, silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await axios.get(`${API}/logs/${logType}`, {
        params: { limit: 500 }
      });
      setLogs(res.data.logs || []);
    } catch (error) {
      if (!silent) {
        toast.error('Failed to fetch logs');
      }
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  const generateSampleLogs = (logType) => {
    const now = new Date();
    const levels = ['INFO', 'INFO', 'INFO', 'WARNING', 'ERROR', 'SUCCESS'];
    const messages = {
      system: [
        'Server started successfully',
        'Database connection established',
        'Memory usage at 45%',
        'CPU usage spike detected',
        'Scheduled task completed',
        'Cache cleared'
      ],
      api: [
        'POST /api/auth/login - 200 OK',
        'GET /api/orders - 200 OK',
        'POST /api/orders - 201 Created',
        'GET /api/users - 401 Unauthorized',
        'PUT /api/orders/123 - 200 OK',
        'DELETE /api/orders/456 - 404 Not Found'
      ],
      ui: [
        'User navigated to Dashboard',
        'Form submitted: Create Order',
        'Modal opened: User Profile',
        'Button clicked: Submit Request',
        'Page load time: 1.2s',
        'Component error: undefined property'
      ],
      user: [
        'User admin@redribbonops.com logged in',
        'User created new order RRG-000001',
        'Password changed for user@test.com',
        'User profile updated',
        'File uploaded: document.pdf',
        'Order status changed to Delivered'
      ]
    };

    return Array.from({ length: 50 }, (_, i) => ({
      id: `log-${i}`,
      timestamp: new Date(now - i * 60000 * Math.random() * 10).toISOString(),
      level: levels[Math.floor(Math.random() * levels.length)],
      message: messages[logType][Math.floor(Math.random() * messages[logType].length)],
      source: logType,
      details: i % 5 === 0 ? { extra: 'Additional context info' } : null
    })).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  };

  const handleDownload = () => {
    const content = logs.map(log => 
      `[${log.timestamp}] [${log.level}] ${log.message}`
    ).join('\n');
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeTab}-logs-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast.success('Logs downloaded');
  };

  const filteredLogs = [...(isStreaming ? streamingLogs : logs)].filter(log => {
    const matchesSearch = log.message?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesLevel = levelFilter === 'all' || log.level === levelFilter;
    return matchesSearch && matchesLevel;
  });

  const scrollToBottom = () => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in" data-testid="logs-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">System Logs</h1>
          <p className="text-slate-500 mt-1">View and export application logs</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={isStreaming ? "default" : "outline"}
            onClick={toggleStreaming}
            className={isStreaming ? "bg-rose-600 hover:bg-rose-700" : ""}
            data-testid="stream-logs-btn"
          >
            {isStreaming ? (
              <>
                <Pause size={16} className="mr-2" />
                Stop Streaming
              </>
            ) : (
              <>
                <Radio size={16} className="mr-2" />
                Live Stream
              </>
            )}
          </Button>
          <Button
            variant={autoRefresh && !isStreaming ? "default" : "outline"}
            onClick={() => {
              if (!isStreaming) {
                setAutoRefresh(!autoRefresh);
              }
            }}
            className={autoRefresh && !isStreaming ? "bg-green-600 hover:bg-green-700" : ""}
            disabled={isStreaming}
            data-testid="auto-refresh-btn"
          >
            <RefreshCw size={16} className={`mr-2 ${autoRefresh && !isStreaming ? 'animate-spin' : ''}`} />
            {autoRefresh && !isStreaming ? 'Polling ON' : 'Poll (5s)'}
          </Button>
          <Button variant="outline" onClick={handleDownload} data-testid="download-logs-btn">
            <Download size={16} className="mr-2" />
            Download
          </Button>
        </div>
      </div>

      {/* Streaming Status Banner */}
      {isStreaming && (
        <div className="flex items-center gap-2 px-4 py-2 bg-rose-50 border border-rose-200 rounded-lg">
          <div className="w-2 h-2 bg-rose-500 rounded-full animate-pulse" />
          <span className="text-sm font-medium text-rose-700">
            Live streaming logs for {activeTab}
          </span>
          <span className="text-sm text-rose-500">
            ({streamingLogs.length} logs received)
          </span>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-4 w-full max-w-md">
          <TabsTrigger value="system" className="flex items-center gap-2" data-testid="system-logs-tab">
            <Server size={14} />
            System
          </TabsTrigger>
          <TabsTrigger value="api" className="flex items-center gap-2" data-testid="api-logs-tab">
            <Globe size={14} />
            API
          </TabsTrigger>
          <TabsTrigger value="ui" className="flex items-center gap-2" data-testid="ui-logs-tab">
            <Activity size={14} />
            UI
          </TabsTrigger>
          <TabsTrigger value="user" className="flex items-center gap-2" data-testid="user-logs-tab">
            <Users size={14} />
            User
          </TabsTrigger>
        </TabsList>

        <div className="mt-6">
          <Card className="border-slate-200">
            <CardHeader className="border-b border-slate-100 pb-4">
              <div className="flex flex-col sm:flex-row gap-4">
                {/* Search */}
                <div className="relative flex-1">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search logs..."
                    className="pl-9"
                    data-testid="log-search-input"
                  />
                </div>
                
                {/* Level Filter */}
                <Select value={levelFilter} onValueChange={setLevelFilter}>
                  <SelectTrigger className="w-40" data-testid="level-filter">
                    <SelectValue placeholder="Log Level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Levels</SelectItem>
                    <SelectItem value="ERROR">Error</SelectItem>
                    <SelectItem value="WARNING">Warning</SelectItem>
                    <SelectItem value="INFO">Info</SelectItem>
                    <SelectItem value="SUCCESS">Success</SelectItem>
                    <SelectItem value="DEBUG">Debug</SelectItem>
                  </SelectContent>
                </Select>

                {/* Refresh */}
                <Button 
                  variant="outline" 
                  onClick={() => fetchLogs(activeTab)}
                  disabled={loading}
                >
                  <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex items-center justify-center h-64">
                  <div className="animate-spin h-8 w-8 border-4 border-rose-600 border-t-transparent rounded-full" />
                </div>
              ) : filteredLogs.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-slate-500">
                  <FileText size={48} className="text-slate-300 mb-3" />
                  <p>No logs found</p>
                </div>
              ) : (
                <div 
                  ref={logContainerRef}
                  className="h-[500px] overflow-y-auto font-mono text-sm"
                  data-testid="logs-container"
                >
                  {filteredLogs.map((log, index) => {
                    const LevelIcon = LOG_LEVELS[log.level]?.icon || Info;
                    return (
                      <div 
                        key={log.id || index}
                        className={`flex items-start gap-3 px-4 py-2 border-b border-slate-100 hover:bg-slate-50 ${
                          index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                        }`}
                      >
                        <span className="text-xs text-slate-400 shrink-0 w-44">
                          {format(new Date(log.timestamp), 'MMM dd HH:mm:ss.SSS')}
                        </span>
                        <Badge className={`shrink-0 ${LOG_LEVELS[log.level]?.color || 'bg-slate-100'}`}>
                          <LevelIcon size={12} className="mr-1" />
                          {log.level}
                        </Badge>
                        <span className="text-slate-700 break-all">{log.message}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* Stats Footer */}
          <div className="flex items-center justify-between mt-4 text-sm text-slate-500">
            <span>Showing {filteredLogs.length} of {logs.length} logs</span>
            <Button variant="link" onClick={scrollToBottom} className="text-rose-600">
              Scroll to latest
            </Button>
          </div>
        </div>
      </Tabs>
    </div>
  );
}
