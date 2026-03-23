import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';
import {
  LayoutDashboard,
  Plus,
  Edit,
  Trash2,
  Copy,
  Eye,
  Save,
  X,
  GripVertical,
  Inbox,
  Clock,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Layers,
  TrendingUp,
  BarChart3,
  PieChart,
  Activity,
  Target,
  List,
  Bell,
  ArrowLeft,
  Settings,
  Users
} from 'lucide-react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Widget icon mapping
const WIDGET_ICONS = {
  'kpi_card': Inbox,
  'chart': BarChart3,
  'ticket_list': List,
  'announcements': Bell
};

// Size options
const SIZE_OPTIONS = [
  { value: 'small', label: 'Small (4 cols)', cols: 4 },
  { value: 'medium', label: 'Medium (6 cols)', cols: 6 },
  { value: 'large', label: 'Large (12 cols)', cols: 12 }
];

// Sortable Widget Item
function SortableWidgetItem({ widget, onRemove, onResize }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: widget.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  };

  const Icon = WIDGET_ICONS[widget.widget_type] || Inbox;
  const sizeInfo = SIZE_OPTIONS.find(s => s.value === widget.size) || SIZE_OPTIONS[1];

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`p-4 border rounded-lg bg-white shadow-sm ${isDragging ? 'ring-2 ring-rose-500' : ''}`}
    >
      <div className="flex items-center gap-3">
        <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing hover:text-slate-600">
          <GripVertical size={20} />
        </button>
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${widget.config?.color || 'bg-slate-500'}`}>
          <Icon size={20} className="text-white" />
        </div>
        <div className="flex-1">
          <p className="font-medium">{widget.title}</p>
          <p className="text-xs">{widget.widget_type} · {sizeInfo.label}</p>
        </div>
        <Select value={widget.size} onValueChange={(value) => onResize(widget.id, value)}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SIZE_OPTIONS.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="ghost" size="icon" onClick={() => onRemove(widget.id)} className="text-red-500 hover:text-red-700">
          <X size={18} />
        </Button>
      </div>
    </div>
  );
}

// Widget Library Item
function WidgetLibraryItem({ widget, onAdd }) {
  const Icon = WIDGET_ICONS[widget.widget_type] || Inbox;

  return (
    <div 
      className="p-3 border rounded-lg bg-white cursor-pointer transition-colors"
      onClick={() => onAdd(widget)}
    >
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${widget.config?.color || 'bg-slate-500'}`}>
          <Icon size={16} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{widget.title}</p>
          <p className="text-xs">{widget.category}</p>
        </div>
        <Plus size={16} className="" />
      </div>
    </div>
  );
}

