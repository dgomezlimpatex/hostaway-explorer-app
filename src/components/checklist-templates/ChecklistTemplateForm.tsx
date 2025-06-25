
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import { TaskChecklistTemplate, ChecklistCategory, ChecklistItem } from '@/types/taskReports';
import { useToast } from '@/hooks/use-toast';

interface ChecklistTemplateFormProps {
  template?: TaskChecklistTemplate;
  onSuccess: () => void;
}

export const ChecklistTemplateForm: React.FC<ChecklistTemplateFormProps> = ({
  template,
  onSuccess,
}) => {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    template_name: '',
    property_type: '',
    is_active: true,
    checklist_items: [] as ChecklistCategory[],
  });

  useEffect(() => {
    if (template) {
      setFormData({
        template_name: template.template_name,
        property_type: template.property_type,
        is_active: template.is_active,
        checklist_items: template.checklist_items,
      });
    }
  }, [template]);

  const addCategory = () => {
    const newCategory: ChecklistCategory = {
      id: `category_${Date.now()}`,
      category: '',
      items: [],
    };
    setFormData(prev => ({
      ...prev,
      checklist_items: [...prev.checklist_items, newCategory],
    }));
  };

  const removeCategory = (categoryIndex: number) => {
    setFormData(prev => ({
      ...prev,
      checklist_items: prev.checklist_items.filter((_, index) => index !== categoryIndex),
    }));
  };

  const updateCategory = (categoryIndex: number, updates: Partial<ChecklistCategory>) => {
    setFormData(prev => ({
      ...prev,
      checklist_items: prev.checklist_items.map((category, index) =>
        index === categoryIndex ? { ...category, ...updates } : category
      ),
    }));
  };

  const addItem = (categoryIndex: number) => {
    const newItem: ChecklistItem = {
      id: `item_${Date.now()}`,
      task: '',
      required: false,
      photo_required: false,
    };
    
    setFormData(prev => ({
      ...prev,
      checklist_items: prev.checklist_items.map((category, index) =>
        index === categoryIndex
          ? { ...category, items: [...category.items, newItem] }
          : category
      ),
    }));
  };

  const removeItem = (categoryIndex: number, itemIndex: number) => {
    setFormData(prev => ({
      ...prev,
      checklist_items: prev.checklist_items.map((category, index) =>
        index === categoryIndex
          ? { ...category, items: category.items.filter((_, idx) => idx !== itemIndex) }
          : category
      ),
    }));
  };

  const updateItem = (categoryIndex: number, itemIndex: number, updates: Partial<ChecklistItem>) => {
    setFormData(prev => ({
      ...prev,
      checklist_items: prev.checklist_items.map((category, catIndex) =>
        catIndex === categoryIndex
          ? {
              ...category,
              items: category.items.map((item, itemIdx) =>
                itemIdx === itemIndex ? { ...item, ...updates } : item
              ),
            }
          : category
      ),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.template_name.trim()) {
      toast({
        title: "Error",
        description: "El nombre de la plantilla es requerido.",
        variant: "destructive",
      });
      return;
    }

    if (!formData.property_type) {
      toast({
        title: "Error",
        description: "El tipo de propiedad es requerido.",
        variant: "destructive",
      });
      return;
    }

    if (formData.checklist_items.length === 0) {
      toast({
        title: "Error",
        description: "Debe agregar al menos una categoría.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Here you would call the API to create/update the template
      console.log('Template data:', formData);
      
      toast({
        title: template ? "Plantilla actualizada" : "Plantilla creada",
        description: `La plantilla "${formData.template_name}" se ha ${template ? 'actualizado' : 'creado'} exitosamente.`,
      });
      
      onSuccess();
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo guardar la plantilla. Inténtalo de nuevo.",
        variant: "destructive",
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-h-[70vh] overflow-y-auto">
      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle>Información Básica</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="template_name">Nombre de la Plantilla</Label>
              <Input
                id="template_name"
                value={formData.template_name}
                onChange={(e) => setFormData(prev => ({ ...prev, template_name: e.target.value }))}
                placeholder="Ej: Limpieza Apartamento Estándar"
              />
            </div>
            <div>
              <Label htmlFor="property_type">Tipo de Propiedad</Label>
              <Select 
                value={formData.property_type} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, property_type: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="apartamento">Apartamento</SelectItem>
                  <SelectItem value="casa">Casa</SelectItem>
                  <SelectItem value="estudio">Estudio</SelectItem>
                  <SelectItem value="villa">Villa</SelectItem>
                  <SelectItem value="habitacion">Habitación</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <Switch
              checked={formData.is_active}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
            />
            <Label>Plantilla activa</Label>
          </div>
        </CardContent>
      </Card>

      {/* Categories and Items */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Categorías y Tareas</CardTitle>
          <Button type="button" onClick={addCategory} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Agregar Categoría
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {formData.checklist_items.map((category, categoryIndex) => (
            <Card key={category.id} className="border-l-4 border-l-blue-500">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 flex-1">
                    <GripVertical className="h-4 w-4 text-gray-400" />
                    <Input
                      value={category.category}
                      onChange={(e) => updateCategory(categoryIndex, { category: e.target.value })}
                      placeholder="Nombre de la categoría"
                      className="font-medium"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeCategory(categoryIndex)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {category.items.map((item, itemIndex) => (
                  <div key={item.id} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                    <GripVertical className="h-4 w-4 text-gray-400" />
                    <Input
                      value={item.task}
                      onChange={(e) => updateItem(categoryIndex, itemIndex, { task: e.target.value })}
                      placeholder="Descripción de la tarea"
                      className="flex-1"
                    />
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        checked={item.required}
                        onCheckedChange={(checked) => updateItem(categoryIndex, itemIndex, { required: checked as boolean })}
                      />
                      <Label className="text-sm">Requerido</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        checked={item.photo_required}
                        onCheckedChange={(checked) => updateItem(categoryIndex, itemIndex, { photo_required: checked as boolean })}
                      />
                      <Label className="text-sm">Foto</Label>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeItem(categoryIndex, itemIndex)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addItem(categoryIndex)}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Agregar Tarea
                </Button>
              </CardContent>
            </Card>
          ))}
          
          {formData.checklist_items.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No hay categorías. Haz clic en "Agregar Categoría" para empezar.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-end space-x-3 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onSuccess}>
          Cancelar
        </Button>
        <Button type="submit">
          {template ? 'Actualizar' : 'Crear'} Plantilla
        </Button>
      </div>
    </form>
  );
};
