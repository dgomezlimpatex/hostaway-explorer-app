# Correcciones de la tercera revisión del previsor

Fecha: 22 de septiembre de 2026. Rama: `codex/previsor-incidencias-n01-n03`.
Base preservada: `04187abe`, posterior a la publicación `ed3bebc550d13ce31272a6903d92734a6bc3e810`.
Reglas: `staffing-2026-09-22.3`.

Estado: implementado y probado localmente; publicado después de autorización expresa en el commit `5389fc3d`. Lecturas reales contrastadas mediante SELECT y reproducción local del lector y motor. **Pendiente de recorrido autenticado en navegador.** Ver [publicación y verificación de ambos dominios](PUBLICACION_INCIDENCIAS_20260922.md).

## Encargo y alcance

Fuente del encargo: [revisión recibida](revision-incidencias-20260922.md). Las observaciones de la revisión se contrastaron con las fuentes; sus cifras no se fijan en la interfaz.

Los cambios de aplicación permanecen en `src/features/staffing`. No se han cambiado otros módulos, estilos globales, políticas, tablas, migraciones, funciones ni notificaciones. No se han enviado correos o WhatsApp ni escrito datos reales. La expansión de recurrencias es en memoria; no crea tareas.

## Evidencia por incidencia

| Caso y contexto | Antes | Resultado local y comprobación |
|---|---|---|
| N01: Asunción, octubre; Hotel SC del 19 a las 09:30–14:00 | El lector incluía tareas materializadas, pero omitía las recurrencias futuras. Perfil: 0 h futuras y 0 h de otros servicios. | 26 compromisos, 117 h futuras y 117 h de otros servicios ya incluidas en esas futuras. El día 19 aparece una vez y bloquea su franja. La ejecución del 22 de septiembre también aparece una sola vez, como materializada. |
| N01: compatibilidad histórica | Existen ejecuciones antiguas sin `execution_day`. Una lectura limitada a septiembre no descubre todo ese historial. | Se usa la fecha civil explícita cuando existe; para registros antiguos, la misma conversión de `execution_date` a Europe/Madrid del calendario. Se probaron ambas representaciones, fechas UTC del día anterior, cancelaciones y ejecuciones ya gestionadas. |
| N02: semana 19–25 de octubre; 101 Huésped de MARINA30 | Se confundía un horario registrado fuera de ventana con falta de encaje. | El registro real sigue siendo 11:00–11:33, duración 33 min y ventana 12:00–15:00. Se muestran simultáneamente «Sin asignar», «Registro por corregir» y «Propuesta disponible · sin guardar». El motor propone a Daiane a las 12:00–12:33. |
| N02: once incidencias frente a cero del simulador | El significado de las poblaciones no estaba reconciliado. | Los once registros originales tienen propuesta y no precisan capacidad adicional según el cálculo. Con todas las recurrencias incorporadas se añade un registro con datos insuficientes: **12 por revisar = 11 con encaje + 1 sin evaluar**. Quedan 0 tareas verificables sin propuesta antes y después del refuerzo de 15 h para esa semana. Los enlaces usan la misma clasificación y conservan las fechas de la simulación. |
| N03: tareas sin duración de septiembre–noviembre | Un filtro de cuatro tareas mostraba 91 tarjetas de día. | Los resultados se agrupan únicamente en fechas con coincidencias; cada tarea tiene su detalle. El calendario completo queda como acceso secundario. Fixture original: cuatro tareas, cuatro fechas, cuatro detalles. Datos reales actualizados: cuatro tareas materializadas y nueve recurrencias futuras con datos ausentes; el contador y la lista muestran 13, sin ocultar las nuevas incidencias. |
| N04: desplazamientos | La revisión no disponía de la instrucción posterior del usuario. | Se conserva la exclusión de viajes. La instrucción directa vigente es: «Creo que lo más comodo para esta previsión es no contabilizar el tiempo de viajes», seguida de la petición de retirar los viajes que aún aparecían. No se restauran los 15 minutos del plan anterior. |
| Presentación mensual y simulación | Comparativa mensual después de una lista larga; evaluación pendiente eclipsaba las horas por completar. | Indicadores → tendencia → meses → adelanto de tres días. Dos cifras de igual tamaño y enlaces separados; mes del objetivo integrado. Simulación con resultado breve y reconciliación desplegable. La reserva muestra su inclusión con aviso de redondeo, sin una suma visible contradictoria. |

La tarea recurrente sin propiedad asociada procede de la plantilla `491098be-84ab-4351-9511-6c15f5d269a6`, los viernes. Sus cuatro tareas materializadas son las del 4, 11, 18 y 25 de septiembre. Las nueve fechas futuras de octubre y noviembre se incorporan ahora. El nombre contiene «Hotel SC», pero **no se ha supuesto una equivalencia entre ese nombre y una propiedad**. Corregir la plantilla de origen requiere identificar la propiedad real; no corresponde inventarla en el previsor.

