
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Camera, FileText, CheckCircle, AlertTriangle, ListTodo } from 'lucide-react';
import { TaskChecklistTemplate, ChecklistCategory, ChecklistItem } from '@/types/taskReports';
import { AdditionalTask, Task } from '@/types/calendar';
import { MediaCapture } from './MediaCapture';
import { cn } from '@/lib/utils';

interface ChecklistSectionProps {
  template: TaskChecklistTemplate | undefined;
  checklist: Record<string, any>;
  onChecklistChange: (checklist: Record<string, any>) => void;
  reportId?: string;
  isReadOnly?: boolean;
  task?: Task;
  onAdditionalTaskComplete?: (subtaskId: string, completed: boolean, notes?: string, mediaUrls?: string[]) => void;
}

export const ChecklistSection: React.FC<ChecklistSectionProps> = ({
  template,
  checklist,
  onChecklistChange,
  reportId,
  isReadOnly = false,
  task,
  onAdditionalTaskComplete,
}) => {
  const [selectedItem, setSelectedItem] = useState<string | null>(null);

  // Get additional tasks from task
  const additionalTasks = task?.additionalTasks || [];
  const pendingAdditionalTasks = additionalTasks.filter(t => !t.completed).length;

  const handleItemToggle = (categoryId: string, itemId: string, completed: boolean) => {
    if (isReadOnly) return;
    
    const key = `${categoryId}.${itemId}`;
    const newChecklist = { ...checklist };
    
    if (completed) {
      newChecklist[key] = {
        completed: true,
        notes: checklist[key]?.notes || '',
        media_urls: checklist[key]?.media_urls || [],
      };
    } else {
      delete newChecklist[key];
    }
    
    onChecklistChange(newChecklist);
  };

  const handleNotesChange = (categoryId: string, itemId: string, notes: string) => {
    if (isReadOnly) return;
    
    const key = `${categoryId}.${itemId}`;
    const newChecklist = { ...checklist };
    
    if (!newChecklist[key]) {
      newChecklist[key] = { completed: false, notes: '', media_urls: [] };
    }
    
    newChecklist[key].notes = notes;
    onChecklistChange(newChecklist);
  };

  const handleMediaAdded = (categoryId: string, itemId: string, mediaUrl: string) => {
    if (isReadOnly) return;
    
    console.log('ChecklistSection - adding media:', { categoryId, itemId, mediaUrl });
    const key = `${categoryId}.${itemId}`;
    const newChecklist = { ...checklist };
    
    if (!newChecklist[key]) {
      const currentCompleted = checklist[key]?.completed || false;
      newChecklist[key] = { completed: currentCompleted, notes: '', media_urls: [] };
    }
    
    const currentMediaUrls = newChecklist[key].media_urls || [];
    newChecklist[key].media_urls = [...currentMediaUrls, mediaUrl];
    
    console.log('ChecklistSection - updated checklist item:', newChecklist[key]);
    onChecklistChange(newChecklist);
  };

  // Handle additional task toggle
  const handleAdditionalTaskToggle = (subtask: AdditionalTask, completed: boolean) => {
    if (isReadOnly || !onAdditionalTaskComplete) return;
    
    const key = `additional.${subtask.id}`;
    const itemData = checklist[key];
    
    onAdditionalTaskComplete(
      subtask.id, 
      completed, 
      itemData?.notes || '',
      itemData?.media_urls || []
    );
  };

  // Handle additional task notes
  const handleAdditionalTaskNotesChange = (subtaskId: string, notes: string) => {
    if (isReadOnly) return;
    
    const key = `additional.${subtaskId}`;
    const newChecklist = { ...checklist };
    
    if (!newChecklist[key]) {
      newChecklist[key] = { notes: '', media_urls: [] };
    }
    
    newChecklist[key].notes = notes;
    onChecklistChange(newChecklist);
  };

  // Handle additional task media
  const handleAdditionalTaskMediaAdded = (subtaskId: string, mediaUrl: string) => {
    if (isReadOnly) return;
    
    const key = `additional.${subtaskId}`;
    const newChecklist = { ...checklist };
    
    if (!newChecklist[key]) {
      newChecklist[key] = { notes: '', media_urls: [] };
    }
    
    const currentMediaUrls = newChecklist[key].media_urls || [];
    newChecklist[key].media_urls = [...currentMediaUrls, mediaUrl];
    
    onChecklistChange(newChecklist);
  };

  // Calculate total items including additional tasks
  const totalItems = (template?.checklist_items.reduce((acc, cat) => acc + cat.items.length, 0) || 0) + additionalTasks.length;
  const completedItems = Object.keys(checklist).filter(k => checklist[k]?.completed || k.startsWith('additional.')).length + additionalTasks.filter(t => t.completed).length;

  if (!template && additionalTasks.length === 0) {
    return (
      <div className="text-center py-8">
        <FileText className="h-12 w-12 mx-auto text-gray-400 mb-4" />
        <p className="text-gray-500">No hay plantilla de checklist disponible</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">
          Checklist{template ? `: ${template.template_name}` : ''}
          {isReadOnly && <Badge variant="secondary" className="ml-2">Solo Lectura</Badge>}
        </h3>
        <Badge variant="outline">
          {completedItems} / {totalItems} completadas
        </Badge>
      </div>

      {/* Additional Tasks Section - First and Highlighted */}
      {additionalTasks.length > 0 && (
        <Card className="border-orange-300 bg-orange-50/50 shadow-md">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-md flex items-center gap-2 text-orange-700">
                <AlertTriangle className="h-5 w-5" />
                ⚠️ Tareas Adicionales
              </CardTitle>
              <Badge 
                variant={pendingAdditionalTasks > 0 ? "destructive" : "secondary"}
                className={pendingAdditionalTasks === 0 ? "bg-green-100 text-green-700" : ""}
              >
                {pendingAdditionalTasks > 0 
                  ? `${pendingAdditionalTasks} pendiente${pendingAdditionalTasks !== 1 ? 's' : ''}`
                  : 'Todas completadas'
                }
              </Badge>
            </div>
            <p className="text-sm text-orange-600 mt-1">
              Estas tareas han sido añadidas específicamente para esta limpieza
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {additionalTasks.map((subtask) => {
              const key = `additional.${subtask.id}`;
              const itemData = checklist[key];
              const isCompleted = subtask.completed;

              return (
                <div 
                  key={subtask.id} 
                  className={cn(
                    "border rounded-lg p-4 space-y-3 transition-colors",
                    isCompleted 
                      ? "bg-green-50 border-green-200" 
                      : "bg-white border-orange-200"
                  )}
                >
                  <div 
                    className={cn(
                      "flex items-start gap-3 cursor-pointer select-none",
                      !isReadOnly && "active:bg-muted/50 rounded-md -m-1 p-1"
                    )}
                    onClick={() => {
                      if (!isReadOnly) {
                        handleAdditionalTaskToggle(subtask, !isCompleted);
                      }
                    }}
                  >
                    <Checkbox
                      checked={isCompleted}
                      onCheckedChange={(checked) => 
                        handleAdditionalTaskToggle(subtask, checked as boolean)
                      }
                      className="mt-1 flex-shrink-0 h-5 w-5"
                      disabled={isReadOnly}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div className="flex-1 min-w-0">
                      {/* Badges */}
                      <div className="flex items-center flex-wrap gap-1 mb-2">
                        <Badge variant="destructive" className="text-xs">Requerido</Badge>
                        {subtask.photoRequired && (
                          <Badge variant="secondary" className="text-xs">
                            <Camera className="h-3 w-3 mr-1" />
                            Foto
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-xs text-orange-600 border-orange-300">
                          <ListTodo className="h-3 w-3 mr-1" />
                          Subtarea
                        </Badge>
                      </div>
                      
                      {/* Task text */}
                      <p className={cn(
                        "font-medium leading-relaxed",
                        isCompleted && "line-through text-gray-500"
                      )}>
                        {subtask.text}
                      </p>

                      {/* Added by info */}
                      <p className="text-xs text-muted-foreground mt-1">
                        Añadida por {subtask.addedByName || 'Admin'}
                      </p>
                      
                      {isCompleted && (
                        <div className="flex items-center text-green-600 text-sm mt-2">
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Completado {subtask.completedByName && `por ${subtask.completedByName}`}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Notes */}
                  <div className="pl-8">
                    <Textarea
                      placeholder={isReadOnly ? "Sin notas adicionales" : "Notas adicionales (opcional)"}
                      value={itemData?.notes || subtask.notes || ''}
                      onChange={(e) => handleAdditionalTaskNotesChange(subtask.id, e.target.value)}
                      className="min-h-[60px]"
                      disabled={isReadOnly}
                    />
                  </div>

                  {/* Media capture */}
                  {subtask.photoRequired && (
                    <div className="pl-8">
                      <MediaCapture
                        onMediaCaptured={(mediaUrl) => handleAdditionalTaskMediaAdded(subtask.id, mediaUrl)}
                        reportId={reportId}
                        checklistItemId={key}
                        existingMedia={itemData?.media_urls || subtask.mediaUrls || []}
                        isReadOnly={isReadOnly}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Regular checklist categories */}
      {template?.checklist_items.map((category: ChecklistCategory) => (
        <Card key={category.id}>
          <CardHeader>
            <CardTitle className="text-md">{category.category}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {category.items.map((item: ChecklistItem) => {
              const key = `${category.id}.${item.id}`;
              const itemData = checklist[key];
              const isCompleted = itemData?.completed || false;

              return (
                <div key={item.id} className="border rounded-lg p-4 space-y-3">
                  <div 
                    className={cn(
                      "flex items-start gap-3 cursor-pointer select-none",
                      !isReadOnly && "active:bg-muted/50 rounded-md -m-1 p-1"
                    )}
                    onClick={() => {
                      if (!isReadOnly) {
                        handleItemToggle(category.id, item.id, !isCompleted);
                      }
                    }}
                  >
                    <Checkbox
                      checked={isCompleted}
                      onCheckedChange={(checked) => 
                        handleItemToggle(category.id, item.id, checked as boolean)
                      }
                      className="mt-1 flex-shrink-0 h-5 w-5"
                      disabled={isReadOnly}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div className="flex-1 min-w-0">
                      {/* Badges primero */}
                      <div className="flex items-center flex-wrap gap-1 mb-2">
                        {item.required && (
                          <Badge variant="destructive" className="text-xs">Requerido</Badge>
                        )}
                        {item.photo_required && (
                          <Badge variant="secondary" className="text-xs">
                            <Camera className="h-3 w-3 mr-1" />
                            Foto
                          </Badge>
                        )}
                      </div>
                      
                      {/* Texto de la tarea con más espacio */}
                      <p className={`font-medium leading-relaxed ${isCompleted ? 'line-through text-gray-500' : ''}`}>
                        {item.task}
                      </p>
                      
                      {isCompleted && (
                        <div className="flex items-center text-green-600 text-sm mt-2">
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Completado
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Notas */}
                  <div className="pl-8">
                    <Textarea
                      placeholder={isReadOnly ? "Sin notas adicionales" : "Notas adicionales (opcional)"}
                      value={itemData?.notes || ''}
                      onChange={(e) => handleNotesChange(category.id, item.id, e.target.value)}
                      className="min-h-[60px]"
                      disabled={isReadOnly}
                    />
                  </div>

                  {/* Captura de media */}
                  {item.photo_required && (
                    <div className="pl-8">
                      <MediaCapture
                        onMediaCaptured={(mediaUrl) => handleMediaAdded(category.id, item.id, mediaUrl)}
                        reportId={reportId}
                        checklistItemId={key}
                        existingMedia={itemData?.media_urls || []}
                        isReadOnly={isReadOnly}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
