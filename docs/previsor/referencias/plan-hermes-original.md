# Plan de corrección de la auditoría del previsor de personal

**Estado:** plan de trabajo propuesto; no implica cambios de código, datos ni producción.

**Fuente principal:** `C:/Users/danig/AppData/Local/hermes/profiles/limpatexengineer/attachments/pasted_content_2026-09-20_19-21-37-216_ad9748.txt`.

**Auditoría:** revisión manual de producción del 20/09/2026 en sede A Coruña. No leyó código ni base de datos. El refuerzo hipotético fue descartado y se verificaron `0 personas editadas`, `0 refuerzos` y `0 cambios en memoria`.

**Producción actual:** deployment visual `dpl_AZDBK5KJfxVY4yyQQvqpewj4Hi1w`, `READY`, alias `https://gestionlimpatex.vercel.app`. La versión publicada no se considera todavía una base única y fiable para decidir refuerzos o reducción de plantilla.

## 1. Objetivo y límites

El objetivo es que el previsor responda de forma coherente a estas dos decisiones operativas:

1. qué carga real existe y qué tareas pueden ejecutarse con el equipo disponible;
2. qué personas no alcanzarán su mínimo mensual ajustado y qué acción concreta procede.

La interfaz visual se conserva como base, pero no se añadirá más decoración hasta cerrar la coherencia de cálculo, periodo, sede, navegación y lenguaje.

No se hará durante este plan:

- borrar, desasignar o crear tareas reales;
- escribir jornadas, libranzas, contratos, refuerzos o configuraciones en Supabase;
- activar notificaciones, jobs o schedulers;
- modificar Calendario, Dashboard global, sidebar global o navegación móvil fuera del previsor;
- tratar una captura o un build correcto como prueba de cobertura operativa;
- desplegar una corrección sin la autorización específica de Dani y verificación posterior.

## 2. Reglas de trabajo

- Primero se reproduce cada hallazgo con un caso pequeño y determinista; después se identifica la causa; solo entonces se corrige.
- Se separan hechos observados por la auditoría, hipótesis sobre el código y reglas confirmadas por Dani.
- Existe una sola fuente de cálculo: `readStaffingDataset` + `buildStaffingForecast` y sus adaptadores revisados. Las siete pantallas serán presentaciones del mismo resultado, no calculadoras paralelas.
- Sede, mes/semana, centro y escenario forman un contexto maestro. Deben viajar juntos en la URL, la clave de React Query y el modelo presentado.
- `0 h` en ficha excluye a la persona de capacidad y candidaturas, pero sus tareas asignadas siguen siendo carga; `NOT COUNT` queda fuera de cualquier previsión.
- El margen del 20 % es reserva global de demanda turística; no se convierte en tareas, no se reparte artificialmente por día y no suma horas trabajadas de una persona.
- El máximo individual es el 130 % de la jornada semanal y engloba el trabajo de Limpatex. El mínimo se comprueba por mes natural con ajustes, no como obligación rígida independiente cada semana.
- Desconocido no significa cero: si faltan disponibilidad, libranzas, duración, identidad, sede o fuente, se muestra incertidumbre y no cobertura garantizada.
- Las simulaciones son puras, reversibles y visualmente separadas de asignaciones reales.

## 3. Inventario técnico que se usará

### Fuente canónica existente

- `src/pages/StaffingForecastPage.tsx`: carga por sede y rango, usando `readStaffingDataset`, `buildStaffingForecast` y `StaffingDashboard`.
- `src/features/staffing/data.ts`: lectura acotada por `sede_id`, tareas, trabajadores, propiedades, grupos, disponibilidad, ausencias, mantenimiento y asignaciones.
- `src/features/staffing/engine.ts`: ventanas, disponibilidad, viajes, solapes, capacidad, límite semanal y resultados de cobertura.
- `src/features/staffing/monthly.ts`: meses naturales y segmentos de semanas frontera; debe convertirse en la única agregación mensual visible.
- `src/features/staffing/StaffingDashboard.tsx`: actualmente calcula resumen, periodo, centro, candidatos, simulación y saldo; será el punto de extracción del modelo común.
- `src/features/staffing/StaffingRedesignUtils.ts`: reserva del 20 %, grupos de candidatos y formateo; se revisará para que no esconda reglas distintas.

