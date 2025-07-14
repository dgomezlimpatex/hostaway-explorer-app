
import React, { useEffect, useState } from 'react';
import { User, Users } from 'lucide-react';
import { TaskAssignment } from '@/types/taskAssignments';
import { multipleTaskAssignmentService } from '@/services/storage/multipleTaskAssignmentService';
import { Badge } from '@/components/ui/badge';

interface TaskCardCleanerInfoProps {
  cleaner?: string;
  taskId?: string;
}

export const TaskCardCleanerInfo: React.FC<TaskCardCleanerInfoProps> = ({
  cleaner,
  taskId,
}) => {
  const [assignments, setAssignments] = useState<TaskAssignment[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (taskId) {
      loadAssignments();
    }
  }, [taskId]);

  const loadAssignments = async () => {
    if (!taskId) return;
    
    setIsLoading(true);
    try {
      const taskAssignments = await multipleTaskAssignmentService.getTaskAssignments(taskId);
      setAssignments(taskAssignments);
    } catch (error) {
      console.error('Error loading assignments:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // If we have multiple assignments, show them
  if (assignments.length > 1) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-xl border border-blue-100">
          <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
            <Users className="h-4 w-4 text-white" />
          </div>
          <div className="flex-1">
            <div className="font-semibold text-blue-900">
              {assignments.length} Limpiadoras asignadas
            </div>
            <div className="text-blue-600 text-xs">Equipo de limpieza</div>
          </div>
        </div>
        <div className="flex flex-wrap gap-1 px-3">
          {assignments.map((assignment) => (
            <Badge key={assignment.id} variant="outline" className="text-xs bg-blue-50">
              {assignment.cleaner_name}
            </Badge>
          ))}
        </div>
      </div>
    );
  }

  // If we have exactly one assignment, show it normally
  if (assignments.length === 1) {
    return (
      <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-xl border border-blue-100">
        <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
          <User className="h-4 w-4 text-white" />
        </div>
        <div>
          <div className="font-semibold text-blue-900">{assignments[0].cleaner_name}</div>
          <div className="text-blue-600 text-xs">Limpiadora asignada</div>
        </div>
      </div>
    );
  }

  // Fallback to showing the cleaner prop if no assignments found
  if (cleaner && !isLoading) {
    return (
      <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-xl border border-blue-100">
        <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
          <User className="h-4 w-4 text-white" />
        </div>
        <div>
          <div className="font-semibold text-blue-900">{cleaner}</div>
          <div className="text-blue-600 text-xs">Limpiadora asignada</div>
        </div>
      </div>
    );
  }

  return null;
};
