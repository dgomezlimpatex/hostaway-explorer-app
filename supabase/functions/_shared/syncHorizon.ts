/**
 * Horizonte (días hacia el futuro) que una sincronización usa para leer
 * reservas y para decidir si crea tareas.
 *
 * Cualquier valor que no sea un entero positivo cae al valor por defecto
 * histórico: un valor mal escrito nunca amplía ni recorta el comportamiento
 * por accidente.
 */
export function resolveDaysAhead(
  raw: string | number | undefined | null,
  fallback: number,
): number {
  if (typeof raw === 'number') {
    return Number.isInteger(raw) && raw > 0 ? raw : fallback;
  }
  const parsed = Number.parseInt(String(raw ?? '').trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * Lee un secret/variable de entorno sin romper en Node (los tests de este
 * repo empaquetan las funciones de `supabase/functions` con esbuild).
 */
export function envValue(name: string): string | undefined {
  if (typeof Deno === 'undefined') return undefined;
  return Deno.env.get(name) ?? undefined;
}
