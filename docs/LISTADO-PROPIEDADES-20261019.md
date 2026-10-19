# Listado general de propiedades — 19/10/2026

Petición: analizar y optimizar el listado, medir antes/después y conservar funciones y trabajo sin cobertura. Base publicada: 5c6940189d0d9dfae06caa4b295e2c0d53d1a93d / PR170, deployment dpl_DXYcBwAfMcux6jeSyrAQajESActi.

## 1. Descargar únicamente los datos que devuelve el servicio

getAll pedía las 66 columnas de properties. mapPropertyFromDB solo usa 47; las restantes se descartaban antes de entregar los datos a cualquier consumidor. Ahora la selección enumera esas 47 columnas. Conserva la relación de cliente con sus tres campos, el filtro de sede, el orden descendente por created_at y los 50 campos que entrega el mapper a la aplicación. No se divide la ficha ni se retrasa la descarga de campos necesarios para editar.

La prueba del servicio real compara el resultado completo antes/después, incluyendo nulos, ceros, false, cliente como objeto/array/ausente, herencia de estado/lavandería, cambio de sede y errores. Si el mapper incorpora un campo nuevo sin añadirlo a la selección, la prueba falla. Los consumidores compartidos de getAll siguen recibiendo el mismo objeto Property. No cambian getById, getByClientId ni los métodos de escritura.

Medición remota de solo lectura: la misma instantánea de 187 propiedades, con la misma relación de cliente, comparando SELECT completo y SELECT explícito. Solo se devolvieron agregados, sin contenido ni datos personales:

| Métrica | Antes | Después |
| --- | ---: | ---: |
| Columnas de properties | 66 | 47 |
| Campos Property entregados al consumidor | 50 | 50 |
| Bytes de representación JSON agregada | 400.435 | 312.827 |

Reducción de 87.608 bytes, un 21,88%, en esa representación comparable. No es una medición de bytes HTTP comprimidos, ni de latencia autenticada, ni de velocidad global. El servicio mantiene una petición por carga y las políticas SQL existentes.

## 2. No consultar limpiezas mientras la pestaña está cerrada

La ficha solicitaba el historial de limpiezas al montarse, aunque estuviera mostrando Ficha, Consumos, Actividad o Checklist. Ahora llama al mismo hook con IDs únicamente cuando la sección de la URL es Limpiezas. No cambia la consulta, el cálculo de fechas ni su caché de cinco minutos.

Medición en Chromium, con página, servicio, mapper, React Query y hook de fechas reales, tanto a 1440 como a 390 px. Cada ejecución usa un contexto nuevo y datos sintéticos:

| Al abrir la ficha en Ficha | Antes | Después |
| --- | ---: | ---: |
| Peticiones del listado | 1 | 1 |
| Peticiones de historial de limpiezas | 1 | 0 |

Al abrir Limpiezas se realiza una petición y se muestran correctamente última/próxima limpieza. Volver a la pestaña reutiliza la caché fresca. Se verifican los enlaces directos con propertyId y seccion=limpiezas, errores y Reintentar. La comparación baseline del navegador carga el PropertyDetailPanel original de 5c694018; así mide este segundo cambio por separado de la selección de columnas.

## Regresiones y límites

- Directorio real en escritorio/móvil: búsqueda sin distinguir acentos, ausencia de coincidencias, filtro de estado, cliente y sin cliente, limpiar filtros, fechas, enlace directo y reintento; tráfico externo bloqueado.
- Edición real con CSS: Ficha/Consumos/Checklist, Guardar cambios, Descartar, validación, fallos, guardados parciales, cambio inmediato de propiedad, dos guardados en segundo plano y recuperación de error. Se actualizó únicamente el aislamiento del módulo Actividad en este arnés antiguo: sus importaciones nuevas bloqueaban la compilación de la prueba; no se retiraron comprobaciones de edición.
- Actividad se probó además con su propio arnés: filtros, carga progresiva, navegación, errores parciales, cambio de propiedad/sede, permisos simulados, teclado y móvil. Se fijó la fecha del navegador a 17/10/2026, la fecha de sus fixtures: el test esperaba 18/09 como inicio de ventana y fallaba al ejecutarse el 19/10. No se cambió el cálculo de fechas de la aplicación.
- Flujo completo sin cobertura con backend interceptado: borradores, notas, checklist, bytes de fotos tras Escape, recarga, cámara, finalización, reintentos sin duplicar fotos, conflictos, reasignación y separación de cuentas. IndexedDB y sincronización permanecen intactos.
- Build, lint focalizado, tipos raíz y Node correctos. Tipos de aplicación: mismos 130 errores heredados antes/después, sin diagnósticos nuevos.

Las pruebas usan datos sintéticos y escrituras locales simuladas. Las consultas remotas son solo SELECT de metadatos y agregados. Sin SQL de cambios, RLS, permisos, autenticación, datos reales, PMS, comunicaciones ni despliegues Supabase. No se añadió caché ni se amplió su frescura. Las verificaciones en Chromium móvil no sustituyen pruebas físicas en todos los dispositivos.

Sigue pendiente medir el plan de ejecución del listado con un contexto autenticado representativo. Se conserva la relación de cliente y sus políticas; estos cambios no prueban que se haya resuelto toda la demora SQL histórica. El historial se evita en la carga inicial, pero conserva su consulta original cuando el usuario lo solicita.

## Reproducción

```powershell
node scripts/propertyDirectoryProjectionTest.mjs --baseline
node scripts/propertyDirectoryProjectionTest.mjs
node scripts/propertyDirectoryBrowserTest.mjs --baseline
node scripts/propertyDirectoryBrowserTest.mjs
node scripts/propertyInlineEditBrowserTest.mjs
node scripts/propertyActivityBrowserTest.mjs
node scripts/propertyActivityTest.mjs
node scripts/propertiesUiContractTest.mjs
```

Los modos baseline requieren la historia Git y se usan para la comparación local. Las pruebas normales de proyección/directorio se construyen sin dist ni conexiones externas. La prueba de edición con estilos y el flujo completo sin cobertura se ejecutan después de build.
