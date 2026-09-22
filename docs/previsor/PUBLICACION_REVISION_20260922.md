# Publicación de la revisión de Previsión — 22/09/2026

Publicación autorizada expresamente por el usuario: «publicalo». Se publica desde la copia reconciliada `hostaway-previsor-codex-20260921`, sin modificar las protecciones del checkout retirado ni activar despliegues automáticos.

## Fuente y conservación

- Ambos dominios estaban en `dpl_CLVWmV8aCwvSK698DKT6gTs8QoeD`, fuente `28d6e67052ba5db4409a514fe9315246143878eb`. La API confirmó que no había otra versión publicada posterior.
- Git comprobó que esa fuente es antecesora de la nueva. La corrección se añade a ella; no se reemplaza por el `main` antiguo (`c1c538d8`).
- Commit publicado: `ed3bebc550d13ce31272a6903d92734a6bc3e810`, respaldado en `origin/codex/previsor-revision-20260922` antes de desplegar.
- Diferencia vacía en servicios, hooks, Supabase, rutas globales, estilos globales, lockfile y configuración de Vercel. No cambian asignaciones ni notificaciones de WhatsApp/correo. No se envían mensajes de prueba ni se despliegan funciones o migraciones.

## Resultado verificado

- Despliegue: `dpl_EhaMicPtN8fGHQPpqTMWWyvUNSp7`.
- URL inmutable: `https://gestionlimpatex-1pqbtc625-limpatex.vercel.app`.
- Estado `READY`, SHA de origen coincidente con el commit probado y build remoto correcto. Typecheck raíz repetido correctamente antes de publicar; se mantienen las limitaciones previas del chequeo completo documentadas en el informe local.
- Se desplegó con `--prod --skip-domain`. El CLI asignó el dominio secundario al acabar el build; se verificó su nueva versión antes de promover el principal.
- A las **10:57:43 UTC**, las consultas de ambos dominios a la API resuelven el despliegue nuevo: `gestionlimpatex.vercel.app` y `gestionlimpatex-limpatex.vercel.app`.
- Las siete rutas de cada dominio responden HTTP 200 y sirven la misma entrada. HTML, entrada JavaScript, módulo del previsor, CSS y worker coinciden por SHA-256 entre los dos dominios. Versión de reglas: `staffing-2026-09-22.2`.
- Evidencia: [publicacion-revision-verificacion.json](publicacion-revision-verificacion.json).
- El navegador integrado llega al formulario de acceso. No dispone de sesión de producción; no se declara realizada la validación autenticada de las siete pantallas ni de las cifras reales. Las comprobaciones HTTP certifican la entrega de archivos, no el renderizado autenticado. Las pruebas locales y capturas controladas constan en [REVISION_20260922_RESULTADO_LOCAL.md](REVISION_20260922_RESULTADO_LOCAL.md).

## Reversión

Se conserva el despliegue anterior. En caso de regresión relevante:

```powershell
vercel rollback gestionlimpatex-qz6o1g70e-limpatex.vercel.app --scope limpatex --yes
```

Inspeccionar ambos dominios. Si alguno conserva el destino nuevo, corregir su alias expresamente:

```powershell
vercel alias set gestionlimpatex-qz6o1g70e-limpatex.vercel.app gestionlimpatex.vercel.app --scope limpatex
vercel alias set gestionlimpatex-qz6o1g70e-limpatex.vercel.app gestionlimpatex-limpatex.vercel.app --scope limpatex
```

Verificar que ambos resuelven `dpl_CLVWmV8aCwvSK698DKT6gTs8QoeD`. No hay cambios de datos o funciones que revertir. Esta documentación se guarda después del despliegue y no cambia su código.