### Superficies que ahora deben dejar de recalcular

- `src/features/staffing/StaffingOperationalScreens.tsx`: las vistas visuales actuales usan `useTasks`, `useCleaners`, `useCurrentWeekWorkload`, `useOperationalAnalytics` y edificios por separado. Se convertirán en consumidores de un `ForecastContext`/`ForecastViewModel` canónico.
- `src/features/staffing/StaffingOperationalWorkspace.tsx` y `src/pages/StaffingOperationalPage.tsx`: conservarán las siete rutas anidadas, pero recibirán el contexto maestro y conservarán sus parámetros al navegar.
- `src/hooks/useWorkloadCalculation.ts`: consulta tareas sin un filtro explícito de sede; debe auditarse y corregirse o dejar de ser fuente del previsor.
- `src/hooks/useCleaningPlanningBuildingData.ts`: usa una clave de caché estática y lecturas de grupos/asignaciones sin sede visible; debe aislarse por sede mediante relaciones e IDs autorizados.
- `src/hooks/analytics/useOperationalAnalytics.ts`: seguirá siendo fuente de informes de partes, no de déficit de plantilla, salvo que se etiquete claramente esa diferencia.
- `src/components/planning/OperationalPlanningPage.tsx`: debe leer los parámetros `tab` reales o recibir enlaces que apunten a secciones existentes.

## 4. Fases y puertas de aceptación

### Fase 0 — Baseline, reproducción y contrato de datos

**Propósito:** demostrar cada síntoma sin tocar producción y evitar arreglar una interpretación equivocada.

**Trabajo:**

- Crear fixtures sintéticos mínimos para contratos, tareas turísticas, otros servicios, mantenimiento, viajes, ausencias, centros y candidatos.
- Construir una prueba de lectura inyectada que use el lector real sin red ni Supabase; comprobar que la sede y los IDs se conservan.
- Reproducir con el mismo `ForecastContext` los recorridos de la auditoría: resumen, mensual, filtro de centro, alertas, candidatos, calendario y configuración.
- Registrar para cada hallazgo: entrada, resultado actual, causa confirmada o hipótesis, prueba roja, arreglo esperado y prueba verde.
- Capturar una matriz antes/después con el mismo rango, sede y escenario; no usar cifras de la maqueta como expected.

**Aceptación:** ningún arreglo se inicia sin una prueba roja o una discrepancia de contrato reproducible; el baseline queda guardado sin datos personales ni secretos.

### Fase 1 — Un solo contexto maestro y una sola fuente de cálculo

**Cubre:** hallazgos 1, 3, 4, 5, 6 y 7; además evita que Inicio, Previsión, Equipo y Turnos diverjan.

**Diseño:** crear un modelo equivalente a:

```text
ForecastContext {
  sedeId, monthAnchor, horizonMonths, selectedWeek,
  centerId, scenario: known | reserve, asOf,
  snapshot: { dataset, result, monthlyView, issues, fetchedAt }
}
```

- `StaffingForecastPage` y las rutas `/staffing-forecast/screens/:screen` leerán los mismos parámetros de URL y la misma consulta por `sedeId + dateFrom + dateTo`.
- El selector maestro deberá cambiar todo el módulo, no solo una tarjeta.
- La clave de React Query debe incluir sede, rango, centro cuando afecte a la lectura, escenario y versión del contrato; nunca reutilizar resultados de otra sede.
- El filtro de centro se aplicará al resultado canonical con capacidad asignable del centro. Si se muestra capacidad total de sede, se etiquetará como referencia y no como cobertura del centro.
- El enlace «Previsión de personal» y «Abrir previsión detallada» mostrarán la misma fuente y contexto; no habrá dos calculadoras con saldos distintos.
- La carga mantendrá el snapshot anterior solo como estado visible etiquetado mientras actualiza; un error no se presentará como ausencia de trabajo.

**Aceptación:** para la misma sede, periodo, centro y escenario, resumen, detalle, tabla semanal, alertas y Equipo reciben los mismos `knownMinutes`, `reserveMinutes`, `capacityMinutes`, `uncoveredMinutes` e `issues`; cambiar sede o mes nunca conserva cifras de la consulta anterior.

