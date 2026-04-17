import { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { Play, UserPlus, Forward, Mail, Bell, RefreshCw, Webhook } from 'lucide-react';

const ActionNode = memo(({ data, selected }) => {
  const actionCount = data?.actions?.length || 0;
  
  const getActionIcon = (type) => {
    switch (type) {
      case 'assign_role': return UserPlus;
      case 'forward_ticket': return Forward;
      case 'email_user':
      case 'email_requester': return Mail;
      case 'notify': return Bell;
      case 'update_status': return RefreshCw;
      case 'webhook': return Webhook;
      default: return Play;
    }
  };
  
  return (
    <div
      className={`px-4 py-3 rounded-lg border-2 shadow-sm min-w-[180px] ${
        selected ? 'border-amber-500 ring-2 ring-amber-200' : 'border-amber-300'
      }`}
      style={{ backgroundColor: '#fef3c7' }}
      data-testid="action-node"
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-amber-500 !border-2 !border-white"
      />
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center">
          <Play size={16} className="text-white" />
        </div>
        <div>
          <p className="font-medium text-sm text-amber-900">{data?.label || 'Action'}</p>
          <p className="text-xs text-amber-600">
            {actionCount > 0 ? `${actionCount} action${actionCount > 1 ? 's' : ''}` : 'No actions'}
          </p>
        </div>
      </div>
      {actionCount > 0 && (
        <div className="mt-2 pt-2 border-t border-amber-200">
          <div className="space-y-1">
            {data.actions.slice(0, 3).map((action, idx) => {
              const Icon = getActionIcon(action.action_type);
              return (
                <div key={action.id || idx} className="flex items-center gap-1">
                  <Icon size={10} className="text-amber-600" />
                  <span className="text-xs text-amber-700 truncate max-w-[140px]">
                    {action.action_type.replace(/_/g, ' ')}
                  </span>
                </div>
              );
            })}
            {actionCount > 3 && (
              <span className="text-xs text-amber-500">+{actionCount - 3} more</span>
            )}
          </div>
        </div>
      )}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-amber-500 !border-2 !border-white"
      />
    </div>
  );
});

ActionNode.displayName = 'ActionNode';

export default ActionNode;
