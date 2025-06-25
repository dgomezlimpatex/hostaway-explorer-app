
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Edit, Trash2, Copy } from 'lucide-react';
import { useChecklistTemplates } from '@/hooks/useTaskReports';
import { ChecklistTemplatesList } from './ChecklistTemplatesList';
import { CreateTemplateModal } from './CreateTemplateModal';
import { EditTemplateModal } from './EditTemplateModal';
import { TaskChecklistTemplate } from '@/types/taskReports';
import { useToast } from '@/hooks/use-toast';

export default function ChecklistTemplatesPage() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<TaskChecklistTemplate | null>(null);
  const { data: templates = [], isLoading } = useChecklistTemplates();
  const { toast } = useToast();

  const handleCreateTemplate = () => {
    setIsCreateModalOpen(true);
  };

  const handleEditTemplate = (template: TaskChecklistTemplate) => {
    setEditingTemplate(template);
  };

  const handleDuplicateTemplate = (template: TaskChecklistTemplate) => {
    // Logic to duplicate template
    toast({
      title: "Función próximamente",
      description: "La duplicación de plantillas estará disponible pronto.",
    });
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Plantillas de Checklist</h1>
          <p className="text-gray-600 mt-2">
            Gestiona las plantillas de checklist para diferentes tipos de propiedades
          </p>
        </div>
        <Button onClick={handleCreateTemplate}>
          <Plus className="h-4 w-4 mr-2" />
          Nueva Plantilla
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Plantillas Disponibles ({templates.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <ChecklistTemplatesList
            templates={templates}
            isLoading={isLoading}
            onEdit={handleEditTemplate}
            onDuplicate={handleDuplicateTemplate}
          />
        </CardContent>
      </Card>

      <CreateTemplateModal
        open={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
      />

      <EditTemplateModal
        template={editingTemplate}
        open={!!editingTemplate}
        onOpenChange={(open) => !open && setEditingTemplate(null)}
      />
    </div>
  );
}
