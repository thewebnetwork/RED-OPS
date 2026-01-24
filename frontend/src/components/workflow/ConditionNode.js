import { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { GitBranch } from 'lucide-react';

const ConditionNode = memo(({ data, selected }) => {
  const conditionCount = data?.conditions?.length || 0;
  
  return (
    <div
      className={`px-4 py-3 rounded-lg border-2 shadow-sm min-w-[180px] ${
        selected ? 'border-purple-500 ring-2 ring-purple-200' : 'border-purple-300'
      }`}
      style={{ backgroundColor: '#f3e8ff' }}
      data-testid="condition-node"
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-purple-500 !border-2 !border-white"
      />
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-purple-500 flex items-center justify-center">
          <GitBranch size={16} className="text-white" />
        </div>
        <div>
          <p className="font-medium text-sm text-purple-900">{data?.label || 'Condition'}</p>
          <p className="text-xs text-purple-600">
            {conditionCount > 0 ? `${conditionCount} rule${conditionCount > 1 ? 's' : ''}` : 'No rules'}
          </p>
        </div>
      </div>
      {conditionCount > 0 && (
        <div className="mt-2 pt-2 border-t border-purple-200">
          <div className="space-y-1">
            {data.conditions.slice(0, 2).map((cond, idx) => (
              <div key={cond.id || idx} className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                <span className="text-xs text-purple-700 truncate max-w-[140px]">
                  {cond.field} {cond.operator} {cond.value}
                </span>
              </div>
            ))}
            {conditionCount > 2 && (
              <span className="text-xs text-purple-500">+{conditionCount - 2} more</span>
            )}
          </div>
        </div>
      )}
      {/* Two output handles for Yes/No paths */}
      <div className="mt-2 flex justify-between px-2 text-xs">
        <span className="text-green-600 font-medium">Yes</span>
        <span className="text-red-600 font-medium">No</span>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        id="yes"
        style={{ left: '25%' }}
        className="!w-3 !h-3 !bg-green-500 !border-2 !border-white"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="no"
        style={{ left: '75%' }}
        className="!w-3 !h-3 !bg-red-500 !border-2 !border-white"
      />
    </div>
  );
});

ConditionNode.displayName = 'ConditionNode';

export default ConditionNode;
