# Auditoría y propuesta de mejora — Gestión Limpatex

> Rama local de trabajo: `feature/auditoria-redesign-mejoras`  
> Regla de producción: no push, no merge, no deploy y no migraciones sin aprobación explícita de Dani.

## 1. Stack detectado

- Frontend: Vite + React 18 + TypeScript.
- Routing: `react-router-dom` con lazy loading por página.
- UI: Tailwind CSS + shadcn/Radix UI + lucide-react + sonner.
- Estado remoto/cache: TanStack React Query.
- Backend/BBDD: Supabase, con cliente frontend en `src/integrations/supabase/client.ts` y Edge Functions en `supabase/functions`.
- Dominios operativos: producción probable en Vercel (`gestionlimpatex.vercel.app`) y flujo Lovable/GitHub.
- Build: `vite build`.
- Lint: `eslint .`, actualmente falla por deuda técnica preexistente en `src` y `supabase/functions`.

## 2. Estado inicial del proyecto

La app ya tiene una cobertura funcional amplia: dashboard, calendario, tareas, trabajadores, clientes, propiedades, reportes, incidencias, logística, inventario, lavandería, control de mudas, forecast, portales cliente e integraciones Hostaway/Avantio/Little Hotelier/Avirato.

La estructura permite iterar, pero hay deuda técnica relevante:

- 550 ficheros TS/TSX bajo `src`.
- 54 páginas.
- 276 componentes.
- 118 hooks.
- Muchas features conviven en un único SPA grande.
- Hay lazy loading de rutas, pero varios chunks siguen siendo pesados: `xlsx`, `jspdf`, `BarChart`, `TaskDetailsModal`, `Calendar`, `Workers`.
- `npm run lint` falla con cientos de errores preexistentes, principalmente `no-explicit-any`.
- `tsconfig` tiene `noImplicitAny: false` y `strictNullChecks: false`.
- Hay muchos `console.log` en código de producción.
- `.env` no estaba protegido suficientemente en `.gitignore`.

## 3. Riesgos detectados

- La rama `main` despliega probablemente a producción vía Vercel; cualquier push a `main` puede desplegar.
- Supabase frontend apunta a proyecto real: `https://qyipyygojlfhdghnraus.supabase.co`.
- `.env` aparece como trackeado históricamente según auditoría del subagente de seguridad; requiere revisar historial y rotar secretos si alguna vez tuvo claves reales.
- Hay migraciones históricas con policies RLS amplias (`USING true / WITH CHECK true`) y operaciones destructivas (`DELETE`, `DROP`, cambios masivos).
- Varias Edge Functions usan `SUPABASE_SERVICE_ROLE_KEY` y algunas tienen `verify_jwt=false`; deben revisarse antes de desplegar backend.
- El lint global no puede usarse como gate real hasta separar frontend/Supabase o corregir deuda.

## 4. Problemas técnicos principales

1. Lint global roto por deuda preexistente.
2. Tipado laxo en `tsconfig`.
3. Chunks grandes en build.
4. Consola de producción ruidosa.
5. Navegación lateral y tokens visuales dispersos.
6. Estados de carga/empty/error no totalmente uniformes.
7. Riesgo en Supabase/RLS/Edge Functions que requiere hardening específico.
8. Falta de branch protection/checks obligatorios documentados.

## 5. Problemas UX/UI

- La app es funcional pero mezcla estilos heredados: grises/azules genéricos, cards diferentes, sidebar poco premium.
- Jerarquía visual mejorable para operaciones críticas: hoy, sin asignar, incidencias, riesgos.
- Mobile existe, pero necesita un sistema visual más coherente y touch-first.
- Tablas/listados y estados vacíos pueden ser más accionables.
- El calendario es una pieza crítica y debe tener más prevención de errores y feedback.

## 6. Problemas operativos

- Falta una torre de control única que cruce tareas, incidencias, mudas, inventario y personal.
- Las alertas de riesgo son todavía mejorables: sin asignar, check-in cercano, ausencias, stock, incidencias previas.
- La app tiene datos suficientes para automatizar decisiones repetitivas, pero falta una bandeja de decisiones pendientes.

## 7. 10 mejoras técnicas propuestas

| # | Mejora | Problema | Zona | Impacto | Riesgo | Dificultad | Prioridad | Estado |
|---|---|---|---|---|---|---|---|---|
| 1 | Separar scripts `lint:app` y `typecheck` | `npm run lint` falla por deuda global | `package.json` | Alto | Bajo | Baja | P0 | Implementada |
| 2 | Proteger `.env` | Riesgo de secretos en Git | `.gitignore` | Alto | Bajo | Baja | P0 | Implementada |
| 3 | Tokens visuales premium Limpatex | UI genérica/inconsistente | `src/index.css` | Medio-alto | Bajo | Baja | P0 | Implementada |
| 4 | Shell operativo reutilizable | Falta patrón común para páginas | `src/components/ui/operational-shell.tsx` | Medio | Bajo | Media | P1 | Implementada base |
| 5 | Sidebar premium y más claro | Navegación poco moderna | `DashboardSidebar.tsx` | Alto UX | Medio | Media | P1 | Implementada base |
| 6 | Cards globales más modernas | Cards planas/inconsistentes | `ui/card.tsx` | Medio | Medio | Baja | P1 | Implementada base |
| 7 | Reducir logs de producción | Ruido/rendimiento/privacidad | `Index.tsx`, `TasksPage.tsx` | Medio | Bajo | Baja | P1 | Implementada parcial |
| 8 | Auditoría de chunks pesados | Bundle grande | build/dist | Alto | Bajo | Media | P1 | Futura |
| 9 | Hardening Supabase RLS/functions | Superficie de seguridad | `supabase/*` | Muy alto | Alto | Alta | P0 | Futura con aprobación |
| 10 | Tests/smoke Playwright de rutas críticas | Evitar pantalla blanca post-deploy | `tests/e2e` | Alto | Medio | Media | P1 | Futura |