### Fase 2 — Corrección de semántica de carga, reserva y cobertura

**Cubre:** hallazgos 2, 3, 4 y la sección de claridad de cifras.

**Modelo visible por día y semana:**

- turismo conocido;
- otros servicios de Limpatex, incluido mantenimiento cuando compute para contrato;
- desplazamientos como tiempo bloqueado, no como horas computables;
- reserva turística global del 20 %;
- capacidad contractual y capacidad realmente asignable;
- carga sin asignar;
- déficit conocido y déficit no verificable.

**Reglas:**

- No aplicar `applyForecastReserve` a cada día para crear déficit diarios artificiales.
- Calcular la reserva una sola vez por unidad semanal/global acordada, conservarla separada de tareas y distribuirla en el mensual según los minutos turísticos reales que caen en cada mes natural.
- La reserva no se imputa a trabajadores como horas realizadas, no completa el mínimo mensual y no se convierte en tareas.
- El estado `Cubierto` solo se usará cuando el motor haya demostrado un encaje factible de servicios indivisibles, ventanas, disponibilidad, ausencias, viajes, solapes y límites; un saldo agregado positivo se llamará `Saldo semanal positivo`.
- Si existe fuente incompleta, el estado será `No verificable` o `Cobertura pendiente`, nunca verde por defecto.
- El centro filtrado tendrá demanda y capacidad asignable propias; la bolsa global se mostrará aparte si resulta útil.
- Los redondeos se harán después de sumar y se mostrarán con una precisión uniforme o en horas/minutos.

**Aceptación:** una semana con 100 h de turismo y 40 h de otros servicios muestra 20 h de reserva turística global; no modifica artificialmente cada domingo, no aplica margen a otros servicios ni viajes y no se presenta como 20 h trabajadas por nadie.

### Fase 3 — Mes natural, semanas frontera y objetivo mensual

**Cubre:** hallazgo 5, hallazgo 7 y puntos de contrato/ausencias de la auditoría.

**Mensual:**

- Los indicadores de octubre suman del 01/10 al 31/10. Las semanas 28/09–04/10 y 26/10–01/11 aparecen solo como contexto con segmentos imputados al mes.
- Cada tarea, reserva y parte se asigna por fecha civil Madrid al mes correspondiente.
- El encabezado muestra siempre mes, rango real, semana activa y sede.
- El horizonte de tres o seis meses muestra totales separados por mes, no una tabla única que parezca un total mensual.

**Por persona:** crear un `WorkerMonthLedger` derivado del resultado canónico:

- horas contractuales semanales desde ficha;
- objetivo del mes natural, usando semanal × 4,345 y ajustes por alta/baja, vacaciones y ausencias computables;
- horas ya computadas, separando turismo y otros servicios;
- horas futuras asignadas y tareas pendientes;
- mantenimiento/otros servicios que sí cuentan para el mínimo;
- viajes como bloqueo, no como trabajo computable;
- objetivo ajustado, total previsto y horas faltantes;
- estado `Cumple`, `Faltan X h`, `No verificable` o `Sin jornada`.

Los trabajadores con 0 h permanecen visibles en Equipo, pero no entran en capacidad ni candidaturas; su carga asignada sigue apareciendo como carga general.

**Aceptación:** contrato 15 h/semana sin ajustes produce 65,175 h mensuales y tope semanal 19,5 h; contrato 6 h con dos días laborables de vacaciones reduce el objetivo según el ajuste acordado; una semana de 13 h no marca incumplimiento mensual por sí sola.

### Fase 4 — Acciones contextuales y navegación

**Cubre:** hallazgo 6, calendario y continuidad entre las siete páginas.

Todos los enlaces conservarán `sede`, `month`, `week`, `center`, `scenario` y el identificador necesario:

