import { usePropertyChecklistAssignment } from '@/hooks/usePropertyChecklists';
import { useChecklistTemplates } from '@/hooks/useChecklistTemplates';
import { Badge } from '@/components/ui/badge';
import { CheckSquare, AlertCircle } from 'lucide-react';

interface PropertyChecklistInfoProps {
  propertyId: string;
}

export const PropertyChecklistInfo = ({ propertyId }: PropertyChecklistInfoProps) => {
  const { data: checklistAssignment } = usePropertyChecklistAssignment(propertyId);
  const { data: templates } = useChecklistTemplates();

  if (!checklistAssignment?.checklist_template_id) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <AlertCircle className="h-4 w-4" />
        <span>Sin checklist</span>
      </div>
    );
  }

  const assignedTemplate = templates?.find(
    template => template.id === checklistAssignment.checklist_template_id
  );

  if (!assignedTemplate) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <AlertCircle className="h-4 w-4" />
        <span>Checklist no encontrada</span>
      </div>
    );
  }

  const totalTasks = assignedTemplate.checklist_items.reduce(
    (sum, cat) => sum + cat.items.length, 0
  );

  return (
    <div className="flex items-center gap-2">
      <CheckSquare className="h-4 w-4 text-green-600" />
      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
        {assignedTemplate.template_name}
      </Badge>
      <span className="text-xs text-muted-foreground">
        {totalTasks} tarea{totalTasks !== 1 ? 's' : ''}
      </span>
    </div>
  );
};