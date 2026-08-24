# Supervisión por edificios — Plan de implementación

> **Para Hermes:** ejecutar por olas verificadas. La primera ola debe cerrar un tramo vertical completo antes de añadir stock, maquinaria y zonas comunes.

**Objetivo:** sustituir la preparación manual de rutas por una agenda automática de supervisión agrupada por edificios, con supervisoras asignadas, propiedades derivadas y checklists ejecutables.

**Arquitectura:** se conserva el histórico de `supervision_routes` como compatibilidad, pero la unidad operativa nueva será el edificio y el trabajo generado por fecha. Se añade una relación específica de supervisoras por edificio y un servicio de agenda que calcula apartamentos pendientes a partir de propiedades vinculadas, tareas de limpieza, revisiones e incidencias. Las checklists actuales se reutilizan inicialmente y se versionan después en una fase separada.

**Stack:** Vite + React + TypeScript, React Query, Supabase/Postgres/RLS, scripts de contratos con Node/esbuild.

---

## Decisiones de negocio confirmadas

- Los edificios existentes (`property_groups`) son la unidad principal.
- Las propiedades se obtienen automáticamente desde `property_group_assignments`; la supervisora no las añade una a una.
- La asignación de supervisora debe usar el usuario real, no `supervisor_name` como texto.
- La asignación de limpiadoras (`cleaner_group_assignments`) no se reutiliza para supervisión.
- La supervisora verá sus edificios y las propiedades asociadas, limitados por sede/rol.
- La ruta manual se conserva temporalmente como compatibilidad/histórico, pero deja de ser la experiencia principal.
- La primera ola implementa apartamentos y revisiones; trasteros, maquinaria, almacén central y zonas comunes se incorporan como tipos de trabajo posteriores.
- No se alteran tareas de limpieza ni asignaciones de trabajadoras.
- Las operaciones deben ser aditivas, reversibles y sin exponer datos económicos.

## Ola 1 — Agenda automática por edificio

### Tarea 1 — Contrato de dominio y prueba RED/GREEN

**Archivos:**
- Crear: `src/features/supervision/buildingAgenda.ts`
- Crear: `scripts/supervisionBuildingAgendaTest.entry.ts`
- Crear: `scripts/supervisionBuildingAgendaTest.mjs`
- Modificar: `package.json`

**Comportamiento:**
- Agrupar propiedades por edificio.
- Excluir propiedades inactivas o sin identificador.
- Generar trabajo para propiedades con limpieza del día terminada o con una incidencia/revisión que obligue a repetir.
- Priorizar entrada próxima, incidencia abierta, devolución para repaso y falta de revisión reciente.
- No generar duplicados para la misma propiedad, edificio, fecha y tipo de revisión.
- Mantener una salida explicable con `reason[]`.

**Verificación:**
`npm run test:supervision-building-agenda`

### Tarea 2 — Migración de asignación de supervisoras

**Archivo:**
- Crear: `supabase/migrations/20260824130000_supervision_building_assignments.sql`

**Objetos:**
- `supervision_building_supervisors` con edificio, usuario, rol (`primary`, `secondary`, `backup`), vigencia, prioridad, notas y estado.
- Índices por edificio, usuario y vigencia.
- RLS: administradores/manager gestionan; supervisoras solo leen sus asignaciones.
- Trigger de integridad: el usuario asignado debe tener rol supervisor, manager o admin y el edificio debe corresponder a una sede accesible.
- Función de consulta segura para obtener asignaciones activas por usuario.

No modificar `src/integrations/supabase/types.ts` manualmente.

### Tarea 3 — Servicio de edificios asignados y agenda

**Archivos:**
- Crear: `src/features/supervision/buildingSupervisionStorage.ts`
- Crear: `src/features/supervision/useBuildingSupervisionWorkspace.ts`
- Modificar: `src/features/supervision/types.ts`

**Comportamiento:**
- Consultar edificios asignados al usuario autenticado.
- Cargar propiedades del edificio mediante `property_group_assignments`.
- Cargar tareas de la fecha mediante la proyección operativa ya existente.
- Cargar revisiones/incidencias de supervisión.
- Devolver edificios agrupados y agenda explicable.
- Fallback offline de lectura usando snapshots aislados por usuario.

### Tarea 4 — Vista de supervisora por edificios

