# Replanificación de tareas guardadas

Publicación autorizada por Dani el 05/10/2026 con «publica», después de revisar la corrección local.

La candidata parte de `ac13c78`, correspondiente a `dpl_9U3aFye5ogi9dN4qJaiVuVnFRS3k`: los 1.509 archivos fuente subidos a ese despliegue se compararon por SHA-1 y coinciden exactamente con el commit. Conserva la corrección de inicio de sesión. Se portó exclusivamente el arreglo de `55488c0`, sin incorporar las fases locales adicionales del planificador.

Cambios: reconocer los ajustes rápidos guardados desde el tablero sin invalidar el resto del borrador; mantener protección ante modificaciones de otras tareas o disponibilidad; confirmar la desasignación real de tareas guardadas y permitir recolocarlas; conservar compañeras y un horario consistente en limpiezas compartidas. No cambia SQL, funciones Edge, configuración de Supabase ni avisos existentes.

Pruebas locales: `cleaningPlanningSavedContextTest.mjs`, `cleaningPlanningReassignBrowserTest.mjs` (390/1440, datos ficticios, sin red), `passwordSignInTest.mjs`, compatibilidad de guardado, atomicidad e idempotencia pasan. Build, tipos Node/raíz y lint sin errores. Los 102 diagnósticos de tipos de aplicación son idénticos a la producción de partida; el calendario mantiene dos avisos de lint anteriores. No se realizaron pruebas que escriban tareas reales.

La publicación es manual en Vercel. Se guarda y sube la rama de publicación; `main` no se integra automáticamente. La verificación de despliegue y de ambos dominios se registra en `C:\Users\danig\.codex\project-audits\limpatex-planning-reassign-release-20261005`.
