
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { PropertyChecklistEditor } from './PropertyChecklistEditor';
import { CopyChecklistFromProperty } from './CopyChecklistFromProperty';
import { useChecklistTemplates, useCreateChecklistTemplate, useUpdateChecklistTemplate } from '@/hooks/useChecklistTemplates';
import { usePropertyChecklistAssignment, useAssignChecklistToProperty, useRemoveChecklistFromProperty } from '@/hooks/usePropertyChecklists';
import { Property } from '@/types/property';
import { ChecklistCategory } from '@/types/taskReports';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Trash2 } from 'lucide-react';

interface AssignChecklistModalProps {
  property: Property | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const AssignChecklistModal: React.FC<AssignChecklistModalProps> = ({
  property,
  open,
  onOpenChange,
}) => {
  const [categories, setCategories] = useState<ChecklistCategory[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  
  const { data: assignment, isLoading: loadingAssignment } = usePropertyChecklistAssignment(property?.id || '');
  const { data: templates = [] } = useChecklistTemplates();
  const createTemplate = useCreateChecklistTemplate();
  const updateTemplate = useUpdateChecklistTemplate();
  const assignChecklist = useAssignChecklistToProperty();
  const removeChecklist = useRemoveChecklistFromProperty();
  const { toast } = useToast();

  // Load existing template data when modal opens
  useEffect(() => {
    if (!open || !property) {
      setIsLoaded(false);
      return;
    }

    if (loadingAssignment) return;

    if (assignment?.checklist_template_id) {
      const template = templates.find(t => t.id === assignment.checklist_template_id);
      if (template) {
        setCategories(template.checklist_items || []);
      } else {
        setCategories([]);
      }
    } else {
      setCategories([]);
    }
    setIsLoaded(true);
  }, [open, property, assignment, templates, loadingAssignment]);

  const handleCopyFromTemplate = (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (template) {
      // Deep copy the categories with new IDs
      const copiedCategories = template.checklist_items.map(cat => ({
        ...cat,
        id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
        items: cat.items.map(item => ({
          ...item,
          id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
        })),
      }));
      setCategories(copiedCategories);
      toast({
        title: "Checklist copiada",
        description: `Se copió la checklist "${template.template_name}". Puedes editarla antes de guardar.`,
      });
    }
  };

  const handleSave = async () => {
    if (!property) return;

    try {
      if (assignment?.checklist_template_id) {
        // Update existing template
        await updateTemplate.mutateAsync({
          templateId: assignment.checklist_template_id,
          updates: {
            checklist_items: categories,
            template_name: `Checklist - ${property.nombre}`,
          },
        });
      } else {
        // Create new template and assign
        const newTemplate = await createTemplate.mutateAsync({
          template_name: `Checklist - ${property.nombre}`,
          property_type: property.nombre,
          checklist_items: categories,
          is_active: true,
        });
        await assignChecklist.mutateAsync({
          propertyId: property.id,
          templateId: newTemplate.id,
        });
      }
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving checklist:', error);
    }
  };

  const handleRemove = async () => {
    if (!property) return;
    try {
      await removeChecklist.mutateAsync(property.id);
      setCategories([]);
      onOpenChange(false);
    } catch (error) {
      console.error('Error removing checklist:', error);
    }
  };

  const isSaving = createTemplate.isPending || updateTemplate.isPending || assignChecklist.isPending;
  const hasExisting = !!assignment?.checklist_template_id;

  if (!property) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Checklist — {property.nombre}
          </DialogTitle>
        </DialogHeader>

        {(!isLoaded || loadingAssignment) ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Copy from existing */}
            <CopyChecklistFromProperty
              excludePropertyId={property.id}
              onSelectTemplate={handleCopyFromTemplate}
            />

            <Separator />

            {/* Inline editor */}
            <PropertyChecklistEditor
              categories={categories}
              onChange={setCategories}
            />
          </div>
        )}

        <DialogFooter className="flex justify-between sm:justify-between gap-2">
          <div>
            {hasExisting && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleRemove}
                disabled={removeChecklist.isPending}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Eliminar checklist
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  Guardando...
                </>
              ) : (
                hasExisting ? 'Guardar cambios' : 'Crear checklist'
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
