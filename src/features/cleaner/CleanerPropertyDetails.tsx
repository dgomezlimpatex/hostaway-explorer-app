import type { Database } from '@/integrations/supabase/types';

export type CleanerPropertyDetailsData = Partial<Pick<Database['public']['Tables']['properties']['Row'],
  'notas' | 'numero_camas' | 'numero_camas_pequenas' | 'numero_camas_suite' | 'numero_sofas_cama' |
  'numero_banos' | 'duracion_servicio' | 'numero_sabanas' | 'numero_sabanas_pequenas' |
  'numero_sabanas_suite' | 'numero_toallas_grandes' | 'numero_toallas_pequenas' |
  'numero_alfombrines' | 'numero_fundas_almohada' | 'kit_alimentario' |
  'cantidad_rollos_papel_higienico' | 'cantidad_rollos_papel_cocina'
>>;

const characteristics = [
  ['numero_camas', 'Camas grandes'], ['numero_camas_pequenas', 'Camas pequeñas'],
  ['numero_camas_suite', 'Camas suite'], ['numero_sofas_cama', 'Sofás cama'], ['numero_banos', 'Baños'],
] as const;
const supplies = [
  ['numero_sabanas', 'Sábanas grandes'], ['numero_sabanas_pequenas', 'Sábanas pequeñas'],
  ['numero_sabanas_suite', 'Sábanas suite'], ['numero_toallas_grandes', 'Toallas grandes'],
  ['numero_toallas_pequenas', 'Toallas pequeñas'], ['numero_alfombrines', 'Alfombrines'],
  ['numero_fundas_almohada', 'Fundas de almohada'], ['kit_alimentario', 'Kit alimentario'],
  ['cantidad_rollos_papel_higienico', 'Papel higiénico'], ['cantidad_rollos_papel_cocina', 'Papel de cocina'],
] as const;

export function CleanerPropertyDetails({ property, taskNotes, compact = false }: {
  property?: CleanerPropertyDetailsData | null; taskNotes?: string; compact?: boolean;
}) {
  const details = property && <div className="space-y-4">
    <section aria-label="Notas del piso" className="rounded-xl border border-amber-200 bg-amber-50 p-3">
      <h3 className="mb-1 text-sm font-semibold">Notas del piso</h3>
      <p className="whitespace-pre-wrap break-words text-sm">{property.notas?.trim() || 'No hay notas específicas guardadas para este piso.'}</p>
    </section>
    <section aria-label="Características del piso">
      <h3 className="mb-2 text-sm font-semibold">Características del piso</h3>
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {characteristics.map(([field, label]) => <div key={field} className="rounded-lg bg-muted p-2.5">
          <dt className="text-xs text-muted-foreground">{label}</dt>
          <dd className="mt-1 font-semibold">{property[field] === undefined ? '—' : property[field] ?? 0}</dd>
        </div>)}
        <div className="rounded-lg bg-muted p-2.5"><dt className="text-xs text-muted-foreground">Duración del servicio</dt>
          <dd className="mt-1 font-semibold">{property.duracion_servicio == null ? '—' : `${property.duracion_servicio} min`}</dd></div>
      </dl>
    </section>
    <section aria-label="Textiles y amenities">
      <h3 className="mb-2 text-sm font-semibold">Textiles y amenities</h3>
      <dl className="grid grid-cols-1 gap-1 sm:grid-cols-2">
        {supplies.map(([field, label]) => <div key={field} className="flex items-center justify-between gap-3 rounded-lg bg-muted px-3 py-2">
          <dt className="text-sm">{label}</dt><dd className="font-semibold tabular-nums">{property[field] === undefined ? '—' : property[field] ?? 0}</dd>
        </div>)}
      </dl>
    </section>
  </div>;
  const notes = taskNotes?.trim() && <section aria-label="Notas de la tarea" className="mt-3 rounded-xl bg-muted p-3">
    <h3 className="mb-1 text-sm font-semibold">Notas de la tarea</h3><p className="whitespace-pre-wrap break-words text-sm">{taskNotes}</p>
  </section>;
  if (!property && !notes) return null;
  return compact ? <details className="mb-4 rounded-xl border p-3">
    <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold">Datos e indicaciones del piso</summary>
    {details}{notes}
  </details> : <div className="mb-4">{details}{notes}</div>;
}
