import { Link } from 'react-router-dom';
import { hours } from './forecastContract';
import { personName, shortDay, sumKnown, within, type ViewScope } from './forecastPresentation';
import type { ScreenProps } from './ForecastUi';

export function ForecastCapacityBreakdown({ model, to, scope }: Pick<ScreenProps, 'model' | 'to'> & { scope: ViewScope }) {
  const rows = (model.capacityRows ?? []).filter(r => within(r.date, scope));
  const labels = [['windows', 'Franjas antes de descuentos'], ['rest', 'Libranzas registradas o propuestas'], ['absence', 'Ausencias e indisponibilidad'], ['services', 'Otros servicios dentro de las franjas'], ['otherCenters', 'Compromisos en otros centros'], ['unverified', 'Disponibilidad no verificable'], ['weeklyReduction', 'Ajuste al límite semanal'], ['capacity', 'Capacidad de referencia']] as const;
  return <details className="sf-detail-block sf-capacity-breakdown"><summary>Desglose diario de la capacidad del equipo</summary>
    <p className="sf-caption">Franjas disponibles menos bloqueos y ajuste al máximo semanal (130 %). El reparto diario es una referencia según franjas y compromisos registrados; no confirma que una tarea encaje. El refuerzo se muestra por separado. Viajes: no contabilizados.</p>
    {[...new Set(rows.map(r => r.date))].map(date => {
      const dayRows = rows.filter(r => r.date === date);
      return <details key={date}><summary>{shortDay(date)} · {hours(sumKnown(dayRows, r => r.capacity))}</summary><dl className="sf-detail-list">
        {labels.map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{key !== 'windows' && key !== 'capacity' ? '− ' : ''}{hours(sumKnown(dayRows, r => r[key]))}</dd></div>)}
      </dl><p className="sf-caption">Otros servicios computables del día: {hours(sumKnown(dayRows, r => r.paid))}. Incluyen franjas fuera de las ventanas turísticas y consumen límite semanal. No se suman a la demanda turística ni se descuentan dos veces.</p>
      <details><summary>Ver aportación por persona</summary><ul>{dayRows.map(r => <li key={r.workerId}><Link to={to('team', { person: r.workerId, focusMonth: date.slice(0, 7), personTab: 'availability' })}>{personName(model.workers.find(w => w.id === r.workerId)?.name ?? 'Persona por revisar')}</Link>: {hours(r.capacity)} · servicios {hours(r.paid)}{r.unverified > 0 && ' · disponibilidad por verificar'}</li>)}</ul></details>
      </details>;
    })}
  </details>;
}
