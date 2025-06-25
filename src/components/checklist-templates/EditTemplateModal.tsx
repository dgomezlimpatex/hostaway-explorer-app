
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ChecklistTemplateForm } from './ChecklistTemplateForm';
import { TaskChecklistTemplate } from '@/types/taskReports';

interface EditTemplateModalProps {
  template: TaskChecklistTemplate | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const EditTemplateModal: React.FC<EditTemplateModalProps> = ({
  template,
  open,
  onOpenChange,
}) => {
  const handleSuccess = () => {
    onOpenChange(false);
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  if (!template) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Plantilla: {template.template_name}</DialogTitle>
        </DialogHeader>
        <ChecklistTemplateForm 
          template={template}
          onSuccess={handleSuccess}
          onCancel={handleCancel}
        />
      </DialogContent>
    </Dialog>
  );
};
