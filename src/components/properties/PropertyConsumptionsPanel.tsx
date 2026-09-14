import { Button } from '@/components/ui/button';
import { usePropertyStockConsumptionRules, useStockProducts } from '@/hooks/useStock';
import type { Property } from '@/types/property';
import { buildInitialStockConsumptions, getLegacyFieldForStockProduct, normalizeStockName } from './forms/propertyStockConsumption';

const legacyGroups: { title: string; fields: [NonNullable<ReturnType<typeof getLegacyFieldForStockProduct>>, string][] }[] = [
  { title: 'Lencería y lavandería', fields: [['numeroSabanas', 'Sábanas grandes'], ['numeroSabanasRequenas', 'Sábanas pequeñas'], ['numeroSabanasSuite', 'Sábanas suite'], ['numeroToallasGrandes', 'Toallas grandes'], ['numeroTotallasPequenas', 'Toallas pequeñas'], ['numeroAlfombrines', 'Alfombrines'], ['numeroFundasAlmohada', 'Fundas de almohada']] },
  { title: 'Amenities', fields: [['kitAlimentario', 'Kit alimentario'], ['amenitiesBano', 'Amenities de baño'], ['amenitiesCocina', 'Amenities de cocina']] },
  { title: 'Consumibles', fields: [['cantidadRollosPapelHigienico', 'Rollos de papel higiénico'], ['cantidadRollosPapelCocina', 'Rollos de papel de cocina'], ['bayetasCocina', 'Bayetas de cocina'], ['bolsasBasura', 'Bolsas de basura']] },
  { title: 'Otros materiales', fields: [] },
];

export function PropertyConsumptionsPanel({ property, onEdit }: { property: Property; onEdit: () => void }) {
  const productsQuery = useStockProducts();
  const rulesQuery = usePropertyStockConsumptionRules(property.id);
  if (productsQuery.isError || rulesQuery.isError) return <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">No se han podido cargar los consumos de esta propiedad.<Button variant="ghost" size="sm" onClick={() => { void productsQuery.refetch(); void rulesQuery.refetch(); }}>Reintentar</Button></div>;
  if (productsQuery.isLoading || rulesQuery.isLoading) return <p role="status" className="p-4 text-sm text-slate-500">Cargando consumos…</p>;

  const products = (productsQuery.data || []).filter(product => product.is_consumable);
  const quantities = buildInitialStockConsumptions(products, rulesQuery.data || [], property);
  const mappedFields = new Set(products.map(getLegacyFieldForStockProduct));
  const groups = legacyGroups.map(group => ({ title: group.title, rows: group.fields.filter(([field]) => !mappedFields.has(field)).map(([field, name]) => ({ id: field as string, name: name as string, quantity: Number(property[field]) || 0, unit: 'ud.' })) }));
  for (const product of products) {
    const group = product.category?.kind === 'laundry' ? 0 : normalizeStockName(product.category?.name || '').includes('consumible') ? 2 : product.category?.kind === 'amenity' ? 1 : 3;
    groups[group].rows.push({ id: product.id, name: product.name, quantity: quantities[product.id] ?? 0, unit: product.unit_of_measure || 'ud.' });
  }

  return <>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h3 className="text-sm font-bold text-slate-900">Consumos por limpieza</h3><p className="mt-1 text-xs text-slate-500">Cantidades configuradas para este apartamento.</p></div>
      <Button variant="outline" size="sm" onClick={onEdit}>Editar consumos</Button>
    </div>
    {groups.filter(group => group.rows.length > 0).map(group => <section key={group.title} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <h4 className="border-b border-slate-100 px-4 py-3 text-sm font-bold text-slate-900">{group.title}</h4>
      <dl className="divide-y divide-slate-100">{group.rows.map(row => <div key={row.id} className="flex items-center justify-between gap-4 px-4 py-2.5 text-sm">
        <dt className="min-w-0 break-words text-slate-600">{row.name}</dt><dd className="shrink-0 font-semibold tabular-nums text-slate-900">{row.quantity.toLocaleString('es-ES')} <span className="text-xs font-normal text-slate-500">{row.unit}</span></dd>
      </div>)}</dl>
    </section>)}
  </>;
}
