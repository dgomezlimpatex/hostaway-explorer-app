import { useMemo, useState } from 'react';
import { Check, ExternalLink, Home, Loader2, Plus, Search, Unlink2, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useAssignPropertyToGroup, useRemovePropertyFromGroup } from '@/hooks/usePropertyGroups';
import { toast } from '@/hooks/use-toast';
import type { Property } from '@/types/property';
import type { PropertyGroupAssignment } from '@/types/propertyGroups';
import type { PlanningBuildingCrmProperty } from '@/types/operationalPlanning';
import { cn } from '@/lib/utils';
import { formatCrmHours } from './buildingCrmFormatters';

interface BuildingPropertiesPanelProps {
  propertyGroupId: string;
  properties: PlanningBuildingCrmProperty[];
  allProperties: Property[];
  propertyAssignments: PropertyGroupAssignment[];
  onRefresh: () => Promise<unknown>;
}

export const BuildingPropertiesPanel = ({
  propertyGroupId,
  properties,
  allProperties,
  propertyAssignments,
  onRefresh,
}: BuildingPropertiesPanelProps) => {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProperties, setSelectedProperties] = useState<string[]>([]);
  const [propertyToRemove, setPropertyToRemove] = useState<PlanningBuildingCrmProperty | null>(null);
  const assignProperty = useAssignPropertyToGroup();
  const removeProperty = useRemovePropertyFromGroup();

  const availableProperties = useMemo(() => {
    const assignedPropertyIds = new Set(propertyAssignments.map((assignment) => assignment.propertyId));

    return allProperties
      .filter((property) => property.isActive !== false && property.clientIsActive !== false)
      .filter((property) => !assignedPropertyIds.has(property.id))
      .sort((a, b) => a.codigo.localeCompare(b.codigo, 'es', { numeric: true }));
  }, [allProperties, propertyAssignments]);

  const filteredAvailableProperties = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLocaleLowerCase('es');
    if (!normalizedSearch) return availableProperties;

    return availableProperties.filter((property) => [
      property.codigo,
      property.nombre,
      property.direccion,
    ].some((value) => value.toLocaleLowerCase('es').includes(normalizedSearch)));
  }, [availableProperties, searchTerm]);

  const selectedPropertyDetails = useMemo(
    () => allProperties.filter((property) => selectedProperties.includes(property.id)),
    [allProperties, selectedProperties],
  );

  const visiblePropertyIds = filteredAvailableProperties.map((property) => property.id);
  const allVisibleSelected = visiblePropertyIds.length > 0
    && visiblePropertyIds.every((propertyId) => selectedProperties.includes(propertyId));

  const toggleProperty = (propertyId: string, checked: boolean) => {
    setSelectedProperties((current) => checked
      ? Array.from(new Set([...current, propertyId]))
      : current.filter((id) => id !== propertyId));
  };

  const handleToggleVisibleProperties = () => {
    setSelectedProperties((current) => {
      if (allVisibleSelected) return current.filter((id) => !visiblePropertyIds.includes(id));
      return Array.from(new Set([...current, ...visiblePropertyIds]));
    });
  };

  const handleOpenAddModal = () => {
    setSearchTerm('');
    setSelectedProperties([]);
    setIsAddModalOpen(true);
  };

  const handleCloseAddModal = (open: boolean) => {
    if (assignProperty.isPending) return;
    setIsAddModalOpen(open);
    if (!open) {
      setSearchTerm('');
      setSelectedProperties([]);
    }
  };

  const handleAddProperties = async () => {
    if (selectedProperties.length === 0) return;

    const propertiesToAssign = [...selectedProperties];

    try {
      for (const propertyId of propertiesToAssign) {
        await assignProperty.mutateAsync({
          groupId: propertyGroupId,
          propertyId,
          silent: true,
        });
      }

      await onRefresh().catch((refreshError) => {
        console.error('Properties assigned but building refresh failed:', refreshError);
      });

      toast({
        title: `${propertiesToAssign.length} apartamento${propertiesToAssign.length === 1 ? '' : 's'} guardado${propertiesToAssign.length === 1 ? '' : 's'}`,
        description: 'El edificio se ha actualizado con las propiedades seleccionadas.',
      });
      setSelectedProperties([]);
      setSearchTerm('');
      setIsAddModalOpen(false);
    } catch (error) {
      console.error('Error adding properties to building:', error);
      await onRefresh().catch((refreshError) => {
        console.error('Building refresh failed after assignment error:', refreshError);
      });
      setSelectedProperties([]);
    }
  };

  const handleRemoveProperty = async () => {
    if (!propertyToRemove) return;

    const assignment = propertyAssignments.find((candidate) => (
      candidate.propertyGroupId === propertyGroupId && candidate.propertyId === propertyToRemove.propertyId
    ));

    if (!assignment) {
      toast({
        title: 'No se encontró la asignación',
        description: 'Actualiza la ficha del edificio e inténtalo de nuevo.',
        variant: 'destructive',
      });
      setPropertyToRemove(null);
      return;
    }

    try {
      await removeProperty.mutateAsync({
        assignmentId: assignment.id,
        groupId: propertyGroupId,
        silent: true,
      });
      await onRefresh().catch((refreshError) => {
        console.error('Property removed but building refresh failed:', refreshError);
      });
      toast({
        title: 'Propiedad retirada',
        description: `${propertyToRemove.propertyCode} ya no está vinculada a este edificio.`,
      });
      setPropertyToRemove(null);
    } catch (error) {
      console.error('Error removing property from building:', error);
      toast({
        title: 'No se pudo retirar la propiedad',
        description: error instanceof Error ? error.message : 'Comprueba la conexión e inténtalo de nuevo.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Card className="border-[#310984]/10 bg-white shadow-sm shadow-[#310984]/5">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-[#171321]">
              <Home className="h-5 w-5 text-[#310984]" />
              Propiedades del edificio
            </CardTitle>
            <p className="mt-1 text-sm text-[#6b627a]">Duración y personas necesarias por propiedad. Sin ropa, llaves ni logística auxiliar.</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="w-fit border-[#310984]/15 bg-[#faf8ff] text-[#310984]">{properties.length}</Badge>
            <Button type="button" size="sm" className="bg-[#310984] text-white hover:bg-[#4c1bb0]" onClick={handleOpenAddModal}>
              <Plus className="mr-2 h-4 w-4" />
              Añadir apartamentos
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {properties.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#310984]/15 p-6 text-center text-sm text-[#6b627a]">
            Este edificio no tiene propiedades vinculadas en la sede activa. Usa “Añadir apartamentos” para vincularlas.
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {properties.map((property) => (
              <article key={property.propertyId} className="rounded-2xl border border-[#310984]/10 bg-[#faf8ff] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#310984]">{property.propertyCode}</p>
                    <h3 className="mt-1 break-words font-semibold text-[#171321]">{property.propertyName}</h3>
                    {property.propertyAddress && <p className="mt-1 break-words text-xs text-[#6b627a]">{property.propertyAddress}</p>}
                  </div>
                  {property.hasMissingDuration ? (
                    <Badge variant="outline" className="border-red-200 bg-red-50 text-red-800">Revisar</Badge>
                  ) : (
                    <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-800">OK</Badge>
                  )}
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-xl bg-white p-3">
                    <p className="text-xs text-[#6b627a]">Duración</p>
                    <p className="font-semibold text-[#171321]">{property.hasMissingDuration ? 'Pendiente' : formatCrmHours(property.durationMinutes)}</p>
                  </div>
                  <div className="rounded-xl bg-white p-3">
                    <p className="text-xs text-[#6b627a]">Necesita</p>
                    <p className="font-semibold text-[#171321]">{property.requiredCleaners} persona{property.requiredCleaners === 1 ? '' : 's'}</p>
                  </div>
                </div>
                {property.isLargeProperty && (
                  <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
                    Casa grande: revisar equipo estable y capacidad de pico.
                  </p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button asChild size="sm" variant="outline" className="flex-1 border-[#310984]/15 bg-white text-[#310984] hover:bg-[#f0eaff]">
                    <Link to={`/properties?propertyId=${property.propertyId}`}>
                      Editar propiedad
                      <ExternalLink className="ml-2 h-3.5 w-3.5" />
                    </Link>
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="border-red-200 bg-white text-red-700 hover:bg-red-50 hover:text-red-800"
                    onClick={() => setPropertyToRemove(property)}
                    disabled={removeProperty.isPending}
                    aria-label={`Retirar ${property.propertyCode} del edificio`}
                  >
                    <Unlink2 className="mr-2 h-3.5 w-3.5" />
                    Retirar
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={isAddModalOpen} onOpenChange={handleCloseAddModal}>
        <DialogContent className="flex max-h-[min(92vh,820px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
          <DialogHeader className="border-b border-[#310984]/10 bg-gradient-to-r from-[#faf8ff] to-white px-6 py-5 sm:px-8">
            <div className="flex flex-wrap items-start justify-between gap-3 pr-8">
              <div>
                <DialogTitle className="text-xl text-[#171321]">Añadir apartamentos al edificio</DialogTitle>
                <DialogDescription className="mt-1 max-w-2xl text-sm leading-6 text-[#6b627a]">
                  Busca por código, nombre o dirección y marca los apartamentos que quieres incorporar. Los ya asignados a otro edificio quedan fuera automáticamente.
                </DialogDescription>
              </div>
              <Badge variant="outline" className="border-[#310984]/20 bg-white px-3 py-1 text-[#310984]">
                {availableProperties.length} disponibles
              </Badge>
            </div>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 sm:px-8">
            {availableProperties.length === 0 ? (
              <div className="flex min-h-[320px] flex-col items-center justify-center rounded-2xl border border-dashed border-[#310984]/15 bg-[#faf8ff] p-8 text-center text-sm text-[#6b627a]">
                <Home className="mb-3 h-10 w-10 text-[#310984]/50" />
                <p className="font-semibold text-[#171321]">No hay apartamentos disponibles</p>
                <p className="mt-1 max-w-md">Todas las propiedades activas de la sede ya están vinculadas a un edificio o no hay propiedades en el catálogo.</p>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="flex flex-col gap-3 rounded-2xl border border-[#310984]/10 bg-white p-3 shadow-sm sm:flex-row sm:items-center">
                  <div className="relative min-w-0 flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6b627a]" />
                    <Input
                      type="search"
                      value={searchTerm}
                      onChange={(event) => setSearchTerm(event.target.value)}
                      placeholder="Buscar por código, nombre o dirección…"
                      aria-label="Buscar apartamentos disponibles"
                      className="h-11 border-[#310984]/15 bg-[#faf8ff] pl-9 focus-visible:ring-[#310984]"
                    />
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={handleToggleVisibleProperties} className="h-11 border-[#310984]/15 text-[#310984]">
                      <Check className="mr-2 h-4 w-4" />
                      {allVisibleSelected ? 'Quitar visibles' : 'Seleccionar todos los visibles'}
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedProperties([])} disabled={selectedProperties.length === 0} className="h-11 text-[#6b627a]">
                      Limpiar
                    </Button>
                  </div>
                </div>

                <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
                  <section aria-label="Catálogo de apartamentos disponibles" className="min-w-0">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-[#171321]">Catálogo disponible</p>
                        <p className="text-sm text-[#6b627a]">{filteredAvailableProperties.length} resultado{filteredAvailableProperties.length === 1 ? '' : 's'} visibles</p>
                      </div>
                      <Badge variant="outline" className="border-[#310984]/15 bg-[#faf8ff] text-[#310984]">
                        {selectedProperties.length} seleccionados
                      </Badge>
                    </div>

                    {filteredAvailableProperties.length === 0 ? (
                      <div className="flex min-h-[260px] items-center justify-center rounded-2xl border border-dashed border-[#310984]/15 bg-[#faf8ff] p-8 text-center text-sm text-[#6b627a]">
                        No encontramos apartamentos con “{searchTerm}”. Prueba otro código o dirección.
                      </div>
                    ) : (
                      <div className="grid max-h-[min(54vh,560px)] gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
                        {filteredAvailableProperties.map((property) => {
                          const checkboxId = `building-property-${property.id}`;
                          const isSelected = selectedProperties.includes(property.id);

                          return (
                            <div
                              key={property.id}
                              className={cn(
                                'flex min-h-[112px] items-start gap-3 rounded-2xl border p-4 transition-colors',
                                isSelected
                                  ? 'border-[#310984] bg-[#f0eaff] shadow-sm'
                                  : 'border-[#310984]/10 bg-white hover:border-[#310984]/35 hover:bg-[#faf8ff]',
                              )}
                            >
                              <Checkbox
                                id={checkboxId}
                                checked={isSelected}
                                onCheckedChange={(checked) => toggleProperty(property.id, checked === true)}
                                aria-label={`Seleccionar ${property.codigo} ${property.nombre}`}
                                className="mt-0.5 h-5 w-5"
                              />
                              <label htmlFor={checkboxId} className="min-w-0 flex-1 cursor-pointer">
                                <span className="block font-semibold leading-5 text-[#171321]">{property.codigo} · {property.nombre}</span>
                                <span className="mt-2 block break-words text-sm leading-5 text-[#6b627a]">{property.direccion || 'Dirección no disponible'}</span>
                              </label>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </section>

                  <aside className="rounded-2xl border border-[#310984]/10 bg-[#faf8ff] p-4 lg:sticky lg:top-0 lg:self-start" aria-live="polite">
                    <div className="flex items-center gap-2 text-[#310984]">
                      <Users className="h-4 w-4" />
                      <p className="font-semibold text-[#171321]">Resumen de selección</p>
                    </div>
                    <p className="mt-2 text-sm leading-5 text-[#6b627a]">
                      {selectedProperties.length === 0
                        ? 'Selecciona uno o varios apartamentos para incorporarlos al edificio.'
                        : `${selectedProperties.length} apartamento${selectedProperties.length === 1 ? '' : 's'} preparado${selectedProperties.length === 1 ? '' : 's'} para guardar.`}
                    </p>
                    {selectedPropertyDetails.length > 0 && (
                      <div className="mt-4 max-h-52 space-y-2 overflow-y-auto pr-1">
                        {selectedPropertyDetails.map((property) => (
                          <div key={property.id} className="rounded-xl border border-[#310984]/10 bg-white px-3 py-2">
                            <p className="truncate text-sm font-medium text-[#171321]">{property.codigo}</p>
                            <p className="truncate text-xs text-[#6b627a]">{property.nombre}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </aside>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3 border-t border-[#310984]/10 bg-white px-6 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8">
            <p className="text-sm text-[#6b627a]" aria-live="polite">
              {selectedProperties.length === 0 ? 'No hay apartamentos seleccionados' : `${selectedProperties.length} seleccionados para guardar`}
            </p>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => handleCloseAddModal(false)} disabled={assignProperty.isPending}>
                Cancelar
              </Button>
              <Button
                type="button"
                className="min-w-[190px] bg-[#310984] text-white hover:bg-[#4c1bb0]"
                onClick={() => void handleAddProperties()}
                disabled={selectedProperties.length === 0 || assignProperty.isPending || availableProperties.length === 0}
              >
                {assignProperty.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {assignProperty.isPending ? 'Guardando…' : `Guardar ${selectedProperties.length} apartamento${selectedProperties.length === 1 ? '' : 's'}`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(propertyToRemove)}
        onOpenChange={(open) => {
          if (!open && !removeProperty.isPending) setPropertyToRemove(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Retirar esta propiedad del edificio?</AlertDialogTitle>
            <AlertDialogDescription>
              {propertyToRemove
                ? `${propertyToRemove.propertyCode} · ${propertyToRemove.propertyName} dejará de estar vinculada a este edificio. No se borrará la propiedad ni sus datos maestros.`
                : 'La propiedad dejará de estar vinculada a este edificio.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removeProperty.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={removeProperty.isPending}
              onClick={(event) => {
                event.preventDefault();
                void handleRemoveProperty();
              }}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {removeProperty.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {removeProperty.isPending ? 'Retirando…' : 'Retirar del edificio'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};
