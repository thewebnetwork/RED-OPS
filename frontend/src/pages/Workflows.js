import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import {
  GitBranch,
  Plus,
  Search,
  MoreVertical,
  Pencil,
  Copy,
  Trash2,
  Eye,
  Play
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '../components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
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

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function Workflows() {
  const navigate = useNavigate();
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedWorkflow, setSelectedWorkflow] = useState(null);
  const [newWorkflowName, setNewWorkflowName] = useState('');
  const [newWorkflowDescription, setNewWorkflowDescription] = useState('');

  useEffect(() => {
    fetchWorkflows();
  }, []);

  const fetchWorkflows = async () => {
    try {
      const res = await axios.get(`${API}/workflows`);
      setWorkflows(res.data);
    } catch (error) {
      toast.error('Failed to load workflows');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateWorkflow = async () => {
    if (!newWorkflowName.trim()) {
      toast.error('Please enter a workflow name');
      return;
    }

    try {
      const res = await axios.post(`${API}/workflows`, {
        name: newWorkflowName,
        description: newWorkflowDescription,
        nodes: [
          {
            id: 'trigger-1',
            type: 'trigger',
            label: 'Start',
            position: { x: 250, y: 50 },
            data: { trigger_type: 'manual' }
          }
        ],
        edges: []
      });
      toast.success('Workflow created!');
      setShowCreateDialog(false);
      setNewWorkflowName('');
      setNewWorkflowDescription('');
      navigate(`/workflows/${res.data.id}`);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create workflow');
    }
  };

  const handleDuplicateWorkflow = async () => {
    if (!newWorkflowName.trim() || !selectedWorkflow) {
      toast.error('Please enter a name for the duplicate');
      return;
    }

    try {
      const res = await axios.post(
        `${API}/workflows/${selectedWorkflow.id}/duplicate?new_name=${encodeURIComponent(newWorkflowName)}`
      );
      toast.success('Workflow duplicated!');
      setShowDuplicateDialog(false);
      setNewWorkflowName('');
      setSelectedWorkflow(null);
      fetchWorkflows();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to duplicate workflow');
    }
  };

  const handleDeleteWorkflow = async () => {
    if (!selectedWorkflow) return;

    try {
      await axios.delete(`${API}/workflows/${selectedWorkflow.id}`);
      toast.success('Workflow deleted');
      setShowDeleteDialog(false);
      setSelectedWorkflow(null);
      fetchWorkflows();
    } catch (error) {
      toast.error('Failed to delete workflow');
    }
  };

  const filteredWorkflows = workflows.filter(w =>
    w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    w.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getNodeCount = (workflow) => workflow.nodes?.length || 0;
  const getEdgeCount = (workflow) => workflow.edges?.length || 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-rose-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="workflows-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Workflow Builder</h1>
          <p className="text-slate-500 mt-1">Create and manage automated workflows</p>
        </div>
        <Button
          onClick={() => setShowCreateDialog(true)}
          className="bg-rose-600 hover:bg-rose-700"
          data-testid="create-workflow-btn"
        >
          <Plus size={18} className="mr-2" />
          New Workflow
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <Input
          placeholder="Search workflows..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
          data-testid="search-workflows"
        />
      </div>

      {/* Workflows Grid */}
      {filteredWorkflows.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
              <GitBranch size={32} className="text-slate-400" />
            </div>
            <h3 className="text-lg font-medium text-slate-900 mb-2">No workflows yet</h3>
            <p className="text-slate-500 text-center max-w-md mb-4">
              Create your first workflow to automate processes like ticket routing, 
              notifications, and more.
            </p>
            <Button
              onClick={() => setShowCreateDialog(true)}
              className="bg-rose-600 hover:bg-rose-700"
            >
              <Plus size={18} className="mr-2" />
              Create First Workflow
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredWorkflows.map((workflow) => (
            <Card
              key={workflow.id}
              className="group hover:shadow-md transition-shadow cursor-pointer"
              data-testid={`workflow-card-${workflow.id}`}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: workflow.color || '#3B82F6' }}
                  >
                    <GitBranch size={20} className="text-white" />
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                        data-testid={`workflow-menu-${workflow.id}`}
                      >
                        <MoreVertical size={16} />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => navigate(`/workflows/${workflow.id}`)}>
                        <Pencil size={14} className="mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => {
                        setSelectedWorkflow(workflow);
                        setNewWorkflowName(`${workflow.name} (Copy)`);
                        setShowDuplicateDialog(true);
                      }}>
                        <Copy size={14} className="mr-2" />
                        Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-red-600"
                        onClick={() => {
                          setSelectedWorkflow(workflow);
                          setShowDeleteDialog(true);
                        }}
                      >
                        <Trash2 size={14} className="mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <CardTitle
                  className="mt-3 hover:text-rose-600 transition-colors"
                  onClick={() => navigate(`/workflows/${workflow.id}`)}
                >
                  {workflow.name}
                </CardTitle>
                <CardDescription className="line-clamp-2">
                  {workflow.description || 'No description'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 text-sm text-slate-500">
                  <span className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                    {getNodeCount(workflow)} nodes
                  </span>
                  <span className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    {getEdgeCount(workflow)} connections
                  </span>
                </div>
                {workflow.assigned_role_names?.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {workflow.assigned_role_names.slice(0, 3).map((role, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded-full"
                      >
                        {role}
                      </span>
                    ))}
                    {workflow.assigned_role_names.length > 3 && (
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded-full">
                        +{workflow.assigned_role_names.length - 3} more
                      </span>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Workflow Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Workflow</DialogTitle>
            <DialogDescription>
              Give your workflow a name and description to get started.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="workflow-name">Name</Label>
              <Input
                id="workflow-name"
                placeholder="e.g., New Order Processing"
                value={newWorkflowName}
                onChange={(e) => setNewWorkflowName(e.target.value)}
                data-testid="workflow-name-input"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="workflow-description">Description (optional)</Label>
              <Textarea
                id="workflow-description"
                placeholder="What does this workflow do?"
                value={newWorkflowDescription}
                onChange={(e) => setNewWorkflowDescription(e.target.value)}
                data-testid="workflow-description-input"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateWorkflow}
              className="bg-rose-600 hover:bg-rose-700"
              data-testid="confirm-create-workflow"
            >
              Create Workflow
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Duplicate Workflow Dialog */}
      <Dialog open={showDuplicateDialog} onOpenChange={setShowDuplicateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Duplicate Workflow</DialogTitle>
            <DialogDescription>
              Enter a name for the duplicated workflow.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="duplicate-name">New Name</Label>
              <Input
                id="duplicate-name"
                value={newWorkflowName}
                onChange={(e) => setNewWorkflowName(e.target.value)}
                data-testid="duplicate-name-input"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDuplicateDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleDuplicateWorkflow}
              className="bg-rose-600 hover:bg-rose-700"
            >
              Duplicate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Workflow?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedWorkflow?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteWorkflow}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
