# Entrega automática de APP GESTIÓN LIMPATEX

Autorizada por Dani el 5 de octubre de 2026. Los chats implementan mejoras en paralelo. GitHub Actions comprueba e incorpora cada propuesta y publica de forma serializada; Vercel Git continúa desactivado para que no exista una segunda vía automática que se salte las comprobaciones.

Dani amplió la autorización el 5 de octubre: también pueden entregarse funciones, nuevas pantallas, estructura y cálculos locales solicitados. La autorización es permanente para preparar, comprobar, subir, integrar y publicar esas peticiones. La presentación conserva su filtro inicial. La funcionalidad exige revisión y pruebas específicas. Siguen reservados datos reales, SQL/esquema/Edge Functions, seguridad, autenticación, permisos, comunicaciones, sincronizaciones/PMS, gastos e infraestructura. Las acciones reservadas ya autorizadas expresamente se entregan por una ruta revisada aparte; no se elude este filtro.

## Para los chats de Codex

1. Leer AGENTS.md y preservar todos los trabajos existentes. Crear/reutilizar un worktree aislado y una rama `codex/` por tarea, basados en `origin/main` actualizado. No trabajar en el checkout principal mezclado.
2. Implementar solo la petición de Dani y verificar el efecto. No desplegar directamente desde el worktree.
3. Revisar el diff y confirmar únicamente los archivos propios. Nunca confirmar todo un índice mezclado. Preparar la revisión funcional descrita abajo si corresponde; no incluir acciones reservadas.
4. Para una mejora elegible, guardar un resumen del problema, cambio y verificaciones fuera del repo; ejecutar `node automation/delivery/submit.mjs "Título de la mejora" ruta-al-resumen.md`. El script entrega la rama, crea/reutiliza la propuesta y solicita la cola.
5. Adjuntar siempre la URL de PR al chat con `attach_artifact`. Informar de que está en cola; solo afirmar publicación al comprobar el workflow y ambos dominios. Dani puede iniciar otra idea sin esperar.

Si el filtro rechaza una mejora, explicar la razón y preparar su revisión; no forzar etiquetas ni cambiar el coordinador para sortearlo.

## Qué comprueba la cola

Solo propuestas del propietario, desde este repositorio y ramas `codex/`, con la etiqueta `limpatex:auto-delivery` (la anterior sigue aceptándose) y `Delivery-Scope: presentation` o `Delivery-Scope: application` en el cuerpo. Genera un candidato sobre main vigente; comprueba el filtro visual o la revisión funcional ligada al diff, errores nuevos de tipos de aplicación/Node, lint focalizado, compilación y entrada de navegador sin autenticación. Ejecuta código del candidato sin secretos ni permisos GitHub de escritura. Repite las pruebas funcionales en Linux con la red aislada para impedir conexiones con producción. Dependencias, workflows y configuración quedan fuera de las propuestas automáticas. El trabajo de publicación utiliza scripts de control de main, no scripts procedentes de la propuesta.

La rama main exige la comprobación `limpatex/verified-candidate` y estar actualizada. El coordinador sube a la rama de la propuesta únicamente la combinación comprobada, la incorpora y despliega desde el commit incorporado. Nunca hace force-push de main. Una cola compartida evita publicaciones simultáneas.

Antes de publicar comprueba la huella de fuente de producción y ambos alias. Solicita la construcción sin asignar dominios y vuelve a comprobar producción antes de promover. Si Vercel asigna su alias automático durante la construcción, solo acepta el deployment propio, READY y con commit y huella previstos; cualquier publicación ajena detiene el circuito. Después de promover verifica los dos dominios y sus assets.

## Operación

