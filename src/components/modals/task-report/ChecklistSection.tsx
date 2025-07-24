
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Camera, FileText, CheckCircle } from 'lucide-react';
import { TaskChecklistTemplate, ChecklistCategory, ChecklistItem } from '@/types/taskReports';
import { MediaCapture } from './MediaCapture';

interface ChecklistSectionProps {
  template: TaskChecklistTemplate | undefined;
  checklist: Record<string, any>;
  onChecklistChange: (checklist: Record<string, any>) => void;
  reportId?: string;
  isReadOnly?: boolean;
}

export const ChecklistSection: React.FC<ChecklistSectionProps> = ({
  template,
  checklist,
  onChecklistChange,
  reportId,
  isReadOnly = false,
}) => {
  const [selectedItem, setSelectedItem] = useState<string | null>(null);

  if (!template) {
    return (
      <div className="text-center py-8">
        <FileText className="h-12 w-12 mx-auto text-gray-400 mb-4" />
        <p className="text-gray-500">No hay plantilla de checklist disponible</p>
      </div>
    );
  }

  const handleItemToggle = (categoryId: string, itemId: string, completed: boolean) => {
    if (isReadOnly) return; // No permitir edición en modo solo lectura
    
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
    if (isReadOnly) return; // No permitir edición en modo solo lectura
    
    const key = `${categoryId}.${itemId}`;
    const newChecklist = { ...checklist };
    
    if (!newChecklist[key]) {
      newChecklist[key] = { completed: false, notes: '', media_urls: [] };
    }
    
    newChecklist[key].notes = notes;
    onChecklistChange(newChecklist);
  };

  const handleMediaAdded = (categoryId: string, itemId: string, mediaUrl: string) => {
    if (isReadOnly) return; // No permitir edición en modo solo lectura
    
    console.log('ChecklistSection - adding media:', { categoryId, itemId, mediaUrl });
    const key = `${categoryId}.${itemId}`;
    const newChecklist = { ...checklist };
    
    if (!newChecklist[key]) {
      newChecklist[key] = { completed: false, notes: '', media_urls: [] };
    }
    
    newChecklist[key].media_urls = [...(newChecklist[key].media_urls || []), mediaUrl];
    console.log('ChecklistSection - updated checklist item:', newChecklist[key]);
    onChecklistChange(newChecklist);
  };

  return (
    <div className="space-y-6 max-h-[60vh] overflow-y-auto">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">
          Checklist: {template.template_name}
          {isReadOnly && <Badge variant="secondary" className="ml-2">Solo Lectura</Badge>}
        </h3>
        <Badge variant="outline">
          {Object.keys(checklist).length} / {
            template.checklist_items.reduce((acc, cat) => acc + cat.items.length, 0)
          } completadas
        </Badge>
      </div>

      {template.checklist_items.map((category: ChecklistCategory) => (
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
                  <div className="flex items-start space-x-3">
                    <Checkbox
                      checked={isCompleted}
                      onCheckedChange={(checked) => 
                        handleItemToggle(category.id, item.id, checked as boolean)
                      }
                      className="mt-1"
                      disabled={isReadOnly}
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <p className={`font-medium ${isCompleted ? 'line-through text-gray-500' : ''}`}>
                          {item.task}
                        </p>
                        <div className="flex items-center space-x-2">
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
                      </div>
                      
                      {isCompleted && (
                        <div className="flex items-center text-green-600 text-sm mt-1">
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Completado
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Notas */}
                  <div className="ml-6">
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
                    <div className="ml-6">
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
