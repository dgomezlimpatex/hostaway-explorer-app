import { useMemo, useState } from 'react';
import { ExternalLink, Home, Loader2, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAssignPropertyToGroup } from '@/hooks/usePropertyGroups';
import type { Property } from '@/types/property';
import type { PropertyGroupAssignment } from '@/types/propertyGroups';
import type { PlanningBuildingCrmProperty } from '@/types/operationalPlanning';
import { formatCrmHours } from './buildingCrmFormatters';

interface BuildingPropertiesPanelProps {
  propertyGroupId: string;
  properties: PlanningBuildingCrmProperty[];
  allProperties: Property[];
  propertyAssignments: PropertyGroupAssignment[];
}

export const BuildingPropertiesPanel = ({
  propertyGroupId,
  properties,
  allProperties,
  propertyAssignments,
}: BuildingPropertiesPanelProps) => {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedProperties, setSelectedProperties] = useState<string[]>([]);
  const assignProperty = useAssignPropertyToGroup();

  const availableProperties = useMemo(() => {
    const assignedPropertyIds = new Set(propertyAssignments.map((assignment) => assignment.propertyId));

    return allProperties
      .filter((property) => property.isActive !== false && property.clientIsActive !== false)
      .filter((property) => !assignedPropertyIds.has(property.id))
      .sort((a, b) => a.codigo.localeCompare(b.codigo, 'es', { numeric: true }));
  }, [allProperties, propertyAssignments]);

  const handleOpenAddModal = () => {
    setSelectedProperties([]);
    setIsAddModalOpen(true);
  };

  const handleCloseAddModal = (open: boolean) => {
    if (assignProperty.isPending) return;
    setIsAddModalOpen(open);
    if (!open) setSelectedProperties([]);
  };

  const handleAddProperties = async () => {
    if (selectedProperties.length === 0) return;

    try {
      for (const propertyId of selectedProperties) {
        await assignProperty.mutateAsync({ groupId: propertyGroupId, propertyId });
      }
      setSelectedProperties([]);
      setIsAddModalOpen(false);
    } catch (error) {
      console.error('Error adding properties to building:', error);
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
                <Button asChild size="sm" variant="outline" className="mt-3 border-[#310984]/15 bg-white text-[#310984] hover:bg-[#f0eaff]">
                  <Link to={`/properties?propertyId=${property.propertyId}`}>
                    Editar propiedad
                    <ExternalLink className="ml-2 h-3.5 w-3.5" />
                  </Link>
                </Button>
              </article>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={isAddModalOpen} onOpenChange={handleCloseAddModal}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Añadir apartamentos al edificio</DialogTitle>
            <DialogDescription>
              Selecciona uno o varios apartamentos. Los que ya pertenecen a otro edificio no aparecen en esta lista.
            </DialogDescription>
          </DialogHeader>

          {availableProperties.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#310984]/15 p-6 text-center text-sm text-[#6b627a]">
              No hay apartamentos disponibles para asignar en la sede activa.
            </div>
          ) : (
            <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
              {availableProperties.map((property) => {
                const checkboxId = `building-property-${property.id}`;
                return (
                  <label key={property.id} htmlFor={checkboxId} className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#310984]/10 bg-[#faf8ff] p-3 hover:border-[#310984]/30">
                    <Checkbox
                      id={checkboxId}
                      checked={selectedProperties.includes(property.id)}
                      onCheckedChange={(checked) => {
                        setSelectedProperties((current) => checked
                          ? Array.from(new Set([...current, property.id]))
                          : current.filter((id) => id !== property.id));
                      }}
                    />
                    <span className="min-w-0">
                      <span className="block font-medium text-[#171321]">{property.codigo} · {property.nombre}</span>
                      <span className="mt-1 block break-words text-xs text-[#6b627a]">{property.direccion}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          )}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => handleCloseAddModal(false)} disabled={assignProperty.isPending}>
              Cancelar
            </Button>
            <Button type="button" className="bg-[#310984] text-white hover:bg-[#4c1bb0]" onClick={() => void handleAddProperties()} disabled={selectedProperties.length === 0 || assignProperty.isPending || availableProperties.length === 0}>
              {assignProperty.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Añadir {selectedProperties.length} apartamento{selectedProperties.length === 1 ? '' : 's'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
