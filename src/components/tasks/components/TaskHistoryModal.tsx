
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Task } from "@/types/calendar";
import { Calendar, User, Clock, Euro } from "lucide-react";

interface TaskHistoryModalProps {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface TaskHistoryEntry {
  id: string;
  timestamp: Date;
  action: string;
  field?: string;
  oldValue?: string;
  newValue?: string;
  user: string;
}

export const TaskHistoryModal = ({ task, open, onOpenChange }: TaskHistoryModalProps) => {
  if (!task) return null;

  // Mock history data - en una aplicación real vendría de la base de datos
  const history: TaskHistoryEntry[] = [
    {
      id: '1',
      timestamp: new Date('2024-06-10T10:30:00'),
      action: 'Tarea creada',
      user: 'Sistema'
    },
    {
      id: '2',
      timestamp: new Date('2024-06-10T11:15:00'),
      action: 'Limpiador asignado',
      field: 'cleaner',
      oldValue: 'Sin asignar',
      newValue: task.cleaner || 'María García',
      user: 'Admin'
    },
    {
      id: '3',
      timestamp: new Date('2024-06-10T14:20:00'),
      action: 'Estado actualizado',
      field: 'status',
      oldValue: 'pending',
      newValue: 'in-progress',
      user: task.cleaner || 'María García'
    },
    {
      id: '4',
      timestamp: new Date('2024-06-10T16:45:00'),
      action: 'Horario modificado',
      field: 'time',
      oldValue: '14:00 - 16:00',
      newValue: `${task.startTime} - ${task.endTime}`,
      user: 'Admin'
    }
  ];

  const getActionIcon = (action: string) => {
    if (action.includes('asignado')) return <User className="h-4 w-4" />;
    if (action.includes('Estado')) return <Badge className="h-4 w-4" />;
    if (action.includes('Horario')) return <Clock className="h-4 w-4" />;
    if (action.includes('coste')) return <Euro className="h-4 w-4" />;
    return <Calendar className="h-4 w-4" />;
  };

  const getActionColor = (action: string) => {
    if (action.includes('creada')) return 'text-blue-600';
    if (action.includes('asignado')) return 'text-green-600';
    if (action.includes('Estado')) return 'text-yellow-600';
    if (action.includes('modificado')) return 'text-purple-600';
    return 'text-gray-600';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Historial de la Tarea</DialogTitle>
          <DialogDescription>
            Registro de cambios para: {task.property}
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="max-h-[400px] pr-4">
          <div className="space-y-4">
            {history.map((entry, index) => (
              <div 
                key={entry.id} 
                className="flex gap-4 p-3 rounded-lg bg-gray-50 border-l-4 border-gray-200"
              >
                <div className={`flex-shrink-0 mt-1 ${getActionColor(entry.action)}`}>
                  {getActionIcon(entry.action)}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-gray-900">{entry.action}</p>
                      
                      {entry.field && (
                        <div className="mt-1 text-sm text-gray-600">
                          <span className="font-medium">Campo:</span> {entry.field}
                          {entry.oldValue && entry.newValue && (
                            <div className="mt-1">
                              <span className="line-through text-red-500">{entry.oldValue}</span>
                              <span className="mx-2">→</span>
                              <span className="text-green-600">{entry.newValue}</span>
                            </div>
                          )}
                        </div>
                      )}
                      
                      <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                        <span>Por: {entry.user}</span>
                        <span>•</span>
                        <span>{entry.timestamp.toLocaleString('es-ES')}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
