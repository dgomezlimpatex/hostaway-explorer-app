import { Package, Save } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useStockWarehouses, useUpdateStockWarehouse } from '@/hooks/useStock';

interface Props { propertyGroupId: string }

export const SupervisionStockLocationEditor = ({ propertyGroupId }: Props) => {
  const { data: warehouses = [], isLoading } = useStockWarehouses();
  const update = useUpdateStockWarehouse();
  const current = useMemo(() => warehouses.find((warehouse) => warehouse.property_group_id === propertyGroupId && warehouse.location_type === 'building_storage'), [warehouses, propertyGroupId]);
  const [selectedId, setSelectedId] = useState('');
  const selectableWarehouses = warehouses.filter((warehouse) => !warehouse.is_default && (!warehouse.property_group_id || warehouse.property_group_id === propertyGroupId));
  const selectedWarehouseId = selectedId || current?.id || '';
  const save = async () => {
    if (!selectedWarehouseId) return;
    await update.mutateAsync({ id: selectedWarehouseId, updates: { property_group_id: propertyGroupId, location_type: 'building_storage' } });
  };
  return <Card className="border-[#310984]/10 bg-white shadow-sm shadow-[#310984]/5"><CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base text-[#171321]"><Package className="h-5 w-5 text-[#310984]" />Trastero de stock del edificio</CardTitle><p className="text-sm text-[#6b627a]">Vincula una ubicación existente para que la supervisora pueda hacer inventario y detectar reposiciones.</p></CardHeader><CardContent className="space-y-3"><div className="flex flex-col gap-2 sm:flex-row"><Select value={selectedWarehouseId} onValueChange={setSelectedId}><SelectTrigger className="flex-1"><SelectValue placeholder={isLoading ? 'Cargando almacenes…' : 'Selecciona un almacén/trastero'} /></SelectTrigger><SelectContent>{selectableWarehouses.map((warehouse) => <SelectItem key={warehouse.id} value={warehouse.id}>{warehouse.name}{warehouse.is_default ? ' · Principal' : ''}</SelectItem>)}</SelectContent></Select><Button onClick={() => void save()} disabled={!selectedWarehouseId || update.isPending}><Save className="mr-2 h-4 w-4" />Guardar ubicación</Button></div>{current ? <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-800">Ubicación actual: {current.name}</Badge> : <p className="text-xs text-amber-700">Sin trastero vinculado. La supervisora no podrá hacer el inventario del edificio hasta configurarlo.</p>}</CardContent></Card>;
};
