import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Home, 
  MapPin, 
  CheckCircle2,
  Clock,
  AlertCircle,
  Info
} from 'lucide-react';
import { Task } from '@/types/calendar';

interface TaskDetailsHeaderProps {
  task: Task;
  isEditing: boolean;
  formData: Partial<Task>;
  propertyData: any;
  onFieldChange: (field: string, value: string) => void;
}

export const TaskDetailsHeader = ({
  task,
  isEditing,
  formData,
  propertyData,
  onFieldChange
}: TaskDetailsHeaderProps) => {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-800 border-green-300"><CheckCircle2 className="h-3 w-3 mr-1" />Completado</Badge>;
      case 'in-progress':
        return <Badge className="bg-orange-100 text-orange-800 border-orange-300"><Clock className="h-3 w-3 mr-1" />En Progreso</Badge>;
      case 'pending':
        return <Badge className="bg-red-100 text-red-800 border-red-300"><AlertCircle className="h-3 w-3 mr-1" />Pendiente</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Home className="h-5 w-5 text-blue-600" />
            {isEditing ? (
              <Input 
                value={formData.property || ''} 
                onChange={e => onFieldChange('property', e.target.value)}
                className="text-lg font-semibold"
              />
            ) : (
              task.property
            )}
          </CardTitle>
          {getStatusBadge(task.status)}
        </div>
        {propertyData?.codigo && (
          <div className="flex items-center gap-2 text-sm text-blue-700">
            <Info className="h-4 w-4" />
            <span className="font-medium">Código: {propertyData.codigo}</span>
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 text-gray-600">
          <MapPin className="h-4 w-4" />
          {isEditing ? (
            <Input 
              value={formData.address || ''} 
              onChange={e => onFieldChange('address', e.target.value)}
              placeholder="Dirección"
            />
          ) : (
            <span>{task.address}</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
};