import { ExternalLink, Home } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { PlanningBuildingCrmProperty } from '@/types/operationalPlanning';
import { formatCrmHours } from './buildingCrmFormatters';

interface BuildingPropertiesPanelProps {
  properties: PlanningBuildingCrmProperty[];
}

export const BuildingPropertiesPanel = ({ properties }: BuildingPropertiesPanelProps) => {
  return (
    <Card className="border-[#310984]/10 bg-white shadow-sm shadow-[#310984]/5">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-[#171321]">
              <Home className="h-5 w-5 text-[#310984]" />
              Propiedades del edificio
            </CardTitle>
            <p className="mt-1 text-sm text-[#6b627a]">Duración y personas necesarias por propiedad. Sin ropa, llaves ni logística auxiliar.</p>
          </div>
          <Badge variant="outline" className="w-fit border-[#310984]/15 bg-[#faf8ff] text-[#310984]">{properties.length}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        {properties.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#310984]/15 p-6 text-center text-sm text-[#6b627a]">
            Este edificio no tiene propiedades vinculadas en la sede activa.
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
    </Card>
  );
};
