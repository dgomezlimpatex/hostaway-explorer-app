
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Camera, GripVertical, ChevronDown, ChevronRight } from 'lucide-react';
import { ChecklistCategory, ChecklistItem } from '@/types/taskReports';

interface PropertyChecklistEditorProps {
  categories: ChecklistCategory[];
  onChange: (categories: ChecklistCategory[]) => void;
}

export const PropertyChecklistEditor: React.FC<PropertyChecklistEditorProps> = ({
  categories,
  onChange,
}) => {
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

  const toggleCollapse = (categoryId: string) => {
    setCollapsedCategories(prev => {
      const next = new Set(prev);
      next.has(categoryId) ? next.delete(categoryId) : next.add(categoryId);
      return next;
    });
  };

  const addCategory = () => {
    const newCat: ChecklistCategory = {
      id: Date.now().toString(),
      category: '',
      items: [],
    };
    onChange([...categories, newCat]);
  };

  const removeCategory = (id: string) => {
    onChange(categories.filter(c => c.id !== id));
  };

  const updateCategoryName = (id: string, name: string) => {
    onChange(categories.map(c => c.id === id ? { ...c, category: name } : c));
  };

  const addItem = (categoryId: string) => {
    const newItem: ChecklistItem = {
      id: Date.now().toString(),
      task: '',
      required: false,
      photo_required: false,
    };
    onChange(categories.map(c =>
      c.id === categoryId ? { ...c, items: [...c.items, newItem] } : c
    ));
  };

  const removeItem = (categoryId: string, itemId: string) => {
    onChange(categories.map(c =>
      c.id === categoryId ? { ...c, items: c.items.filter(i => i.id !== itemId) } : c
    ));
  };

  const updateItem = (categoryId: string, itemId: string, updates: Partial<ChecklistItem>) => {
    onChange(categories.map(c =>
      c.id === categoryId
        ? { ...c, items: c.items.map(i => i.id === itemId ? { ...i, ...updates } : i) }
        : c
    ));
  };

  const moveItem = (categoryId: string, itemId: string, direction: 'up' | 'down') => {
    onChange(categories.map(c => {
      if (c.id !== categoryId) return c;
      const idx = c.items.findIndex(i => i.id === itemId);
      if (idx < 0) return c;
      const newIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (newIdx < 0 || newIdx >= c.items.length) return c;
      const items = [...c.items];
      [items[idx], items[newIdx]] = [items[newIdx], items[idx]];
      return { ...c, items };
    }));
  };

  const totalTasks = categories.reduce((sum, c) => sum + c.items.length, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {categories.length} categoría{categories.length !== 1 ? 's' : ''} · {totalTasks} tarea{totalTasks !== 1 ? 's' : ''}
        </p>
        <Button type="button" variant="outline" size="sm" onClick={addCategory}>
          <Plus className="h-4 w-4 mr-1" />
          Categoría
        </Button>
      </div>

      {categories.map((category) => {
        const isCollapsed = collapsedCategories.has(category.id);
        return (
          <div key={category.id} className="border rounded-lg overflow-hidden">
            {/* Category header */}
            <div className="flex items-center gap-2 bg-muted/50 px-3 py-2">
              <button
                type="button"
                onClick={() => toggleCollapse(category.id)}
                className="text-muted-foreground hover:text-foreground"
              >
                {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              <Input
                value={category.category}
                onChange={(e) => updateCategoryName(category.id, e.target.value)}
                placeholder="Nombre de categoría (ej: Cocina, Baño...)"
                className="h-8 bg-background"
              />
              <Badge variant="secondary" className="shrink-0 text-xs">
                {category.items.length}
              </Badge>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeCategory(category.id)}
                className="h-8 w-8 p-0 text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            {/* Items */}
            {!isCollapsed && (
              <div className="p-3 space-y-2">
                {category.items.map((item, idx) => (
                  <div key={item.id} className="flex items-center gap-2 group">
                    <div className="flex flex-col">
                      <button
                        type="button"
                        onClick={() => moveItem(category.id, item.id, 'up')}
                        disabled={idx === 0}
                        className="text-muted-foreground hover:text-foreground disabled:opacity-30 text-xs leading-none"
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        onClick={() => moveItem(category.id, item.id, 'down')}
                        disabled={idx === category.items.length - 1}
                        className="text-muted-foreground hover:text-foreground disabled:opacity-30 text-xs leading-none"
                      >
                        ▼
                      </button>
                    </div>
                    <Input
                      value={item.task}
                      onChange={(e) => updateItem(category.id, item.id, { task: e.target.value })}
                      placeholder="Descripción de la tarea"
                      className="h-8 flex-1"
                    />
                    <div className="flex items-center gap-3 shrink-0">
                      <label className="flex items-center gap-1 text-xs text-muted-foreground cursor-pointer">
                        <Switch
                          checked={item.required}
                          onCheckedChange={(v) => updateItem(category.id, item.id, { required: v })}
                          className="scale-75"
                        />
                        Req.
                      </label>
                      <label className="flex items-center gap-1 text-xs text-muted-foreground cursor-pointer">
                        <Switch
                          checked={item.photo_required}
                          onCheckedChange={(v) => updateItem(category.id, item.id, { photo_required: v })}
                          className="scale-75"
                        />
                        <Camera className="h-3 w-3" />
                      </label>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeItem(category.id, item.id)}
                      className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => addItem(category.id)}
                  className="w-full text-muted-foreground hover:text-foreground"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Añadir tarea
                </Button>
              </div>
            )}
          </div>
        );
      })}

      {categories.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <p className="text-sm">No hay tareas en esta checklist.</p>
          <p className="text-sm">Añade una categoría para empezar.</p>
        </div>
      )}
    </div>
  );
};
