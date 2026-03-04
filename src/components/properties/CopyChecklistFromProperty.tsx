
import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useProperties } from '@/hooks/useProperties';
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
  const { data: properties = [] } = useProperties();
  const { data: templates = [] } = useChecklistTemplates();

  // We need properties that have checklist assignments - we'll filter by checking
  // which templates exist and matching. For simplicity, show all properties except current
  // and let the user pick. The parent will handle loading the template.
  
  // Build a map: propertyId -> template (via property_checklist_assignments)
  // Since we don't have a bulk query, we show properties and templates together
  const propertiesWithTemplates = properties
    .filter(p => p.id !== excludePropertyId)
    .map(p => {
      // Find if any template name matches this property
      const matchingTemplate = templates.find(t => 
        t.template_name.includes(p.nombre) || t.property_type === p.nombre
      );
      return { property: p, template: matchingTemplate };
    });

  // Also show templates directly that aren't matched to specific properties
  const unmatchedTemplates = templates.filter(t => 
    !propertiesWithTemplates.some(pwt => pwt.template?.id === t.id)
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Copy className="h-4 w-4 text-muted-foreground" />
        <Label className="text-sm font-medium">Copiar checklist existente</Label>
      </div>
      <Select onValueChange={onSelectTemplate}>
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
