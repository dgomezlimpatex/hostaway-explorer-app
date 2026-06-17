# Alta de trabajadoras desde REGISTRO y acceso a la app

## Resumen

La app tiene dos caminos distintos para incorporar trabajadoras:

- **Gestión de usuarios**: crea una invitación en `user_invitations`, envía un email y la trabajadora se registra desde `/accept-invitation`.
- **Integraciones · REGISTRO**: sincroniza trabajadoras desde la app matriz y crea o vincula registros en `cleaners`.

El problema detectado era que el flujo de REGISTRO podía crear o vincular una trabajadora sin dejar claro si también tenía acceso real a la aplicación. Además, si ya existía una invitación pendiente, el sistema la marcaba como pendiente pero no reenviaba el email.

## Causa raíz

REGISTRO es una fuente de datos laborales, pero no debe decidir automáticamente el email de acceso a Limpatex sin revisión. En algunos casos el email puede venir vacío, ser antiguo o no ser el que queremos usar para que la trabajadora acceda a sus tareas.

También había falta de visibilidad:

- la pantalla solo mostraba un número total de invitaciones enviadas;
- no enseñaba si una trabajadora quedó sin email, sin sede o con error de envío;
- no permitía copiar el enlace cuando el email fallaba;
- el botón de copiar enlace en Gestión de usuarios usaba una URL antigua de Lovable.

## Solución implementada

Desde `Integraciones · REGISTRO`, al aplicar una selección de trabajadoras para crear o vincular, se abre una ventana de confirmación de acceso.

La ventana muestra cada trabajadora seleccionada con:

- nombre;
- acción: crear nueva o vincular existente;
- sede cuando se crea una nueva;
- email de acceso editable;
- opción `Crear sin acceso`.

Si REGISTRO ya trae un email, aparece prellenado, pero se puede corregir antes de enviar la invitación.

## Estados posibles

- `Invitación enviada`: se creó una invitación nueva y se envió email.
- `Invitación reenviada`: ya existía una invitación pendiente válida y se volvió a enviar.
- `Ya tenía acceso`: el email ya corresponde a un usuario con rol/acceso.
- `Creada sin acceso`: la trabajadora se creó o vinculó, pero no tiene email de acceso.
- `Sin sede`: no se pudo invitar porque falta sede.
- `Email fallido`: la invitación existe, pero falló el envío; se puede copiar el enlace manualmente.
- `Error invitando`: error inesperado al crear o reenviar la invitación.

## Flujo operativo recomendado

1. Abrir `Integraciones · REGISTRO`.
2. Cargar vista previa.
3. Seleccionar solo las trabajadoras que se quieren gestionar en Limpatex.
4. Elegir `Crear nuevo` o `Vincular existente`.
5. Pulsar `Aplicar selección`.
6. Confirmar o corregir el email de acceso en el modal.
7. Si una trabajadora no debe acceder todavía, marcar o dejar `Crear sin acceso`.
8. Revisar el panel `Resultado de accesos`.
9. Si aparece `Email fallido`, copiar el enlace y enviarlo manualmente.

## Checklist de revisión

- Toda trabajadora activa que deba ver tareas debe tener email, sede e invitación aceptada.
- Las trabajadoras sin email pueden existir en `cleaners`, pero no podrán acceder a la app.
- Si una invitación está pendiente, `Reinvitar pendientes` debe reenviar el enlace existente.
- Si una trabajadora acepta la invitación, debe quedar con:
  - rol `cleaner`;
  - acceso a su sede en `user_sede_access`;
  - `cleaners.user_id` vinculado a su usuario.

## Notas técnicas

- La Edge Function implicada es `sync-employees-from-registro`.
- El envío usa `send-invitation-email`.
- El flujo de aceptación sigue pasando por `/accept-invitation`.
- La URL de invitación debe generarse desde el origen actual de la app y en producción apuntar a `https://gestionlimpatex.vercel.app`.
