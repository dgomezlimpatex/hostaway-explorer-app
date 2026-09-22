# Implantación del plan UI/UX — resultado local

Fecha: 22 de septiembre de 2026. Rama `codex/previsor-ui-ux-20260922`, sobre `3c4ae307`.

Estado: siete pantallas implementadas, verificadas con pruebas locales y publicadas el 22 de septiembre de 2026 por autorización expresa del usuario. Falta contraste autenticado de esta versión con registros reales y prueba de comprensión por una persona ajena al desarrollo. Detalles del despliegue y reversión en [PUBLICACION_UI_UX_20260922.md](PUBLICACION_UI_UX_20260922.md).

## Cambios

- Inicio prioriza datos que impiden evaluar, tareas sin asignar y personas con horas pendientes. Desconocidos y riesgo calculado tienen contadores separados.
- El horizonte, la semana y el mes del objetivo tienen significados separados. Los enlaces conservan el ámbito del indicador. Un mes fuera de lo leído ofrece consultarlo completo, sin mostrar ceros ficticios.
- Previsión mantiene reserva separada de las tareas diarias, explica capacidad frente a encaje y representa datos desconocidos como huecos. El gráfico distingue pasado y futuro y ofrece tabla y consulta por teclado.
- Equipo tiene filtros, búsqueda, orden, exclusiones separadas y estado visible en móvil. El perfil separa balance mensual, semana, disponibilidad y tareas; estas se filtran por nombre/centro, fecha y condición registrada/propuesta. Volver desde una tarea recupera los filtros del perfil y de Equipo.
- Cobertura tiene agenda diaria, semana por días y calendario mensual. La agenda diferencia horario registrado, ventana de cliente, asignación y propuesta; los detalles explican conflictos concretos.
- Centros presenta lista compacta, tarjetas opcionales, búsqueda y roles registrados. El detalle incluye todas las propiedades ya leídas y sus ventanas. No confunde adscripción con disponibilidad comprobada para una tarea.
- La simulación tiene fechas explícitas, comparación dentro del mismo ámbito, propuesta por día y restauración independiente de la reserva. La validación admite coma decimal y cuartos de hora.
- Informes comparte las mismas filas filtradas y ordenadas con el CSV y añade totales que conservan valores desconocidos. Se puede ordenar por persona, saldo pendiente, estado o fecha según el informe. Ausencias y mantenimiento muestran su efecto, sin inventar ajustes de ausencias parciales.
- Reglas y datos expone fórmulas, prioridades y exclusiones. Las incidencias se agrupan por causa, cuentan registros afectados sin duplicarlos y dirigen al registro; los identificadores técnicos quedan en un segundo nivel. El contenido de cada causa se monta solo al desplegarla, evitando crear toda la lista extensa inicialmente.
- Navegación móvil, detalles con foco restaurado y estilos limitados al módulo. Las fichas operativas existentes se abren en otra pestaña; el calendario recibe fecha y tarea.

## Reglas conservadas y ajustes deliberados

La instrucción directa de Daniel prevalece sobre la referencia histórica A10: el previsor no contabiliza viajes. El mantenimiento ocupa disponibilidad y cuenta en balances individuales, sin incorporarse a la demanda/calendarios turísticos. Las exclusiones vigentes se conservan.

El motor solo incorpora el intervalo activo del refuerzo y valida horas positivas en incrementos de 0,25. Se retira el límite arbitrario de entrada de 60 h; una persona hipotética sigue limitada por las franjas físicas y el límite semanal indicado. No se crean contratos ni asignaciones.

La comparación muestra también el número de tareas que siguen sin encaje en ambos escenarios, obtenido de las identidades que ya valida el motor. No deduce esos recuentos de una división de horas. El resumen semanal respeta las fechas de contrato al computar servicios y mantiene como desconocidos los intervalos inválidos.

