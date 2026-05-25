
# Automatizar el alta de trabajadores (REGISTRO → invitación → cleaner vinculado)

## Objetivo

Que el flujo sea uno solo: cuando sincronizamos un empleado desde REGISTRO, la app envía sola la invitación por email; y cuando el trabajador la acepta, queda enlazado al cleaner ya existente (sin duplicados).

## Flujo nuevo

```text
REGISTRO (alta del empleado por tu jefe)
        │
        ▼
Integraciones · REGISTRO  →  preview / link
        │  (crea o vincula el cleaner con external_id, sede, DNI, PIN…)
        │
        ▼
[NUEVO] Si el empleado tiene email y aún no es usuario:
        crea automáticamente la invitación con rol 'cleaner' + sede
        y dispara send-invitation-email
        │
        ▼
El trabajador recibe email → acepta → fija contraseña
        │
        ▼
[FIX] accept_invitation enlaza por email al cleaner existente
        (rellena user_id en lugar de crear otro cleaner)
```

## Cambios concretos

### 1. Edge function `sync-employees-from-registro`
En el modo `link` (y opcionalmente `sync` para empleados que aún no tienen invitación):

- Tras crear/vincular cada cleaner, si el empleado de REGISTRO tiene email válido:
  - Comprobar si ya existe `auth.users` con ese email → si existe, no hacer nada.
  - Comprobar si hay invitación pendiente para ese email → si la hay, no duplicar.
  - Si no hay nada, llamar a `create_user_invitation_secure(email, 'cleaner', sede_id)` y a continuación invocar `send-invitation-email`.
- Devolver en la respuesta un contador `invitations_sent` y un detalle por empleado (`invited` / `already_user` / `already_pending` / `no_email`) para mostrarlo en la UI de Integraciones.

### 2. Función SQL `accept_invitation` (migración)
Cambiar el bloque de `IF invitation_record.role = 'cleaner'`:

- Antes de insertar, buscar `cleaners` por `LOWER(email) = LOWER(user_email)` AND `user_id IS NULL`.
- Si existe → `UPDATE` ese cleaner: fijar `user_id = input_user_id`, `is_active = true` y `sede_id` solo si estaba NULL (no pisar la sede de REGISTRO).
- Si no existe → `INSERT` como ahora (caso usuario invitado a mano sin cleaner previo).

Esto elimina los duplicados: el cleaner que vino de REGISTRO se reutiliza.

### 3. UI Integraciones · REGISTRO
- En la pantalla de resultado del `link`, añadir un resumen: "Se han enviado X invitaciones por email" + lista de empleados sin email (para que el usuario sepa a quién hay que pedirle email).
- Botón "Reenviar invitaciones pendientes" que vuelve a llamar a la función para los cleaners sincronizados que aún no tienen `user_id`.

### 4. UI Gestión de Trabajadores (`CreateWorkerModal`)
- Mantener el botón "Nuevo Trabajador" pero reforzar el aviso ámbar: "Solo úsalo para casos excepcionales. Lo normal es sincronizar desde Integraciones · REGISTRO".
- Sin cambios funcionales aquí.

## Detalles técnicos

- La función `create_user_invitation_secure` ya valida rol, sede obligatoria para cleaner, rate-limit y duplicados, así que la edge function solo tiene que llamarla.
- `send-invitation-email` ya existe y se invoca con `{ email, inviterName, role, token, appUrl }`. El `inviterName` puede ser "Sincronización REGISTRO".
- El cambio en `accept_invitation` es la pieza clave para que **no se dupliquen** cleaners cuando el trabajador acepta — usamos email (case-insensitive) como puente.
- No tocamos `auth.users` directamente ni el trigger `handle_new_cleaner` (sigue creando `user_sede_access` cuando se rellena el `user_id`).

## Casos límite

| Situación | Resultado |
|---|---|
| Empleado de REGISTRO sin email | Se sincroniza el cleaner; se reporta en la UI para pedir email |
| Email ya existe en `auth.users` pero sin cleaner | No se reinvita; aparece en la lista para vincular a mano |
| Cleaner manual antiguo con mismo email que el de REGISTRO | Al aceptar la invitación se enlaza por email al cleaner existente; no se duplica |
| Re-sync del mismo empleado | Se respeta la invitación previa (ya pendiente o aceptada) |

## Qué NO toca

- No cambia el modo `sync` para datos ya vinculados (sigue sin tocar email, teléfono, sede).
- No modifica RLS ni tablas existentes salvo la función `accept_invitation`.
- No automatiza el alta en REGISTRO (eso lo sigue haciendo tu jefe).
