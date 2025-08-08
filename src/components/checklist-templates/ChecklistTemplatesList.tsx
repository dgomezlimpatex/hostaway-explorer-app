
import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Edit, Copy, Trash2, FileText } from 'lucide-react';
import { TaskChecklistTemplate } from '@/types/taskReports';
import { Skeleton } from '@/components/ui/skeleton';

interface ChecklistTemplatesListProps {
  templates: TaskChecklistTemplate[];
  isLoading: boolean;
  onEdit: (template: TaskChecklistTemplate) => void;
  onDuplicate: (template: TaskChecklistTemplate) => void;
  onDelete: (template: TaskChecklistTemplate) => void;
}

export const ChecklistTemplatesList: React.FC<ChecklistTemplatesListProps> = ({
  templates,
  isLoading,
  onEdit,
  onDuplicate,
  onDelete,
}) => {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center space-x-4">
            <Skeleton className="h-12 w-12" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <div className="text-center py-12">
        <FileText className="h-12 w-12 mx-auto text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          No hay plantillas creadas
        </h3>
        <p className="text-gray-500 mb-4">
          Crea tu primera plantilla de checklist para empezar
        </p>
      </div>
    );
  }

  const getItemsCount = (template: TaskChecklistTemplate) => {
    return template.checklist_items.reduce((acc, category) => {
      return acc + category.items.length;
    }, 0);
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nombre</TableHead>
          <TableHead>Tipo de Propiedad</TableHead>
          <TableHead>Categorías</TableHead>
          <TableHead>Total Items</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead>Acciones</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {templates.map((template) => (
          <TableRow key={template.id}>
            <TableCell className="font-medium">{template.template_name}</TableCell>
            <TableCell>
              <Badge variant="outline">{template.property_type}</Badge>
            </TableCell>
            <TableCell>{template.checklist_items.length}</TableCell>
            <TableCell>{getItemsCount(template)}</TableCell>
            <TableCell>
              <Badge variant={template.is_active ? "default" : "secondary"}>
                {template.is_active ? "Activa" : "Inactiva"}
              </Badge>
            </TableCell>
            <TableCell>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onEdit(template)}
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onDuplicate(template)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => onDelete(template)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};
