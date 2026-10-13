# Entregas de lencería en fechas pasadas

Petición de Dani: selector de fecha en el enlace del repartidor y posibilidad de
registrar/corregir días pasados desde administración.

## Comportamiento preparado

- Hoy sigue siendo la fecha inicial. El calendario permite seleccionar cualquier
  fecha pasada válida. Tanto interfaz como servidor rechazan las fechas futuras.
- Hay un único recuento por almacén y fecha; repartir y administrar comparten ese
  registro. Iniciar otra vez o recuperar una respuesta perdida no crea otra entrega.
- La fecha es la de la entrega. La confirmación y el movimiento de stock ocurren
  cuando se confirma: no se reconstruyen ni se retrofechan existencias históricas.
- Las tandas/correcciones quedan guardadas en el recuento. El inventario cambia
  únicamente al confirmar, por la diferencia respecto de la versión anterior.
  Los descartes siguen fuera del stock. Una corrección que causase stock negativo
  se rechaza de forma atómica.
- El selector y el cambio de almacén se bloquean durante una operación pendiente
  o una revisión. Cambiar de día con cantidades escritas sin añadir exige elegir
  si se descartan. Una operación pendiente recupera su propia fecha tras recargar.
- En Recepciones de ropa limpia, administración tiene el mismo editor con selector
  de fecha, acceso por su sesión habitual y sin necesitar el PIN de un repartidor.
  El historial existente sigue mostrando versiones y Excel.

## Identidad, permisos y backend

La Edge obtiene el administrador exclusivamente del JWT verificado. Rechaza
intentos de aportar otra identidad y no permite mutaciones administrativas con
una clave de servicio sin usuario auditable. Conserva los permisos existentes de
admin/manager y comprueba el acceso a la sede; SQL repite esa comprobación.

La migración aislada `20261013140000_laundry_receipt_history_admin.sql` añade
`admin_user_id` a operaciones/versiones y permite que `worker_id` sea nulo solo
cuando el actor sea administrador. Se conserva un único actor por registro.
Las referencias del administrador usan `ON DELETE RESTRICT` para conservar su
identidad: una cuenta que tenga este historial debe desactivarse, y no eliminarse
sin resolver antes esas referencias. No se modifican cuentas ni roles existentes.

Una única función interna mantiene la lógica de stock, versión e idempotencia;
los wrappers de PIN y administración validan su identidad antes de invocarla.
Todas las funciones nuevas son SECURITY INVOKER, con search_path explícito,
privadas para anon/authenticated y ejecutables únicamente por service_role.
No se abren políticas RLS ni se conceden accesos nuevos a tablas.
No se reescriben recuentos, versiones, stock, correos, tokens ni sesiones antiguos.

## Verificación local ejecutada

Build correcto; comprobación real de TypeScript de aplicación con los mismos
102 diagnósticos previos y sin nuevos, Node sin diagnósticos; lint focalizado y
diff sin errores. Pruebas PGlite/Edge locales de fechas, creación compartida,
corrección por diferencia, descartes, identidad administrativa, roles/sedes,
RPC privadas, idempotencia, compatibilidad de versiones y enlace deshabilitado.
Regresiones de recepción, suite, descartes, revisión y correo antiguo correctas.

Navegador móvil/escritorio con red interceptada: registro pasado por repartidor,
recarga de una respuesta perdida en su fecha, edición pasada por administración,
alta administrativa de otro día, bloqueo de futuro, historial, Excel y stock
local por diferencia. Ninguna prueba escribe en producción ni envía correo real.

## Publicación revisada

No es elegible para la cola automática de aplicación: contiene SQL, una Edge y
edición administrativa. La petición expresa de Dani autoriza el selector y la
edición de fechas pasadas por administración; continúa la autorización del hilo
para aplicar el ajuste de Supabase y publicar este circuito de recepción.
Usar la reserva de turno conforme a `docs/ENTREGA-AUTOMATICA.md`. No crear entregas
reales ni modificar cantidades durante el despliegue.

Con autorización y turno activo: comprobar versiones/definiciones/ACLs/RLS y
columnas actuales; confirmar que no existen ya los helpers ni columnas nuevos;
aplicar solo esta migración; redesplegar solo `laundry-receipts` conservando
verify_jwt=false y dependencias vigentes. Verificar código/ACLs y hashes de datos
preexistentes; no crear entregas ni enviar correos reales como prueba de despliegue.
Incorporar el commit exacto protegido, entregar publicación a `reserve.mjs ready`
y verificar workflow, ambos dominios y assets antes de anunciar publicado.

Si falla un paso, detenerse y revisar sus efectos parciales antes de reconciliar
la reserva. No repetir escrituras ni revertir datos automáticamente.
