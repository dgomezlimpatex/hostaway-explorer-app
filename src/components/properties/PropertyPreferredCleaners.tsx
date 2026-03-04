import React, { useState } from 'react';
import { Star, Plus, X, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { usePreferredCleaners, useAssignPreferredCleaner, useRemovePreferredCleaner } from '@/hooks/usePropertyPreferredCleaners';
import { useCleaners } from '@/hooks/useCleaners';

interface PropertyPreferredCleanersProps {
  propertyId: string;
}

export const PropertyPreferredCleaners: React.FC<PropertyPreferredCleanersProps> = ({ propertyId }) => {
  const { data: preferred = [], isLoading } = usePreferredCleaners(propertyId);
  const { cleaners } = useCleaners();
  const assignMutation = useAssignPreferredCleaner();
  const removeMutation = useRemovePreferredCleaner();

  const [showAdd, setShowAdd] = useState(false);
  const [selectedCleaner, setSelectedCleaner] = useState('');
  const [notes, setNotes] = useState('');

  const assignedIds = preferred.map(p => p.cleaner_id);
  const availableCleaners = cleaners.filter(c => c.isActive && !assignedIds.includes(c.id));

  const handleAdd = () => {
    if (!selectedCleaner) return;
    assignMutation.mutate({
      propertyId,
      cleanerId: selectedCleaner,
      priority: preferred.length,
      notes: notes || undefined,
    }, {
      onSuccess: () => {
        setSelectedCleaner('');
        setNotes('');
        setShowAdd(false);
      },
    });
  };

  return (
    <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Star className="h-4 w-4 text-yellow-500" />
          <h4 className="text-sm font-semibold">Limpiadoras preferidas</h4>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setShowAdd(!showAdd)}>
          <Plus className="h-4 w-4 mr-1" />
          Añadir
        </Button>
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Cargando...</p>
      ) : preferred.length === 0 ? (
        <p className="text-xs text-muted-foreground">No hay limpiadoras preferidas asignadas.</p>
      ) : (
        <div className="space-y-2">
          {preferred.map((pref, index) => (
            <div key={pref.id} className="flex items-center justify-between p-2 bg-background rounded border">
              <div className="flex items-center gap-2">
                <GripVertical className="h-3 w-3 text-muted-foreground" />
                <Badge variant="secondary" className="bg-green-100 text-green-800 text-xs">
                  P{index + 1}
                </Badge>
                <span className="text-sm font-medium">{pref.cleaner_name}</span>
                {pref.notes && (
                  <span className="text-xs text-muted-foreground italic">— {pref.notes}</span>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeMutation.mutate(pref.id)}
                disabled={removeMutation.isPending}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <div className="space-y-2 pt-2 border-t">
          <Select value={selectedCleaner} onValueChange={setSelectedCleaner}>
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar limpiadora" />
            </SelectTrigger>
            <SelectContent>
              {availableCleaners.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            placeholder="Notas (opcional) — ej: conoce bien el piso"
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleAdd} disabled={!selectedCleaner || assignMutation.isPending}>
              Añadir
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowAdd(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
