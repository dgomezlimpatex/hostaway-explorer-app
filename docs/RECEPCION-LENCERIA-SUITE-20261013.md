# Sábanas de suite y orden del recuento

Petición de Dani del 13/10/2026. Orden acordado: Sábanas de suite,
Sábanas de matrimonio, Sábanas individuales (confirmadas por Dani), Fundas de
almohada, Toallas de manos, Toallas de baño, Alfombrín de ducha, Almohada,
Cubre colchón y Edredón.

## Resultado preparado

El formulario, los descartes, la revisión, el historial administrativo y las
nuevas exportaciones usan este catálogo. Las versiones históricas y operaciones
no se reescriben. La ausencia de suite en un registro antiguo significa cero.
Los reintentos de correos antiguos mantienen su Excel original para preservar
la misma petición bajo la clave de idempotencia del proveedor.

La migración aislada `20261013120000_laundry_receipt_suite_sheets.sql` amplía
las claves, los valores por defecto y las cuatro funciones existentes. Solo
permite añadir la asociación suite cuando existen recuentos, manteniendo
inmutables las asociaciones anteriores. Los recuentos anteriores incorporan
esa asociación al siguiente guardado, sin reinterpretar sábanas individuales.
Se conservan comprobaciones de sesión, revisión, idempotencia y stock negativo.
Los descartes no generan entradas de inventario.

## Publicación pendiente de autorización específica

Este paquete incluye Supabase y no es elegible para la entrega automática de
aplicación. Usar la ruta revisada con reserva de `docs/ENTREGA-AUTOMATICA.md`.
No ejecutar estos pasos antes de autorización explícita y turno activo:

1. Actualizar main y verificar de nuevo el diff, CI y estado productivo.
   Releer las definiciones de las cuatro funciones y sus ACLs; comprobar los
   defaults/RLS y que no existe ya una asociación suite distinta.
2. Aplicar exclusivamente la migración nueva, nunca el historial completo.
3. Ejecutar `scripts/laundryReceiptSuiteSheetsAssociation.sql` tras revisar
   sus dos identificadores: enlaza un producto suite existente de la misma sede
   al enlace de recepción existente. No modifica stock, tokens ni sesiones.
4. Redesplegar únicamente `laundry-receipts`, conservando `verify_jwt=false`
   y su paquete vigente, con el dominio/Excel actualizado. No drenar correos
   ni enviar comunicaciones de prueba reales.
5. Releer claves, defaults, definiciones, ACLs y la asociación. Comprobar que
   las cantidades de stock y versiones históricas siguen iguales. Incorporar
   la PR protegida y solicitar la publicación web con `reserve.mjs ready`.
6. Comprobar workflow y ambos dominios canónicos antes de anunciar publicado.

Las pruebas locales usan PGlite y mocks, sin producción ni correo real. Se
prueban recepción, revisión, descarte, confirmación, corrección por diferencia,
deshacer, doble clic/reintento, historial y Excel en móvil/escritorio.

Verificaciones ejecutadas: `npm run build`, TypeScript raíz y proyectos app/Node,
lint focalizado y `git diff --check`; pruebas `laundryReceiptSuiteSheetsTest`,
`laundryReceiptDatabaseTest`, `laundryReceiptEdgeTest`, `laundryReceiptReviewTest`,
`laundryReceiptDiscardsTest`, `laundryReceiptLegacyEmailTest` y
`laundryReceiptBrowserTest`. Tipos de aplicación: 102 diagnósticos previos y
102 después, exactamente iguales; Node sin diagnósticos. Lint sin errores.
Se ha inspeccionado la captura móvil del catálogo completo.

Si un paso productivo falla, detenerse e inspeccionar los efectos parciales.
No repetir escrituras ni revertir datos automáticamente. Un frontend antiguo
puede seguir contando los materiales anteriores con el backend ampliado.
Después de recibir suite, no retirar esa clave ni su asociación: revertir la
interfaz debe conservar la posibilidad de consultar/corregir esas cantidades.
