import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import ReactFlow, {
  addEdge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  MarkerType,
  Panel,
} from 'reactflow';
import 'reactflow/dist/style.css';
import {
  ArrowLeft,
  Save,
  Play,
  Settings,
  Plus,
  Trash2,
  X,
  Zap,
  FileText,
  GitBranch,
  Clock,
  CheckCircle,
  Mail,
  UserPlus,
  Forward,
  Bell,
  Webhook,
  RefreshCw
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '../components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Checkbox } from '../components/ui/checkbox';
import { ScrollArea } from '../components/ui/scroll-area';
import { Separator } from '../components/ui/separator';
import { Badge } from '../components/ui/badge';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../components/ui/tabs';

// Custom node components
import TriggerNode from '../components/workflow/TriggerNode';
import FormNode from '../components/workflow/FormNode';
import ActionNode from '../components/workflow/ActionNode';
import ConditionNode from '../components/workflow/ConditionNode';
import EndNode from '../components/workflow/EndNode';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Node types mapping
const nodeTypes = {
  trigger: TriggerNode,
  form: FormNode,
  action: ActionNode,
  condition: ConditionNode,
  end: EndNode,
};

// Default edge options
const defaultEdgeOptions = {
  type: 'smoothstep',
  animated: true,
  markerEnd: {
    type: MarkerType.ArrowClosed,
    width: 20,
    height: 20,
  },
  style: {
    strokeWidth: 2,
    stroke: '#64748b',
  },
};

// Node palette items
const nodePalette = [
  { type: 'trigger', label: 'Trigger', icon: Zap, color: '#22c55e', description: 'Start point of workflow' },
  { type: 'form', label: 'Form', icon: FileText, color: '#3b82f6', description: 'Collect data from user' },
  { type: 'action', label: 'Action', icon: Play, color: '#f59e0b', description: 'Perform automated action' },
  { type: 'condition', label: 'Condition', icon: GitBranch, color: '#8b5cf6', description: 'Branch based on criteria' },
  { type: 'end', label: 'End', icon: CheckCircle, color: '#ef4444', description: 'End of workflow' },
];

export default function WorkflowEditor() {
  const { workflowId } = useParams();
  const navigate = useNavigate();
  const reactFlowWrapper = useRef(null);
  const [reactFlowInstance, setReactFlowInstance] = useState(null);
  
  const [workflow, setWorkflow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  
  const [selectedNode, setSelectedNode] = useState(null);
  const [showNodeConfig, setShowNodeConfig] = useState(false);
  const [roles, setRoles] = useState([]);
  const [teams, setTeams] = useState([]);

  // Fetch workflow data
  useEffect(() => {
    const loadData = async () => {
      try {
        const res = await axios.get(`${API}/workflows/${workflowId}`);
        setWorkflow(res.data);
        
        // Convert stored nodes to React Flow format
        const flowNodes = (res.data.nodes || []).map(node => ({
          id: node.id,
          type: node.type,
          position: node.position,
          data: {
            ...node.data,
            label: node.label,
          },
        }));
        
        // Convert stored edges to React Flow format
        const flowEdges = (res.data.edges || []).map(edge => ({
          id: edge.id,
          source: edge.source,
          target: edge.target,
          sourceHandle: edge.source_handle,
          label: edge.label,
          ...defaultEdgeOptions,
        }));
        
        setNodes(flowNodes);
        setEdges(flowEdges);
      } catch (error) {
        toast.error('Failed to load workflow');
        navigate('/workflows');
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
    fetchRoles();
    fetchTeams();
  }, [workflowId, navigate, setNodes, setEdges]);

  const fetchRoles = async () => {
    try {
      const res = await axios.get(`${API}/roles`);
      setRoles(res.data);
    } catch (error) {
      console.error('Failed to fetch roles');
    }
  };

  const fetchTeams = async () => {
    try {
      const res = await axios.get(`${API}/teams`);
      setTeams(res.data);
    } catch (error) {
      console.error('Failed to fetch teams');
    }
  };

  // Handle connections between nodes
  const onConnect = useCallback(
    (params) => {
      const newEdge = {
        ...params,
        id: `edge-${Date.now()}`,
        ...defaultEdgeOptions,
      };
      setEdges((eds) => addEdge(newEdge, eds));
    },
    [setEdges]
  );

  // Handle node selection
  const onNodeClick = useCallback((event, node) => {
    setSelectedNode(node);
    setShowNodeConfig(true);
  }, []);

  // Handle drag and drop from palette
  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow');
      if (!type || !reactFlowInstance) return;

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const paletteItem = nodePalette.find(p => p.type === type);
      const newNode = {
        id: `${type}-${Date.now()}`,
        type,
        position,
        data: {
          label: paletteItem?.label || type,
        },
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [reactFlowInstance, setNodes]
  );

  // Save workflow
  const handleSave = async () => {
    setSaving(true);
    try {
      // Convert React Flow format back to storage format
      const workflowNodes = nodes.map(node => ({
        id: node.id,
        type: node.type,
        label: node.data?.label || node.type,
        position: node.position,
        data: { ...node.data, label: undefined },
      }));

      const workflowEdges = edges.map(edge => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        source_handle: edge.sourceHandle || null,
        label: edge.label || null,
      }));

      await axios.put(`${API}/workflows/${workflowId}`, {
        nodes: workflowNodes,
        edges: workflowEdges,
      });

      toast.success('Workflow saved!');
    } catch (error) {
      toast.error('Failed to save workflow');
    } finally {
      setSaving(false);
    }
  };

  // Update selected node data
  const updateNodeData = (key, value) => {
    if (!selectedNode) return;

    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === selectedNode.id) {
          return {
            ...node,
            data: {
              ...node.data,
              [key]: value,
            },
          };
        }
        return node;
      })
    );

    setSelectedNode((prev) => ({
      ...prev,
      data: {
        ...prev.data,
        [key]: value,
      },
    }));
  };

  // Delete selected node
  const deleteSelectedNode = () => {
    if (!selectedNode) return;
    setNodes((nds) => nds.filter((n) => n.id !== selectedNode.id));
    setEdges((eds) => eds.filter((e) => e.source !== selectedNode.id && e.target !== selectedNode.id));
    setSelectedNode(null);
    setShowNodeConfig(false);
  };

  // Handle palette item drag start
  const onDragStart = (event, nodeType) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin h-8 w-8 border-4 border-rose-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-slate-50" data-testid="workflow-editor">
      {/* Header */}
      <div className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4 z-10">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/workflows')}
            data-testid="back-to-workflows"
          >
            <ArrowLeft size={20} />
          </Button>
          <div>
            <h1 className="font-semibold text-slate-900">{workflow?.name}</h1>
            <p className="text-xs text-slate-500">{workflow?.description || 'No description'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleSave}
            disabled={saving}
            data-testid="save-workflow-btn"
          >
            <Save size={16} className="mr-2" />
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Node Palette */}
        <div className="w-64 bg-white border-r border-slate-200 flex flex-col">
          <div className="p-4 border-b border-slate-200">
            <h2 className="font-semibold text-slate-900">Node Palette</h2>
            <p className="text-xs text-slate-500 mt-1">Drag nodes to the canvas</p>
          </div>
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-2">
              {nodePalette.map((item) => (
                <div
                  key={item.type}
                  className="p-3 bg-slate-50 rounded-lg border border-slate-200 cursor-grab hover:border-slate-300 hover:shadow-sm transition-all"
                  draggable
                  onDragStart={(e) => onDragStart(e, item.type)}
                  data-testid={`palette-${item.type}`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: item.color }}
                    >
                      <item.icon size={16} className="text-white" />
                    </div>
                    <div>
                      <p className="font-medium text-sm text-slate-900">{item.label}</p>
                      <p className="text-xs text-slate-500">{item.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Canvas */}
        <div className="flex-1" ref={reactFlowWrapper}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onInit={setReactFlowInstance}
            onDrop={onDrop}
            onDragOver={onDragOver}
            nodeTypes={nodeTypes}
            defaultEdgeOptions={defaultEdgeOptions}
            fitView
            snapToGrid
            snapGrid={[15, 15]}
            deleteKeyCode="Delete"
          >
            <Background color="#e2e8f0" gap={15} />
            <Controls />
            <MiniMap
              nodeColor={(node) => {
                const paletteItem = nodePalette.find(p => p.type === node.type);
                return paletteItem?.color || '#64748b';
              }}
              maskColor="rgba(0, 0, 0, 0.1)"
            />
            <Panel position="top-right" className="bg-white rounded-lg shadow-lg p-2 flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setNodes([]);
                  setEdges([]);
                }}
              >
                <Trash2 size={14} className="mr-1" />
                Clear
              </Button>
            </Panel>
          </ReactFlow>
        </div>

        {/* Node Configuration Sheet */}
        <Sheet open={showNodeConfig} onOpenChange={setShowNodeConfig}>
          <SheetContent className="w-[400px] sm:w-[500px] overflow-y-auto">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <Settings size={18} />
                Configure {selectedNode?.type} Node
              </SheetTitle>
              <SheetDescription>
                Customize this node&apos;s behavior and settings
              </SheetDescription>
            </SheetHeader>

            {selectedNode && (
              <div className="mt-6 space-y-6">
                {/* Common Settings */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Node Label</Label>
                    <Input
                      value={selectedNode.data?.label || ''}
                      onChange={(e) => updateNodeData('label', e.target.value)}
                      placeholder="Enter node label"
                      data-testid="node-label-input"
                    />
                  </div>
                </div>

                <Separator />

                {/* Node Type Specific Settings */}
                {selectedNode.type === 'trigger' && (
                  <TriggerNodeConfig
                    data={selectedNode.data}
                    updateData={updateNodeData}
                  />
                )}

                {selectedNode.type === 'form' && (
                  <FormNodeConfig
                    data={selectedNode.data}
                    updateData={updateNodeData}
                  />
                )}

                {selectedNode.type === 'action' && (
                  <ActionNodeConfig
                    data={selectedNode.data}
                    updateData={updateNodeData}
                    roles={roles}
                    teams={teams}
                  />
                )}

                {selectedNode.type === 'condition' && (
                  <ConditionNodeConfig
                    data={selectedNode.data}
                    updateData={updateNodeData}
                  />
                )}

                <Separator />

                {/* Delete Button */}
                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={deleteSelectedNode}
                  data-testid="delete-node-btn"
                >
                  <Trash2 size={16} className="mr-2" />
                  Delete Node
                </Button>
              </div>
            )}
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}

