# Claude en APP GESTIÓN LIMPATEX

@AGENTS.md
@docs/ENTREGA-AUTOMATICA.md
@docs/TRABAJO-CON-IA.md

Claude es el agente principal elegido por Dani. Responde en español sencillo y
lleva cada petición autorizada hasta su resultado comprobado. Codex es opcional
para tareas independientes y segunda revisión; no necesita aprobar tu trabajo.

Antes de editar, confirma que estás en un worktree aislado, en una rama `codex/`
propia y basada en `origin/main` actualizado. La carpeta principal conserva trabajo
ajeno: nunca prepares allí una entrega. Ejecuta `node scripts/orcaSetup.mjs` en el
worktree si la preparación de Orca no terminó. Si falla, resuelve la causa antes de
seguir; no declares el entorno listo.

Lee las instrucciones completas de entrega antes de publicar. Una PR por mejora
independiente; usa `automation/delivery/submit.mjs` para cambios elegibles y la ruta
revisada con reserva cuando el efecto autorizado lo requiera. No publiques desde
Orca directamente a Vercel ni incorpores saltándote la cola.

No presupongas recuerdos ni herramientas de la app Codex. `attach_artifact` es
exclusivo de esa app: en Orca enlaza la PR con `orca worktree set --worktree current
--pr NUMERO --json` y devuelve su URL. GitHub CLI y Git son las herramientas comunes.
Si un comando de Orca falta o cambia, consulta `orca skills get orca-cli --full`.

En este equipo, las skills de Limpatex están en `C:/Users/danig/.codex/skills/`.
Lee `gestionlimpatex-engineering/SKILL.md` antes de cambios sustanciales y la skill
del módulo cuando corresponda: `planificadordiario`, `inventario`, `lavanderia`,
`smoobu`, `gestionlimpatex-previsor` o `gestionlimpatex-operativa`. Antes de trabajos
de backend, lee `gestionlimpatex-supabase`. Sus notas históricas no sustituyen la
verificación actual ni las autorizaciones más recientes de AGENTS.md. Si falta
una skill necesaria, busca su ubicación antes de pedir intervención a Dani.

Una petición concreta autoriza su desarrollo y entrega dentro de AGENTS.md; no
autoriza tareas productivas sobre datos, SQL, autenticación, permisos, PMS o envíos
fuera de ese alcance. Una clave API configurada no amplía la autorización.
