# Segunda optimización de lecturas de propiedades — 19/10/2026

Petición: revisar qué queda por optimizar, medir antes/después y conservar funciones y trabajo sin cobertura. Base: 871bdeef13c7d3da7c0b56e0b3904fb821d2cb35, publicada en ambos dominios mediante dpl_79fcMLZ3ynh3oz4soe4bz7F2NJMp.

## Revisión y alcance elegido

La primera mejora redujo las lecturas de propiedades de una por tarea a una por propiedad distinta. Aún quedaba ese segundo recorrido: cinco propiedades distintas suponían cinco peticiones. Esta entrega agrupa la preparación semanal en lotes de hasta 25 IDs únicos, ligados al mismo ciclo, usuario, sede y trabajadora. Solo se inicia un lote si una tarea necesita cargarlo.

Conserva el filtro de sede y todos los campos anteriores. El ID adicional sirve para asociar correctamente las respuestas, aunque lleguen desordenadas, y se retira del paquete final. Cada tarea sigue guardando su parte, plantilla y propiedad en su propia entrada de IndexedDB. Las lecturas directas siguen frescas; terminar/cancelar descarta la reutilización y los errores permiten un nuevo intento. No se modifican permisos, SQL, esquema, guardado, fotos, finalización ni sincronización.

No cambia la pantalla de edición de propiedades, sus guardados en segundo plano ni el catálogo general. No amplía el tiempo de frescura de ninguna caché. Un lote puede incluir propiedades de otras tareas del mismo ciclo cuyo paquete ya estuviera fresco; se limita a 25 y no incluye propiedades ajenas a esa preparación.

## Medición reproducible

El mismo arnés ejecuta el cargador real de la base publicada y el código nuevo, con 20 tareas y 5 propiedades. No usa Supabase productivo.

| Lectura | Antes | Después |
| --- | ---: | ---: |
| Propiedades | 5 | 1 |
| Partes | 20 | 20 |
| Asignaciones de checklist | 20 | 20 |
| Catálogo de plantillas | 1 | 1 |
| Total | 46 | 42 |

Son un 80% menos de peticiones de propiedades y un 8,7% menos de peticiones totales en ese escenario. No se convierte este recuento en una mejora de tiempo SQL ni de velocidad de toda la app. Se verifican además límites de 1, 25, 26 y 73 propiedades: 1, 1, 2 y 3 peticiones respectivamente. Una preparación enteramente satisfecha por React Query no necesita iniciar el lote.

```powershell
node scripts/cleanerPropertyPreparationTest.mjs --batch --baseline-current
node scripts/cleanerPropertyPreparationTest.mjs --batch
node scripts/cleanerPropertyBatchTest.mjs
node scripts/cleanerPropertyPreparationBrowserTest.mjs
```

El modo baseline-current carga el archivo original de 871bdeef con git show; solo es necesario para la comparación local. Las pruebas normales de CI no dependen de historia Git ni de red. PROPERTY_PREPARATION_RESULT permite guardar el resultado en JSON fuera del repositorio.

## Qué sigue pendiente

Consulta remota de solo lectura de pg_stat_statements, agrupada por queryid para no duplicar roles/base de datos. Son medias históricas acumuladas, incluyen versiones anteriores y no equivalen a la latencia HTTP ni a una comparación de despliegues:

| Consulta | Llamadas acumuladas | Media ponderada SQL |
| --- | ---: | ---: |
| Propiedad individual para preparación | 22.234 | 167,80 ms |
| Catálogo completo de propiedades y cliente | 425 | 772,89 ms |
| Tareas por asignación con propiedad/partes | 6.437 | 600,56 ms |
| Tareas por trabajadora con propiedad/partes | 6.414 | 506,31 ms |

El catálogo completo y los joins de tareas necesitan medir planes con el contexto de acceso real y el volumen transferido antes de decidir cambios. El índice primario de propiedades y los índices de sede y cliente ya existen; no hay evidencia para añadir otro índice automáticamente. Hay varias políticas con subconsultas, pero este análisis no demuestra cuál causa la demora ni autoriza modificarlas. No se cambió ninguna política.

En la preparación aún quedan 20 lecturas de partes y 20 de asignación de checklist. Se conservan para no mezclar optimizaciones sin su propia medición y regresión. La próxima evaluación puede estudiar esas lecturas por separado. No se afirma que esta entrega reduzca las medias históricas anteriores; falta una ventana de uso productivo comparable de la nueva forma de consulta.

## Verificación

- Lotes acotados, filas invertidas asociadas por ID, conservación de campos/ceros/nulos, propiedad ausente y desconocida, independencia de partes/checklists, nuevas cuentas/sedes/ciclos, errores HTTP y de red, reintento, cancelación y funciones retenidas tras terminar.
- Hook real en Chromium móvil con IndexedDB: 20 paquetes completos con una petición de propiedades. Comprueba el contenido de las 20 entradas, cambia de cuenta/sede, recarga sin cobertura y abre la tarea sin peticiones externas.
- Flujo completo de limpiadoras con backend interceptado: borradores, notas, checklist, fotos y sus bytes tras Escape, recarga, recuperación de cámara, finalización sin cobertura y envío posterior sin duplicados. Conserva conflicto, reasignación y separación de cuentas.
- Regresiones de preparación, finalización, fotos y Escape. Build y lint focalizado correctos; tipos raíz y Node correctos. Aplicación con los mismos 130 errores heredados antes/después, sin diagnósticos nuevos.

Todas las escrituras de pruebas se limitan a datos sintéticos en el navegador. Las mediciones remotas consultan estadísticas y metadatos sin datos personales. No se ejecutaron escrituras productivas, SQL de cambios ni despliegues Supabase. Chromium con tamaño móvil no sustituye una comprobación física en todos los modelos de teléfono.

Referencia de API: [filtro IN de Supabase](https://supabase.com/docs/reference/javascript/in). La incidencia histórica de Escape del informe anterior quedó resuelta en PR168 y publicada con PR169; el flujo completo ahora pasa.
