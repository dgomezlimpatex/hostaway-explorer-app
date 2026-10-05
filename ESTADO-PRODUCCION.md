# Estado de producción — app Gestión Limpatex

**Esta carpeta es la copia única que se mantiene.** Contiene exactamente el código fuente que
sirve hoy producción, recuperado del propio despliegue y verificado contra él.

## Qué es exactamente esta versión

| Dato | Valor |
|---|---|
| Deployment | `dpl_AJTpSjCWkVMrf8jDfF2cCghhWzLx` |
| Proyecto Vercel | `limpatex/gestion_limpatex` |
| Tipo / estado | `production` / `READY` |
| Creado | 2026-09-24 09:49 (Europe/Madrid) |
| Origen | CLI (`source: cli`), **sin metadatos de Git**: se publicó desde un árbol local |
| Dominios | https://gestionlimpatex.vercel.app · https://gestionlimpatex-limpatex.vercel.app |
| Ficheros en el deployment | 1772 (árbol de origen, vía API de Vercel) |
| Ficheros en esta copia | 1509 (sin `dist/`: ver «Qué NO incluye») |

## Cómo se recuperó

Producción no existía en GitHub: se publicó desde árboles locales, en varios casos sin commit
ni push. La rama del último cambio (`release/laundry-route-v2-20260923`) ya no existe y su
commit `9e5805ba` quedó sin referencias en el repositorio. Por eso el árbol se recuperó del
propio deployment y no de Git:

1. `vercel inspect https://gestionlimpatex.vercel.app` → deployment y su origen (`cli`).
2. API de Vercel `GET /v6/deployments/{id}/files` → 1772 ficheros de origen.
3. API de Vercel `GET /v7/deployments/{id}/files/{uid}` → contenido de cada fichero.

## Verificación de identidad con producción (2026-09-24)

Se instalaron dependencias (`npm ci`, 444 paquetes), se reprodujo el build (`npm run build`,
4375 módulos transformados) y se comparó el resultado con lo que sirve el dominio:

- **237/237 chunks** emparejados uno a uno por el mapa de dependencias del entry y **0
  desalineados** → mismo grafo de módulos, en el mismo orden.
- **34 chunks idénticos byte a byte**; **202 idénticos salvo el nombre hasheado** del chunk y
  las referencias a ese nombre.
- **`PlanningPage` idéntico salvo el renombrado del minificador**, con **101/101 textos de
  interfaz iguales** entre ambos builds.
- **16/16 assets no-JS** (fuentes, imágenes, `robots.txt`, …) idénticos byte a byte.
- `index.html` solo difiere en el nombre del chunk de entrada.

La única diferencia real entre un build local y el de producción es el **entorno**: producción
se construyó con las variables `VITE_*` del proyecto, que Vite incrusta en el objeto
`import.meta.env`. Ese objeto cambia → se desplaza el renombrado del minificador → cambian los
hashes de los chunks. No hay diferencia de código ni de interfaz.

## Variables de entorno del build

Vercel inyecta 18 variables `VITE_VERCEL_*` (metadatos del despliegue):

```
VITE_VERCEL_DEPLOYMENT_ID              VITE_VERCEL_GIT_PULL_REQUEST_ID
VITE_VERCEL_ENV                        VITE_VERCEL_GIT_REPO_ID
VITE_VERCEL_GIT_COMMIT_AUTHOR_LOGIN    VITE_VERCEL_GIT_REPO_OWNER
VITE_VERCEL_GIT_COMMIT_AUTHOR_NAME     VITE_VERCEL_GIT_REPO_SLUG
VITE_VERCEL_GIT_COMMIT_MESSAGE         VITE_VERCEL_OBSERVABILITY_CLIENT_CONFIG
VITE_VERCEL_GIT_COMMIT_REF             VITE_VERCEL_PROJECT_ID
VITE_VERCEL_GIT_COMMIT_SHA             VITE_VERCEL_PROJECT_PRODUCTION_URL
VITE_VERCEL_GIT_PREVIOUS_SHA           VITE_VERCEL_TARGET_ENV
VITE_VERCEL_GIT_PROVIDER               VITE_VERCEL_URL
```

El código propio solo lee dos variables y hoy ninguna está definida (el interruptor queda
apagado por defecto): `VITE_PLANNING_BATCH_V2_READ_ENABLED` y
`VITE_PLANNING_BATCH_V2_WRITE_ENABLED`.

No hay `.env` en esta copia a propósito: los valores viven en Vercel (Project Settings →
Environment Variables) y no se versionan.

## Qué NO incluye

- `dist/`: se subió al deployment por arrastre (build local antiguo, 263 ficheros). No es fuente
  y no debe publicarse; se conserva aparte como evidencia.
- `node_modules`, `.git`, `.env`: no forman parte del deployment.
- `.gitignore`: Vercel no lo subió; se ha añadido uno nuevo en esta copia.

## Reglas de esta copia

1. **Solo esta copia se mantiene, se edita y se publica.**
2. No se trabaja directamente sobre `main`: una rama por tarea.
3. `vercel.json` lleva `git.deploymentEnabled: false`: subir a GitHub **no** publica.
4. Publicar es manual y expreso, con orden de Dani.
5. Backend: Supabase `qyipyygojlfhdghnraus` es **producción**, compartido y sin staging.
6. Reconstruir para comparar: `npm ci && npm run build`.

## Copia remota y estado de Git

Esta version ya esta respaldada en GitHub: rama **`produccion-20260924`** de
`dgomezlimpatex/hostaway-explorer-app`, con `main` (`c1c538d8`, del 14/09) como padre — `main`
no se ha tocado. La rama local `produccion-20260924` sigue a `origin/produccion-20260924`, y la
localizacion de la copia esta limpia (sin diferencias con la rama publicada).

Pendiente para mas adelante: decidir si `main` pasa a ser este estado (por ejemplo fusionando
esta rama) y unificar el nombre del repositorio.

### Nota de entorno: Git por HTTPS en este equipo

Git fallaba con `schannel: AcquireCredentialsHandle failed: SEC_E_NO_CREDENTIALS` incluso
contra repositorios publicos. Se resuelve cambiando el backend TLS a OpenSSL:

    git config --global http.sslBackend openssl

En esta copia ya esta aplicado a nivel de repositorio (`git config http.sslBackend openssl`).
Sin este ajuste, `git fetch` y `git push` no funcionan en este equipo.