| Acción | Destino y comportamiento obligatorio |
|---|---|
| Revisar equipo | Equipo filtrado por mes y personas en riesgo, no el editor de simulación. |
| Día con mayor déficit | Turnos/previsión con la fecha exacta, semana, centro y escenario que generaron la alerta. |
| Tareas sin asignar | Lista de las tareas pendientes del contexto; no una tarea asignada elegida por defecto. |
| Ver candidatos | Primero selector/lista de tareas pendientes; después candidatos de la tarea elegida. |
| Abrir calendario | Fecha, centro y `task` exactos; comprobar que el calendario enfoca el elemento. |
| Abrir configuración | Pestaña real que corresponde al texto; no solo un query string ignorado. |
| Volver al previsor | Recupera el mismo contexto sin pedir una consulta distinta ni perder el filtro. |

**Aceptación:** cada acción se prueba con una tarea y un día conocidos y la pantalla receptora muestra exactamente el mismo objeto, fecha, sede, periodo y escenario; los enlaces no abren un sustituto plausible.

### Fase 5 — Equipo, candidatos, Turnos y Centros

#### Equipo

- Ordenar primero personas en riesgo verificable y mantener filtros por centro, estado y mes.
- Mostrar el ledger mensual de la Fase 3; no llamar «H. pendientes» a una resta semanal ambigua.
- Diferenciar `—` por ausencia de datos de `0 h` real.
- Ausencias y libranzas mostrarán fuente y periodo; no inventar «día libre sugerido».

#### Candidatos

- Normalizar centro por IDs de grupo/propiedad, no por dirección o texto libre.
- Aplicar niveles estrictos: titular; si no es elegible, suplentes; backup solo sin suplente elegible; otros edificios cuando se agotan las opciones del edificio.
- Ocultar grupos inferiores cuando existe una alternativa elegible superior.
- Dentro del nivel, ordenar por horas mensuales pendientes y después por el hueco factible más útil.
- Mostrar un intervalo realmente disponible y suficiente, no repetir toda la ventana de la tarea.
- Excluir 0 h, `NOT COUNT`, ausencias, solapes, movilidad no permitida y ventanas incompatibles.

#### Turnos

- Mostrar edificio, propiedad, tipo, fecha, inicio, fin, duración y persona; no solo `limpieza-turistica`.
- Usar IDs de centro y propiedad coherentes en filtros y filas.
- Dibujar tareas sin asignar con estado inequívoco; el clic conserva fecha y tarea.
- Respetar ventanas del cliente y no prometer simultáneamente una persona a dos centros.

#### Centros

- Separar dificultad del edificio, prioridad de personal, estado de cobertura y movilidad.
- Titular, suplente, backup y movilidad se muestran con fuente y estado verificable.
- `Movilidad: No verificada` no equivale a elegibilidad.
- La capacidad por centro se deriva de relaciones/IDs y disponibilidad real, no de nombres ni de toda la capacidad de la sede.
- Verificar aislamiento por sede de grupos, propiedades y asignaciones antes de cambiar consultas o RLS.

**Aceptación:** los fixtures con titular + suplente + backup muestran solo la primera opción elegible; una persona compartida nunca aparece como disponible simultáneamente; dos propiedades sin edificio conservan identidades distintas.

### Fase 6 — Simulación de refuerzos y propuestas

**Cubre:** hallazgo 8 y la separación entre propuesta y realidad.

- El formulario pedirá horas semanales, periodo, sede/centro, ventanas y reglas relevantes; no fijará domingo libre por defecto.
- El refuerzo hipotético se identificará visualmente y nunca se añadirá a la ficha real.
- El motor asignará primero capacidad del equipo existente hasta el 130 % semanal permitido; después probará el refuerzo; aplazar será la última alternativa visible.
- El resultado mostrará días, franjas, tareas, horas utilizadas, déficit eliminado y déficit residual.
- La simulación tendrá `baseline`, `scenario`, diferencia por persona/día/centro y botón de restauración; no habrá mutación Supabase.
- El refuerzo puntual no se confundirá con una nueva contratación con obligación mensual.

**Aceptación:** introducir X horas reduce únicamente los déficits factibles; el resultado conserva límites, no inventa disponibilidad, no cambia la carga real y deja trazable por qué un déficit permanece.

### Fase 7 — Las siete páginas y lenguaje operativo

