# Trabajo con Claude, Codex y Orca

Configuración autorizada por Dani el 11 de octubre de 2026. Claude es el agente
principal en Orca; Codex sigue disponible. La entrega usa la cola protegida existente.

## Para Dani

Crea un espacio de trabajo en Orca dentro de APP GESTIÓN LIMPATEX, deja Claude
seleccionado y escribe la mejora que necesitas. Cada mejora independiente debe
tener su propio espacio. Puedes continuar otra tarea mientras una PR está en cola.
Empieza con dos mejoras simultáneas; si dependen del mismo cambio, se ordenan.

Claude Opus 5.5 con esfuerzo alto es la selección inicial del proyecto. El modelo
se puede cambiar con `/model`; no hay una comparación universal que garantice que
un proveedor resuelva mejor todas las tareas. El saldo real y su caducidad se
consultan en la consola de Anthropic. No hay un límite monetario de sesión impuesto
por esta configuración interactiva. La comprobación inicial de conexión sí usa un
presupuesto acotado. No se activan agentes periódicos ni trabajo indefinido.

## Contrato común de los agentes

1. Leer AGENTS.md y docs/ENTREGA-AUTOMATICA.md; las ampliaciones fechadas más recientes
   prevalecen sobre los traspasos históricos. No reutilizar estados antiguos de
   producción ni interpretar una skill antigua como el estado actual.
2. Inspeccionar rama, estado, base y worktrees. Preparar una copia aislada desde
   `origin/main` actualizado. Una tarea tiene un único agente responsable de editar;
   un segundo agente puede revisar en lectura o trabajar en otra tarea aislada.
3. Acordar mediante la propia petición el resultado observable y comprobarlo. Las
   decisiones rutinarias las toma el agente. Proponer otras mejoras sin introducirlas
   en la entrega actual. No hacer a Dani copiar comandos o redactar revisiones.
4. Verificar casos normales, límites y regresiones con datos locales; build, tipos
   de aplicación y Node sin errores nuevos, lint focalizado y navegador cuando
   corresponda. No ejecutar todas las pruebas indiscriminadamente: algunas escriben
   en Supabase de producción. Una carpeta aislada no aísla el backend.
5. Confirmar solo archivos propios, preparar revisión funcional cuando corresponda
   y entregar mediante el script común. Si otra PR cambia el mismo código, resolver
   y repetir revisión/pruebas. La cola no elimina por sí sola los conflictos.
6. Devolver enlace a la PR y estado real: preparado, en cola, bloqueado o publicado.
   Solo anunciar publicado después de verificar workflow, commit y ambos dominios.
   Si la cola falla, diagnosticar y resolver dentro del alcance; no saltar filtros.

## Preparación de Orca

`orca.yaml` llama a `node scripts/orcaSetup.mjs`. El script solo acepta worktrees del
repositorio esperado. En un worktree nuevo y limpio convierte el nombre de rama de
Orca al prefijo `codex/` que exige la cola. Nunca renombra main, una rama con trabajo
propio o una rama con archivos pendientes. No hace push ni cambia otras carpetas.

Instala dependencias desde package-lock con `npm ci --ignore-scripts`, sin copiar
credenciales ni archivos .env del checkout principal. La marca local de instalación
incluye package.json, lockfile, Node y plataforma. Si cambian, renueva dependencias.
Cada worktree tiene sus propias dependencias y cachés.

El agente debe esperar al éxito de preparación antes de compilar. El servidor de
desarrollo usa un puerto libre propio por tarea. Para pruebas funcionales, usar
fixtures/mocks locales; no iniciar sesión contra producción como prueba automática.

La API key y, cuando corresponda, el identificador del workspace de Anthropic se
guardan en el entorno local del usuario. Nunca deben aparecer en Git, archivos de
revisión, registros compartidos ni prompts. Claude usa API; no necesita un login
de suscripción. Codex conserva su autenticación propia.

## Revisión cruzada y oportunidades

Una segunda IA aporta valor en cálculos, concurrencia, recuperación de errores y
flujos difíciles. Debe revisar el diff exacto y aportar hallazgos verificables.
No crear un segundo implementador sobre la misma carpeta ni exigir doble revisión
para cambios triviales. Claude puede entregar sin depender de una sesión de Codex.

Las oportunidades descubiertas se enumeran en el cierre de la tarea con beneficio,
evidencia y esfuerzo aproximado, sin datos personales. Se incorporan al trabajo
solo cuando Dani las pide. No iniciar un proyecto nuevo ni consumir créditos en
auditorías recurrentes por iniciativa de un agente.

## Entrega e instrucciones para nuevas sesiones

Claude carga CLAUDE.md, que importa las instrucciones comunes; Codex carga AGENTS.md.
Los dos usan ramas `codex/`: el nombre identifica la ruta de entrega, no el proveedor.
En Orca, asociar la PR al espacio mediante `orca worktree set --worktree current
--pr NUMERO --json`; en la app Codex, usar `attach_artifact` cuando esté disponible.
Mantener la documentación común en el repositorio para las nuevas copias. Los chats
ya abiertos deben releerla; no reciben automáticamente las nuevas instrucciones.
