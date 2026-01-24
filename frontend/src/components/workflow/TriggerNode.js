import { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { Zap } from 'lucide-react';

const TriggerNode = memo(({ data, selected }) => {
  return (
    <div
      className={`px-4 py-3 rounded-lg border-2 shadow-sm min-w-[160px] ${
        selected ? 'border-green-500 ring-2 ring-green-200' : 'border-green-300'
      }`}
      style={{ backgroundColor: '#dcfce7' }}
      data-testid="trigger-node"
    >
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-green-500 flex items-center justify-center">
          <Zap size={16} className="text-white" />
        </div>
        <div>
          <p className="font-medium text-sm text-green-900">{data?.label || 'Trigger'}</p>
          <p className="text-xs text-green-600">
            {data?.trigger_type === 'manual' && 'Manual start'}
            {data?.trigger_type === 'form_submit' && 'On form submit'}
            {data?.trigger_type === 'ticket_created' && 'Ticket created'}
            {data?.trigger_type === 'status_changed' && 'Status changed'}
            {data?.trigger_type === 'schedule' && 'Scheduled'}
            {data?.trigger_type === 'webhook' && 'Webhook'}
            {!data?.trigger_type && 'Start workflow'}
          </p>
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-green-500 !border-2 !border-white"
      />
    </div>
  );
});

TriggerNode.displayName = 'TriggerNode';

export default TriggerNode;
