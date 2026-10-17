import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  Clock3,
  Hotel,
  Info,
  Loader2,
  PauseCircle,
  RefreshCw,
  XCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  PMS_STATUS_LABEL,
  describeAttemptResult,
  formatAge,
  formatMadridStamp,
  type AttemptView,
  type LinkIssue,
  type PmsHealth,
  type PmsHealthStatus,
  type PmsHealthTone,
  type PmsId,
} from './pmsHealthDomain';
import { usePmsHealth } from './usePmsHealth';

const TONE_BADGE: Record<PmsHealthTone, string> = {
  ok: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  warning: 'border-amber-200 bg-amber-50 text-amber-900',
  danger: 'border-red-200 bg-red-50 text-red-800',
  info: 'border-primary/30 bg-primary/10 text-primary',
  neutral: 'border-slate-200 bg-slate-100 text-slate-700',
};

const TONE_BORDER: Record<PmsHealthTone, string> = {
  ok: 'border-emerald-200/80',
  warning: 'border-amber-300/80',
  danger: 'border-red-300/80',
  info: 'border-primary/30',
  neutral: 'border-border',
};

const STATUS_ICON: Record<PmsHealthStatus, typeof CheckCircle2> = {
  up_to_date: CheckCircle2,
  warnings: AlertTriangle,
  stale: Clock3,
  error: XCircle,
  running: Loader2,
  insufficient: CircleHelp,
  disabled: PauseCircle,
};

interface PmsMeta {
  name: string;
  subtitle: string;
  route: string;
  historyHint: string;
  linksHint: string;
  readLabel: string;
}

const PMS_META: Record<PmsId, PmsMeta> = {
  smoobu: {
    name: 'Smoobu',
    subtitle: 'Coto Rivas S.L · Houmi Orzán',
    route: '/smoobu',
    historyHint: 'pestaña Historial',
    linksHint: 'pestaña Mapeo',
    readLabel: 'Reservas leídas',
  },
  little_hotelier: {
    name: 'Little Hotelier',
    subtitle: 'Integración local con Little Hotelier',
    route: '/little-hotelier',
    historyHint: 'pestaña Historial',
    linksHint: 'pestaña Habitaciones',
    readLabel: 'Reservas recibidas',
  },
};

const KIND_LABEL: Record<AttemptView['kind'], string> = {
  scheduled: 'automática',
  manual: 'manual',
  off_schedule: 'fuera de horario (posible manual)',
  unknown: '',
};

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium break-words">{children}</dd>
    </div>
  );
}

function attemptText(view: AttemptView | null, empty: string) {
  if (!view) return <span className="font-normal text-muted-foreground">{empty}</span>;
  const kind = KIND_LABEL[view.kind];
  return (
    <>
      {formatMadridStamp(view.at)}
      <span className="font-normal text-muted-foreground">
        {' '}
        · {formatAge(view.ageMinutes)}
        {kind ? ` · ${kind}` : ''}
      </span>
    </>
  );
}

function IssueList({ issues, tone }: { issues: LinkIssue[]; tone: 'warning' | 'neutral' }) {
  const style = tone === 'warning' ? 'border-amber-200 bg-amber-50/60' : 'border-slate-200 bg-slate-50';
  return (
    <ul className={`space-y-1 rounded-lg border p-3 text-sm ${style}`}>
      {issues.slice(0, 6).map((issue) => (
        <li key={`${issue.kind}-${issue.label}`} className="flex justify-between gap-3">
          <span className="min-w-0 break-words">{issue.label}</span>
          <span className="shrink-0 font-medium">{issue.count}</span>
        </li>
      ))}
      {issues.length > 6 && <li className="text-xs text-muted-foreground">y {issues.length - 6} más</li>}
    </ul>
  );
}

