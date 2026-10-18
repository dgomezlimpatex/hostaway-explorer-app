# Medición de rendimiento — APP GESTIÓN LIMPATEX

Fecha: 19/10/2026, Europe/Madrid. Base: `95568fdc683f9cd5b7fa06fc33709f102417708d`.
Antes de modificar código se comprobó que ambos dominios canónicos servían
`dpl_BSkrEo2tLyLzxajBLTCaAdPavRfN`, READY, con ese commit y huella de fuente
`5014607d11a5766fc2d644cf84f28e99f4df76054b57d73fe1214471c6f9c82e`.
El índice y los archivos pendientes del checkout principal se conservaron.

## Resultados antes y después

| Optimización y escenario repetible | Antes | Después |
| --- | ---: | ---: |
| Columna de 150 trabajadores; montaje y 20 cambios ajenos del padre | 21 renders | 1 render |
| Ausencias; misma selección reordenada y con IDs repetidos | 9 lecturas | 3 lecturas |
| Stock de 20 edificios con un producto por trastero | 40 lecturas | 2 lecturas |
| Galería de 60 fotos; viewport 1200 × 800, sin scroll | 60 imágenes solicitadas | 33 imágenes solicitadas |
| Dependencias JS estáticas de informes de logística, gzip | 602 836 bytes | 332 658 bytes (−44,8%) |
| Dependencias JS estáticas del detalle de preparación, gzip | 487 361 bytes | 217 188 bytes (−55,4%) |

Las medidas de renders, lecturas e imágenes se obtuvieron en Chromium 149 con
componentes y hooks reales y fixtures sintéticos; todos los accesos externos se
interceptaron. Las cantidades de imágenes dependen de la distancia de precarga
del navegador: no representan bytes ahorrados en toda una sesión ni una mejora
de LCP. Se comprobó que la última imagen se carga al hacer scroll.

Los tamaños proceden de dos builds de producción Vite con manifest. Se recorre
el grafo de imports estáticos y se comprime cada archivo con gzip; no se suman
imports dinámicos. Esto mide dependencias de entrada a esas rutas con caché fría,
no todo el JavaScript transferido en una sesión. Excel y PDF se descargan cuando
se usan. La entrada del dashboard no tiene una reducción significativa:
393 130 → 393 153 bytes gzip. No se declara una mejora global del arranque.

## Cambios y comprobaciones

- `WorkersColumn` usa la comparación normal de props de `React.memo`. Se probó
  también que cambiar una trabajadora sí vuelve a renderizar y actualiza su nombre.
- La clave de ausencias normaliza el conjunto de IDs. Se mantienen los 30 segundos
  de frescura existentes; cambio de día e invalidación explícita siguen consultando.
- El lector de stock agrupa edificios en lotes de 100 y pagina de 500 en 500.
  Conserva filtros de productos y trasteros activos, errores y edificios sin stock.
  Se verificaron errores de ambas consultas, trasteros duplicados, conjunto vacío,
  y 1201 niveles para evitar truncamientos por el límite de respuesta de la API.
  No se modificaron cantidades, cálculos, políticas, SQL ni funciones remotas.
- Los dos exportadores de logística cargan `xlsx` y `jspdf` bajo demanda, dentro
  del manejo de errores existente. Cuatro descargas reales pasaron: Excel y PDF
  de informes y de preparación. Se verificaron contenido del libro, cabecera PDF
  y reutilización de cada módulo entre ambos exportadores.
- Las miniaturas de galería usan carga diferida y decodificación asíncrona.
  Se conserva la carga inmediata de la foto abierta en el diálogo.
- Fuentes: ya se sirven localmente, con cuatro pesos latinos y `font-display: swap`.
  El HTML de entrada utiliza un script de módulo. No se cambian sin evidencia de
  ahorro. No se instalaron dependencias ni herramientas de seguimiento.

Build correcto; comprobación raíz de TypeScript correcta. La comprobación real de
aplicación conserva 130 errores heredados, sin nuevos; proyecto Node, sin errores.
Lint focalizado conserva 9 errores heredados, sin nuevos. Pasan además las pruebas
existentes de agenda de edificios y ocupación de supervisión.

## Consultas lentas en producción: diagnóstico de solo lectura

Snapshot agregado de `pg_stat_statements`, acumulado desde
`2026-10-05T13:20:52.920368Z`. No se reiniciaron estadísticas ni se leyó contenido
de reservas o datos personales. Los tiempos son de ejecución de Postgres;
no incluyen red y no prueban un problema de índices por sí solos.

| Huella de consulta | Forma normalizada | Llamadas | Media | Máximo |
| --- | --- | ---: | ---: | ---: |
| `-6408495100201540308` | Tareas por asignación, rango de fechas y sede, con propiedades y reportes | 6239 | 596,63 ms | 6444,59 ms |
| `8898570699531632019` | Tareas por limpiadora principal, fechas y sede, con propiedades, reportes y asignaciones | 6219 | 503,80 ms | 6199,47 ms |
| `-7820214082300997529` | Detalle de propiedad por ID y sede | 21512 | 165,66 ms | 4472,58 ms |

Se comprobaron índices existentes para `task_reports.task_id`,
`task_reports.cleaner_id`, `(task_id, cleaner_id)`, asignaciones por trabajador/tarea,
stock por almacén y trasteros por edificio. No se propone crear índices duplicados.
La alta frecuencia de detalle de propiedad es una pista de repetición; las
estadísticas agregadas no demuestran que pertenezca a un único flujo N+1.
El N+1 de stock sí se identificó en el código y se eliminó con la medición local.

Pendiente para reducir los tiempos SQL: capturar planes y trazas del flujo afectado
con su rol efectivo y parámetros representativos, revisar RLS y selectividad,
probar la hipótesis en aislamiento y comparar ejecución antes/después. No se ha
acreditado una mejora SQL ni alterado el backend en esta entrega. Sentry y el MCP
de Chrome DevTools no están conectados en esta sesión; se utilizó Playwright.

## Reproducción

```powershell
node scripts/performanceBrowserTest.mjs
node scripts/performanceStockTest.mjs
node scripts/performanceExportsTest.mjs
node scripts/supervisionBuildingAgendaTest.mjs
node scripts/supervisionOccupancyTest.mjs
node scripts/performanceBundleMeasure.mjs resultado-bundle.json
```

Para obtener las cantidades de una base anterior sin exigir los resultados
optimizados, los dos primeros arneses admiten `--measure`. Para comparar, usar
el mismo arnés sobre cada revisión aislada. `PERFORMANCE_RESULT` permite guardar
las medidas en un archivo externo al repositorio. Las pruebas locales no equivalen
a medir una sesión autenticada de producción ni permiten afirmar una mejora de INP/LCP.
