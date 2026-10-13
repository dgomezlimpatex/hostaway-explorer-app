# Validación del circuito preparado

Validación local del 13/10/2026. Datos ficticios y sin operaciones en Supabase de producción. La base incorpora las entregas vigentes de `origin/main`; no incluye cambios pendientes de otros checkouts.

## Resultado observable

El circuito reserva las bolsas sin descontarlas, registra entrega a trastero compartido o propiedad, cambia la ropa instalada al finalizar la limpieza, recoge toda la sucia hacia el central y registra el envío conjunto. La recepción existente devuelve limpia por tipología, sin atribuirla a una propiedad. Los rechazos quedan apartados en el central y vuelven al pendiente del proveedor cuando se envían a relavar.

La apertura incluye limpia física y embolsada, instalada, sucia pendiente de recoger, sucia ya recogida en el central, pendiente en lavandería y rechazada apartada. Los vacíos no se interpretan como cero. La adopción de bolsas existentes no repite el descuento.

## Evidencia

| Comprobación | Resultado |
| --- | --- |
| Migración exacta con PostgreSQL local WASM | 14 grupos: dos ciclos, trastero compartido, bolsa directa, correcciones, conservación, reservas y permisos. |
| Límites y recuperación | 16 escenarios: recuentos incompletos, sucia inicial en central, envíos parciales, rechazo/relavado/baja, recepciones anteriores, cambios de dotación, aperturas y reintentos. |
| Handler real de la Edge Function | 27 peticiones: circuito apagado o sin SQL, PIN, actor, transacción, fallo de stock, metadatos de bolsa obsoletos y reintentos. Dependencias de red sustituidas por fixtures. |
| PostgreSQL nativo 17.11 | Cinco grupos con dos conexiones independientes: preparación/entrega, finalización/recogida y recepción concurrentes, recepción frente a finalización sin interbloqueo y grants reales. Producción usa PostgreSQL 17.4; no se probó allí. |
| Pantalla real de configuración | Recuento, activación, roles, móvil/escritorio y recuperación tras perder la respuesta de guardado/envío, contra la migración exacta local. |
| Inventario real | Saldo físico 10, reservado 4, disponible 6, necesidad 9: faltan 3. Error de lectura oculta saldos anteriores. |
| Ruta V2 real | Cantidad mostrada obsoleta rechazada, recogida y entrega visibles solo con circuito activo y modo anterior conservado. |
| Regresión de preparación | El enfriamiento entre pulsaciones y fases se conserva en móvil/escritorio, también con guardado lento o error rápido. |
| Regresión de inventario | Navegación y filtros de las cuatro páginas de inventario comprobados. |
| Compilación | `npm run build` correcto. Avisos previos de datos de navegadores y expresión CSS existente. |
| Tipos de función | Deno correcto para `laundry-route-workflow`, con dependencias reales y sin desplegar. |
| Tipos de aplicación | 102 diagnósticos previos conservados; el cambio no añade errores. No se presenta como un typecheck de aplicación limpio. |
| Tipos de proyecto raíz y Node | Correctos. |
| Lint | Archivos propios de interfaz y servicio correctos. El hook de tracking conserva sus tres errores previos de `any`, comparados con `origin/main`. La función se verifica con Deno; la configuración de ESLint del proyecto la excluye. |

Los contratos de `resolve_laundry_bag_lines` y recepción usados en fixtures se obtuvieron mediante lectura de las definiciones desplegadas. Incluyen la recepción v4 y su historial administrativo. Antes de publicar se comparan de nuevo mediante el preflight de solo lectura.

## Revisión propia del alcance

- Movimientos atómicos y claves estables evitan duplicados tras confirmar dos veces o perder conexión. Las reservas impiden utilizar prendas ya asignadas a otra bolsa.
- El servidor valida sede, pertenencia a ruta, empleado verificado, fecha, propiedad, generación y cantidades. No confía en el nombre de actor enviado por el cliente.
- Las tablas nuevas tienen RLS y grants explícitos; las escrituras usan RPCs comprobadas o funciones privadas. Se conserva historial al borrar/cancelar tareas y los saldos solo cambian tras una acción física registrada.
- El envío a lavandería y las bajas usan identificador persistido antes de llamar, saldo esperado y motivo. Resolver una bolsa exige indicar la acción física; cancelar una tarea no devuelve ropa por sí solo.
- No se cambian los tipos generados de Supabase, el circuito de PMS ni destinatarios. La envoltura conserva el outbox de recepción existente: una futura confirmación real mantiene sus efectos habituales.

## Límite de la validación

No se han aplicado SQL, permisos, recuentos ni activaciones reales; tampoco se han desplegado funciones, integrado la PR o publicado Vercel. JWT/RLS con sesiones reales del proveedor, PIN de empleados reales, conteos físicos y dos ciclos observados se comprobarán dentro de la publicación/activación específicamente autorizadas.

La entrega contiene efectos reservados de esquema, permisos y Edge Function. Queda en borrador para publicación revisada conforme a `LAVANDERIA-ACTIVACION-CIRCUITO.md`; no utiliza la etiqueta ni el manifiesto de entrega automática ordinaria.
