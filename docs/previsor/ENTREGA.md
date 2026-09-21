# Entrega del previsor — 21 de septiembre de 2026

## Estado y alcance

Implementación local en `codex/previsor-correccion-20260921`. No se ha publicado, enviado a GitHub, aplicado una migración ni escrito datos en Supabase. La autorización de implementación del usuario sustituye la pausa del plan; no autoriza publicación.

Las siete páginas comparten lectura, contexto y motor. La raíz y el acceso Previsión usan el mismo componente. Los perfiles, tareas, centros, candidatos y cinco paneles de configuración permanecen dentro de `/staffing-forecast`. Las simulaciones son memoria/URL local y nunca asignaciones reales.

**Probado localmente:** contrato, lectores, aislamiento de contexto, permisos de entrada, cálculos cancelables, regresiones, compilación, lint focalizado y recorridos visuales con datos sintéticos. **Pendiente:** QA de esta versión con sesiones reales de los roles y sedes disponibles, revisión visual final del usuario y publicación autorizada. No se certifica identidad píxel a píxel ni se usa el build como prueba de cobertura operativa.

## Procedencia y preservación

- El checkout original `hostaway-explorer-app` está retirado y se conserva sin publicar.
- Clon nuevo de `main` canónico: `c1c538d8`, sin módulo de personal. Rama remota posterior recuperada: `feature/staffing-redesign-20260918`, `d45ab777`.
- Ambos dominios de producción servían `dpl_AZDBK5KJfxVY4yyQQvqpewj4Hi1w`, URL `gestionlimpatex-boap9qlp5-limpatex.vercel.app`. Metadatos: Hermes, rama `feature/operational-screens-20260918`, SHA `a9a1becfb27630e3e896068579da153e53979399`, árbol modificado. Ese SHA no estaba disponible en Git.
- Se recuperaron los archivos fuente publicados mediante API de lectura de Vercel, comprobando SHA1. Respaldo externo: `C:\Users\danig\Downloads\previsor-production-recovery-20260921`. Se excluyó el estado temporal de Supabase.
- Base reconciliada y conservada en commit `017b2192`. Los cambios sustantivos del despliegue eran rutas y pantallas del previsor; otras diferencias eran finales de línea.
- Se conserva `git.deploymentEnabled: false`. No se modifican protecciones ni el flujo de publicación de Hermes.
- Entorno: Node 22.14.0, npm 11.6.0; instalación mediante `npm ci`.

## Fuentes y autoridad