// Dashboard Card
function DashboardCard({ dashboard, onEdit, onClone, onDelete, onPreview }) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-rose-500 to-rose-600 rounded-xl flex items-center justify-center">
              <LayoutDashboard size={24} className="text-white" />
            </div>
            <div>
              <h3 className="font-semibold">{dashboard.name}</h3>
              <p className="text-sm line-clamp-1">{dashboard.description}</p>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="text-xs">
                  {dashboard.widgets?.length || 0} widgets
                </Badge>
                {dashboard.is_system && (
                  <Badge className="text-xs">System</Badge>
                )}
                {dashboard.is_default_for && (
                  <Badge className="text-xs">
                    Default: {dashboard.is_default_for}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => onPreview(dashboard)} title="Preview">
              <Eye size={16} />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => onClone(dashboard)} title="Clone">
              <Copy size={16} />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => onEdit(dashboard)} title="Edit">
              <Edit size={16} />
            </Button>
            {!dashboard.is_system && (
              <Button variant="ghost" size="icon" onClick={() => onDelete(dashboard)} title="Delete" className="text-red-500 hover:text-red-700">
                <Trash2 size={16} />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Main Component
export default function DashboardBuilder() {
const navigate = useNavigate();
  
  const [dashboards, setDashboards] = useState([]);
  const [widgetLibrary, setWidgetLibrary] = useState({ widgets: [], categories: {} });
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState([]);
  
  // Editor state
  const [editingDashboard, setEditingDashboard] = useState(null);
  const [editorWidgets, setEditorWidgets] = useState([]);
  const [dashboardName, setDashboardName] = useState('');
  const [dashboardDescription, setDashboardDescription] = useState('');
  
  // Dialog states
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showCloneDialog, setShowCloneDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [selectedDashboard, setSelectedDashboard] = useState(null);
  const [cloneName, setCloneName] = useState('');
  const [previewRole, setPreviewRole] = useState('Administrator');
  const [previewData, setPreviewData] = useState(null);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const fetchData = async () => {
    setLoading(true);
    try {
      const [dashboardsRes, widgetsRes, rolesRes] = await Promise.all([
        axios.get(`${API}/dashboards/list`),
        axios.get(`${API}/dashboards/widgets`),
        axios.get(`${API}/roles`)
      ]);
      setDashboards(dashboardsRes.data.dashboards || []);
      setWidgetLibrary(widgetsRes.data || { widgets: [], categories: {} });
      setRoles(rolesRes.data || []);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Create new dashboard
  const handleCreate = async () => {
    if (!dashboardName.trim()) {
      toast.error('Please enter a dashboard name');
      return;
    }

    try {
      const res = await axios.post(`${API}/dashboards`, {
        name: dashboardName,
        description: dashboardDescription,
        widgets: []
      });
      toast.success('Dashboard created successfully');
      setShowCreateDialog(false);
      setDashboardName('');
      setDashboardDescription('');
      fetchData();
      // Open editor for new dashboard
      const newDashboard = { id: res.data.id, name: dashboardName, description: dashboardDescription, widgets: [] };
      handleEdit(newDashboard);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create dashboard');
    }
  };

  // Clone dashboard
  const handleClone = async () => {
    if (!cloneName.trim() || !selectedDashboard) {
      toast.error('Please enter a name for the cloned dashboard');
      return;
    }

    try {
      await axios.post(`${API}/dashboards/${selectedDashboard.id}/clone?name=${encodeURIComponent(cloneName)}`);
      toast.success('Dashboard cloned successfully');
      setShowCloneDialog(false);
      setCloneName('');
      setSelectedDashboard(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to clone dashboard');
    }
  };

  // Delete dashboard
  const handleDelete = async () => {
    if (!selectedDashboard) return;

    try {
      await axios.delete(`${API}/dashboards/${selectedDashboard.id}`);
      toast.success('Dashboard deleted successfully');
      setShowDeleteDialog(false);
      setSelectedDashboard(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete dashboard');
    }
  };

  // Edit dashboard
  const handleEdit = (dashboard) => {
    setEditingDashboard(dashboard);
    setEditorWidgets(dashboard.widgets || []);
    setDashboardName(dashboard.name);
    setDashboardDescription(dashboard.description || '');
  };

  // Save dashboard
  const handleSave = async () => {
    if (!editingDashboard) return;

    try {
      await axios.put(`${API}/dashboards/${editingDashboard.id}`, {
        name: dashboardName,
        description: dashboardDescription,
        widgets: editorWidgets
      });
      toast.success('Dashboard saved successfully');
      setEditingDashboard(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save dashboard');
    }
  };

  // Add widget to dashboard
  const handleAddWidget = (libraryWidget) => {
    const newWidget = {
      id: `w${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      widget_type: libraryWidget.widget_type,
      title: libraryWidget.title,
      config: libraryWidget.config || {},
      size: libraryWidget.default_size || 'medium',
      position: editorWidgets.length,
      required_permissions: libraryWidget.required_permissions || []
    };
    setEditorWidgets([...editorWidgets, newWidget]);
  };

  // Remove widget
  const handleRemoveWidget = (widgetId) => {
    setEditorWidgets(editorWidgets.filter(w => w.id !== widgetId));
  };

  // Resize widget
  const handleResizeWidget = (widgetId, newSize) => {
    setEditorWidgets(editorWidgets.map(w => 
      w.id === widgetId ? { ...w, size: newSize } : w
    ));
  };

  // Handle drag end
  const handleDragEnd = (event) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      setEditorWidgets((items) => {
        const oldIndex = items.findIndex(i => i.id === active.id);
        const newIndex = items.findIndex(i => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  // Preview dashboard
  const handlePreview = async (dashboard) => {
    setSelectedDashboard(dashboard);
    setShowPreviewDialog(true);
    
    try {
      const res = await axios.get(`${API}/dashboards/${dashboard.id}/preview?role=${previewRole}`);
      setPreviewData(res.data);
    } catch (error) {
      toast.error('Failed to load preview');
    }
  };

  // Update preview when role changes
  const handlePreviewRoleChange = async (role) => {
    setPreviewRole(role);
    if (selectedDashboard) {
      try {
        const res = await axios.get(`${API}/dashboards/${selectedDashboard.id}/preview?role=${role}`);
        setPreviewData(res.data);
      } catch (error) {
        toast.error('Failed to load preview');
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-rose-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  // Editor View
  if (editingDashboard) {
    return (
      <div className="space-y-6" data-testid="dashboard-editor">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => setEditingDashboard(null)}>
              <ArrowLeft size={20} className="mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Edit Dashboard</h1>
              <p className="">Drag and drop widgets to customize layout</p>
            </div>
          </div>
          <Button onClick={handleSave} className="bg-rose-600 hover:bg-rose-700 gap-2">
            <Save size={18} />
            Save Dashboard
          </Button>
        </div>

        {/* Editor Content */}
        <div className="grid grid-cols-12 gap-6">
          {/* Widget Library */}
          <div className="col-span-4">
            <Card className="sticky top-4">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Widget Library</CardTitle>
                <CardDescription>Click to add widgets</CardDescription>
              </CardHeader>
              <CardContent className="max-h-[calc(100vh-300px)] overflow-y-auto">
                <Tabs defaultValue={Object.keys(widgetLibrary.categories)[0] || 'all'}>
                  <TabsList className="w-full flex-wrap h-auto gap-1 mb-4">
                    {Object.keys(widgetLibrary.categories).map(cat => (
                      <TabsTrigger key={cat} value={cat} className="text-xs">
                        {cat}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  {Object.entries(widgetLibrary.categories).map(([cat, widgets]) => (
                    <TabsContent key={cat} value={cat} className="space-y-2">
                      {widgets.map(widget => (
                        <WidgetLibraryItem
                          key={widget.id}
                          widget={widget}
                          onAdd={handleAddWidget}
                        />
                      ))}
                    </TabsContent>
                  ))}
                </Tabs>
              </CardContent>
            </Card>
          </div>

          {/* Dashboard Canvas */}
          <div className="col-span-8">
            <Card className="">
              <CardHeader className="border-b">
                <div className="space-y-3">
                  <div>
                    <Label>Dashboard Name</Label>
                    <Input
                      value={dashboardName}
                      onChange={(e) => setDashboardName(e.target.value)}
                      placeholder="Enter dashboard name"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Description</Label>
                    <Textarea
                      value={dashboardDescription}
                      onChange={(e) => setDashboardDescription(e.target.value)}
                      placeholder="Enter dashboard description"
                      className="mt-1"
                      rows={2}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4">
                <div className="min-h-[400px]">
                  {editorWidgets.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed rounded-lg">
                      <LayoutDashboard size={48} className="mb-3" />
                      <p className="text-lg font-medium">No widgets added</p>
                      <p className="text-sm">Click widgets from the library to add them</p>
                    </div>
                  ) : (
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={handleDragEnd}
                    >
                      <SortableContext
                        items={editorWidgets.map(w => w.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        <div className="space-y-3">
                          {editorWidgets.map(widget => (
                            <SortableWidgetItem
                              key={widget.id}
                              widget={widget}
                              onRemove={handleRemoveWidget}
                              onResize={handleResizeWidget}
                            />
                          ))}
                        </div>
                      </SortableContext>
                    </DndContext>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // Main Dashboard List View
  return (
    <div className="space-y-6" data-testid="dashboard-builder">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard Builder</h1>
          <p className="mt-1">Create and manage dashboard templates</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)} className="bg-rose-600 hover:bg-rose-700 gap-2">
          <Plus size={18} />
          Create Dashboard
        </Button>
      </div>

      {/* System Dashboards */}
      <div>
        <h2 className="text-lg font-semibold mb-3">System Dashboards</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {dashboards.filter(d => d.is_system).map(dashboard => (
            <DashboardCard
              key={dashboard.id}
              dashboard={dashboard}
              onEdit={handleEdit}
              onClone={(d) => { setSelectedDashboard(d); setCloneName(`${d.name} (Copy)`); setShowCloneDialog(true); }}
              onDelete={(d) => { setSelectedDashboard(d); setShowDeleteDialog(true); }}
              onPreview={handlePreview}
            />
          ))}
        </div>
      </div>

      {/* Custom Dashboards */}
      {dashboards.filter(d => !d.is_system).length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Custom Dashboards</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {dashboards.filter(d => !d.is_system).map(dashboard => (
              <DashboardCard
                key={dashboard.id}
                dashboard={dashboard}
                onEdit={handleEdit}
                onClone={(d) => { setSelectedDashboard(d); setCloneName(`${d.name} (Copy)`); setShowCloneDialog(true); }}
                onDelete={(d) => { setSelectedDashboard(d); setShowDeleteDialog(true); }}
                onPreview={handlePreview}
              />
            ))}
          </div>
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Dashboard</DialogTitle>
            <DialogDescription>Create a new custom dashboard template</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Dashboard Name *</Label>
              <Input
                value={dashboardName}
                onChange={(e) => setDashboardName(e.target.value)}
                placeholder="e.g., Custom Ops View"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={dashboardDescription}
                onChange={(e) => setDashboardDescription(e.target.value)}
                placeholder="Describe the purpose of this dashboard"
                className="mt-1"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button onClick={handleCreate} className="bg-rose-600 hover:bg-rose-700">Create Dashboard</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Clone Dialog */}
      <Dialog open={showCloneDialog} onOpenChange={setShowCloneDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clone Dashboard</DialogTitle>
            <DialogDescription>Create a copy of "{selectedDashboard?.name}"</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label>New Dashboard Name *</Label>
            <Input
              value={cloneName}
              onChange={(e) => setCloneName(e.target.value)}
              placeholder="Enter name for cloned dashboard"
              className="mt-1"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCloneDialog(false)}>Cancel</Button>
            <Button onClick={handleClone} className="bg-rose-600 hover:bg-rose-700">Clone Dashboard</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Dashboard</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedDashboard?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Preview Dialog */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Preview: {selectedDashboard?.name}</DialogTitle>
            <DialogDescription>See how this dashboard appears for different roles</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-4">
              <Label>Preview as:</Label>
              <Select value={previewRole} onValueChange={handlePreviewRoleChange}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roles.map(role => (
                    <SelectItem key={role.id || role.name} value={role.name}>{role.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {previewData && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Badge variant="outline">
                    {previewData.visible_widget_count} / {previewData.original_widget_count} widgets visible
                  </Badge>
                  {previewData.visible_widget_count < previewData.original_widget_count && (
                    <span className="text-amber-600">
                      ({previewData.original_widget_count - previewData.visible_widget_count} hidden due to permissions)
                    </span>
                  )}
                </div>
                <div className="border rounded-lg p-4 max-h-[400px] overflow-y-auto">
                  <h4 className="font-medium mb-3">Visible Widgets:</h4>
                  <div className="space-y-2">
                    {previewData.dashboard?.widgets?.map((widget, idx) => (
                      <div key={idx} className="flex items-center gap-2 p-2 bg-white rounded border">
                        <div className={`w-6 h-6 rounded ${widget.config?.color || 'bg-slate-500'} flex items-center justify-center`}>
                          <Inbox size={12} className="text-white" />
                        </div>
                        <span className="text-sm">{widget.title}</span>
                        <Badge variant="outline" className="ml-auto text-xs">{widget.size}</Badge>
                      </div>
                    ))}
                    {previewData.dashboard?.widgets?.length === 0 && (
                      <p className="text-sm">No widgets visible for this role</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPreviewDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