El balance de Asunción permanece «No verificable»: sus seis jornadas recurrentes de 4,5 h suman 27 h semanales, frente al máximo de 26 h de su jornada de 20 h. Se muestran las horas leídas y la incompatibilidad. Incorporar compromisos no equivale a validar sus condiciones ni a confirmar ejecución.

## Fuentes reales y límites

Se consultaron las fuentes necesarias de la sede `1e0759ec-5e63-4edd-9dad-e493c715bbba`: 1.473 tareas, 28 personas activas, 176 propiedades, cuatro recurrencias, 158 ejecuciones y sus relaciones, libranzas, ausencias y mantenimientos. Rango leído: 31 de agosto–6 de diciembre; contexto presentado: septiembre–noviembre; referencia de cómputo fijada al 22 de septiembre a las 12:00 de Madrid.

La copia completa se guarda únicamente en un archivo local ignorado por Git. [Evidencia de la sede](incidencias-datos-reales-sede.json) conserva resultados y las identidades necesarias para contrastarlos. [La primera comprobación individual](incidencias-n01-datos-verificados.json) se conserva como evidencia de alcance más estrecho; la comprobación completa incorpora además la compatibilidad histórica.

Reproducción opcional, sin red:

```powershell
node scripts/forecastIncidentsReplay.mjs .incidents-full-source.local
```

Este contraste no prueba permisos ni renderizado con una sesión real del usuario. La comparación autenticada entre calendario operativo y previsor queda pendiente. El replay completa en torno a 4,5 segundos el cálculo base de tres meses en esta máquina; esa cifra no es una medición de latencia de producción.

## Verificación

- 9 casos nuevos de negocio: recurrencias, fuentes incompletas, duplicados, fechas antiguas y clasificación de incidencias.
- 34 casos de contrato, controles de acceso/caché y cliente SELECT: pasan.
- 10 regresiones de la revisión anterior y 14 casos de presentación: pasan.
- 31 comprobaciones de navegador aislado: pasan; cero errores de navegador y cero peticiones externas inesperadas. Incluyen contador → lista → detalle, simulación, cancelación/reintento, teclado, texto al 200 % y las siete pantallas en cuatro anchuras.
- Build, comprobación TypeScript raíz y herramientas: pasan. Lint de archivos modificados: cero errores; conserva una advertencia de React Fast Refresh del arnés de pruebas.
- TypeScript de aplicación: 101 errores anteriores, exactamente los mismos que la base; ninguno nuevo ni dentro del previsor. No se presenta la aplicación completa como libre de errores de tipos.
- `git diff --check`: pasa. Sin cambios en servicios, hooks globales, integraciones, funciones o migraciones.

Resultados: [resumen técnico](incidencias-validacion.json), [negocio](tests-incidencias-negocio.txt), [contrato](tests-incidencias-contrato.txt), [regresiones](tests-incidencias-regresion.txt), [presentación y navegador](tests-incidencias-ui.txt).

## Evidencia visual

Las capturas proceden de datos sintéticos identificados como tales, sin conexión a Supabase. Verifican presentación y navegación; las cifras de negocio reales se contrastan por separado en el replay.

- [390 px](incidencias-n01-n03-capturas/incidents-forecast-390.png)
- [768 px](incidencias-n01-n03-capturas/incidents-forecast-768.png)
- [1024 px](incidencias-n01-n03-capturas/incidents-forecast-1024.png)
- [1440 px](incidencias-n01-n03-capturas/incidents-forecast-1440.png)

En el escenario controlado, el resumen mensual comienza aproximadamente en y=1.888 / 1.417 / 1.308 / 1.350, respectivamente. A 1024 px, el SVG del gráfico comienza en y=765, con el título encima. Son medidas del fixture, no comparativas pixel a pixel con los datos de la revisión ni garantías para cualquier contenido. La cabecera usa menos filas y el resumen mensual precede siempre a la lista diaria. Se conserva desplazamiento horizontal local en la tabla cuando hace falta.

No se ha realizado una certificación con lectores de pantalla. La comprobación automatizada de nueve pares de color no sustituye una auditoría completa de accesibilidad.

## Entrega y reversión

Servidor local: http://127.0.0.1:8080/staffing-forecast. Usa la aplicación real; requiere iniciar sesión. No se sirve el arnés de datos sintéticos en esa ruta.

El código de esta iteración se guarda en `5389fc3d`, sobre `04187abe`. Para revertir el código, aplicar `git revert` a ese commit en la rama de trabajo; no requiere reversión de datos. La publicación posterior conserva el despliegue anterior y documenta su restauración en el registro enlazado. Los despliegues automáticos siguen desactivados.
