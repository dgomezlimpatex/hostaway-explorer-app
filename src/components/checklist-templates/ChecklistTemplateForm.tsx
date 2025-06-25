
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Camera } from 'lucide-react';
import { TaskChecklistTemplate, ChecklistCategory, ChecklistItem } from '@/types/taskReports';
import { useCreateChecklistTemplate, useUpdateChecklistTemplate } from '@/hooks/useChecklistTemplates';

interface ChecklistTemplateFormProps {
  template?: TaskChecklistTemplate;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export const ChecklistTemplateForm: React.FC<ChecklistTemplateFormProps> = ({
  template,
  onSuccess,
  onCancel,
}) => {
  const [templateName, setTemplateName] = useState(template?.template_name || '');
  const [propertyType, setPropertyType] = useState(template?.property_type || '');
  const [categories, setCategories] = useState<ChecklistCategory[]>(
    template?.checklist_items || [
      {
        id: '1',
        category: 'Cocina',
        items: []
      }
    ]
  );

  const createMutation = useCreateChecklistTemplate();
  const updateMutation = useUpdateChecklistTemplate();

  const handleAddCategory = () => {
    const newCategory: ChecklistCategory = {
      id: Date.now().toString(),
      category: 'Nueva Categoría',
      items: []
    };
    setCategories([...categories, newCategory]);
  };

  const handleRemoveCategory = (categoryId: string) => {
    setCategories(categories.filter(cat => cat.id !== categoryId));
  };

  const handleUpdateCategory = (categoryId: string, newName: string) => {
    setCategories(categories.map(cat => 
      cat.id === categoryId ? { ...cat, category: newName } : cat
    ));
  };

  const handleAddItem = (categoryId: string) => {
    const newItem: ChecklistItem = {
      id: Date.now().toString(),
      task: 'Nueva tarea',
      required: false,
      photo_required: false
    };

    setCategories(categories.map(cat => 
      cat.id === categoryId 
        ? { ...cat, items: [...cat.items, newItem] }
        : cat
    ));
  };

  const handleRemoveItem = (categoryId: string, itemId: string) => {
    setCategories(categories.map(cat => 
      cat.id === categoryId 
        ? { ...cat, items: cat.items.filter(item => item.id !== itemId) }
        : cat
    ));
  };

  const handleUpdateItem = (categoryId: string, itemId: string, updates: Partial<ChecklistItem>) => {
    setCategories(categories.map(cat => 
      cat.id === categoryId 
        ? {
            ...cat, 
            items: cat.items.map(item => 
              item.id === itemId ? { ...item, ...updates } : item
            )
          }
        : cat
    ));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!templateName.trim() || !propertyType.trim()) {
      return;
    }

    const templateData = {
      template_name: templateName.trim(),
      property_type: propertyType.trim(),
      checklist_items: categories,
      is_active: true,
      created_by: undefined // Will be set by the backend
    };

    try {
      if (template) {
        await updateMutation.mutateAsync({
          templateId: template.id,
          updates: templateData
        });
      } else {
        await createMutation.mutateAsync(templateData);
      }
      onSuccess?.();
    } catch (error) {
      console.error('Error saving template:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="template-name">Nombre de la Plantilla</Label>
          <Input
            id="template-name"
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            placeholder="Ej: Limpieza Apartamento Estándar"
            required
          />
        </div>
        <div>
          <Label htmlFor="property-type">Tipo de Propiedad</Label>
          <Select value={propertyType} onValueChange={setPropertyType}>
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar tipo..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="apartamento">Apartamento</SelectItem>
              <SelectItem value="casa">Casa</SelectItem>
              <SelectItem value="estudio">Estudio</SelectItem>
              <SelectItem value="villa">Villa</SelectItem>
              <SelectItem value="hotel">Hotel</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Categorías y Tareas</h3>
          <Button type="button" onClick={handleAddCategory} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Añadir Categoría
          </Button>
        </div>

        {categories.map((category) => (
          <Card key={category.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <Input
                  value={category.category}
                  onChange={(e) => handleUpdateCategory(category.id, e.target.value)}
                  className="font-medium"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleRemoveCategory(category.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {category.items.map((item) => (
                <div key={item.id} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <Input
                      value={item.task}
                      onChange={(e) => handleUpdateItem(category.id, item.id, { task: e.target.value })}
                      placeholder="Descripción de la tarea"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleRemoveItem(category.id, item.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id={`required-${item.id}`}
                          checked={item.required}
                          onCheckedChange={(checked) => 
                            handleUpdateItem(category.id, item.id, { required: checked as boolean })
                          }
                        />
                        <Label htmlFor={`required-${item.id}`} className="text-sm">
                          Requerido
                        </Label>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id={`photo-${item.id}`}
                          checked={item.photo_required}
                          onCheckedChange={(checked) => 
                            handleUpdateItem(category.id, item.id, { photo_required: checked as boolean })
                          }
                        />
                        <Label htmlFor={`photo-${item.id}`} className="text-sm">
                          Foto requerida
                        </Label>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      {item.required && (
                        <Badge variant="destructive" className="text-xs">
                          Requerido
                        </Badge>
                      )}
                      {item.photo_required && (
                        <Badge variant="secondary" className="text-xs">
                          <Camera className="h-3 w-3 mr-1" />
                          Foto
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleAddItem(category.id)}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Añadir Tarea
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex justify-end space-x-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
        )}
        <Button 
          type="submit" 
          disabled={createMutation.isPending || updateMutation.isPending}
        >
          {createMutation.isPending || updateMutation.isPending
            ? 'Guardando...'
            : template ? 'Actualizar' : 'Crear'
          } Plantilla
        </Button>
      </div>
    </form>
  );
};