1. **Inicio:** mes/semana, sede, actualización y estado de datos visibles; dos decisiones principales: refuerzo por día y personas que no cumplen mes; eliminar tarjetas duplicadas de urgencia/pendientes.
2. **Previsión de personal:** una única fuente canónica, selector maestro, turismo/otros/viajes/reserva/capacidad y estado verificable; no otro previsor simplificado.
3. **Equipo:** ledger mensual, riesgo ordenado, filtros contextuales, ausencia de datos diferenciada de cero.
4. **Turnos:** timeline útil con propiedad, horario, duración, persona, centro y sin asignar; acciones al calendario exactas.
5. **Centros:** seis tarjetas o el número real devuelto por la sede, con imagen solo si existe fuente; dificultad, cobertura, roles y movilidad separados.
6. **Informes:** renombrar `Déficits` si mide diferencias de partes; definir `Trabajo efectivo`; separar analítica histórica de déficit de personal; Exportar debe ser impresión solo si se etiqueta como tal o generar archivo real con datos verificables.
7. **Configuración:** cinco categorías enlazadas a tabs/formularios existentes; abrir no escribe nada; los controles maestros no se duplican.

Microcopy: retirar nombres de tablas/campos y frases decorativas de uso diario; mantener azul marino, turquesa, fondo claro y tarjetas; rojo solo para problema comprobado, ámbar para incertidumbre/acción pendiente, verde/neutro para resultado verificable. Todas las fechas usarán Europe/Madrid y el formato será uniforme.

### Fase 8 — Fuentes, sede, permisos y seguridad

- Auditar cada SELECT real contra el esquema desplegado antes de tocar migraciones.
- Añadir `activeSede` a claves de caché y consultas que dependan de sede; verificar defensa en profundidad con IDs retornados.
- Para grupos/propiedades sin `sede_id` directo, resolver el alcance mediante propiedades autorizadas y registrar conflictos; no añadir un filtro textual improvisado.
- Revisar RLS/policies de `cleaners`, `tasks`, `properties`, `property_groups`, asignaciones, ausencias y mantenimiento en el proyecto enlazado antes de cualquier migración.
- Revisar la matriz de roles: admin/manager, supervisor, cleaner y client deben ver únicamente las siete páginas y datos que corresponden a su permiso real; el guard de frontend no sustituye RLS.
- No introducir service role, nuevas escrituras, RPC ni notificaciones para resolver una discrepancia visual.
- Mantener el aislamiento de pruebas: fixtures e inyección de lectores para lógica; sesión autenticada no destructiva solo para QA posterior.

**Aceptación:** cambiar de sede no filtra datos de la anterior; un usuario sin permiso no dispara lecturas; una fuente con error queda como parcial/desconocida; los policies reales cubren el alcance que la UI anuncia.

### Fase 9 — Matriz de pruebas de negocio

Cada caso se implementará como fixture determinista, con resultado esperado y resultado obtenido. La cifra esperada se expresará en minutos cuando sea posible.

1. 15 h/semana, mes sin ajustes: mínimo 65,175 h; máximo semanal 19,5 h.
2. Mantenimiento y turismo: ambos cuentan para mínimo y máximo; viajes bloquean huecos sin sumar trabajo.
3. Tarea fija asignada cuyo fin ya pasó y no está completada: imputar una sola duración acordada, no futura y realizada a la vez.
4. Tarea sin asignar: cuenta como carga pendiente, no como horas de una persona.
5. Tareas simultáneas o fuera de ventana: conflicto visible y no cobertura certificada.
6. Dos tareas mismo edificio y después otro: 0 min en el mismo centro, 15 min al cambiar; viaje bloquea disponibilidad.
7. Dos propiedades sin edificio: identidades y desplazamientos independientes.
8. 100 h turismo + 40 h otros: reserva turística global de 20 h; no margen sobre otros ni viajes.
9. Semana entre meses con 30 h turismo en el primero y 70 h en el segundo: reserva 6 h/14 h, sin duplicar semanas.
10. Contrato 6 h con dos días laborables de vacaciones: objetivo mensual ajustado, sin descontar libranza dos veces.
11. Libranza flexible: propuesta revisable que reduce el mayor déficit diario, sin escribir calendario.
12. Titular + suplente + backup: prioridad estricta; no mostrar backup si hay suplente elegible.
13. Persona compartida entre dos centros: nunca dos tareas simultáneas.
14. Falta de mínimo mensual: alerta individual con horas faltantes, sin crear tareas ni usar reserva/viaje como trabajo.
15. Refuerzo de X horas: uso en días con déficit y déficit residual explícito.
16. Fuente ausente, duración desconocida o identidad ambigua: desconocido y motivo, no cero ni capacidad garantizada.
17. Cambio de sede: caché y resultados completamente separados.
18. Filtro de centro: capacidad asignable del centro, no toda la capacidad de sede presentada como cobertura.
19. Mes frontera: solo días del mes en indicadores; semanas completas como contexto.
20. Acción de alerta: fecha, tarea, centro, periodo y escenario conservados en el destino.
21. Escenario conocido frente a reserva: mismos datos base y solo la reserva separada; no tareas sintéticas.
22. Reintento/cancelación de lectura: no duplica filas, no muestra parcial como vacío y conserva issues explícitos.

