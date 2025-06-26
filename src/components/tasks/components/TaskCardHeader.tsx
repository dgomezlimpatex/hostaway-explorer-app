
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { MapPin } from 'lucide-react';

interface TaskCardHeaderProps {
  property: string;
  address: string;
  status: string;
}

export const TaskCardHeader: React.FC<TaskCardHeaderProps> = ({
  property,
  address,
  status,
}) => {
  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200 shadow-emerald-100';
      case 'in-progress':
        return 'bg-blue-50 text-blue-700 border-blue-200 shadow-blue-100';
      case 'pending':
        return 'bg-amber-50 text-amber-700 border-amber-200 shadow-amber-100';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200 shadow-gray-100';
    }
  };

  const getStatusText = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return 'Completado';
      case 'in-progress':
        return 'En Progreso';
      case 'pending':
        return 'Pendiente';
      default:
        return status;
    }
  };

  return (
    <div className="flex items-start justify-between">
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-xl text-gray-900 leading-tight">
            {property}
          </h3>
          <Badge className={`${getStatusColor(status)} font-semibold px-3 py-1.5 rounded-full text-xs border shadow-sm`}>
            {getStatusText(status)}
          </Badge>
        </div>
        
        <div className="flex items-center gap-2 text-gray-600">
          <MapPin className="h-4 w-4 text-gray-400 flex-shrink-0" />
          <span className="text-sm font-medium truncate">{address}</span>
        </div>
      </div>
    </div>
  );
};