// Trigger Node Configuration
function TriggerNodeConfig({ data, updateData }) {
  return (
    <div className="space-y-4">
      <h4 className="font-medium text-sm text-slate-900">Trigger Settings</h4>
      <div className="space-y-2">
        <Label>Trigger Type</Label>
        <Select
          value={data?.trigger_type || 'manual'}
          onValueChange={(val) => updateData('trigger_type', val)}
        >
          <SelectTrigger data-testid="trigger-type-select">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="manual">Manual Start</SelectItem>
            <SelectItem value="form_submit">Form Submission</SelectItem>
            <SelectItem value="ticket_created">Ticket Created</SelectItem>
            <SelectItem value="status_changed">Status Changed</SelectItem>
            <SelectItem value="schedule">Scheduled</SelectItem>
            <SelectItem value="webhook">Webhook</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

// Form Node Configuration
function FormNodeConfig({ data, updateData }) {
  const [fields, setFields] = useState(data?.fields || []);

  const addField = () => {
    const newField = {
      id: `field-${Date.now()}`,
      name: '',
      label: 'New Field',
      field_type: 'text',
      required: false,
    };
    const updated = [...fields, newField];
    setFields(updated);
    updateData('fields', updated);
  };

  const updateField = (fieldId, key, value) => {
    const updated = fields.map(f =>
      f.id === fieldId ? { ...f, [key]: value } : f
    );
    setFields(updated);
    updateData('fields', updated);
  };

  const removeField = (fieldId) => {
    const updated = fields.filter(f => f.id !== fieldId);
    setFields(updated);
    updateData('fields', updated);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-sm text-slate-900">Form Fields</h4>
        <Button size="sm" variant="outline" onClick={addField}>
          <Plus size={14} className="mr-1" />
          Add Field
        </Button>
      </div>

      <div className="space-y-3">
        {fields.map((field, idx) => (
          <div key={field.id} className="p-3 bg-slate-50 rounded-lg border space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Field {idx + 1}</span>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                onClick={() => removeField(field.id)}
              >
                <X size={12} />
              </Button>
            </div>
            <Input
              placeholder="Field label"
              value={field.label}
              onChange={(e) => updateField(field.id, 'label', e.target.value)}
              className="h-8 text-sm"
            />
            <div className="flex gap-2">
              <Select
                value={field.field_type}
                onValueChange={(val) => updateField(field.id, 'field_type', val)}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Text</SelectItem>
                  <SelectItem value="textarea">Text Area</SelectItem>
                  <SelectItem value="number">Number</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="phone">Phone</SelectItem>
                  <SelectItem value="date">Date</SelectItem>
                  <SelectItem value="select">Dropdown</SelectItem>
                  <SelectItem value="checkbox">Checkbox</SelectItem>
                  <SelectItem value="file">File Upload</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-center gap-1">
                <Checkbox
                  id={`req-${field.id}`}
                  checked={field.required}
                  onCheckedChange={(checked) => updateField(field.id, 'required', checked)}
                />
                <Label htmlFor={`req-${field.id}`} className="text-xs">Required</Label>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Action Node Configuration
function ActionNodeConfig({ data, updateData, roles, teams }) {
  const [actions, setActions] = useState(data?.actions || []);

  const actionTypes = [
    { type: 'assign_role', label: 'Auto-Assign Role', icon: UserPlus },
    { type: 'forward_ticket', label: 'Forward Ticket', icon: Forward },
    { type: 'email_user', label: 'Email Assigned User', icon: Mail },
    { type: 'email_requester', label: 'Email Requester', icon: Mail },
    { type: 'update_status', label: 'Update Status', icon: RefreshCw },
    { type: 'notify', label: 'Send Notification', icon: Bell },
    { type: 'webhook', label: 'Trigger Webhook', icon: Webhook },
  ];

  const addAction = (type) => {
    const actionInfo = actionTypes.find(a => a.type === type);
    const newAction = {
      id: `action-${Date.now()}`,
      action_type: type,
      config: {},
    };
    const updated = [...actions, newAction];
    setActions(updated);
    updateData('actions', updated);
  };

  const updateAction = (actionId, config) => {
    const updated = actions.map(a =>
      a.id === actionId ? { ...a, config: { ...a.config, ...config } } : a
    );
    setActions(updated);
    updateData('actions', updated);
  };

  const removeAction = (actionId) => {
    const updated = actions.filter(a => a.id !== actionId);
    setActions(updated);
    updateData('actions', updated);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-sm text-slate-900">Actions</h4>
      </div>

      {/* Action selector */}
      <Select onValueChange={addAction}>
        <SelectTrigger data-testid="add-action-select">
          <SelectValue placeholder="Add an action..." />
        </SelectTrigger>
        <SelectContent>
          {actionTypes.map((action) => (
            <SelectItem key={action.type} value={action.type}>
              <div className="flex items-center gap-2">
                <action.icon size={14} />
                {action.label}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Configured actions */}
      <div className="space-y-3">
        {actions.map((action, idx) => {
          const actionInfo = actionTypes.find(a => a.type === action.action_type);
          return (
            <div key={action.id} className="p-3 bg-slate-50 rounded-lg border space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {actionInfo && <actionInfo.icon size={14} className="text-slate-600" />}
                  <span className="text-sm font-medium">{actionInfo?.label}</span>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  onClick={() => removeAction(action.id)}
                >
                  <X size={12} />
                </Button>
              </div>

              {/* Action-specific config */}
              {action.action_type === 'assign_role' && (
                <Select
                  value={action.config?.role_id || ''}
                  onValueChange={(val) => updateAction(action.id, { role_id: val })}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.filter(r => r.can_pick_orders).map((role) => (
                      <SelectItem key={role.id} value={role.id}>
                        {role.display_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {action.action_type === 'forward_ticket' && (
                <Select
                  value={action.config?.team_id || ''}
                  onValueChange={(val) => updateAction(action.id, { team_id: val })}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Select team" />
                  </SelectTrigger>
                  <SelectContent>
                    {teams.map((team) => (
                      <SelectItem key={team.id} value={team.id}>
                        {team.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {(action.action_type === 'email_user' || action.action_type === 'email_requester') && (
                <div className="space-y-2">
                  <Input
                    placeholder="Email subject"
                    value={action.config?.subject || ''}
                    onChange={(e) => updateAction(action.id, { subject: e.target.value })}
                    className="h-8 text-sm"
                  />
                  <Textarea
                    placeholder="Email body (supports variables like {{requester_name}}, {{ticket_id}})"
                    value={action.config?.body || ''}
                    onChange={(e) => updateAction(action.id, { body: e.target.value })}
                    className="text-sm"
                    rows={3}
                  />
                </div>
              )}

              {action.action_type === 'update_status' && (
                <Select
                  value={action.config?.status || ''}
                  onValueChange={(val) => updateAction(action.id, { status: val })}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Open">Open</SelectItem>
                    <SelectItem value="In Progress">In Progress</SelectItem>
                    <SelectItem value="Pending">Pending</SelectItem>
                    <SelectItem value="Delivered">Delivered</SelectItem>
                  </SelectContent>
                </Select>
              )}

              {action.action_type === 'notify' && (
                <Input
                  placeholder="Notification message"
                  value={action.config?.message || ''}
                  onChange={(e) => updateAction(action.id, { message: e.target.value })}
                  className="h-8 text-sm"
                />
              )}

              {action.action_type === 'webhook' && (
                <div className="space-y-2">
                  <Input
                    placeholder="Webhook URL"
                    value={action.config?.url || ''}
                    onChange={(e) => updateAction(action.id, { url: e.target.value })}
                    className="h-8 text-sm"
                  />
                  <Select
                    value={action.config?.method || 'POST'}
                    onValueChange={(val) => updateAction(action.id, { method: val })}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="GET">GET</SelectItem>
                      <SelectItem value="POST">POST</SelectItem>
                      <SelectItem value="PUT">PUT</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Condition Node Configuration
function ConditionNodeConfig({ data, updateData }) {
  const [conditions, setConditions] = useState(data?.conditions || []);

  const addCondition = () => {
    const newCondition = {
      id: `cond-${Date.now()}`,
      field: '',
      operator: 'equals',
      value: '',
    };
    const updated = [...conditions, newCondition];
    setConditions(updated);
    updateData('conditions', updated);
  };

  const updateCondition = (condId, key, value) => {
    const updated = conditions.map(c =>
      c.id === condId ? { ...c, [key]: value } : c
    );
    setConditions(updated);
    updateData('conditions', updated);
  };

  const removeCondition = (condId) => {
    const updated = conditions.filter(c => c.id !== condId);
    setConditions(updated);
    updateData('conditions', updated);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-sm text-slate-900">Conditions</h4>
        <Button size="sm" variant="outline" onClick={addCondition}>
          <Plus size={14} className="mr-1" />
          Add Condition
        </Button>
      </div>

      <div className="space-y-3">
        {conditions.map((cond, idx) => (
          <div key={cond.id} className="p-3 bg-slate-50 rounded-lg border space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Condition {idx + 1}</span>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                onClick={() => removeCondition(cond.id)}
              >
                <X size={12} />
              </Button>
            </div>
            <Input
              placeholder="Field name (e.g., priority, status)"
              value={cond.field}
              onChange={(e) => updateCondition(cond.id, 'field', e.target.value)}
              className="h-8 text-sm"
            />
            <div className="flex gap-2">
              <Select
                value={cond.operator}
                onValueChange={(val) => updateCondition(cond.id, 'operator', val)}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="equals">Equals</SelectItem>
                  <SelectItem value="not_equals">Not Equals</SelectItem>
                  <SelectItem value="contains">Contains</SelectItem>
                  <SelectItem value="greater_than">Greater Than</SelectItem>
                  <SelectItem value="less_than">Less Than</SelectItem>
                  <SelectItem value="is_empty">Is Empty</SelectItem>
                  <SelectItem value="is_not_empty">Is Not Empty</SelectItem>
                </SelectContent>
              </Select>
              <Input
                placeholder="Value"
                value={cond.value}
                onChange={(e) => updateCondition(cond.id, 'value', e.target.value)}
                className="h-8 text-sm"
              />
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-slate-500">
        Connect &quot;Yes&quot; output to the path when conditions are met, &quot;No&quot; output otherwise.
      </p>
    </div>
  );
}