function IntegrationCard({ health }: { health: PmsHealth }) {
  const meta = PMS_META[health.integration];
  const [showError, setShowError] = useState(false);
  const Icon = STATUS_ICON[health.status];
  const pending = health.pendingLinks;
  const canShowError = health.lastErrorAt !== null;
  const unavailable = 'Sin información disponible';
  const receivedDataOnly = health.scheduleBasis === 'received_data';
  const sedeScope = pending?.sede.state === 'ok' ? pending.sede : null;
  const hasLinkDetail =
    (pending?.unattributed.length ?? 0) > 0 || (sedeScope && (sedeScope.blocking.length > 0 || sedeScope.review.length > 0));
  // El titular ya cuenta estos hallazgos: no se repiten debajo.
  const visibleFindings = health.findings.filter(
    (finding) =>
      !(
        (health.status === 'error' && finding.code === 'last_attempt_failed') ||
        (health.status === 'stale' && finding.code === 'not_run') ||
        (health.status === 'warnings' && (finding.code === 'partial_failure' || finding.code === 'no_data_read'))
      ),
  );

  return (
    <Card
      className={`overflow-hidden rounded-2xl shadow-sm ${TONE_BORDER[health.tone]}`}
      data-testid={`pms-card-${health.integration}`}
      data-status={health.status}
    >
      <CardHeader className="space-y-3 border-b bg-primary/5 pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Hotel className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-lg">{meta.name}</CardTitle>
              <p className="truncate text-xs text-muted-foreground">{meta.subtitle}</p>
            </div>
          </div>
          <Badge
            variant="outline"
            className={`shrink-0 gap-1.5 whitespace-nowrap ${TONE_BADGE[health.tone]}`}
            data-testid={`pms-status-${health.integration}`}
          >
            <Icon className={`h-3.5 w-3.5 ${health.status === 'running' ? 'animate-spin' : ''}`} />
            {PMS_STATUS_LABEL[health.status]}
          </Badge>
        </div>
        <p className="text-sm leading-relaxed" data-testid={`pms-headline-${health.integration}`}>
          {health.headline}
        </p>
      </CardHeader>

      <CardContent className="space-y-4 p-4 sm:p-5">
        {!health.diagnosticReadFailed && (
          <dl className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
            {receivedDataOnly ? (
              <>
                <Fact label="Programación esperada">
                  {health.scheduleTimes ? (
                    <>
                      {health.scheduleTimes.join(', ')} (Madrid)
                      <span className="font-normal text-muted-foreground"> · declarada; la app no puede comprobarla</span>
                    </>
                  ) : (
                    <span className="font-normal text-muted-foreground">Sin frecuencia registrada</span>
                  )}
                </Fact>
                <Fact label="Ejecución">
                  <span className="font-normal text-muted-foreground">Sin información de ejecución</span>
                </Fact>
                <Fact label="Última recepción de datos">{attemptText(health.lastAttempt, 'Ninguna registrada')}</Fact>
                <Fact label="Última importación confirmada">
                  {attemptText(health.lastSuccess, 'Ninguna registrada')}
                </Fact>
                <Fact label="Resultado de la última recepción">
                  {health.lastAttempt ? describeAttemptResult(health.lastAttempt) : unavailable}
                </Fact>
              </>
            ) : (
              <>
                <Fact label="Último intento registrado">{attemptText(health.lastAttempt, 'Ninguno registrado')}</Fact>
                <Fact label="Última importación correcta">
                  {attemptText(health.lastSuccess, 'Ninguna registrada')}
                </Fact>
                <Fact label="Resultado del último intento">
                  {health.lastAttempt ? describeAttemptResult(health.lastAttempt) : unavailable}
                </Fact>
                <Fact label="Pasadas esperadas">
                  {health.scheduleTimes ? (
                    `${health.scheduleTimes.join(', ')} (Madrid)`
                  ) : (
                    <span className="font-normal text-muted-foreground">Sin frecuencia registrada</span>
                  )}
                </Fact>
              </>
            )}
            <Fact label={meta.readLabel}>
              {health.lastAttempt && health.lastAttempt.outcome !== 'failed' ? health.lastAttempt.read : '—'}
            </Fact>
            <Fact label="Sin vincular ni sede atribuible">
              {pending ? (
                pending.unattributedTotal
              ) : (
                <span className="font-normal text-muted-foreground">{unavailable}</span>
              )}
            </Fact>
          </dl>
        )}

        {pending && pending.unattributed.length > 0 && (
          <section data-testid={`pms-links-global-${health.integration}`}>
            <h3 className="mb-1 text-xs font-medium text-muted-foreground">Sin propiedad vinculada ni sede atribuible</h3>
            <IssueList issues={pending.unattributed} tone="warning" />
          </section>
        )}

        {sedeScope && (sedeScope.blocking.length > 0 || sedeScope.review.length > 0) && (
          <section className="space-y-3" data-testid={`pms-links-sede-${health.integration}`}>
            <h3 className="text-xs font-medium text-muted-foreground">
              Asociado a la sede {sedeScope.sedeName ?? 'activa'} por su mapeo
            </h3>
            {sedeScope.blocking.length > 0 && <IssueList issues={sedeScope.blocking} tone="warning" />}
            {sedeScope.review.length > 0 && (
              <div>
                <p className="mb-1 text-xs font-medium">Configuración por revisar</p>
                <IssueList issues={sedeScope.review} tone="neutral" />
              </div>
            )}
          </section>
        )}

        {visibleFindings.length > 0 && (
          <ul className="space-y-1.5" data-testid={`pms-findings-${health.integration}`}>
            {visibleFindings.map((finding) => {
              const FindingIcon = finding.severity === 'info' ? Info : AlertTriangle;
              const color =
                finding.severity === 'danger'
                  ? 'text-red-600'
                  : finding.severity === 'warning'
                    ? 'text-amber-600'
                    : 'text-muted-foreground';
              return (
                <li key={finding.code} className="flex items-start gap-2 text-sm">
                  <FindingIcon className={`mt-0.5 h-4 w-4 shrink-0 ${color}`} />
                  <span>{finding.text}</span>
                </li>
              );
            })}
          </ul>
        )}

        {showError && canShowError && (
          <div
            className="rounded-lg border bg-muted/40 p-3 text-sm"
            data-testid={`pms-error-detail-${health.integration}`}
          >
            <p className="font-medium">Último error registrado · {formatMadridStamp(health.lastErrorAt)}</p>
            {health.lastErrorSummaries.length > 0 ? (
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {health.lastErrorSummaries.map((summary) => (
                  <li key={summary} className="break-words">
                    {summary}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-muted-foreground">El intento falló pero no guardó un mensaje de error.</p>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              Resumen depurado: sin datos de huéspedes, claves ni enlaces.
            </p>
          </div>
        )}

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button asChild variant="outline" size="sm" className="justify-center">
            <Link to={meta.route}>Abrir historial ({meta.historyHint})</Link>
          </Button>
          {hasLinkDetail && (
            <Button asChild variant="outline" size="sm" className="justify-center">
              <Link to={meta.route}>Resolver sin vincular ({meta.linksHint})</Link>
            </Button>
          )}
          {canShowError && (
            <Button
              variant="outline"
              size="sm"
              className="justify-center gap-1"
              onClick={() => setShowError((open) => !open)}
              aria-expanded={showError}
            >
              {showError ? 'Ocultar último error' : 'Ver último error'}
              <ChevronDown className={`h-4 w-4 transition-transform ${showError ? 'rotate-180' : ''}`} />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function CardSkeleton({ label }: { label: string }) {
  return (
    <Card className="rounded-2xl" aria-label={`Cargando ${label}`}>
      <CardContent className="space-y-3 p-5">
        {[0, 1, 2].map((item) => (
          <div key={item} className="h-14 animate-pulse rounded-xl bg-muted/70" />
        ))}
      </CardContent>
    </Card>
  );
}

const LEGEND: Array<[string, string]> = [
  ['Al día', 'El último intento importó datos sin fallos y la pasada esperada consta.'],
  ['Con advertencias', 'Importa, pero hay errores parciales, ninguna lectura o reservas sin vincular.'],
  ['Datos desactualizados', 'Falta una pasada que debería haberse ejecutado ya, según su horario.'],
  ['Error', 'El último intento falló, o una ejecución parece atascada.'],
  ['En ejecución', 'Hay una ejecución en marcha ahora mismo.'],
  ['Sin información suficiente', 'No hay historial legible o no hay una frecuencia con la que valorarlo.'],
  ['Desactivada', 'Solo cuando la configuración lo confirma.'],
];

export function PmsHealthPanel() {
  const view = usePmsHealth();

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground" data-testid="pms-refresh-note">
          Actualizar solo vuelve a leer lo que ya está guardado. No inicia ninguna sincronización ni modifica reservas.
          {view.readAt ? ` Leído a las ${formatMadridStamp(view.readAt).slice(-5)}.` : ''}
        </p>
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-2 sm:w-fit"
          onClick={() => void view.refresh()}
          disabled={view.isFetching}
          data-testid="pms-refresh"
        >
          <RefreshCw className={`h-4 w-4 ${view.isFetching ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {view.smoobu ? <IntegrationCard health={view.smoobu} /> : <CardSkeleton label="Smoobu" />}
        {view.littleHotelier ? (
          <IntegrationCard health={view.littleHotelier} />
        ) : (
          <CardSkeleton label="Little Hotelier" />
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        El estado de cada integración es global: los registros de las pasadas no llevan sede y no se atribuyen a ninguna.
        Solo las incidencias de vinculación se asocian a una sede, a través del mapeo de cada habitación
        {view.sedeName ? ` (sede activa: ${view.sedeName})` : ''}.
      </p>

      <details className="rounded-xl border bg-card p-4 text-sm">
        <summary className="cursor-pointer font-medium">Qué significa cada estado</summary>
        <ul className="mt-3 space-y-2">
          {LEGEND.map(([name, text]) => (
            <li key={name}>
              <span className="font-medium">{name}.</span> <span className="text-muted-foreground">{text}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-muted-foreground">
          «No hay nuevas reservas» aparece cuando hubo lectura y ningún cambio. Si una pasada termina sin leer nada
          se muestra como advertencia: terminar sin error no prueba que se haya importado.
        </p>
      </details>
    </div>
  );
}
