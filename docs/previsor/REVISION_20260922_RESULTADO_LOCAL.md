# Corrección de la revisión de Previsión — 22/09/2026

Estado: correcciones implementadas y verificadas en local. No publicadas. Rama `codex/previsor-revision-20260922`, sobre `2fdcfe41` (documentación del despliegue de código `28d6e670`). Se conserva el diseño y los recorridos que funcionaban.

La autorización recibida fue «Aplicar las correcciones y validarlas en local». El documento recibido se conserva en [REVISION_RECIBIDA_20260922.md](REVISION_RECIBIDA_20260922.md); las instrucciones dirigidas a Hermes se trataron como especificación para contrastar, no como autorización para publicar o modificar datos.

## Reglas reconciliadas

- **R02:** se mantiene la instrucción directa de Daniel en esta conversación: «Creo que lo más cómodo para esta previsión es no contabilizar el tiempo de viajes». El requisito histórico de 15 minutos queda sustituido. Las propuestas se evalúan sin viajes y así se indica en Reglas y datos y en el desglose. No se certifican como viables bajo una regla de desplazamientos distinta.
- **Mantenimientos y otros servicios:** no forman parte de la demanda ni del calendario turístico. Tanto las tareas importadas de otros servicios como los compromisos de ficha consumen disponibilidad y cómputo individual. Se conservan en las fichas y balances, sin borrarlos ni alterar datos reales.
- **Horas del refuerzo:** se retira el paso obligatorio de 0,25 h. La regla de AGENTS.md sobre duraciones de tareas no justifica imponer ese paso al presupuesto semanal hipotético. Se admiten horas positivas finitas, con coma decimal; las duraciones reales no se redondean ni se modifican.
- Se conservan las exclusiones, la reserva del 20 %, la prioridad de candidatos, el objetivo mensual y el máximo semanal. No se modifican notificaciones ni asignaciones reales.

## Matriz R01–R13

| Caso | Causa contrastada | Corrección local | Evidencia / límite |
|---|---|---|---|
| R01 | `buildLedgers` consultaba incidencias de todo el horizonte sin acotarlas al mes. Avisos de ausencias y tareas perdían su fecha; podían bloquear capacidad en otros meses. | Los diagnósticos conservan fecha o intervalo y centro cuando se conocen. Balance, candidatos, margen y capacidad los consultan dentro de su ámbito. Fechas desconocidas siguen siendo diagnósticos sin acotar; no se inventan. | Pruebas que fallaban antes y pasan después: lectura SELECT inyectada septiembre–noviembre frente a octubre; igual balance de octubre y capacidad diaria. Se conserva el aviso en septiembre. Falta repetir los valores concretos de la auditoría con sesión real. |
| R02 | La auditoría no dispone de la instrucción directa de esta conversación. | Se mantiene la exclusión de viajes y se documenta la precedencia. | Pruebas existentes de viajes excluidos y tareas consecutivas entre edificios. No se reintroducen 15 minutos. |
| R03 | La tarjeta mostraba primero déficit confirmado y subordinaba las personas sin evaluar. | La evaluación incompleta es la cifra principal y abre su propio filtro. Déficit confirmado tiene enlace separado; mes y horas faltantes visibles. | Recorrido de navegador al conjunto «Por verificar», sin interpretar el cero como cumplimiento. |
| R04 | Selección de las primeras diez fechas del horizonte. | Trabajo desde hoy ordenado por fecha límite, con motivos locales; histórico plegado por separado; recuento y «Ver todos los días». | Prueba: primera fecha desde la referencia de consulta, diez filas iniciales, ampliación y archivo histórico independientes. No existe prioridad fija del domingo. |
| R05 | El estado miraba avisos globales antes de comprobar si había tareas locales. | Estados separados: sin registros, datos incompletos, sin encaje, asignaciones incompatibles y encaje propuesto. Se retira el enlace a cero candidatos. | Semana de centro vacío: siete días «Sin tareas registradas», sin advertencias de tareas de otro centro. Mensaje sobre reservas futuras pendiente de recepción. |
| R06 | No había desglose. Además, el agregado inicial añadía compromisos pagados a la capacidad después de descontarlos. | Capacidad basada en equipo real y compromisos registrados; desglose de franjas, descansos, ausencias, servicios, otros centros, incertidumbre y ajuste semanal, con consulta por persona. Servicios fuera de demanda turística. | Pruebas: presupuesto semanal consumido por mantenimiento deja cero capacidad; descuentos por persona reconcilian; franjas superpuestas se descuentan una sola vez. El reparto diario sigue siendo referencia, no cobertura comprobada. |
| R07 | El trabajador hipotético entraba en el reparto aritmético de capacidad. | La serie de equipo excluye al refuerzo. Serie independiente de trabajo realmente encajado por el refuerzo. | Simulación sin encajes conserva todas las capacidades diarias y destaca «no aporta encajes adicionales». |
| R08 | Equipo y refuerzo se intentaban intercalados; el resultado quedaba lejos del control y la lista conservaba el orden de origen. | Primero se completa el equipo; luego el refuerzo intenta el residual. Se conservan propuestas y libranzas del equipo. Comparación inmediata, conjuntos por identidad reconciliados, conflictos del registro separados y propuestas por fecha/hora. | Pruebas de conservación del plan base y ecuación antes − mejoras + pérdidas = después; navegador comprueba orden de tres franjas y ubicación del resultado. No se deducen tareas de una división de horas. |
| R09 | Un punto parcial se unía a semanas completas. | Puntos huecos sin trazos a semanas vecinas, fechas incluidas y número de días visibles; mismos valores en tabla. | Navegador comprueba puntos parciales y ausencia de segmentos que los unan. No se duplican días fuera del horizonte. |
| R10 | La suma completa desconocida ocultaba las duraciones válidas del mismo día. | Subtotal sumado desde tareas válidas, número de duraciones ausentes y acceso exacto al conjunto bloqueante; total final pendiente. Reserva sobre ese subtotal expresamente etiquetada. | Caso de 33 minutos válidos y una duración desconocida: subtotal 33, total desconocido, filtro devuelve solo la tarea bloqueante. |
| R11 | Avisos sin delimitación y recuentos de entidades irrelevantes; muchas salidas por registro. | Filtrado por periodo/centro y ámbito común de sede identificado; prioridad de bloqueos de lectura/carga/balance; fechas próximas primero dentro de causa; acción principal para duraciones y por registro, referencias secundarias y ceros irrelevantes ocultos. | Pruebas de centro vacío, fecha y acción de duración, recuentos afectados y despliegue diferido del contenido. Incidencias sin fecha siguen visibles con su limitación. |
| R12 | El balance incluía tareas no turísticas, pero Disponibilidad solo listaba servicios recurrentes y ausencias. | Disponibilidad muestra también tareas importadas de otros servicios, con horario y enlace a detalle; se distinguen de compromisos de ficha. Filtrado por mes y fechas de contrato. | Prueba: el mismo servicio de una hora aparece en balance y disponibilidad, ocupa su franja y no aumenta demanda turística. |
| R13 | Objetivo ligado al mes inicial/lunes y tabla sin balances de equipo. | Selector explícito del mes del objetivo, enlaces a ambos meses de semanas partidas y riesgo/evaluación por cada mes en resumen. Tarjetas mensuales en móvil. | Navegador selecciona octubre desde semana partida y abre ambos balances; tres tarjetas con acción visible en móvil. Mes fuera del horizonte conserva consulta explícita, sin ceros ficticios. |

