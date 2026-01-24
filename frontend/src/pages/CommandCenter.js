import { useState, useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { 
  Plus,
  Search,
  Video,
  Lightbulb,
  Bug,
  ChevronRight,
  Clock,
  FileText,
  ArrowRight,
  Upload,
  X,
  File,
  Image,
  FileVideo,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Allowed file extensions (safe files only)
const ALLOWED_EXTENSIONS = [
  // Images
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp',
  // Documents
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.rtf', '.csv',
  // Videos
  '.mp4', '.mov', '.avi', '.mkv', '.webm',
  // Audio
  '.mp3', '.wav', '.ogg', '.m4a',
  // Archives
  '.zip', '.rar', '.7z'
];

// Blocked extensions (dangerous files)
const BLOCKED_EXTENSIONS = [
  '.exe', '.bat', '.cmd', '.msi', '.dll', '.scr', '.pif', '.com',
  '.js', '.vbs', '.vbe', '.jse', '.ws', '.wsf', '.wsc', '.wsh',
  '.ps1', '.psm1', '.psd1', '.ps1xml', '.psc1', '.msc',
  '.hta', '.cpl', '.msp', '.inf', '.reg', '.jar', '.sh', '.bash'
];

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const statusColors = {
  'Open': 'bg-blue-100 text-blue-700',
  'In Progress': 'bg-amber-100 text-amber-700',
  'Pending': 'bg-purple-100 text-purple-700',
  'Delivered': 'bg-green-100 text-green-700',
  'Closed': 'bg-slate-100 text-slate-500',
};

const requestTypeColors = {
  'Editing': 'bg-rose-100 text-rose-700',
  'Feature': 'bg-indigo-100 text-indigo-700',
  'Bug': 'bg-red-100 text-red-700',
};

const priorityColors = {
  'Low': 'bg-slate-100 text-slate-600',
  'Normal': 'bg-blue-100 text-blue-600',
  'High': 'bg-orange-100 text-orange-600',
  'Urgent': 'bg-red-100 text-red-600',
};

export default function CommandCenter() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const preselectedCategory = searchParams.get('category');
  
  const [activeTab, setActiveTab] = useState('create');
  const [categoriesL1, setCategoriesL1] = useState([]);
  const [categoriesL2, setCategoriesL2] = useState([]);
  const [myRequests, setMyRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categorySearch, setCategorySearch] = useState('');
  
  // Form state
  const [selectedL1, setSelectedL1] = useState('');
  const [selectedL2, setSelectedL2] = useState('');
  const [requestType, setRequestType] = useState('Request');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [attachments, setAttachments] = useState([]);
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (preselectedCategory && categoriesL1.length > 0) {
      const bugCategory = categoriesL1.find(c => c.name.toLowerCase().includes('bug'));
      const featureCategory = categoriesL1.find(c => c.name.toLowerCase().includes('feature'));
      
      if (preselectedCategory === 'bug' && bugCategory) {
        setSelectedL1(bugCategory.id);
        setRequestType('Bug');
      } else if (preselectedCategory === 'feature' && featureCategory) {
        setSelectedL1(featureCategory.id);
        setRequestType('Request');
      }
    }
  }, [preselectedCategory, categoriesL1]);

  useEffect(() => {
    if (selectedL1) {
      fetchCategoriesL2(selectedL1);
    } else {
      setCategoriesL2([]);
    }
  }, [selectedL1]);

  const fetchData = async () => {
    try {
      const [l1Res, requestsRes] = await Promise.all([
        axios.get(`${API}/categories/l1`),
        axios.get(`${API}/my-requests`)
      ]);
      setCategoriesL1(l1Res.data);
      setMyRequests(requestsRes.data);
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const fetchCategoriesL2 = async (l1Id) => {
    try {
      const res = await axios.get(`${API}/categories/l2?category_l1_id=${l1Id}`);
      setCategoriesL2(res.data);
    } catch (error) {
      console.error('Failed to load L2 categories');
    }
  };

  const getSelectedL2Details = () => {
    return categoriesL2.find(c => c.id === selectedL2);
  };

  const getSelectedL1Details = () => {
    return categoriesL1.find(c => c.id === selectedL1);
  };

  const filteredL1Categories = categoriesL1.filter(c =>
    c.name.toLowerCase().includes(categorySearch.toLowerCase())
  );

  const getCategoryIcon = (name) => {
    if (name?.toLowerCase().includes('media')) return Video;
    if (name?.toLowerCase().includes('feature')) return Lightbulb;
    if (name?.toLowerCase().includes('bug')) return Bug;
    return FileText;
  };

  // File validation
  const validateFile = (file) => {
    const extension = '.' + file.name.split('.').pop().toLowerCase();
    
    // Check blocked extensions
    if (BLOCKED_EXTENSIONS.includes(extension)) {
      toast.error(`File type ${extension} is not allowed for security reasons`);
      return false;
    }
    
    // Check allowed extensions
    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      toast.error(`File type ${extension} is not supported`);
      return false;
    }
    
    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      toast.error(`File "${file.name}" exceeds 50 MB limit`);
      return false;
    }
    
    return true;
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    const validFiles = [];
    
    for (const file of files) {
      if (validateFile(file)) {
        // Check total size
        const currentSize = attachments.reduce((sum, f) => sum + f.size, 0);
        if (currentSize + file.size > MAX_FILE_SIZE) {
          toast.error('Total attachments cannot exceed 50 MB');
          break;
        }
        validFiles.push(file);
      }
    }
    
    setAttachments(prev => [...prev, ...validFiles]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeAttachment = (index) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const getFileIcon = (fileName) => {
    const ext = fileName.split('.').pop().toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) return Image;
    if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext)) return FileVideo;
    return File;
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-rose-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  const selectedL1Details = getSelectedL1Details();
  const selectedL2Details = getSelectedL2Details();
  const showEditingForm = selectedL2Details?.triggers_editor_workflow;
  const showFeatureForm = selectedL1Details?.name?.toLowerCase().includes('feature') && !showEditingForm;
  const showBugForm = selectedL1Details?.name?.toLowerCase().includes('bug') && !showEditingForm;

  return (
    <div className="space-y-6 animate-fade-in" data-testid="command-center-page">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Command Center</h1>
        <p className="text-slate-500 mt-1">Place requests, report issues, or request new features</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="create" className="data-[state=active]:bg-rose-600 data-[state=active]:text-white" data-testid="create-tab">
            <Plus size={16} className="mr-2" />
            Create New Request
          </TabsTrigger>
          <TabsTrigger value="my-requests" data-testid="my-requests-tab">
            <FileText size={16} className="mr-2" />
            My Requests ({myRequests.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="create" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Form Area */}
            <div className="lg:col-span-2">
              <Card className="border-slate-200">
                <CardHeader className="border-b border-slate-100 pb-4">
                  <CardTitle>Create New Request</CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  {/* Title */}
                  <div>
                    <Label>Title</Label>
                    <Input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Put the title of your request, order, or issue..."
                      className="mt-1.5"
                      data-testid="request-title-input"
                    />
                  </div>

                  {/* Request Type */}
                  <div>
                    <Label>Request Type</Label>
                    <div className="flex gap-4 mt-2">
                      <label className={`flex items-center gap-2 p-3 border rounded-lg cursor-pointer transition-all ${requestType === 'Request' ? 'border-rose-500 bg-rose-50' : 'border-slate-200 hover:border-slate-300'}`}>
                        <input
                          type="radio"
                          name="requestType"
                          value="Request"
                          checked={requestType === 'Request'}
                          onChange={(e) => setRequestType(e.target.value)}
                          className="sr-only"
                        />
                        <Lightbulb size={18} className={requestType === 'Request' ? 'text-rose-600' : 'text-slate-400'} />
                        <span className={requestType === 'Request' ? 'text-rose-700 font-medium' : 'text-slate-600'}>Request</span>
                      </label>
                      <label className={`flex items-center gap-2 p-3 border rounded-lg cursor-pointer transition-all ${requestType === 'Bug' ? 'border-rose-500 bg-rose-50' : 'border-slate-200 hover:border-slate-300'}`}>
                        <input
                          type="radio"
                          name="requestType"
                          value="Bug"
                          checked={requestType === 'Bug'}
                          onChange={(e) => setRequestType(e.target.value)}
                          className="sr-only"
                        />
                        <Bug size={18} className={requestType === 'Bug' ? 'text-rose-600' : 'text-slate-400'} />
                        <span className={requestType === 'Bug' ? 'text-rose-700 font-medium' : 'text-slate-600'}>Incident / Issues</span>
                      </label>
                    </div>
                  </div>

                  {/* Description */}
                  <div>
                    <Label>Describe your Issue/Request *</Label>
                    <Textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Please describe your request or issue in detail. The more information you provide, the better we can assist you..."
                      className="mt-1.5 min-h-[120px]"
                      data-testid="request-description-input"
                    />
                  </div>

                  {/* File Attachments */}
                  <div>
                    <Label>Attachments</Label>
                    <p className="text-xs text-slate-500 mt-1 mb-2">
                      Upload screenshots, documents, or files (max 50 MB total). Supported: images, PDFs, documents, videos, audio.
                    </p>
                    
                    {/* Upload Area */}
                    <div 
                      className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:border-rose-400 transition-colors cursor-pointer"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        onChange={handleFileSelect}
                        className="hidden"
                        accept={ALLOWED_EXTENSIONS.join(',')}
                        data-testid="file-upload-input"
                      />
                      <Upload size={32} className="mx-auto text-slate-400 mb-2" />
                      <p className="text-sm text-slate-600">Click to upload or drag and drop</p>
                      <p className="text-xs text-slate-400 mt-1">Max 50 MB • No executable files</p>
                    </div>

                    {/* Attached Files List */}
                    {attachments.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {attachments.map((file, index) => {
                          const FileIcon = getFileIcon(file.name);
                          return (
                            <div key={index} className="flex items-center gap-3 p-2 bg-slate-50 rounded-lg">
                              <FileIcon size={18} className="text-slate-500" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-slate-700 truncate">{file.name}</p>
                                <p className="text-xs text-slate-400">{formatFileSize(file.size)}</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => removeAttachment(index)}
                                className="p-1 hover:bg-slate-200 rounded"
                              >
                                <X size={16} className="text-slate-500" />
                              </button>
                            </div>
                          );
                        })}
                        <p className="text-xs text-slate-500">
                          Total: {formatFileSize(attachments.reduce((sum, f) => sum + f.size, 0))} / 50 MB
                        </p>
                      </div>
                    )}

                    {/* Security Notice */}
                    <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
                      <AlertCircle size={16} className="text-amber-600 mt-0.5 shrink-0" />
                      <p className="text-xs text-amber-700">
                        For security, executable files (.exe, .bat, .js, etc.) are blocked. If you need to share code or scripts, please use a .txt or .zip file.
                      </p>
                    </div>
                  </div>

                  {/* Dynamic Form Based on Category */}
                  {selectedL2 && (
                    <div className="pt-4 border-t border-slate-100">
                      {showEditingForm && (
                        <EditingRequestForm 
                          title={title}
                          description={description}
                          attachments={attachments}
                          categoryL1Id={selectedL1}
                          categoryL2Id={selectedL2}
                          onSuccess={() => {
                            setTitle('');
                            setDescription('');
                            setAttachments([]);
                            setSelectedL1('');
                            setSelectedL2('');
                            fetchData();
                            toast.success('Editing request submitted!');
                          }}
                        />
                      )}
                      {showFeatureForm && (
                        <FeatureRequestForm
                          title={title}
                          description={description}
                          attachments={attachments}
                          categoryL1Id={selectedL1}
                          categoryL2Id={selectedL2}
                          onSuccess={() => {
                            setTitle('');
                            setDescription('');
                            setAttachments([]);
                            setSelectedL1('');
                            setSelectedL2('');
                            fetchData();
                            toast.success('Feature request submitted!');
                          }}
                        />
                      )}
                      {showBugForm && (
                        <BugReportForm
                          title={title}
                          description={description}
                          attachments={attachments}
                          categoryL1Id={selectedL1}
                          categoryL2Id={selectedL2}
                          bugType={selectedL2Details?.name || ''}
                          onSuccess={() => {
                            setTitle('');
                            setDescription('');
                            setAttachments([]);
                            setSelectedL1('');
                            setSelectedL2('');
                            fetchData();
                            toast.success('Bug report submitted!');
                          }}
                        />
                      )}
                    </div>
                  )}

                  {!selectedL2 && (
                    <div className="p-8 text-center text-slate-500 bg-slate-50 rounded-lg">
                      <FileText size={48} className="mx-auto text-slate-300 mb-3" />
                      <p>Select a category to continue</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Category Selection Panel */}
            <div>
              <Card className="border-slate-200">
                <CardHeader className="border-b border-slate-100 pb-4">
                  <CardTitle className="text-base">Categorization</CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                  {/* Search */}
                  <div className="relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <Input
                      value={categorySearch}
                      onChange={(e) => setCategorySearch(e.target.value)}
                      placeholder="Type to find a category faster..."
                      className="pl-9 text-sm"
                    />
                  </div>

                  {/* Category L1 */}
                  <div>
                    <Label className="text-xs text-slate-500">Category Level 1</Label>
                    <Select value={selectedL1} onValueChange={(v) => { setSelectedL1(v); setSelectedL2(''); }}>
                      <SelectTrigger className="mt-1.5" data-testid="category-l1-select">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredL1Categories.map(cat => {
                          const Icon = getCategoryIcon(cat.name);
                          return (
                            <SelectItem key={cat.id} value={cat.id}>
                              <div className="flex items-center gap-2">
                                <Icon size={14} />
                                {cat.name}
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Category L2 */}
                  {selectedL1 && (
                    <div>
                      <Label className="text-xs text-slate-500">Category Level 2</Label>
                      <Select value={selectedL2} onValueChange={setSelectedL2}>
                        <SelectTrigger className="mt-1.5" data-testid="category-l2-select">
                          <SelectValue placeholder="Select specific category" />
                        </SelectTrigger>
                        <SelectContent>
                          {categoriesL2.map(cat => (
                            <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Selected Path */}
                  {selectedL1 && (
                    <div className="p-3 bg-slate-50 rounded-lg">
                      <p className="text-xs text-slate-500 mb-1">Selected Path:</p>
                      <div className="flex items-center gap-1 text-sm">
                        <span className="font-medium">{selectedL1Details?.name}</span>
                        {selectedL2Details && (
                          <>
                            <ChevronRight size={14} className="text-slate-400" />
                            <span className="font-medium text-rose-600">{selectedL2Details.name}</span>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="my-requests" className="mt-6">
          <Card className="border-slate-200">
            <CardHeader className="border-b border-slate-100 pb-4">
              <CardTitle>My Requests</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {myRequests.length === 0 ? (
                <div className="p-12 text-center text-slate-500">
                  <FileText size={48} className="mx-auto text-slate-300 mb-3" />
                  <p>No requests yet</p>
                  <Button 
                    variant="link" 
                    onClick={() => setActiveTab('create')}
                    className="text-rose-600 mt-2"
                  >
                    Create your first request
                  </Button>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {myRequests.map(request => (
                    <Link
                      key={request.id}
                      to={request.request_type === 'Editing' ? `/orders/${request.id}` : `/requests/${request.request_type.toLowerCase()}/${request.id}`}
                      className="flex items-center gap-4 p-4 hover:bg-slate-50 transition-colors"
                      data-testid={`request-row-${request.code}`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs text-slate-500">{request.code}</span>
                          <Badge className={requestTypeColors[request.request_type]}>{request.request_type}</Badge>
                          <Badge className={statusColors[request.status]}>{request.status}</Badge>
                        </div>
                        <p className="font-medium text-slate-900 mt-1 truncate">{request.title}</p>
                        <p className="text-sm text-slate-500">
                          {request.category_l1_name && request.category_l2_name 
                            ? `${request.category_l1_name} → ${request.category_l2_name}`
                            : request.category_l1_name || 'Uncategorized'
                          }
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <Badge className={priorityColors[request.priority_or_severity]}>{request.priority_or_severity}</Badge>
                        <p className="text-xs text-slate-400 mt-1">
                          {format(new Date(request.updated_at), 'MMM d, yyyy')}
                        </p>
                      </div>
                      <ArrowRight size={16} className="text-slate-400" />
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Editing Request Form (reuses existing workflow)
function EditingRequestForm({ title, description, attachments, categoryL1Id, categoryL2Id, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    priority: 'Normal',
    video_script: '',
    reference_links: '',
    footage_links: '',
    music_preference: '',
    delivery_format: '',
    special_instructions: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title) {
      toast.error('Please enter a title');
      return;
    }
    if (!description) {
      toast.error('Please enter a description');
      return;
    }

    setLoading(true);
    try {
      await axios.post(`${API}/orders`, {
        title,
        description,
        category_l1_id: categoryL1Id,
        category_l2_id: categoryL2Id,
        attachment_count: attachments?.length || 0,
        ...formData
      });
      onSuccess();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to submit request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg">
        <p className="text-sm text-rose-700 font-medium">Editing Services Request</p>
        <p className="text-xs text-rose-600">This will create an editing order that editors can pick up.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label>Priority</Label>
          <Select value={formData.priority} onValueChange={(v) => setFormData(prev => ({ ...prev, priority: v }))}>
            <SelectTrigger className="mt-1.5">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Low">Low</SelectItem>
              <SelectItem value="Normal">Normal</SelectItem>
              <SelectItem value="High">High</SelectItem>
              <SelectItem value="Urgent">Urgent</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Delivery Format</Label>
          <Input
            value={formData.delivery_format}
            onChange={(e) => setFormData(prev => ({ ...prev, delivery_format: e.target.value }))}
            placeholder="e.g., 1080p MP4, 9:16 for Instagram"
            className="mt-1.5"
          />
        </div>
      </div>

      <div>
        <Label>Description *</Label>
        <Textarea
          value={formData.description}
          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          placeholder="Describe what you need edited..."
          className="mt-1.5 min-h-[100px]"
        />
      </div>

      <div>
        <Label>Video Script</Label>
        <Textarea
          value={formData.video_script}
          onChange={(e) => setFormData(prev => ({ ...prev, video_script: e.target.value }))}
          placeholder="Paste your video script here..."
          className="mt-1.5"
        />
      </div>

      <div>
        <Label>Footage Links</Label>
        <Textarea
          value={formData.footage_links}
          onChange={(e) => setFormData(prev => ({ ...prev, footage_links: e.target.value }))}
          placeholder="Links to raw footage (Google Drive, Dropbox, etc.)"
          className="mt-1.5"
        />
      </div>

      <div>
        <Label>Reference Links</Label>
        <Textarea
          value={formData.reference_links}
          onChange={(e) => setFormData(prev => ({ ...prev, reference_links: e.target.value }))}
          placeholder="Links to example videos or inspiration..."
          className="mt-1.5"
        />
      </div>

      <div>
        <Label>Music Preference</Label>
        <Input
          value={formData.music_preference}
          onChange={(e) => setFormData(prev => ({ ...prev, music_preference: e.target.value }))}
          placeholder="e.g., Upbeat, corporate, link to specific track..."
          className="mt-1.5"
        />
      </div>

      <div>
        <Label>Special Instructions</Label>
        <Textarea
          value={formData.special_instructions}
          onChange={(e) => setFormData(prev => ({ ...prev, special_instructions: e.target.value }))}
          placeholder="Any other details or requirements..."
          className="mt-1.5"
        />
      </div>

      <Button type="submit" className="w-full bg-rose-600 hover:bg-rose-700" disabled={loading}>
        {loading ? 'Submitting...' : 'Submit Editing Request'}
      </Button>
    </form>
  );
}

// Feature Request Form
function FeatureRequestForm({ title, categoryL1Id, categoryL2Id, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    description: '',
    why_important: '',
    who_is_for: '',
    reference_links: '',
    priority: 'Normal'
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title) {
      toast.error('Please enter a title');
      return;
    }
    if (!formData.description) {
      toast.error('Please describe your request');
      return;
    }

    setLoading(true);
    try {
      await axios.post(`${API}/feature-requests`, {
        title,
        category_l1_id: categoryL1Id,
        category_l2_id: categoryL2Id,
        ...formData
      });
      onSuccess();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to submit request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
        <p className="text-sm text-indigo-700 font-medium">Feature Request</p>
        <p className="text-xs text-indigo-600">Tell us about the feature or service you'd like to see.</p>
      </div>

      <div>
        <Label>What are you requesting? *</Label>
        <Textarea
          value={formData.description}
          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          placeholder="Describe the feature or service you're requesting..."
          className="mt-1.5 min-h-[100px]"
        />
      </div>

      <div>
        <Label>Why is this important / what problem does it solve?</Label>
        <Textarea
          value={formData.why_important}
          onChange={(e) => setFormData(prev => ({ ...prev, why_important: e.target.value }))}
          placeholder="Explain the value this would provide..."
          className="mt-1.5"
        />
      </div>

      <div>
        <Label>Who is this for?</Label>
        <Input
          value={formData.who_is_for}
          onChange={(e) => setFormData(prev => ({ ...prev, who_is_for: e.target.value }))}
          placeholder="e.g., All users, Marketing team, Clients..."
          className="mt-1.5"
        />
      </div>

      <div>
        <Label>Example / Reference Links</Label>
        <Textarea
          value={formData.reference_links}
          onChange={(e) => setFormData(prev => ({ ...prev, reference_links: e.target.value }))}
          placeholder="Links to examples or references..."
          className="mt-1.5"
        />
      </div>

      <div>
        <Label>Priority</Label>
        <Select value={formData.priority} onValueChange={(v) => setFormData(prev => ({ ...prev, priority: v }))}>
          <SelectTrigger className="mt-1.5">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Low">Low</SelectItem>
            <SelectItem value="Normal">Normal</SelectItem>
            <SelectItem value="High">High</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700" disabled={loading}>
        {loading ? 'Submitting...' : 'Submit Feature Request'}
      </Button>
    </form>
  );
}

// Bug Report Form
function BugReportForm({ title, categoryL1Id, categoryL2Id, bugType, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    bug_type: bugType,
    steps_to_reproduce: '',
    expected_behavior: '',
    actual_behavior: '',
    browser: '',
    device: '',
    url_page: '',
    severity: 'Normal'
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title) {
      toast.error('Please enter a title');
      return;
    }
    if (!formData.steps_to_reproduce) {
      toast.error('Please describe the steps to reproduce');
      return;
    }
    if (!formData.expected_behavior || !formData.actual_behavior) {
      toast.error('Please describe expected and actual behavior');
      return;
    }

    setLoading(true);
    try {
      await axios.post(`${API}/bug-reports`, {
        title,
        category_l1_id: categoryL1Id,
        category_l2_id: categoryL2Id,
        ...formData
      });
      onSuccess();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to submit bug report');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-sm text-red-700 font-medium">Bug Report</p>
        <p className="text-xs text-red-600">Help us fix this issue by providing details.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label>Bug Type</Label>
          <Select value={formData.bug_type} onValueChange={(v) => setFormData(prev => ({ ...prev, bug_type: v }))}>
            <SelectTrigger className="mt-1.5">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="UI Bug">UI Bug</SelectItem>
              <SelectItem value="Button / Click Bug">Button / Click Bug</SelectItem>
              <SelectItem value="Login / Access Bug">Login / Access Bug</SelectItem>
              <SelectItem value="Payment / Checkout Bug">Payment / Checkout Bug</SelectItem>
              <SelectItem value="Other Bug">Other Bug</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Severity</Label>
          <Select value={formData.severity} onValueChange={(v) => setFormData(prev => ({ ...prev, severity: v }))}>
            <SelectTrigger className="mt-1.5">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Low">Low</SelectItem>
              <SelectItem value="Normal">Normal</SelectItem>
              <SelectItem value="High">High</SelectItem>
              <SelectItem value="Urgent">Urgent</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label>Steps to Reproduce *</Label>
        <Textarea
          value={formData.steps_to_reproduce}
          onChange={(e) => setFormData(prev => ({ ...prev, steps_to_reproduce: e.target.value }))}
          placeholder="1. Go to...\n2. Click on...\n3. See error..."
          className="mt-1.5 min-h-[100px]"
        />
      </div>

      <div>
        <Label>Expected Behavior *</Label>
        <Textarea
          value={formData.expected_behavior}
          onChange={(e) => setFormData(prev => ({ ...prev, expected_behavior: e.target.value }))}
          placeholder="What should have happened?"
          className="mt-1.5"
        />
      </div>

      <div>
        <Label>Actual Behavior *</Label>
        <Textarea
          value={formData.actual_behavior}
          onChange={(e) => setFormData(prev => ({ ...prev, actual_behavior: e.target.value }))}
          placeholder="What actually happened?"
          className="mt-1.5"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <Label>Browser</Label>
          <Select value={formData.browser} onValueChange={(v) => setFormData(prev => ({ ...prev, browser: v }))}>
            <SelectTrigger className="mt-1.5">
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Chrome">Chrome</SelectItem>
              <SelectItem value="Safari">Safari</SelectItem>
              <SelectItem value="Firefox">Firefox</SelectItem>
              <SelectItem value="Edge">Edge</SelectItem>
              <SelectItem value="Other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Device</Label>
          <Select value={formData.device} onValueChange={(v) => setFormData(prev => ({ ...prev, device: v }))}>
            <SelectTrigger className="mt-1.5">
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Desktop">Desktop</SelectItem>
              <SelectItem value="Mobile">Mobile</SelectItem>
              <SelectItem value="Tablet">Tablet</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>URL/Page</Label>
          <Input
            value={formData.url_page}
            onChange={(e) => setFormData(prev => ({ ...prev, url_page: e.target.value }))}
            placeholder="Where did it happen?"
            className="mt-1.5"
          />
        </div>
      </div>

      <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
        <p className="text-sm text-amber-700">
          <strong>Tip:</strong> Add screenshots or screen recordings if possible to help us understand the issue better.
        </p>
      </div>

      <Button type="submit" className="w-full bg-red-600 hover:bg-red-700" disabled={loading}>
        {loading ? 'Submitting...' : 'Submit Bug Report'}
      </Button>
    </form>
  );
}