- Workflow: `.github/workflows/limpatex-delivery.yml`.
- El disparo sin número de PR solo comprueba las conexiones y la base; no publica.
- `dry_run=true` comprueba una propuesta sin incorporar ni desplegar.
- Consultar resultados en GitHub Actions. Un fallo de validación conserva main y producción. Si la incorporación termina pero Vercel falla, main puede quedar por delante; revisar/reanudar esa publicación antes de nuevas entregas, sin volver a incorporar la propuesta cerrada.
- El secreto Vercel se guarda cifrado en GitHub y se limita al proyecto. No copiarlo al repo, al cliente ni a variables VITE.
- La publicación usa la API del proyecto y el commit exacto de GitHub. Si una entrega quedó incorporada sin publicar, el workflow `limpatex-recover.yml` puede reanudarla por número de PR: exige validación previa, la misma fuente de aplicación y producción sin cambios; no incorpora otra vez la propuesta.
- Si la misma entrega ya está publicada y solo faltó confirmar el resultado, la recuperación comprueba su commit, fuente, ambos dominios y assets sin crear otro despliegue.
- Reutiliza archivos con el mismo hash del deployment anterior y sube solo contenidos nuevos; el deployment sigue conteniendo la aplicación completa. Las subidas limitadas por Vercel esperan y reintentan de forma acotada.
- No se aplican SQL ni se despliegan funciones de Supabase. Una vista previa utiliza el backend compartido si la app se conecta; las pruebas de esta cola no inician sesión.
- Los chats que ya estaban abiertos pueden conservar instrucciones antiguas. Deben adoptar este circuito antes de entregar; la configuración no les envía mensajes ni interrumpe su trabajo.

## Reversión

Deshabilitar el workflow para detener nuevas entregas. Conservar ramas y propuestas. Ante una incidencia publicada, recuperar un deployment anterior comprobado mediante Vercel y verificar ambos alias; después reconciliar main con la fuente elegida antes de reactivar la cola. No resetear main ni aplicar rollback de base de datos.

## Revisión funcional que prepara Codex

1. Verificar la petición con pruebas pertinentes de límites/regresión y datos locales. Revisar cambios de datos, login, permisos, comunicaciones, integraciones y costes, incluidos efectos indirectos al abrir la pantalla. Si hay un efecto reservado o duda real, detener esa publicación y explicar el alcance; no marcarlo como falso para pasar.
2. Confirmar los archivos propios de la implementación y pruebas. Preparar fuera del repositorio un JSON con `request` (petición de Dani), `reason` (por qué entra en alcance), `verification` (qué se comprobó y limitaciones), `effects` (todas las categorías abajo explícitamente false) y `tests` (rutas de archivos Node locales .mjs/.cjs/.js bajo scripts/ o src/). Los tests deben comprobar código real, no una copia del algoritmo. No usar pruebas :db, sesiones reales ni red; los arneses locales con esbuild pueden ejecutarse sin red.
3. Ejecutar `node automation/delivery/review.mjs ruta-a-revision.json`. Genera `.delivery/requests/<tarea>.json`, versión y huella del diff exacto. Revisar y confirmar únicamente ese archivo; después ejecutar submit como en una entrega visual. Actualizar la revisión tras cualquier cambio. La cola compara el diff combinado sobre main vigente; si otra entrega modifica el mismo código, puede exigir revisar y comprobar de nuevo.

Ejemplo de revisión externa (el script añade version, scope y digest):

```json
{
  "request": "Añadir el cálculo local solicitado por Dani",
  "reason": "Calcula una propuesta en memoria sin guardar datos ni cambiar permisos",
  "verification": "Casos normales, límites y regresión verificados con fixtures locales",
  "effects": {
    "productionData": false, "database": false, "security": false,
    "authentication": false, "communications": false, "integrations": false,
    "costs": false, "infrastructure": false
  },
  "tests": ["scripts/exampleCalculationTest.mjs"]
}
```