## Composición y móvil

Se conserva la paleta, tipografía y estructura del módulo. Menos márgenes y repetición antes de los resultados; reglas estables dentro de «Cómo se calcula». Tendencia completa adaptada al ancho, etiquetas espaciadas y tabla alternativa. En móvil los meses son tarjetas con acciones visibles. Decimales españoles, nombre del día, nombre de sede sin truncado forzado, Escape en menú y acceso a próximos tres meses.

Capturas con **datos sintéticos identificados**, generadas por el navegador aislado: [escritorio](revision-20260922-capturas/revision-forecast-1440.png), [móvil](revision-20260922-capturas/revision-forecast-390.png). No son capturas de registros de producción ni datos insertados en la aplicación.

## Verificación

- 34 pruebas de contrato existentes y acceso de usuario/sede, caché, cancelación, reintento y lector SELECT-only.
- 10 pruebas nuevas de coherencia y cálculo: `npm run test:forecast:revision`.
- 14 pruebas de presentación y 27 comprobaciones de navegador: `npm run test:forecast:ui-ux`.
- Siete pantallas en 390/768/1024/1440 px; texto al 200 % en móvil y escritorio; recorridos adicionales de esta auditoría. Nueve pares principales de contraste revisados. No equivale a auditoría completa con lector de pantalla.
- Build y lint focalizado correctos. Typecheck raíz y herramientas correctos. El chequeo completo de aplicación conserva los mismos 101 errores previos ajenos al módulo; no añade errores en el previsor.
- Sin cambios en `src/services`, `src/hooks`, `supabase`, cliente Supabase, rutas globales, estilos globales, lockfile o Vercel. No hay nuevas consultas ni escrituras de datos reales.

Evidencia: [coherencia](tests-revision-coherence.txt), [contrato y lectura](tests-revision-contract.txt), [presentación y navegador](tests-revision-ui-ux.txt), [capturas y recorridos](revision-20260922-capturas/resultados.json), [compilación](build-revision-local.txt), [tipos](typecheck-revision-local.txt).

## Pendiente y revisión

El alcance autorizado es local. Producción continúa en el despliegue anterior. La aplicación local está en `http://127.0.0.1:8080/staffing-forecast`; requiere la sesión habitual para contrastar con datos reales. La prueba de lectura inyectada reproduce la causa de R01, pero no se atribuyen a producción las cifras de fixtures ni se declara verificado el recorrido autenticado de la auditoría. También queda pendiente la prueba humana de comprensión.

Para una publicación posterior: volver a inspeccionar ambos dominios, preservar cualquier cambio nuevo y publicar solo tras autorización. Reversión local: volver a la base `2fdcfe41` desde otro checkout o revertir el commit de esta corrección. No existen cambios de base de datos ni funciones que revertir.
