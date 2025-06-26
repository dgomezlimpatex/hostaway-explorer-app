
import React from 'react';
import { Badge } from '@/components/ui/badge';

interface TaskCardServiceInfoProps {
  type: string;
  supervisor?: string;
}

export const TaskCardServiceInfo: React.FC<TaskCardServiceInfoProps> = ({
  type,
  supervisor,
}) => {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="px-3 py-1.5 font-medium bg-white border-gray-200 text-gray-700">
          {type}
        </Badge>
        {supervisor && (
          <Badge variant="secondary" className="px-3 py-1.5 font-medium bg-purple-50 text-purple-700 border-purple-200">
            Supervisor: {supervisor}
          </Badge>
        )}
      </div>
    </div>
  );
};
