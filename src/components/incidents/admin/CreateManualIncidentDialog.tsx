import React, { useMemo, useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useIncidentCategories } from '@/hooks/useCleaningIncidents';
import { useCreateManualIncident } from '@/hooks/useIncidents';
import { useClients } from '@/hooks/useClients';
import { useProperties } from '@/hooks/useProperties';
import { useSede } from '@/contexts/SedeContext';

interface CreateManualIncidentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const NO_PROPERTY_VALUE = 'none';

export const CreateManualIncidentDialog: React.FC<CreateManualIncidentDialogProps> = ({
  open,
  onOpenChange,
}) => {
  const { activeSede } = useSede();
  const { data: clients = [], isLoading: loadingClients } = useClients();
  const { data: properties = [], isLoading: loadingProperties } = useProperties();
  const { data: categories = [], isLoading: loadingCategories } = useIncidentCategories();
  const createManualIncident = useCreateManualIncident();

  const [clientId, setClientId] = useState('');
  const [propertyId, setPropertyId] = useState(NO_PROPERTY_VALUE);
  const [categoryId, setCategoryId] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');

  const clientProperties = useMemo(
    () => properties.filter((property) => property.clienteId === clientId),
    [clientId, properties],
  );

  const canSubmit =
    !!activeSede?.id &&
    !!clientId &&
    !!categoryId &&
    description.trim().length >= 5 &&
    !createManualIncident.isPending;

  const reset = () => {
    setClientId('');
    setPropertyId(NO_PROPERTY_VALUE);
    setCategoryId('');
    setLocation('');
    setDescription('');
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && !createManualIncident.isPending) reset();
    onOpenChange(nextOpen);
  };

  const handleClientChange = (value: string) => {
    setClientId(value);
    setPropertyId(NO_PROPERTY_VALUE);
  };

  const handleSubmit = async () => {
    if (!activeSede?.id || !canSubmit) return;

    try {
      await createManualIncident.mutateAsync({
        sedeId: activeSede.id,
        clientId,
        propertyId: propertyId === NO_PROPERTY_VALUE ? null : propertyId,
        categoryId,
        description: description.trim(),
        location: location.trim() || null,
      });
      handleOpenChange(false);
    } catch {
      // El toast se gestiona en el hook.
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-full bg-orange-100 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <DialogTitle>Crear incidencia manual</DialogTitle>
              <DialogDescription>
                Se creará en la sede activa{activeSede?.nombre ? `: ${activeSede.nombre}` : ''} como incidencia interna pendiente de revisión.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {!activeSede?.id && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Selecciona una sede activa antes de crear la incidencia.
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="manual-incident-client">Cliente</Label>
            <Select value={clientId} onValueChange={handleClientChange} disabled={loadingClients || createManualIncident.isPending}>
              <SelectTrigger id="manual-incident-client">
                <SelectValue placeholder={loadingClients ? 'Cargando clientes…' : 'Selecciona un cliente'} />
              </SelectTrigger>
              <SelectContent>
                {clients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="manual-incident-property">Propiedad (opcional)</Label>
            <Select
              value={propertyId}
              onValueChange={setPropertyId}
              disabled={!clientId || loadingProperties || createManualIncident.isPending}
            >
              <SelectTrigger id="manual-incident-property">
                <SelectValue placeholder={loadingProperties ? 'Cargando propiedades…' : 'Sin propiedad'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_PROPERTY_VALUE}>Sin propiedad</SelectItem>
                {clientProperties.map((property) => (
                  <SelectItem key={property.id} value={property.id}>
                    {property.codigo ? `${property.codigo} · ` : ''}{property.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="manual-incident-category">Categoría</Label>
            <Select value={categoryId} onValueChange={setCategoryId} disabled={loadingCategories || createManualIncident.isPending}>
              <SelectTrigger id="manual-incident-category">
                <SelectValue placeholder={loadingCategories ? 'Cargando categorías…' : 'Selecciona una categoría'} />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="manual-incident-location">Ubicación (opcional)</Label>
            <Input
              id="manual-incident-location"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder="Ej: baño principal, cocina, portal…"
              disabled={createManualIncident.isPending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="manual-incident-description">Descripción</Label>
            <Textarea
              id="manual-incident-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Describe la incidencia con detalle…"
              className="min-h-[120px]"
              disabled={createManualIncident.isPending}
            />
            <p className="text-xs text-muted-foreground">Mínimo 5 caracteres.</p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={createManualIncident.isPending}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {createManualIncident.isPending ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creando…</>
            ) : (
              'Crear incidencia'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
