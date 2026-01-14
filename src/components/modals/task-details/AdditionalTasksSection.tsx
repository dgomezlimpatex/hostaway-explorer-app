import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { 
  Plus, 
  Trash2, 
  Camera, 
  CheckCircle2, 
  Clock, 
  AlertTriangle,
  ListTodo
} from 'lucide-react';
import { AdditionalTask, Task } from '@/types/calendar';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

interface AdditionalTasksSectionProps {
  task: Task;
  onAddSubtask: (subtask: Omit<AdditionalTask, 'id' | 'completed' | 'addedAt' | 'addedBy'>) => void;
  onRemoveSubtask: (subtaskId: string) => void;
  isEditing?: boolean;
}

export const AdditionalTasksSection = ({
  task,
  onAddSubtask,
  onRemoveSubtask,
  isEditing = false
}: AdditionalTasksSectionProps) => {
  const { userRole, user } = useAuth();
  const [isAdding, setIsAdding] = useState(false);
  const [newTaskText, setNewTaskText] = useState('');
  const [requiresPhoto, setRequiresPhoto] = useState(false);

  const canManageSubtasks = userRole === 'admin' || userRole === 'manager';
  const additionalTasks = task.additionalTasks || [];
  
  const pendingCount = additionalTasks.filter(t => !t.completed).length;
  const completedCount = additionalTasks.filter(t => t.completed).length;

  const handleAddSubtask = () => {
    if (!newTaskText.trim()) return;
    
    onAddSubtask({
      text: newTaskText.trim(),
      photoRequired: requiresPhoto,
      addedByName: user?.email || 'Admin'
    });
    
    setNewTaskText('');
    setRequiresPhoto(false);
    setIsAdding(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAddSubtask();
    }
    if (e.key === 'Escape') {
      setIsAdding(false);
      setNewTaskText('');
      setRequiresPhoto(false);
    }
  };

  return (
    <Card className="border-orange-200 bg-orange-50/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-md flex items-center gap-2">
            <ListTodo className="h-5 w-5 text-orange-600" />
            Subtareas Adicionales
            {additionalTasks.length > 0 && (
              <div className="flex gap-1 ml-2">
                {pendingCount > 0 && (
                  <Badge variant="destructive" className="text-xs">
                    {pendingCount} pendiente{pendingCount !== 1 ? 's' : ''}
                  </Badge>
                )}
                {completedCount > 0 && (
                  <Badge variant="secondary" className="bg-green-100 text-green-700 text-xs">
                    {completedCount} completada{completedCount !== 1 ? 's' : ''}
                  </Badge>
                )}
              </div>
            )}
          </CardTitle>
          {canManageSubtasks && !isAdding && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAdding(true)}
              className="border-orange-300 text-orange-700 hover:bg-orange-100"
            >
              <Plus className="h-4 w-4 mr-1" />
              Añadir Subtarea
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Add new subtask form */}
        {isAdding && (
          <div className="bg-white p-4 rounded-lg border border-orange-200 space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder="Describe la subtarea..."
                value={newTaskText}
                onChange={(e) => setNewTaskText(e.target.value)}
                onKeyDown={handleKeyDown}
                autoFocus
                className="flex-1"
              />
              <Button
                size="sm"
                onClick={handleAddSubtask}
                disabled={!newTaskText.trim()}
                className="bg-orange-600 hover:bg-orange-700"
              >
                Añadir
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setIsAdding(false);
                  setNewTaskText('');
                  setRequiresPhoto(false);
                }}
              >
                Cancelar
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="requires-photo"
                checked={requiresPhoto}
                onCheckedChange={setRequiresPhoto}
              />
              <Label htmlFor="requires-photo" className="text-sm flex items-center gap-1">
                <Camera className="h-4 w-4" />
                Requiere foto
              </Label>
            </div>
          </div>
        )}

        {/* List of subtasks */}
        {additionalTasks.length === 0 && !isAdding ? (
          <div className="text-center py-4 text-muted-foreground">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-orange-300" />
            <p className="text-sm">No hay subtareas adicionales</p>
            {canManageSubtasks && (
              <p className="text-xs mt-1">
                Añade subtareas específicas para esta limpieza
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {additionalTasks.map((subtask) => (
              <div
                key={subtask.id}
                className={cn(
                  "flex items-start gap-3 p-3 rounded-lg border transition-colors",
                  subtask.completed 
                    ? "bg-green-50 border-green-200" 
                    : "bg-white border-orange-200"
                )}
              >
                <div className="mt-0.5">
                  {subtask.completed ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  ) : (
                    <Clock className="h-5 w-5 text-orange-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn(
                    "font-medium text-sm",
                    subtask.completed && "line-through text-muted-foreground"
                  )}>
                    {subtask.text}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    {subtask.photoRequired && (
                      <Badge variant="secondary" className="text-xs">
                        <Camera className="h-3 w-3 mr-1" />
                        Foto requerida
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground">
                      Añadida por {subtask.addedByName || 'Admin'}
                    </span>
                    {subtask.completed && subtask.completedByName && (
                      <span className="text-xs text-green-600">
                        • Completada por {subtask.completedByName}
                      </span>
                    )}
                  </div>
                  {subtask.notes && (
                    <p className="text-xs text-muted-foreground mt-1 italic">
                      "{subtask.notes}"
                    </p>
                  )}
                </div>
                {canManageSubtasks && !subtask.completed && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onRemoveSubtask(subtask.id)}
                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