### Fase 10 — Verificación visual, roles y entrega

Por cada fase de código:

- prueba roja focalizada;
- prueba verde focalizada;
- `npm run test:staffing` y contratos de lectura relevantes;
- ESLint de todos los archivos tocados;
- `tsconfig.app.json` y `tsconfig.node.json`, registrando por separado la deuda global preexistente;
- `npm run build` y `git diff --check`;
- prueba estática de rutas y query parameters;
- navegador local con fixtures o lector inyectado, sin escribir en Supabase;
- QA autenticada no destructiva por rol/sede cuando exista sesión segura;
- comparación de capturas de los siete estados con la plantilla, sin afirmar equivalencia por tener los mismos textos.

Antes de publicar: rama propia, estado Git inventariado, revisión independiente de cálculo/RLS/permisos, artefacto protegido en commit o backup verificable, autorización explícita y despliegue al proyecto canónico. Después: `vercel inspect`, HTML canónico, assets exactos, chunk lazy, estado `READY` y reporte separado de QA autenticada.

## 5. Orden recomendado y criterios de salida

### Bloque P0 — no aceptar el previsor como base operativa

Fases 0, 1, 2 y 3: reproducción, contexto único, reserva global, cobertura verificable, mes natural y ledger mensual. Este bloque resuelve la posibilidad de que dos pantallas den conclusiones incompatibles.

**Salida P0:** los 22 casos de la matriz pasan; el mismo escenario produce el mismo resultado desde resumen, detalle, Equipo y Turnos; no hay cobertura verde basada solo en suma de horas.

### Bloque P1 — decisiones y navegación utilizables

Fases 4, 5 y 6: enlaces contextuales, candidatos por niveles, timeline con datos útiles, centros por IDs y simulación reversible.

**Salida P1:** cada alerta abre su lista/día/tarea real; ninguna simulación escribe; los candidatos son elegibles y ordenados por regla.

### Bloque P2 — claridad, informes y configuración

Fases 7 y 8: microcopy, informes con semántica honesta, exportación definida, configuración real, sede/RLS/permisos y fuentes parciales.

**Salida P2:** cada etiqueta explica qué mide, cada enlace abre lo que anuncia y el acceso por rol/sede coincide con RLS.

### Bloque P3 — QA y publicación

Fase 10, revisión independiente y despliegue controlado.

**Salida P3:** solo entonces se podrá decir que la corrección está implementada y verificada. Un deployment `READY` sin esta evidencia seguirá siendo únicamente una publicación técnica.

## 6. Riesgos que deben quedar visibles

- La auditoría manual no prueba por sí sola la causa interna; cada causa se confirmará con código y fixture.
- Corregir el lector o RLS puede cambiar qué datos aparecen; se hará read-only primero y sin `db push` global.
- Las semanas frontera y los calendarios Madrid pueden producir falsos verdes si se mezclan `Date` local y claves civiles.
- La analítica de partes no equivale automáticamente a déficit de personal.
- Una tarjeta de centro no puede prometer movilidad, coste o cobertura si la fuente no lo verifica.
- La versión visual ya está en producción, pero esta auditoría impide presentarla como terminada operativamente.