**Archivos:**
- Crear: `src/pages/SupervisionBuildings.tsx`
- Crear: `src/components/supervision/BuildingSupervisionCard.tsx`
- Crear: `src/components/supervision/SupervisionAgendaItem.tsx`
- Modificar: `src/App.tsx`
- Modificar: navegación de escritorio y móvil.

**UX:**
- Entrada “Mi supervisión”.
- Selector de fecha.
- Tarjetas por edificio con progreso, pendientes e incidencias.
- Dentro de cada edificio, propiedades derivadas automáticamente.
- Botón “Revisar” que abre la checklist actual sin crear paradas manuales.
- Filtros: pendientes, completadas, incidencias y todas.
- Orden automático explicable; no drag-and-drop como requisito.
- La ruta manual queda como acceso secundario de compatibilidad.

### Tarea 5 — Conectar la checklist actual

**Archivos:**
- Crear: `src/components/supervision/ApartmentReviewSheet.tsx`
- Reutilizar: `src/features/supervision/domain.ts`, `supervisionStorage.ts`.
- Modificar: `src/pages/SupervisionBuildings.tsx`.

**Comportamiento:**
- Revisión rápida y completa.
- Checklist de apartamento actual.
- Notas, resultado, devolución para repaso, incidencia y fotos.
- Al guardar, invalidar agenda y mostrar el siguiente elemento pendiente.
- No crear una `supervision_route` nueva para cada revisión automática.

### Tarea 6 — Contratos, integración y migración remota

**Verificación local:**
- `npm run test:supervision-building-agenda`
- `npm run test:supervision-ui`
- `npm run test:supervision-domain`
- `npm run test:role-modes`
- `npm run typecheck`
- ESLint dirigido.
- `npm run build`
- `git diff --check`

**Verificación Supabase:**
- `pg_policies` y privilegios.
- Usuario supervisor solo ve edificios asignados.
- Manager/admin gestionan asignaciones.
- Usuario sin rol supervisor no puede insertar asignación.
- Sin datos económicos en la agenda.

**Release:**
- Commit de la ola.
- Push de la rama feature.
- Deploy Vercel tras gates verdes.
- Aplicar migración solo después de revisar el SQL y verificar remoto.
- QA autenticado pendiente hasta disponer de cuenta real.

---

## Ola 2 — Programación y generación durable

- `supervision_building_policies` con frecuencias de revisión rápida/completa.
- `supervision_work_items` con clave idempotente por edificio/propiedad/fecha/tipo.
- Generador diario seguro y reintentable.
- Estados pendiente/en curso/completado/aplazado/bloqueado.
- Motivos obligatorios de aplazamiento.
- Dashboard de cobertura para administrador.

## Ola 3 — Trasteros, stock y maquinaria

- Ubicaciones de stock por edificio/almacén.
- Reposición, inventario y reserva central separados.
- Equipos y maquinaria como activos con estado, fotos e incidencias.
- Checklists de trastero y almacén.
- No conectar directamente con el stock global actual sin ubicación.

## Ola 4 — Zonas comunes y extraordinarios

- Zonas comunes configurables por edificio.
- Checklists específicas.
- Solicitudes extraordinarias con aprobación administrativa.
- Programación y verificación posterior.

## Riesgos y controles

- **Duplicados:** claves idempotentes y contratos de agenda.
- **Asignaciones incorrectas:** rol real + sede + vigencia en SQL.
- **RLS indirecto:** verificar joins de edificios/propiedades/tareas.
- **Sobrecarga:** mostrar carga por supervisora antes de activar automatismos.
- **Pantalla demasiado compleja:** una acción principal: “Revisar siguiente”.
- **Datos históricos:** conservar rutas existentes y no migrarlas destructivamente.
- **Offline:** no sincronizar trabajo bajo otra identidad y no duplicar revisiones/fotos.

## Criterio de aceptación de la Ola 1

- Una supervisora con edificios asignados ve automáticamente sus edificios.
- Cada edificio muestra sus propiedades vinculadas sin añadirlas manualmente.
- La agenda genera únicamente comprobaciones pertinentes para la fecha.
- Cada elemento explica por qué está pendiente.
- Pulsar “Revisar” abre la checklist actual.
- Guardar una revisión actualiza el progreso sin crear una ruta manual.
- Un manager/admin puede asignar y retirar supervisoras.
- Un usuario de otra sede no ve esos edificios.
- No se muestran costes, precios ni datos económicos.
- La experiencia manual antigua sigue disponible como compatibilidad hasta completar QA.
