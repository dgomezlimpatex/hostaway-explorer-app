
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { PropertyChecklistEditor } from './PropertyChecklistEditor';
import { CopyChecklistFromProperty } from './CopyChecklistFromProperty';
import { useChecklistTemplates, useCreateChecklistTemplate, useUpdateChecklistTemplate } from '@/hooks/useChecklistTemplates';
import { usePropertyChecklistAssignment, useAssignChecklistToProperty, useRemoveChecklistFromProperty } from '@/hooks/usePropertyChecklists';

import { Property } from '@/types/property';
import { ChecklistCategory } from '@/types/taskReports';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Trash2, Save } from 'lucide-react';

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
  const [showSaveAsTemplate, setShowSaveAsTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');
  
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

  const handleCopyFromTemplate = async (templateId: string) => {
    if (!property) return;

    try {
      // IMPORTANT: Assign the existing template directly (no duplication)
      await assignChecklist.mutateAsync({
        propertyId: property.id,
        templateId,
      });

      // Close immediately to avoid users clicking "Guardar" (which would fork/update)
      onOpenChange(false);
    } catch (error) {
      console.error('Error assigning existing template:', error);
      toast({
        title: 'Error',
        description: 'No se pudo asignar la plantilla. Inténtalo de nuevo.',
        variant: 'destructive',
      });
    }
  };

  const handleSave = async () => {
    if (!property) return;

    try {
      const desiredTemplateName = `Checklist - ${property.nombre}`;

      const propertyTemplatePayload = {
        template_name: desiredTemplateName,
        property_type: property.nombre,
        checklist_items: categories,
        is_active: true,
      };

      // If there is an assigned template already:
      // - If it's already property-specific, update it.
      // - If it's a shared template, ALWAYS fork (create a new one) and re-assign.
      if (assignment?.checklist_template_id) {
        const assignedTemplate = templates.find(t => t.id === assignment.checklist_template_id);
        const isPropertySpecific = assignedTemplate?.template_name === desiredTemplateName;

        if (isPropertySpecific) {
          await updateTemplate.mutateAsync({
            templateId: assignment.checklist_template_id,
            updates: {
              checklist_items: categories,
              template_name: desiredTemplateName,
            },
          });
        } else {
          const forkedTemplate = await createTemplate.mutateAsync(propertyTemplatePayload);
          await assignChecklist.mutateAsync({
            propertyId: property.id,
            templateId: forkedTemplate.id,
          });
        }
      } else {
        // No assignment yet: user is creating a brand-new checklist for this property
        const newTemplate = await createTemplate.mutateAsync(propertyTemplatePayload);
        await assignChecklist.mutateAsync({
          propertyId: property.id,
          templateId: newTemplate.id,
        });
      }

      onOpenChange(false);
    } catch (error) {
      console.error('Error saving checklist:', error);
      toast({
        title: 'Error',
        description: 'No se pudo guardar la checklist. Inténtalo de nuevo.',
        variant: 'destructive',
      });
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

  const handleSaveAsTemplate = async () => {
    if (!templateName.trim() || categories.length === 0) {
      toast({
        title: "Error",
        description: "Introduce un nombre para la plantilla y asegúrate de que tiene tareas.",
        variant: "destructive",
      });
      return;
    }
    try {
      await createTemplate.mutateAsync({
        template_name: templateName.trim(),
        property_type: 'general',
        checklist_items: categories,
        is_active: true,
      });
      setShowSaveAsTemplate(false);
      setTemplateName('');
      toast({
        title: "Plantilla guardada",
        description: `"${templateName.trim()}" está disponible para usar en otras propiedades.`,
      });
    } catch (error) {
      console.error('Error saving as template:', error);
    }
  };

  const isSaving = createTemplate.isPending || updateTemplate.isPending || assignChecklist.isPending;
  const hasExisting = !!assignment?.checklist_template_id;
  const hasTasks = categories.some(c => c.items.length > 0);

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

            {/* Save as template */}
            {hasTasks && (
              <>
                <Separator />
                {showSaveAsTemplate ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={templateName}
                      onChange={(e) => setTemplateName(e.target.value)}
                      placeholder="Nombre de la plantilla..."
                      className="h-8"
                      autoFocus
                    />
                    <Button size="sm" onClick={handleSaveAsTemplate} disabled={createTemplate.isPending}>
                      <Save className="h-4 w-4 mr-1" />
                      Guardar
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => { setShowSaveAsTemplate(false); setTemplateName(''); }}>
                      Cancelar
                    </Button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowSaveAsTemplate(true)}
                    className="w-full"
                  >
                    <Save className="h-4 w-4 mr-1" />
                    Guardar como plantilla reutilizable
                  </Button>
                )}
              </>
            )}
          </div>
        )}

        <DialogFooter className="flex justify-between sm:justify-between gap-2">
          <div className="flex gap-2">
            {hasExisting && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleRemove}
                disabled={removeChecklist.isPending}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Eliminar
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
