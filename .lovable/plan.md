

# Previsión de Personal — 3 Fases Completas

Sistema para anticipar días pico (domingos, festivos) usando Avantio + reservas internas + capacidad real de plantilla. Determinista, transparente, accionable.

---

## Fase A — Termómetro de Demanda (núcleo visual)

**Objetivo**: ver de un vistazo los próximos 30-45 días y detectar días en rojo con semanas de antelación.

### Backend
- Tabla nueva `staffing_targets`:
  - `day_of_week` (0-6) · `min_workers` · `min_hours` · `notes` · `sede_id` · timestamps
  - RLS: admin/manager pueden CRUD, lectura para autenticados
  - Seed inicial: domingo = 6 personas / 36h, resto = 2 personas / 12h (editable)
- Limpieza datos basura previa: query para detectar reservas con valores anómalos (>100 checkouts/día) y marcarlas para revisión manual antes de entrar en cálculo.

### Cálculo (cliente, hook `useStaffingForecast`)
Por cada día del rango:
```text
checkouts_avantio    = avantio_reservations.departure_date = día (status confirmado)
checkouts_internos   = client_reservations.check_out_date = día
carga_horas          = Σ (checkout × properties.duracion_servicio)
capacidad_horas      = Σ (cleaner_availability del día) − ausencias confirmadas
cobertura            = capacidad / carga
estado               = verde (>110%) / amarillo (90-110%) / rojo (<90%)
deficit_horas        = max(0, carga − capacidad)
deficit_personas     = ceil(deficit_horas / 6)   (turno medio 6h)
```

### UI
- Página nueva `/forecast` accesible desde sidebar (icono `TrendingUp`).
- **Heatmap 6 semanas**: grid 7×6, celdas con color según estado, número de checkouts grande, mini barra de cobertura.
- **Toggle vistas**: heatmap / lista compacta / gráfico líneas (carga vs capacidad).
- **Filtros**: rango de días (30/45/60), sede, incluir/excluir festivos.
- Click en celda → `DayDeficitDrawer`.

### Componentes
- `src/pages/StaffingForecast.tsx`
- `src/components/forecast/HeatmapWeek.tsx`
- `src/components/forecast/ForecastSummaryStats.tsx` (cards: días verdes, amarillos, rojos, peor día)
- `src/components/forecast/StaffingTargetsConfig.tsx` (modal de settings)
- `src/hooks/useStaffingForecast.ts`
- `src/hooks/useStaffingTargets.ts`

---

## Fase B — Recomendaciones Accionables

**Objetivo**: convertir la alerta visual en decisiones rápidas. Cada día rojo lleva al "qué hacer ahora".

### `DayDeficitDrawer` (drill-down de un día)
Layout estilo modal de tareas, secciones con divisores sutiles:

1. **Resumen del día** — fecha, checkouts esperados, horas necesarias vs disponibles, déficit en personas/horas.
2. **Lista de checkouts** — agrupados por propiedad, con duración estimada y estado de asignación (asignado / sin asignar).
3. **Plantilla actual** — trabajadoras del día con horas previstas, contrato, % completado de horas semanales.
4. **Sugerencias automáticas** (núcleo de la fase):
   - **Candidatas para reforzar** — ranking por:
     - Horas de contrato disponibles esta semana (más sobra → más arriba)
     - Histórico de domingos trabajados últimos 90 días (familiaridad)
     - Preferida en propiedades del día (preferred cleaners)
     - Sin ausencia confirmada
   - Cada candidata muestra: nombre, horas pendientes de contrato, días libres negociables, botón "Proponer turno".
5. **Acciones rápidas**:
   - "Crear turno extra" (genera draft de tarea/asignación)
   - "Sugerir cambio de día libre" (a trabajadora con día fijo en domingo)
   - "Marcar día como cubierto manualmente" (override sin acción)

### Patrones aprendidos (panel inferior del drawer)
Stats simples sobre los últimos 8 domingos (o festivos similares):
- Media de checkouts vs el día actual (¿es excepcional o normal?)
- Plantilla típica usada
- Tasa de cobertura histórica
- Aviso si el día actual está >20% por encima de la media → "Día atípicamente alto"

