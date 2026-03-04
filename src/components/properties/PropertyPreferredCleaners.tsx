import React, { useState } from 'react';
import { Star, Plus, X, GripVertical, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { usePreferredCleaners, useAssignPreferredCleaner, useRemovePreferredCleaner } from '@/hooks/usePropertyPreferredCleaners';
import { useCleaners } from '@/hooks/useCleaners';
import { useProperties } from '@/hooks/useProperties';
import { propertyPreferredCleanersStorage } from '@/services/storage/propertyPreferredCleanersStorage';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

interface PropertyPreferredCleanersProps {
  propertyId: string;
}

export const PropertyPreferredCleaners: React.FC<PropertyPreferredCleanersProps> = ({ propertyId }) => {
  const { data: preferred = [], isLoading } = usePreferredCleaners(propertyId);
  const { cleaners } = useCleaners();
  const { data: properties = [] } = useProperties();
  const assignMutation = useAssignPreferredCleaner();
  const removeMutation = useRemovePreferredCleaner();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [showAdd, setShowAdd] = useState(false);
  const [showCopy, setShowCopy] = useState(false);
  const [selectedCleaner, setSelectedCleaner] = useState('');
  const [notes, setNotes] = useState('');
  const [sourcePropertyId, setSourcePropertyId] = useState('');
  const [isCopying, setIsCopying] = useState(false);

  const assignedIds = preferred.map(p => p.cleaner_id);
  const availableCleaners = cleaners.filter(c => c.isActive && !assignedIds.includes(c.id));
  const otherProperties = properties.filter(p => p.id !== propertyId);

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

  const handleCopyFrom = async () => {
    if (!sourcePropertyId) return;
    setIsCopying(true);
    try {
      await propertyPreferredCleanersStorage.copyFromProperty(sourcePropertyId, propertyId);
      queryClient.invalidateQueries({ queryKey: ['property-preferred-cleaners', propertyId] });
      const sourceName = properties.find(p => p.id === sourcePropertyId)?.nombre || '';
      toast({ title: `Limpiadoras copiadas de "${sourceName}"` });
      setSourcePropertyId('');
      setShowCopy(false);
    } catch {
      toast({ title: 'Error al copiar limpiadoras', variant: 'destructive' });
    } finally {
      setIsCopying(false);
    }
  };

  return (
    <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Star className="h-4 w-4 text-yellow-500" />
          <h4 className="text-sm font-semibold">Limpiadoras preferidas</h4>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={() => { setShowCopy(!showCopy); setShowAdd(false); }}>
            <Copy className="h-4 w-4 mr-1" />
            Copiar de otro
          </Button>
          <Button variant="ghost" size="sm" onClick={() => { setShowAdd(!showAdd); setShowCopy(false); }}>
            <Plus className="h-4 w-4 mr-1" />
            Añadir
          </Button>
        </div>
      </div>

      {showCopy && (
        <div className="space-y-2 p-3 border rounded-md bg-background">
          <p className="text-xs text-muted-foreground">Copiar limpiadoras preferidas de otro apartamento:</p>
          <Select value={sourcePropertyId} onValueChange={setSourcePropertyId}>
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar apartamento..." />
            </SelectTrigger>
            <SelectContent>
              {otherProperties.map(p => (
                <SelectItem key={p.id} value={p.id}>
                  {p.nombre} {p.codigo ? `(${p.codigo})` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleCopyFrom} disabled={!sourcePropertyId || isCopying}>
              {isCopying ? 'Copiando...' : 'Copiar'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowCopy(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

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
