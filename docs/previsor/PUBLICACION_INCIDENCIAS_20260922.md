# Publicación de las correcciones N01–N03 — 22/09/2026

Autorización directa del usuario: «súbelo a producción». Publicado desde la copia reconciliada `hostaway-previsor-codex-20260921`. No se han modificado las protecciones del checkout retirado ni activado los despliegues automáticos.

## Fuente preservada

- Ambos dominios servían `dpl_EhaMicPtN8fGHQPpqTMWWyvUNSp7`, fuente `ed3bebc550d13ce31272a6903d92734a6bc3e810`, confirmada en la API de Vercel.
- Git verificó que esa fuente es antecesora del commit publicado. No había una publicación posterior que reconciliar. `origin/main` sigue en `c1c538d8`; no se ha sustituido la producción actual por esa versión antigua.
- Commit publicado: `5389fc3d352c9a1fd2d04d1420b9d92c17632744`, respaldado previamente en `origin/codex/previsor-incidencias-n01-n03`.
- La diferencia de código queda en `src/features/staffing`. No cambian servicios, hooks globales, componentes ajenos, rutas globales, Supabase, lockfile ni configuración de despliegue. Asignaciones y notificaciones de WhatsApp/correo conservan su implementación. No se enviaron mensajes de prueba, desplegaron funciones ni aplicaron migraciones.

## Publicación y verificación

- Despliegue: `dpl_DDbTJDUYpaQKyQ43gEATvePiQp47`.
- URL inmutable: `https://gestionlimpatex-jz286wr6j-limpatex.vercel.app`.
- Estado `READY`; los metadatos de Vercel coinciden con el commit probado. Se repitieron build, TypeScript raíz y los nueve casos de incidencias antes de publicar. El build remoto terminó correctamente.
- Se utilizó `deploy --prod --skip-domain` y posteriormente `promote`. El CLI asignó el dominio secundario al acabar el build, como en la publicación anterior. Se comprobó la versión de ese dominio antes de promover el principal.
- A las **15:26:06 UTC**, ambos dominios resolvían el despliegue nuevo: `gestionlimpatex.vercel.app` y `gestionlimpatex-limpatex.vercel.app`. No quedó ningún alias antiguo entre los dos.
- Las siete rutas de cada dominio responden HTTP 200. HTML, entrada JavaScript, módulo del previsor, CSS y worker coinciden por SHA-256 entre dominios. El código servido contiene `staffing-2026-09-22.3`.
- Evidencia: [publicacion-incidencias-verificacion.json](publicacion-incidencias-verificacion.json).
- El navegador integrado muestra el formulario de acceso al intentar abrir el previsor. No hay sesión autenticada disponible; no se declara realizado un recorrido de las siete pantallas con sesión real. Los HTTP 200 verifican la entrega de archivos, no las consultas bajo permisos del usuario.
- Se mantienen los pendientes de origen y las limitaciones documentadas en [CORRECCIONES_INCIDENCIAS_20260922.md](CORRECCIONES_INCIDENCIAS_20260922.md), incluida la recurrencia de los viernes sin propiedad y los errores de tipos preexistentes fuera del módulo.

## Reversión

Se conserva el despliegue anterior. Si aparece una regresión relevante:

```powershell
vercel rollback gestionlimpatex-1pqbtc625-limpatex.vercel.app --scope limpatex --yes
```

Inspeccionar los dos dominios tras la reversión. Corregir expresamente cualquier alias que siga apuntando a la versión nueva:

```powershell
vercel alias set gestionlimpatex-1pqbtc625-limpatex.vercel.app gestionlimpatex.vercel.app --scope limpatex
vercel alias set gestionlimpatex-1pqbtc625-limpatex.vercel.app gestionlimpatex-limpatex.vercel.app --scope limpatex
```

No hace falta revertir datos: esta entrega no ha escrito en la base de datos.