La nueva propiedad `properties` del resultado expone información que el lector ya obtenía. No añade consultas, tablas ni permisos. La versión de reglas/caché cambia a `staffing-2026-09-22.1` para separar resultados antiguos.

## Validación ejecutada

| Comprobación | Resultado |
|---|---|
| `npm run test:forecast` | 34 casos de contrato; acceso de usuario/sede, caché, cancelación y lector SELECT-only correctos |
| `npm run test:forecast:ui-ux` | 14 pruebas de presentación y 16 comprobaciones de navegador correctas |
| Navegador aislado | Sin peticiones de red imprevistas ni errores JavaScript; el harness no importa el cliente Supabase |
| CSV de horas y ausencias | Descarga real en navegador de pruebas, archivo leído y contrastado con filtros, metadatos y desconocidos |
| Móvil/responsive | Siete páginas en 390, 768, 1024 y 1440 px sin desbordamiento horizontal global; agenda, mes y detalles adicionales en 390 px |
| Aumento de texto | Tamaños de texto al 200 % en las siete pantallas a 390 y 1440 px; corregido un desbordamiento del botón Filtrar. No se usa el cambio de densidad de píxeles como sustituto de aumento de texto |
| Teclado | Abrir/cerrar perfil, restauración del foco, puntos del gráfico y tabla alternativa |
| Colores | Nueve pares principales de texto/fondo superan 4,5:1; no equivale a auditoría completa de accesibilidad |
| `npm run build` | Correcto; avisos previos de Browserslist y regla CSS ajena `-: \\s` |
| Lint focalizado | Correcto en componentes, presentación, informes, lector, contrato y exportación |
| `npx tsc --noEmit --pretty false` | Correcto; el proyecto raíz no comprueba por sí solo todo `src` |
| `tsc -p tsconfig.app.json` | 101 errores anteriores fuera del previsor; salida idéntica a la línea base, sin errores nuevos |
| `tsc -p tsconfig.node.json` | Correcto |
| `git diff --check` | Correcto |

La prueba de caché ahora compara con la constante de versión vigente, en lugar de exigir la fecha histórica 2026-09-21. No se ha eliminado la comprobación de versión.

Evidencia: [resultados del navegador](ui-ux-capturas/resultados.json), [contrato y lectura](tests-contract-ui-ux.txt), [presentación](tests-presentation-ui-ux.txt), [compilación](build-ui-ux.txt), [línea base de tipos](typecheck-baseline.txt). Las capturas contienen datos sintéticos identificados, no registros reales ni una maqueta servida por la aplicación.

## Aceptación trazable

| Caso | Evidencia/estado local |
|---|---|
| A01 | Inicio con periodo, avisos y primera acción; falta medir comprensión humana en ≤30 s |
| A02 | Datos desconocidos separados de cumplimiento; sin mes cargado no aparecen ceros |
| A03 | Septiembre–noviembre → semana 19 octubre → tarea/candidatos/perfil de octubre, probado |
| A04 | El contador semanal abre el mismo conjunto de tareas sin asignar |
| A05 | Filtros de riesgo/desconocidos y perfil con fórmula y balance |
| A06 | Balance mensual separado del máximo semanal, sin mínimo semanal ficticio; prueba de contrato |
| A07 | Mantenimiento computado y franja bloqueada; informe y disponibilidad visibles |
| A08 | Encajes propuestos etiquetados y excluidos del balance real; prueba de contrato/presentación |
| A09 | Cómputo al superar el fin registrado y una sola vez; prueba de contrato, lenguaje de ejecución separado |
| A10 | Sustituido por regla vigente: viajes excluidos; prueba de contrato existente |
| A11 | Reserva semanal separada, control independiente y reparto mensual una sola vez |
| A12 | Semanas partidas y mes objetivo explícito; consulta de un mes fuera del horizonte |
| A13 | Tarea de 33 min con registro fuera de ventana: conflicto concreto y duración sin redondeo engañoso |
| A14 | Prioridad estricta del motor conservada y probada; presentación del primer nivel elegible |
| A15 | Enlace con fecha/id de tarea comprobado y ruta existente inspeccionada; falta recorrido autenticado |
| A16 | Descanso registrado separado de recomendación semanal, sin guardar; prueba de motor y vista |
| A17 | Refuerzo 15,5 h, entrada inválida, intervalo semanal, horas y tareas pendientes en ambos escenarios, restauración conservando reserva; sin escrituras |
| A18 | Sin anillo cuando el total es desconocido; series con huecos y totales por verificar |
| A19 | Vacíos por filtros de personas y centros y limpieza sin perder contexto |
| A20 | Cancelación/reintento sin datos antiguos visibles y aislamiento de caché |
| A21 | Archivos de horas/ausencias descargados, abiertos por la prueba y contrastados; filtros y orden compartidos con la pantalla |
| A22 | Capturas y verificaciones responsive, menú móvil, filtros y texto al 200 % |
| A23 | Teclado, cierre/foco, gráfico/tabla y contraste de paleta; pendiente auditoría humana accesible |
| A24 | Última tarea recibida visible, aviso de menor información futura y distinción pasado/futuro |

