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

export function CleanerPropertyDetails({ property, taskNotes }: {
  property?: CleanerPropertyDetailsData | null; taskNotes?: string;
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
  </div>;
  const notes = taskNotes?.trim() && <section aria-label="Notas de la tarea" className="mt-3 rounded-xl bg-muted p-3">
    <h3 className="mb-1 text-sm font-semibold">Notas de la tarea</h3><p className="whitespace-pre-wrap break-words text-sm">{taskNotes}</p>
  </section>;
  if (!property && !notes) return null;
  return <div className="mb-4">{details}{notes}</div>;
}