1. Acuerdos del usuario y plan autorizado: requisitos funcionales y límites de esta entrega.
2. [Documento original de Hermes](referencias/plan-hermes-original.md): diagnóstico y 22 casos, no autorización para escrituras o publicación.
3. [Conversación compartida](https://chatgpt.com/s/cx_6ab0e01c016081919cfbecbd54a95d7c): notas y cuatro imágenes originales conservadas en `referencias/`.
4. Fuente publicada recuperada y observaciones del navegador: evidencia de implementación anterior, no sustituyen las reglas acordadas.

La disponibilidad se deduce de jornada, libranzas, ausencias y otros servicios, según la conversación. No se exige rellenar el calendario antiguo de disponibilidad. La flexibilidad del motor no constituye un horario laboral real guardado. Contratos parciales sin regla de prorrateo suficiente y ausencias parciales sin equivalencia verificable producen diagnóstico, no un objetivo ajustado inventado.

## Matriz de pantallas y aceptación

| Pantalla | Fuente visual | Implementación y comprobación |
|---|---|---|
| Inicio | Lámina siete páginas | Cuadrícula compacta, seis indicadores distintos y cuatro accesos; destinos filtrados internos. |
| Previsión | Resumen + semana | Área turquesa, reserva diferenciada, capacidad, cuatro indicadores, avisos laterales; tabla mensual natural y barras semanales; mismos resultados que Equipo y Turnos. |
| Equipo | Lámina | Tabla, filtros, objetivo, computadas, futuras, faltantes; perfil interno, 0 h visible, estados desconocidos explícitos. |
| Turnos | Lámina | Timeline, controles de día/semana/mes y filtro; subfilas independientes, detalle exacto, asignación real separada de propuesta. |
| Centros | Lámina | Tarjetas de todos los centros, roles, filtros y detalle; dificultad y cobertura separadas; imagen sustituta sin inventar foto. |
| Informes | Lámina | Indicadores, área y anillo; horas y ausencias, exportación CSV del filtro visible; diferencias de partes no disponibles sin fuente validada. |
| Configuración | Lámina | Cinco opciones originales; paneles de consulta con valores/fuentes, sin controles de guardado. |
| Candidatos | Imagen candidatos | Resumen de tarea y lista de primer nivel elegible; intervalo completo, necesidad mensual, perfil interno. |
| Simulación | Contrato del usuario | Solo horas semanales; base/equipo existente primero, refuerzo hipotético después, intervalos factibles y residual; restauración completa. |

Las capturas de `capturas/` usan exclusivamente fixtures sintéticos y no representan registros de producción. [Comparativa visual](comparativa.html) reúne originales y resultados. Se revisaron las siete páginas en escritorio y a 320, 375 y 768 px; los JSON de cada ancho registran ausencia de desbordamiento horizontal del documento. Las tablas y el timeline tienen desplazamiento propio.

### Diferencias intencionales respecto a los ejemplos

- Sidebar oscuro común tomado de la lámina de siete páginas; detalle de gráficos y candidatos tomado de las imágenes individuales.
- Totales por mes natural, cifras calculadas y cantidad real de registros; no se reproducen números ficticios de las maquetas.
- Timeline de 24 horas para no ocultar servicios fuera de la ventana turística. Los nombres completos y horarios también están disponibles en la tabla y el detalle.
- Sustitutos de imagen y métricas no disponibles cuando no existe fuente validada; no se inventan fotos, rentabilidad, dificultad o partes.
- Paneles internos de consulta sustituyen enlaces globales o controles de edición de los ejemplos.
- La reserva semanal no se convierte en tareas o carga diaria. La cobertura requiere encaje individual, nunca solo un saldo positivo.
- Datos del gráfico desplegables, avisos de calidad y fuente/fecha de lectura permiten interpretar resultados desconocidos.

## Contrato y arquitectura

`forecastContract.ts` define contexto y versión `staffing-2026-09-21.1`; `forecastReader.ts` normaliza fuentes autorizadas con el lector existente; `forecastModel.ts` produce un único resultado; `forecastWorker.ts` ejecuta el cálculo sin bloquear la interfaz y `forecastCompute.ts` cancela terminando su worker privado. La vista solo representa resultados y genera enlaces internos.

Las claves de lectura incluyen usuario, sede, rango y reglas. El cálculo añade fecha de lectura, contexto completo y refuerzo. Cambio de contexto, cancelación y errores no dejan resultados anteriores como si fueran actuales. El lector pagina, deduplica, conserva diagnósticos y no importa operaciones de escritura. No se añaden tablas/RPC ni permisos. Los componentes anteriores se conservan como código no usado por estos recorridos para no alterar otros consumidores ni borrar pruebas históricas.

Reglas: fechas civiles Europe/Madrid, lunes a domingo, objetivo semanal × 4,345 por mes; límite semanal 130 % compartido entre centros; duración de la propiedad sin suplemento; tareas indivisibles y ventanas completas; fin registrado pasado computa una vez; ausencias y otros servicios bloquean; viajes 15/0 minutos sin crédito mensual ni viaje inicial/final; reserva solo turismo 20 %; exclusión NOT COUNT y capacidad de 0 h; prioridades estrictas y necesidad mensual; reales y propuestas separadas.

El planificador es determinista y usa encaje secuencial y propuesta revisable de libranza. Un resultado sin encaje **no demuestra una contratación mínima global**: se identifica como pendiente de encaje, conservando conflictos e incertidumbres. Límite defensivo: 10.000 tareas/100 personas; entrada mayor se diagnostica. Refuerzo hasta 60 h semanales en incrementos de 0,25 h, sin domingo libre impuesto.

## Correspondencia de los 22 casos de Hermes

Los números de prueba corresponden al orden de `scripts/forecastContractTest.entry.ts`.

| Hermes | Cobertura |
|---|---|
| 1 contrato 15 h | 1 |
| 2 mantenimiento, turismo, viajes | 4, 31, 32 |
| 3 fin pasado no completado | 5 |
| 4 sin asignar | 6 |
| 5 ventanas y solapes | 7, 17, 18, 24 |
| 6 viaje entre edificios | 4, 8 |
| 7 propiedades independientes | 8 |
| 8 reserva turismo | 9 |
| 9 reserva entre meses | 10 |
| 10 vacaciones sin doble descuento | 3, 23 |
| 11 libranza flexible | 19 |
| 12 prioridad estricta | 12 |
| 13 capacidad compartida | 11 |
| 14 objetivo mensual | 1, 2, 6 |
| 15 refuerzo factible | 15 |
| 16 fuentes incompletas | 14, 18, 23, 28, 30 |
| 17 cambio de sede | 16 + forecastAccessTest + forecastQueryTest |
| 18 filtro centro | 25 |
| 19 mes frontera | 10 |
| 20 enlaces contextuales | 16 + recorrido de fecha/tarea en navegador |
| 21 reserva separada | 9, 10, 15 |
| 22 cancelación/reintento | 22, 33, 34 + forecastQueryTest |

Casos adicionales: personas de 0 h, exclusiones, lectura inyectada, CSV seguro, prorrateos no verificables, volumen de seis meses, sustituciones sin mutar asignaciones, tareas históricas, servicios externos y aborto del cálculo.

## Validación y límites de evidencia

- `npm run test:staffing`: pasa la suite completa, incluidos 34 casos nuevos de contrato y las regresiones conservadas; cero fallos.
- `npx eslint` sobre archivos modificados del módulo, página y scripts nuevos: pasa.
- `npm run build`: pasa; worker generado como recurso independiente.
- `npx tsc --noEmit --pretty false` y `npx tsc -p tsconfig.node.json --noEmit --pretty false`: pasan.
- `tsc -p tsconfig.app.json`: 101 errores preexistentes fuera del cambio. Contraste con worktree separado en `017b2192`: mismo conjunto, sin errores añadidos por el previsor. El comando raíz no sustituye esta comprobación explícita.
- Navegador: siete páginas, enlaces internos, filtros, tarea candidata exacta, simulación y restauración, fecha de Turnos, panel de configuración, cierre Escape y devolución de foco; carga/error sin cifras antiguas, vacío como sin demanda. Gráficos con alternativa tabular.
- Lectores inyectados y fixtures sin red verifican la ausencia de escrituras y separación de contexto. **No prueban RLS real ni permisos efectivos del backend.** La aplicación conserva las restricciones existentes de administrador/responsable.
- No se ha realizado certificación WCAG ni recorrido con lector de pantalla real. No hay QA autenticada de esta nueva versión con datos reales ni verificación en producción.

## Revisión y reversión

Ejecutar `npm run preview:forecast` y abrir `http://127.0.0.1:8091/staffing-forecast/screens/forecast?month=2026-10&horizon=1&week=2026-10-05`. Esta revisión aislada no importa Supabase ni cambia la autenticación del producto. Para reproducir las pruebas: `npm ci`, `npm run test:staffing`, comandos de tipos y build anteriores.

Inventario: contrato, lector, motor, worker/cancelación, exportador, vista y CSS dentro de `src/features/staffing`; sustitución del contenedor y raíz del previsor; scripts de pruebas/preview y entradas npm; documentación, originales y capturas. Ningún estilo global, política, función o migración forma parte del commit de implementación.

Para revertir código: revertir el commit de implementación en esta rama, conservando `017b2192` como base recuperada. No hay datos o esquema que deshacer. No se ha cambiado ningún despliegue.

La publicación es un paso separado: resolver el relevo Hermes, volver a inspeccionar la producción y preservar novedades, probar el commit exacto, obtener autorización específica, desplegar y verificar ambos dominios. Si hubiera regresión, restaurar el despliegue anterior en ambos alias. Nunca aplicar migraciones históricas o desplegar funciones en bloque.
