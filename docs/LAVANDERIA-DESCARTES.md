# Descartes en la recepción de lencería

Petición de Dani, 06/10/2026: sustituir el contenedor de observaciones por
`DESCARTES`, cerrado por defecto, con las nueve tipologías. La ropa sucia,
rota o rechazada se devuelve a lavandería, no suma al inventario y debe
aparecer en el Excel enviado a los dos destinatarios existentes.

## Resultado preparado

- El recuento y su revisión final tienen el desplegable cerrado al entrar.
- Las tandas de descartes usan `add_discard`; las correcciones del resumen
  usan `set_discard` con revisión vigente. Reutilizan la recuperación local
  con identificador de operación y el bloqueo servidor del recuento compartido.
- Se guardan en `laundry_receipts.discarded_counts`, separados de `counts`.
  Deshacer recupera `previous_discarded_counts` únicamente para una operación
  de descarte; el deshacer de ropa aceptada conserva los descartes.
- La confirmación incluye ambos recuentos en su versión y encargo de correo.
  Cambiar solo descartes produce una versión y Excel actualizados, sin
  movimientos ni cambios de stock. También admite una recepción solo con descartes.
- El Excel nuevo tiene columnas de material, unidades aceptadas y descartes.
  Ejemplo comprobado: 235 toallas aceptadas y 10 descartadas -> stock 235.
- Los snapshots históricos no se reescriben. Los antiguos correos pendientes
  conservan el Excel de dos columnas y el texto original, para que sus
  reintentos mantengan exactamente el payload asociado a la clave del proveedor.
- Las observaciones históricas y la acción antigua `notes` se conservan para
  no perder información ni romper operaciones pendientes de móviles antiguos.

## Verificaciones locales

Compilación correcta, tipos Node y lint focalizado correctos. Tipos reales
de aplicación: 102 diagnósticos antes y después, sin diagnósticos nuevos.
No se modificó el archivo generado de tipos Supabase.

Pruebas con PGlite aislado, PIN/sesiones sintéticos y Resend simulado:

```text
node scripts/laundryReceiptDatabaseTest.mjs
node scripts/laundryReceiptDiscardsTest.mjs
node scripts/laundryReceiptReviewTest.mjs
node scripts/laundryReceiptEdgeTest.mjs
node scripts/laundryReceiptLegacyEmailTest.mjs
npm run test:laundry-receipts:browser
```

Incluyen nueve materiales, tandas de dos empleados, idempotencia, corrección
desactualizada, límites, solo descartes, deshacer, borrador de ayer, stock
invariable tras cambiar descartes, versiones, Excel real, correo fallido/reintento,
compatibilidad histórica y móvil/escritorio. La prueba del navegador usa
la compilación real y el backend aislado, interceptando la red externa.
El arnés PGlite usa una conexión y no demuestra la contención real de Postgres
entre conexiones independientes. No demuestra entregas a buzones reales.

## Activación pendiente: ruta con revisión específica

Este paquete incluye SQL y cambios de la función de correo. No se entrega
por la ruta automática de presentación/aplicación ni se declaran sus efectos
como falsos. Requiere la autorización específica de producción de AGENTS.md.
No se ha aplicado la migración ni desplegado la función como parte de la preparación.

Después de autorizar:

1. Actualizar la base de la PR, revisar el diff exacto y repetir los checks
   pertinentes si cambió el código. Comparar el paquete Edge y las funciones
   SQL desplegadas con la base revisada; en la preparación se comprobó
   `laundry-receipts` versión 1 y los RPC existentes en solo lectura.
2. Reservar el turno compartido según `docs/ENTREGA-AUTOMATICA.md` y comprobar
   `active` inmediatamente antes de cada operación productiva.
3. Aplicar solo `20261006092312_laundry_receipt_discards.sql`. Añade dos columnas
   y reemplaza dos RPC, en una transacción; conserva permisos y RLS. No ejecutar
   el historial de migraciones. Comprobar defaults, RPC, grants y ausencia de
   alteración de movimientos/existencias mediante lecturas agregadas.
4. Desplegar solo `laundry-receipts` con sus dependencias revisadas y
   `verify_jwt=false` como ya está configurado. No cambiar PIN, permisos,
   proveedor, destinatarios, cron ni secretos. El orden es SQL, Edge, frontend.
5. Incorporar el commit validado usando la protección de GitHub y entregar
   el despliegue de frontend al workflow revisado con `reserve.mjs ready`.
6. Verificar el workflow, ambos dominios y el flujo publicado con backend
   simulado. No enviar correos ni crear recuentos ficticios en producción.

Si hay un fallo parcial, conservar columnas y datos; no borrar descartes ni
revertir inventario automáticamente. Revisar backend, GitHub y Vercel antes
de reconciliar o liberar la reserva. No publicar la pantalla contra RPC antiguos.