## 7. Entregables por cierre

1. Documento de contrato de datos y contexto maestro.
2. Fixtures y pruebas de los 22 casos.
3. Modelo canónico de previsión y ledger mensual.
4. Rutas y enlaces contextuales verificados.
5. Revisión de sede, permisos y RLS sin secretos ni datos personales.
6. Capturas comparativas y QA por rol/sede.
7. Informe final que distinga preparado, probado localmente, publicado y verificado en producción.

## 8. Revisión independiente incorporada

La revisión de solo lectura confirma el plan y añade estas condiciones obligatorias antes de considerarlo completo:

- **Procedencia de datos:** documentar para cada resultado `task_assignments`, `cleaner_id`, estado de tarea, duración planificada, fecha de ejecución y diferencia entre asignación real, propuesta futura y servicio pendiente. Una fila sin cadena hasta sede, propiedad, trabajador o reserva autorizado genera `issue` y no capacidad verde.
- **Libro mensual completo:** conservar tipo y tramo horario de ausencias, vacaciones, libranzas, altas/bajas y ajustes parciales. No reducir un ajuste a una fecha bloqueada si cambia el objetivo mensual.
- **Capacidad compartida:** definir cómo se reparte una persona móvil o compartida entre centros sin doble contabilizarla y cómo se muestra la capacidad común cuando no puede atribuirse a un único edificio.
- **Reserva y D-7:** elegir explícitamente si el 20 % es la reserva global de negocio o si existe además una estimación D-7 basada en `receivedDate`. No mezclar ambas bajo la misma etiqueta; si falta historial D-7, marcar la estimación como desconocida/provisional.
- **RLS y grants:** inventariar en el proyecto desplegado `pg_policies`, grants y roles efectivos para `tasks`, `cleaners`, propiedades, grupos, asignaciones, disponibilidad, ausencias y mantenimiento. Las políticas que se combinan por `OR` deben revisarse por nombre y retirarse/sustituirse con una migración explícita solo después de comprobar escritores existentes.
- **Supervisor y roles:** decidir y documentar si supervisor puede consultar el previsor. La matriz de rutas y las policies deben coincidir; el `RoleProtectedRoute` no es prueba de autorización ni de aislamiento.
- **Política por sede:** versionar `staffingRulesForSede` para movilidad, jornadas, trabajadores excluidos y propiedades especiales. Una sede desconocida, UUID obsoleto o regla no verificada debe producir `policy-unverified`, nunca una cobertura silenciosamente conservadora presentada como confirmada.
- **Snapshot trazable:** el contexto maestro incluirá `asOf`, `rulesVersion`, estado/frescura de cada fuente, conteos, identificadores y `fetchedAt`; estos valores formarán parte de cache keys y enlaces para invalidar resultados al cambiar sede, usuario, día o reglas.
- **Diagnóstico útil:** sustituir el contador genérico de incidencias por diagnósticos con fuente, periodo, filas afectadas, conteo, impacto en demanda/capacidad y acción recomendada.
- **Contratos de integración:** probar formalmente que Calendario consume `task`, `date`, sede y centro, y que Configuración consume `tab`; si una ruta no soporta el parámetro, cambiar el enlace y el texto en lugar de fingir profundidad.
- **Regresiones de dominio:** conservar pruebas de proveedores, recurrencias, colaboradores, 0 h, `NOT COUNT`, identidades duplicadas, mappings ambiguos, tareas fuera de rango, jornadas y fechas Madrid durante el refactor.
- **QA fuera del código:** añadir capturas y recorrido de 320/375/768 px, teclado, foco, contraste, lector de pantalla y alternativa textual de gráficos. Las pruebas offline actuales no demuestran RLS, sede ni producción.
- **Referencia de entrega:** antes de aceptar cualquier resultado, registrar qué commit/backup representa el árbol probado y qué deployment lo publicó. La rama actual contiene archivos sin commit y no puede usarse como sustituto de una referencia Git protegida.

Estas puertas completan el plan; no autorizan por sí mismas migraciones, escrituras Supabase, commit, push ni otro despliegue.
