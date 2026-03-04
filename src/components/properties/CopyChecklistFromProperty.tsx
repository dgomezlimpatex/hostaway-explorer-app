
import React, { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useChecklistTemplates } from '@/hooks/useChecklistTemplates';
import { Badge } from '@/components/ui/badge';
import { Copy } from 'lucide-react';

interface CopyChecklistFromPropertyProps {
  excludePropertyId: string;
  onSelectTemplate: (templateId: string) => void;
}

export const CopyChecklistFromProperty: React.FC<CopyChecklistFromPropertyProps> = ({
  excludePropertyId,
  onSelectTemplate,
}) => {
  const [selectedValue, setSelectedValue] = useState<string>('');
  const { data: templates = [] } = useChecklistTemplates();

  const handleSelect = (templateId: string) => {
    onSelectTemplate(templateId);
    // Reset after a tick so the user can re-select or pick another
    setTimeout(() => setSelectedValue(''), 100);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Copy className="h-4 w-4 text-muted-foreground" />
        <Label className="text-sm font-medium">Copiar checklist existente</Label>
      </div>
      <Select value={selectedValue} onValueChange={handleSelect}>
        <SelectTrigger>
          <SelectValue placeholder="Seleccionar plantilla a copiar..." />
        </SelectTrigger>
        <SelectContent>
          {templates.map((template) => {
            const itemCount = template.checklist_items.reduce(
              (sum, cat) => sum + cat.items.length, 0
            );
            return (
              <SelectItem key={template.id} value={template.id}>
                <div className="flex items-center gap-2">
                  <span>{template.template_name}</span>
                  <Badge variant="secondary" className="text-xs">
                    {itemCount} tareas
                  </Badge>
                </div>
              </SelectItem>
            );
          })}
          {templates.length === 0 && (
            <div className="px-2 py-3 text-sm text-muted-foreground text-center">
              No hay plantillas disponibles
            </div>
          )}
        </SelectContent>
      </Select>
    </div>
  );
};