El filtro admite código de aplicación, recursos públicos, documentación y pruebas Node. Bloquea rutas y patrones evidentes de efectos reservados, credenciales, dependencias y configuración. Esta detección es conservadora: puede rechazar un cambio inocuo y no demuestra por sí sola la ausencia de todos los efectos indirectos. La revisión honesta del agente es obligatoria; build y pruebas no garantizan ausencia de errores. Un archivo protegido no se renombra para eludirlo. Las revisiones y pruebas quedan en GitHub para trazabilidad; Dani no tiene que redactarlas ni ejecutar comandos.

## Publicaciones con revisión específica: reservar el mismo turno

También usan la cola `limpatex-production-delivery`, mediante `limpatex-reviewed-release.yml`. Dani conserva las autorizaciones específicas; esta coordinación no autoriza SQL, datos, seguridad ni correos por sí sola. El agente realiza estos pasos:

1. Preparar la PR propia, basada en main vigente, revisar el paquete completo y ejecutar las pruebas pertinentes, incluidos backend y casos operativos locales si corresponde. Guardar la autorización específica y resultados en la PR/auditoría sin secretos ni datos reales. Esperar CI correcto y registrar `limpatex/verified-candidate` success en el head exacto solo después de la revisión real. No cambiar ese head después de reservar.
2. Guardar una nota breve de la autorización específica fuera del repo. Ejecutar `node automation/delivery/reserve.mjs start ruta-reserva.json NUMERO_PR autorizacion.txt`. El archivo de reserva queda fuera de Git. Ejecutar `check ruta-reserva.json` hasta que responda `active`. Si la PR dejó de estar al día mientras esperaba, reconciliar, comprobar de nuevo y reservar con su nuevo head. `waiting` NO es permiso para tocar producción.
3. Con el turno activo, repetir `check` inmediatamente antes de cada operación productiva. Ejecutar únicamente las operaciones que ya tengan autorización específica. Incorporar la PR con su código revisado y protección vigente. La reserva expira treinta minutos después de concederse: no operar con una reserva caducada. Los cambios de datos requieren su propia recuperación; no se revierten automáticamente.
4. Ejecutar `node automation/delivery/reserve.mjs ready ruta-reserva.json`. Exige PR incorporada, mismo head validado y main igual al commit incorporado. El workflow construye ese commit, promueve y verifica ambos dominios y assets; solo entonces cierra el turno. El chat NO publica Vercel por su cuenta. Seguir el workflow y comunicar el resultado real.
5. Si se abandona antes de ready, usar `cancel ruta-reserva.json` y revisar el estado antes de continuar. Un fallo, cancelación o expiración deja una reserva sin cierre correcto y bloquea entregas nuevas. Tras terminar el workflow y revisar/reparar los estados de backend, main y producción, guardar un informe de auditoría sin PII y ejecutar `reconcile ruta-reserva.json informe.md`. Registra su hash y libera la reserva; no realiza reparaciones, migraciones ni rollback automáticamente. No declarar reconciliado un efecto pendiente.

Los cambios realizados por herramientas ajenas a este protocolo no pueden bloquearse físicamente desde GitHub. Las instrucciones obligan a los chats a reservar turno; si alguien publica por fuera, se mantiene la comprobación de deriva y el bloqueo. No ampliar credenciales para intentar impedirlo.

## Espera automática por una publicación identificada

Antes de validar, se fija main. Si los dos dominios aún no coinciden con su fuente, solo se espera cuando su fuente actual corresponde a commits antecesores verificados y Vercel contiene un deployment del proyecto con ese main y su huella exacta, en estado QUEUED/INITIALIZING/BUILDING/READY. Reconsulta cada diez segundos hasta diez minutos y continúa sola cuando ambos dominios coinciden. No crea, promueve ni sustituye deployments durante esa espera.

Si main avanza, la versión es desconocida, el deployment falla/se cancela o vence la espera, se detiene conservando la propuesta. Reservas manuales interrumpidas también bloquean nuevas entregas aunque la huella de frontend coincida: hay que revisar posibles efectos de backend. La espera reconoce publicaciones en curso; no inventa que una diferencia arbitraria sea segura.
