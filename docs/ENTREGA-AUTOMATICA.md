# Entrega automática de APP GESTIÓN LIMPATEX

Autorizada por Dani el 5 de octubre de 2026. Los chats implementan mejoras en paralelo. GitHub Actions comprueba e incorpora cada propuesta y publica de forma serializada; Vercel Git continúa desactivado para que no exista una segunda vía automática que se salte las comprobaciones.

El alcance inicial sigue siendo presentación: textos JSX, clases y CSS, conservando acciones, condiciones, permisos y reglas. El filtro es conservador: nuevas pantallas, cambios de estructura JSX, estilos en objetos y lógica requieren revisión; no se etiquetan automáticamente como presentación. No se autorizan migraciones, funciones Supabase, datos, permisos, seguridad, sincronizaciones o notificaciones por este documento.

## Para los chats de Codex

1. Leer AGENTS.md y preservar todos los trabajos existentes. Crear/reutilizar un worktree aislado y una rama `codex/` por tarea, basados en `origin/main` actualizado. No trabajar en el checkout principal mezclado.
2. Implementar solo la petición de Dani y verificar el efecto. No desplegar directamente desde el worktree.
3. Revisar el diff y confirmar únicamente los archivos propios. Nunca confirmar todo un índice mezclado. Los cambios funcionales quedan fuera de la etiqueta automática hasta tener autorización específica.
4. Para una mejora de presentación elegible, guardar un resumen del problema, cambio y verificaciones fuera del repo; ejecutar `node automation/delivery/submit.mjs "Título de la mejora" ruta-al-resumen.md`. El script entrega la rama, crea/reutiliza la propuesta y solicita la cola.
5. Adjuntar siempre la URL de PR al chat con `attach_artifact`. Informar de que está en cola; solo afirmar publicación al comprobar el workflow y ambos dominios. Dani puede iniciar otra idea sin esperar.

Si el filtro rechaza una mejora, explicar la razón y preparar su revisión; no forzar etiquetas ni cambiar el coordinador para sortearlo.

## Qué comprueba la cola

Solo propuestas del propietario, desde este repositorio y ramas `codex/`, con la etiqueta `limpatex:auto-presentation` y `Delivery-Scope: presentation` en el cuerpo. Genera un candidato sobre main vigente; comprueba el alcance mediante el árbol sintáctico, errores nuevos de tipos de aplicación/Node, lint focalizado, compilación y entrada de navegador sin autenticación. Ejecuta código del candidato sin secretos ni permisos de escritura. El trabajo de publicación utiliza scripts de control de main, no scripts procedentes de la propuesta.

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