## 8. Rediseño aplicado en esta rama

Cambios visuales seguros y transversales:

- Nueva base visual Limpatex premium con morado corporativo `#310984`, fondos suaves y gradientes sutiles.
- Sidebar oscuro premium tipo SaaS operativo, con marca `Limpatex OS`, navegación más visible y estados activos claros.
- Cards globales con bordes más redondeados, blur suave, sombras premium y microinteracción hover.
- Fondo general menos plano y más profesional.
- Nuevo componente reutilizable `OperationalPageShell` para ir migrando páginas a una estética común sin reescribir todo de golpe.
- Nuevo componente `OperationalMetricCard` para KPIs operativos.
- Nuevo `OperationalEmptyState` para estados vacíos accionables.
- Nuevo `OperationalLoadingState` para cargas consistentes.

No se ha cambiado la lógica de negocio ni base de datos.

## 9. 15 funcionalidades nuevas propuestas

| # | Nombre | Problema | Usuario | Prioridad | Complejidad | Valor | Requisitos | Fase |
|---|---|---|---|---|---|---|---|---|
| 1 | Torre de Control Operativa Diaria | Información dispersa | Manager/supervisor | P0 | Media | Muy alto | Agregador tareas/incidencias/inventario | 1 |
| 2 | Alertas de Riesgo Antes del Servicio | Problemas se detectan tarde | Manager | P0 | Media-alta | Muy alto | Reglas por sede/tarea/reserva | 1 |
| 3 | Replanificación Inteligente | Ausencias/urgencias manuales | Manager | P0 | Alta | Muy alto | Motor escenarios/asignación | 2 |
| 4 | Ruta Diaria Optimizada | Desplazamientos ineficientes | Limpiadoras | P0 | Media-alta | Alto | Geocoding/maps | 2 |
| 5 | Checklist Dinámico | Checklists genéricas | Campo/supervisión | P0 | Media | Alto | Plantillas por propiedad/cliente | 1 |
| 6 | Llegada/Salida geolocalizada | Poca trazabilidad horaria | Manager/RRHH | P1 | Media | Alto | GPS móvil/RGPD | 1 |
| 7 | Parte guiado con evidencias | Reportes incompletos | Limpiadoras/clientes | P1 | Media | Alto | Fotos/checklist/offline | 1 |
| 8 | Modo offline completo | Mala cobertura | Campo | P1 | Alta | Alto | IndexedDB/sync queue | 2 |
| 9 | Predicción duración real | Tiempos fijos imprecisos | Planificación | P1 | Media-alta | Alto | Histórico tiempos | 2 |
| 10 | Semáforo calidad propiedad | Supervisión no priorizada | Supervisores | P1 | Media | Medio-alto | Scoring incidencias/reportes | 2 |
| 11 | Bandeja decisiones pendientes | Excepciones dispersas | Manager/admin | P1 | Media | Alto | Tabla operational_actions | 1 |
| 12 | SLA por cliente | Reglas cliente no integradas | Clientes/manager | P1 | Media | Medio-alto | Config cliente/propiedad | 2 |
| 13 | Planificador mudas/amenities | Stock reactivo | Logística/lavandería | P1 | Media-alta | Alto | Reservas+stock+propiedades | 2 |
| 14 | Auditoría cambios sensibles | Falta trazabilidad | Dirección/admin | P2 | Media | Medio | Event log | 1 |
| 15 | Informe diario automático | Cierre manual | Manager/dirección | P2 | Media | Medio-alto | Job/email/PDF | 2 |

## 10. Priorización por fases

### Fase 1 — Seguridad visual + operativa inmediata

- Consolidar shell visual en dashboard/tareas/calendario/trabajadores/propiedades.
- Torre de control diaria.
- Alertas de riesgo.
- Checklist dinámico.
- Parte guiado con evidencias.
- Bandeja de decisiones pendientes.
- Auditoría de cambios sensibles.

### Fase 2 — Automatización operativa

- Replanificación inteligente.
- Rutas optimizadas.
- Offline completo.
- Predicción de duración.
- Semáforo calidad.
- SLA por cliente.
- Planificador mudas/amenities.
- Informe diario automático.

### Fase 3 — Hardening técnico

- RLS real por roles/sedes.
- Revisión Edge Functions con service role.
- Smoke tests automáticos de rutas críticas.
- Bundle splitting avanzado y cargas bajo demanda de `xlsx`, `jspdf`, charts y modales pesados.

## 11. Validación local

- `npm run typecheck`: pasa.
- `npm run build`: pasa.
- `npm run lint:app`: falla por deuda preexistente en `src` (`no-explicit-any`), no por los archivos modificados.
- ESLint acotado a archivos modificados TS/TSX: pasa con 0 errores.
- `npm run lint` global: falla por deuda preexistente en `src`, `supabase/functions` y `tailwind.config.ts`.

## 12. Producción

No se ha hecho push, merge ni deploy en esta tarea. La rama está solo local.
