import { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { CheckCircle } from 'lucide-react';

const EndNode = memo(({ data, selected }) => {
  return (
    <div
      className={`px-4 py-3 rounded-lg border-2 shadow-sm min-w-[140px] ${
        selected ? 'border-red-500 ring-2 ring-red-200' : 'border-red-300'
      }`}
      style={{ backgroundColor: '#fee2e2' }}
      data-testid="end-node"
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-red-500 !border-2 !border-white"
      />
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-red-500 flex items-center justify-center">
          <CheckCircle size={16} className="text-white" />
        </div>
        <div>
          <p className="font-medium text-sm text-red-900">{data?.label || 'End'}</p>
          <p className="text-xs text-red-600">Workflow complete</p>
        </div>
      </div>
    </div>
  );
});

EndNode.displayName = 'EndNode';

export default EndNode;
