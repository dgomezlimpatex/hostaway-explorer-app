# Checklist de implementación — Planificación Limpatex V2

## Objetivo
Implementar un sistema útil de planificación de limpiezas basado en propiedades/edificios y personal asignado, no un simple listado de tareas.

## Reglas confirmadas por Dani
- [x] Centro de trabajo = cada propiedad.
- [x] Propiedades con mismo prefijo de código forman un edificio/grupo operativo. Ej.: `MD18.1` y `MD18.1B` → `MD18`.
- [x] Apartamentos individuales son su propio centro/grupo.
- [x] No se intercambian limpiadoras entre sedes: A Coruña, Ourense, Benidorm.
- [x] Buffer fijo de 30 minutos entre check-out/check-in para tiempo no productivo.
- [x] El sistema no crea tareas: solo asigna/reasigna tareas ya creadas.
- [x] Las limpiezas normales caben en ventana; casas grandes requieren 2–3 personas.

## Fase 1 — Núcleo de dominio y servicios
- [ ] Crear utilidades puras para derivar edificio desde código de propiedad.
- [ ] Crear cálculo de ventana de limpieza con buffer de 30 min.
- [ ] Crear cálculo de carga por limpiadora respetando multi-persona.
- [ ] Crear tipos `PlanningV2*` sin editar tipos autogenerados de Supabase.
- [ ] Añadir pruebas o script verificable para funciones puras.
- [ ] Verificar con `npm run typecheck` y build parcial si procede.

## Fase 2 — Configuración de personal por propiedad/edificio
- [ ] Crear modelo frontend para equipo titular/secundario/backup/excluido.
- [ ] Reutilizar `property_groups`, `property_group_assignments`, `cleaner_group_assignments` si encaja.
- [ ] Crear UI simple para ver edificios/propiedades y asignar personal.
- [ ] Permitir herencia grupo → propiedad y override por propiedad.
- [ ] Filtrar/mostrar por sede.
- [ ] Verificar con typecheck/build.

## Fase 3 — Motor de asignación automática
- [ ] Solo leer tareas ya existentes.
- [ ] Proponer asignación a titular si está disponible.
- [ ] Usar backup/secundario si titular no puede.
- [ ] Bloquear si limpiadora pertenece a otra sede.
- [ ] Bloquear si hay solape.
- [ ] Bloquear si no cabe entre check-out/check-in + buffer.
- [ ] Permitir 2–3 personas en casas grandes.
- [ ] Explicar cada decisión: motivos positivos, bloqueos y warnings.

## Fase 4 — Dashboard visual operativo
- [ ] Sustituir `/cleaning-planning` actual por V2 o marcar V1 como legacy.
- [ ] Vista por edificios/apartamentos con personal asignado.
- [ ] Vista corto/medio/largo plazo: hoy, 7 días, 30 días.
- [ ] Heatmap por limpiadora/día/carga.
- [ ] Panel de alertas: sin cubrir, sobrecarga, fuera de ventana, sin backup.
- [ ] Acciones de asignar/reasignar con confirmación.

## Fase 5 — Sustituciones por bajas
- [ ] Modal para seleccionar limpiadora + rango de baja.
- [ ] Detectar tareas afectadas.
- [ ] Proponer sustitutas dentro de la misma sede y preferentemente mismo edificio/grupo.
- [ ] Aplicar reasignaciones tras confirmación.

## Fase 6 — Validación y producción
- [ ] `npm run typecheck` OK.
- [ ] Lint específico sobre archivos tocados OK.
- [ ] `npm run build` OK.
- [ ] Smoke test navegador local en `/cleaning-planning`.
- [ ] Commit convencional.
- [ ] Push a producción solo tras validación y revisión.

## Subagentes lanzados
- [ ] Subagente A — núcleo dominio/motor puro.
- [ ] Subagente B — servicios/datos/configuración equipos.
- [ ] Subagente C — UI dashboard/flujo operativo.

## Criterio de terminado
Dani puede entrar, ver edificios/apartamentos con personal asignado, revisar carga 7/30 días, generar propuestas para tareas ya creadas, cubrir bajas y entender por qué cada tarea se asignó a cada limpiadora.
