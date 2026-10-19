# Preparación de propiedades: medición y verificación

Petición: aplicar la primera mejora del análisis SQL, reutilizando datos de
propiedades durante la preparación de tareas para limpiadoras.
Base: `2b278f6850f75dc0ea5160c96966852116483714`, comprobada contra ambos dominios
canónicos, deployment READY `dpl_5nCRGKV7ckAY7Je787m17XvPafYy`.

## Cambio

Cada ejecución de la preparación crea un lector propio, ligado a usuario, sede
y trabajadora. Sus dos trabajadores asíncronos comparten la promesa/resultado de
cada propiedad durante ese ciclo. Una nueva preparación crea un lector nuevo.
Al terminar o cancelar el ciclo se vacía el mapa y se desactiva la reutilización;
si React Query conserva su función y la invoca más tarde, vuelve a leer en fresco.

No hay caché global ni una nueva duración de frescura. La lectura conserva la
misma selección de campos, el filtro de sede, los nulos y los ceros. Los fallos
se retiran del mapa para permitir reintentar más adelante. La apertura directa
de una tarea conserva su lectura normal, sin usar ese mapa.

Cada tarea sigue preparando y guardando su propio paquete offline con parte,
checklist y datos de propiedad. No se comparten partes ni checklists entre tareas.
No se modifica sincronización, guardado, finalización, asignaciones, cálculos,
permisos, SQL ni funciones remotas.

## Antes y después

Mismo cargador real y fixtures: 20 tareas, 5 propiedades, dos trabajadores
asíncronos. El arnés permite cargar el archivo original del commit de base.

| Lectura | Base | Cambio |
| --- | ---: | ---: |
| Propiedades | 20 | 5 |
| Partes de tarea | 20 | 20 |
| Asignaciones de checklist | 20 | 20 |
| Catálogo de plantillas | 1 | 1 |
| Total | 61 | 46 |

Reducción del 75% en lecturas de propiedades y del 24,6% en lecturas totales de
este escenario. No es un porcentaje de velocidad de toda la aplicación ni una
medición de la duración SQL en producción. Los clientes de producción se
sustituyen por fixtures en las pruebas.

## Pruebas y límites

- `cleanerPropertyPreparationTest.mjs`: comparación base/cambio, partes y
  checklists independientes; nueva preparación con datos actualizados; cuentas
  y sedes distintas; lectura directa fresca; propiedad ausente/null, campos cero;
  fallo HTTP y excepción de red compartidos; evicción/reintento; identidad de tarea.
- `cleanerPropertyPreparationBrowserTest.mjs`: hook real, móvil y almacenamiento
  IndexedDB real. Prepara los 20 paquetes con 5 lecturas de propiedades; cambia
  de cuenta y sede con nuevas lecturas; recarga sin cobertura y abre la tarea
  con las indicaciones correctas sin ninguna lectura externa.
- `cleanerReportPreparationTest.mjs` y `cleanerFinishTest.mjs`: preparación
  interrumpida, recuperación, límites de guardado y finalización sin cambios.
- Build, comprobación raíz de tipos, tipos Node y lint focalizado correctos.
  Tipos reales de aplicación: 130 errores heredados antes y después, sin nuevos.

Limitación detectada en una prueba preexistente: `cleanerOfflineBrowserTest.mjs`
se detiene en la línea 227, al buscar las indicaciones después de cerrar con
Escape el popover de sincronización sin conexión. Se reconstruyó también el
commit de base con el lector original y la misma prueba falla en el mismo paso.
La tarea queda cerrada y no hay errores JavaScript. No se presenta esta batería
completa como aprobada ni se cambia ese comportamiento en esta entrega. Las
pruebas nuevas de carga, paquetes guardados y apertura offline sí pasan.

## Reproducción

```powershell
node scripts/cleanerPropertyPreparationTest.mjs --baseline
node scripts/cleanerPropertyPreparationTest.mjs
node scripts/cleanerPropertyPreparationBrowserTest.mjs
node scripts/cleanerReportPreparationTest.mjs
node scripts/cleanerFinishTest.mjs
```

`PROPERTY_PREPARATION_RESULT` permite guardar la medición en un archivo externo.
No se ejecutaron pruebas de escritura en Supabase ni sesiones reales.
