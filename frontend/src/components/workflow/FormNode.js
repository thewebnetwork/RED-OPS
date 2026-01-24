import { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { FileText } from 'lucide-react';

const FormNode = memo(({ data, selected }) => {
  const fieldCount = data?.fields?.length || 0;
  
  return (
    <div
      className={`px-4 py-3 rounded-lg border-2 shadow-sm min-w-[180px] ${
        selected ? 'border-blue-500 ring-2 ring-blue-200' : 'border-blue-300'
      }`}
      style={{ backgroundColor: '#dbeafe' }}
      data-testid="form-node"
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-blue-500 !border-2 !border-white"
      />
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center">
          <FileText size={16} className="text-white" />
        </div>
        <div>
          <p className="font-medium text-sm text-blue-900">{data?.label || 'Form'}</p>
          <p className="text-xs text-blue-600">
            {fieldCount > 0 ? `${fieldCount} field${fieldCount > 1 ? 's' : ''}` : 'No fields'}
          </p>
        </div>
      </div>
      {fieldCount > 0 && (
        <div className="mt-2 pt-2 border-t border-blue-200">
          <div className="space-y-1">
            {data.fields.slice(0, 3).map((field, idx) => (
              <div key={field.id || idx} className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                <span className="text-xs text-blue-700 truncate max-w-[140px]">
                  {field.label}
                  {field.required && <span className="text-red-500 ml-0.5">*</span>}
                </span>
              </div>
            ))}
            {fieldCount > 3 && (
              <span className="text-xs text-blue-500">+{fieldCount - 3} more</span>
            )}
          </div>
        </div>
      )}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-blue-500 !border-2 !border-white"
      />
    </div>
  );
});

FormNode.displayName = 'FormNode';

export default FormNode;
