
import React from 'react';
import { User } from 'lucide-react';

interface TaskCardCleanerInfoProps {
  cleaner?: string;
}

export const TaskCardCleanerInfo: React.FC<TaskCardCleanerInfoProps> = ({
  cleaner,
}) => {
  if (!cleaner) return null;

  return (
    <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-xl border border-blue-100">
      <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
        <User className="h-4 w-4 text-white" />
      </div>
      <div>
        <div className="font-semibold text-blue-900">{cleaner}</div>
        <div className="text-blue-600 text-xs">Limpiador asignado</div>
      </div>
    </div>
  );
};
