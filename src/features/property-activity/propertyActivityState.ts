import { groupByDay, type ActivityEvent, type ActivitySourceId, type ActivityWindow } from './propertyActivityModel';
import type { ActivitySourceResult } from './propertyActivitySources';

export interface ActivityResultInput {
  window: ActivityWindow;
  source: ActivitySourceId;
  status: 'pending' | 'success' | 'error';
  data?: ActivitySourceResult;
  error?: unknown;
}

export interface ActivityGap { source: ActivitySourceId; from: string; to: string }

/**
 * Une los tramos cargados sin huecos: un tramo solo se muestra cuando todas sus fuentes han
 * terminado (bien o con error) y todos los tramos más recientes también. Así los eventos no
 * cambian de sitio al llegar otra fuente y un fallo parcial queda señalado, no oculto.
 */
export function combineActivity({ windows, sources, restricted, results }: {
  windows: ActivityWindow[];
  sources: ActivitySourceId[];
  restricted: ActivitySourceId[];
  results: ActivityResultInput[];
}) {
  const events: ActivityEvent[] = [];
  const failures: ActivityGap[] = [];
  const truncated: ActivityGap[] = [];
  let settledWindows = 0;
  let loadingWindow: ActivityWindow | null = null;
  let pendingSources: ActivitySourceId[] = [];
  for (const window of windows) {
    const own = results.filter(result => result.window.index === window.index);
    const pending = own.filter(result => result.status === 'pending');
    if (pending.length) { loadingWindow = window; pendingSources = pending.map(result => result.source); break; }
    for (const result of own) {
      if (result.status === 'error') failures.push({ source: result.source, from: window.from, to: window.to });
      else if (result.data) {
        events.push(...result.data.events);
        if (result.data.truncated) truncated.push({ source: result.source, from: window.from, to: window.to });
      }
    }
    settledWindows += 1;
  }
  const seen = new Set<string>();
  const unique = events.filter(event => (seen.has(event.id) ? false : (seen.add(event.id), true)));
  const consulted = sources.filter(source => !restricted.includes(source));
  return {
    groups: groupByDay(unique),
    eventCount: unique.length,
    settledWindows,
    shownFrom: settledWindows ? windows[settledWindows - 1].from : null,
    loadingWindow,
    pendingSources,
    failures,
    truncated,
    restricted,
    /** Ninguna fuente consultable: no se puede afirmar que no haya actividad. */
    nothingConsultable: consulted.length === 0,
    /** Sin eventos en lo cargado y todas las fuentes consultadas respondieron. */
    confirmedEmpty: settledWindows > 0 && unique.length === 0 && failures.length === 0 && consulted.length > 0,
  };
}
