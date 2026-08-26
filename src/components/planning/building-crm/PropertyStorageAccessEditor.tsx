import { CheckCircle2, CircleOff, Package, Save, Settings2, TriangleAlert } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRolePermissions } from '@/hooks/useRolePermissions';
import { usePropertyStorageAccess, useSetPropertyStorageAccess } from '@/hooks/usePropertyStorageAccess';
import { useStockWarehouses } from '@/hooks/useStock';
import type { PlanningBuildingCrmProperty } from '@/types/operationalPlanning';
import { buildStorageAccessSummary, getStorageAccessLabel, type PropertyStorageAccessType } from '@/features/stock/propertyStorageAccess';

interface PropertyStorageAccessEditorProps {
  propertyGroupId: string;
  properties: PlanningBuildingCrmProperty[];
}

type DraftAccess = PropertyStorageAccessType | 'unconfigured';

export const PropertyStorageAccessEditor = ({ propertyGroupId, properties }: PropertyStorageAccessEditorProps) => {
  const { isAdminOrManager } = useRolePermissions();
  const accessQuery = usePropertyStorageAccess(propertyGroupId);
  const { data: warehouses = [], isLoading: warehousesLoading } = useStockWarehouses();
  const saveAccess = useSetPropertyStorageAccess();
  const [drafts, setDrafts] = useState<Record<string, DraftAccess>>({});

  const buildingWarehouses = useMemo(
    () => warehouses.filter((warehouse) => (
      warehouse.property_group_id === propertyGroupId
      && warehouse.location_type === 'building_storage'
      && warehouse.is_active
    )),
    [propertyGroupId, warehouses],
  );
  const defaultWarehouse = buildingWarehouses[0] || null;
  const accessRows = useMemo(() => accessQuery.data || [], [accessQuery.data]);
  const accessByPropertyId = useMemo(() => new Map(accessRows.map((row) => [row.propertyId, row])), [accessRows]);
  const summary = useMemo(() => buildStorageAccessSummary(
    properties.map((property) => ({ id: property.propertyId, code: property.propertyCode, name: property.propertyName })),
    accessRows,
    propertyGroupId,
  ), [accessRows, properties, propertyGroupId]);

  useEffect(() => {
    const nextDrafts: Record<string, DraftAccess> = {};
    for (const property of properties) {
      nextDrafts[property.propertyId] = accessByPropertyId.get(property.propertyId)?.accessType || 'unconfigured';
    }
    setDrafts(nextDrafts);
  }, [accessByPropertyId, properties]);

  const getDraft = (propertyId: string): DraftAccess => drafts[propertyId] || 'unconfigured';
  const isDirty = (propertyId: string): boolean => getDraft(propertyId) !== (accessByPropertyId.get(propertyId)?.accessType || 'unconfigured');

  const saveProperty = async (property: PlanningBuildingCrmProperty) => {
    const accessType = getDraft(property.propertyId);
    if (accessType === 'unconfigured') return;
    await saveAccess.mutateAsync({
      propertyId: property.propertyId,
      propertyGroupId,
      accessType,
      warehouseId: accessType === 'shared' ? defaultWarehouse?.id || null : null,
    });
  };

  const configuredCount = properties.length - summary.unconfiguredPropertyIds.length;
  const sharedCount = properties.length - summary.withoutAccessPropertyIds.length - summary.unconfiguredPropertyIds.length;

  return (
    <Card className="border-[#310984]/10 bg-white shadow-sm shadow-[#310984]/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base text-[#171321]">
          <Settings2 className="h-5 w-5 text-[#310984]" />
          Acceso al trastero por apartamento
        </CardTitle>
        <p className="text-sm text-[#6b627a]">
          El stock se cuenta una sola vez en el trastero físico. Aquí solo indicamos qué apartamentos lo utilizan y cuáles no tienen acceso.
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          <Badge variant="outline" className="border-[#310984]/20 bg-[#faf8ff] text-[#310984]">
            <Package className="mr-1 h-3.5 w-3.5" />{summary.physicalWarehouseIds.length} ubicación física
          </Badge>
          <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-800">
            <CheckCircle2 className="mr-1 h-3.5 w-3.5" />{sharedCount} compartidos
          </Badge>
          <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">
            <CircleOff className="mr-1 h-3.5 w-3.5" />{summary.withoutAccessPropertyIds.length} sin acceso
          </Badge>
          {summary.unconfiguredPropertyIds.length > 0 && (
            <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">
              <TriangleAlert className="mr-1 h-3.5 w-3.5" />{summary.unconfiguredPropertyIds.length} pendientes
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {!defaultWarehouse && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            Este edificio todavía no tiene un trastero de stock vinculado. Configúralo arriba antes de marcar apartamentos como compartidos.
          </div>
        )}
        {properties.length === 0 && <p className="text-sm text-[#6b627a]">Este edificio todavía no tiene apartamentos vinculados.</p>}
        {properties.map((property) => {
          const row = accessByPropertyId.get(property.propertyId);
          const draft = getDraft(property.propertyId);
          const dirty = isDirty(property.propertyId);
          const saving = saveAccess.isPending && saveAccess.variables?.propertyId === property.propertyId;
          return (
            <div key={property.propertyId} className="grid gap-3 rounded-2xl border border-[#310984]/10 bg-[#faf8ff] p-3 md:grid-cols-[minmax(0,1fr)_240px_auto] md:items-center">
              <div className="min-w-0">
                <p className="truncate font-semibold text-[#171321]">{property.propertyCode} · {property.propertyName}</p>
                <p className="mt-1 text-xs text-[#6b627a]">
                  {draft === 'unconfigured' ? 'Pendiente de configurar' : getStorageAccessLabel(draft)}
                  {draft === 'shared' && defaultWarehouse ? ` · ${defaultWarehouse.name}` : ''}
                  {row?.notes ? ` · ${row.notes}` : ''}
                </p>
              </div>
              <Select
                value={draft}
                onValueChange={(value: DraftAccess) => setDrafts((current) => ({ ...current, [property.propertyId]: value }))}
                disabled={!isAdminOrManager() || warehousesLoading}
              >
                <SelectTrigger aria-label={`Acceso al trastero de ${property.propertyCode}`}>
                  <SelectValue placeholder="Selecciona acceso" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unconfigured">Pendiente de configurar</SelectItem>
                  <SelectItem value="shared" disabled={!defaultWarehouse}>Comparte el trastero del edificio</SelectItem>
                  <SelectItem value="none">Sin acceso a trastero</SelectItem>
                </SelectContent>
              </Select>
              <Button
                size="sm"
                variant={dirty ? 'default' : 'outline'}
                onClick={() => void saveProperty(property)}
                disabled={!dirty || draft === 'unconfigured' || saving || !isAdminOrManager() || (draft === 'shared' && !defaultWarehouse)}
              >
                <Save className="mr-2 h-4 w-4" />{saving ? 'Guardando…' : 'Guardar'}
              </Button>
            </div>
          );
        })}
        {configuredCount > 0 && <p className="text-xs text-[#6b627a]">{configuredCount} de {properties.length} apartamentos tienen una decisión guardada.</p>}
      </CardContent>
    </Card>
  );
};