## Notificaciones y alcance

No hay cambios en `src/services`, `src/hooks`, `supabase`, rutas globales, asignaciones, notificaciones, configuración Vercel ni estilos globales. No se enviaron mensajes de prueba ni se escribieron registros operativos.

La prueba aislada `planningNotificationProviderTest.mjs` pasa. Dos suites generales ya están desactualizadas respecto de esta base:

- `resendSenderContractTest.mjs` intenta leer `supabase/functions/daily-staffing-forecast/index.ts`, ausente también en `3c4ae307`.
- `whatsappDeliveryPipelineTest.mjs` exige literalmente `.limit(50)`, mientras la función existente utiliza límites constantes. Tanto prueba como función son idénticas a la base.

Estos fallos anteriores no se ocultaron ni se corrigieron modificando notificaciones como parte de un trabajo de interfaz. Las pruebas locales no certifican una entrega real de correo/WhatsApp.

Archivos de producto: `ForecastWorkspaceView`, `ForecastUi`, `ForecastOverview`, `ForecastOperations`, `ForecastDetails`, `ForecastPersonTasks`, `ForecastReports`, `forecastPresentation`, `forecastReportData`, `forecast.css`, `forecastContract`, `forecastModel`, `forecastReader`, `forecastExport`, todos dentro de `src/features/staffing`. Resto: script de npm, pruebas y documentación.

## Continuación y reversión

1. Iniciar sesión en `http://localhost:8080/auth`; recorrer esta versión con registros reales, revisar los avisos por sede y contrastar al menos una persona con mantenimiento, una tarea sin asignar y una semana partida.
2. Comprobar desde los detalles los destinos de calendario/fichas con los permisos reales, sin guardar cambios de prueba.
3. Registrar prueba de comprensión humana A01, revisión visual y cualquier corrección necesaria. No atribuir a la interfaz datos todavía desconocidos en origen.
4. Antes de publicar, inspeccionar de nuevo los dos alias y su fuente; incorporar cambios de producción posteriores a la base. Los despliegues automáticos siguen desactivados.

Producción inspeccionada al inicio y antes de publicar: ambos dominios apuntaban a `dpl_2obWJESyXrh7UMLmp1Lok7di1SGV`, commit `3c4ae307`, antecesor de esta entrega. Se conserva como reversión. Ambos dominios sirven ahora `dpl_CLVWmV8aCwvSK698DKT6gTs8QoeD`, commit `28d6e670`.

Reversión local: ejecutar la base `3c4ae307` en otro checkout o revertir el commit de esta rama. No se necesita reversión de datos ni funciones, porque esta entrega no los modifica. Una publicación posterior deberá registrar su commit/despliegue y conservar el despliegue previo de ambos dominios.