### Componentes
- `src/components/forecast/DayDeficitDrawer.tsx`
- `src/components/forecast/CandidateWorkerCard.tsx`
- `src/components/forecast/HistoricalPatternPanel.tsx`
- `src/hooks/useStaffingCandidates.ts` (lógica de ranking)
- `src/hooks/useHistoricalDayPattern.ts`

---

## Fase C — Anticipación Proactiva (notificaciones + persistencia)

**Objetivo**: dejar de depender de que alguien abra la página. El sistema avisa solo.

### Backend
- Tabla nueva `forecast_alerts_log`:
  - `alert_date` (día en alerta) · `alert_type` (red/yellow) · `deficit_hours` · `deficit_workers` · `sent_at` · `recipient_email` · `sede_id` · `dismissed_at` · timestamps
  - Único `(alert_date, alert_type, recipient_email)` para evitar duplicados (patrón `avantio_alert_log`)
- Tabla nueva `forecast_subscribers`:
  - `user_id` · `email` · `daily_digest` (bool) · `instant_red_alerts` (bool) · `min_days_advance` (int, default 7) · `sede_id`
  - Permite a admins/managers suscribirse y configurar a su gusto.

### Edge Function `daily-staffing-forecast`
- Cron diario a las 07:30 (Madrid)
- Recalcula próximos 30 días
- Detecta nuevos días rojos no notificados
- Para cada suscriptor: si hay alertas dentro de su `min_days_advance`, envía email único con:
  - Tabla resumen de días en alerta
  - Para cada día: déficit, top 3 candidatas sugeridas, link directo al `DayDeficitDrawer`
- Inserta en `forecast_alerts_log` para no repetir
- Soporta dismiss: si admin marca "no avisar más" sobre un día, no se reenvía

### Sincronización en tiempo real
- Cuando `avantio-sync` detecta cambios significativos (>10% más checkouts en un día):
  - Recalcula ese día puntual
  - Si pasa de verde a amarillo/rojo → email instantáneo a quien tenga `instant_red_alerts = true`

### Aviso inline en calendario
- Badge sutil en cabecera de día del calendario principal cuando ese día está en rojo (icono `AlertTriangle` ámbar/rojo)
- Click → abre el `DayDeficitDrawer` directamente
- Hook `useDayForecastBadge(date)` para reutilizar en calendario, dashboard, etc.

### Settings
- `src/pages/ForecastSettings.tsx` (o sección en Settings existentes):
  - Configurar `staffing_targets` por día semana
  - Gestionar suscriptores y sus preferencias
  - Ver log de alertas enviadas (últimas 30)
  - Botón "Probar email ahora" para validar configuración

---

## Aspectos técnicos transversales

- **Timezone**: todo en `Europe/Madrid` (regla del proyecto).
- **Sede**: cálculos respetan `activeSede` del contexto.
- **Performance**: cálculos client-side cacheados con React Query (`staleTime: 5min`); recálculo automático tras sincronización Avantio.
- **Datos basura Avantio**: filtro defensivo en `useStaffingForecast` que descarta días con >100 checkouts (umbral configurable) + warning visible para revisión manual.
- **Festivos**: integración con tabla existente o lista hardcodeada España + Comunidad Valenciana, marcados en heatmap con icono pequeño.

## Archivos nuevos (resumen)

```text
src/pages/
  StaffingForecast.tsx
  ForecastSettings.tsx
src/components/forecast/
  HeatmapWeek.tsx
  ForecastSummaryStats.tsx
  StaffingTargetsConfig.tsx
  DayDeficitDrawer.tsx
  CandidateWorkerCard.tsx
  HistoricalPatternPanel.tsx
  ForecastDayBadge.tsx
src/hooks/
  useStaffingForecast.ts
  useStaffingTargets.ts
  useStaffingCandidates.ts
  useHistoricalDayPattern.ts
  useDayForecastBadge.ts
supabase/functions/
  daily-staffing-forecast/index.ts
```

## Cambios DB (3 tablas nuevas)

- `staffing_targets`
- `forecast_alerts_log`
- `forecast_subscribers`

Cero modificaciones a tablas existentes.

## Orden de implementación

1. **Fase A primero** (resuelve 80% del problema con visibilidad).
2. **Fase B** una vez la A esté en uso y el usuario valide el cálculo.
3. **Fase C** al final (requiere A+B funcionando para que los emails lleven a algo útil).

Si lo apruebas, en la siguiente iteración ejecuto las 3 fases seguidas.

