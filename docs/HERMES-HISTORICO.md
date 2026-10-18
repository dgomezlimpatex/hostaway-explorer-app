# Histórico compartido de reparto

Petición de Dani: aprender de tareas desde **01/06/2026**, actualizar una vez al día y preparar una futura ayuda al planificador. Este cambio no escribe asignaciones ni modifica el motor de reparto.

## Flujo

`limpatex_assistant_read` -> dos capturas completas coincidentes -> cálculo reproducible -> archivo local cifrado -> `historial_equipo` y registro resumido en Obsidian -> revisión proactiva existente.

- Operaciones y consultor: resumen y fichas por trabajador, edificio y propiedad.
- Rentabilidad: resumen agregado; el servidor rechaza fichas individuales.
- Comercial: no se instala el MCP histórico ni se amplían sus recursos.
- La identidad se valida con el MCP original antes de leer el archivo, también para revocaciones.

El MCP original amplía únicamente a Operaciones y consultor tres recursos: edificios, vínculos propiedad-edificio y equipos configurados. Se seleccionan columnas concretas y se excluyen notas de acceso, instrucciones generales y snapshots de retiradas. Las vistas son privadas, `security_invoker`; el propietario de la función sigue siendo el rol de lectura sin login ni bypass de RLS. Se comprueban rechazos de escritura. Referencia técnica: https://supabase.com/docs/guides/database/postgres/row-level-security.

## Interpretación

Se conserva todo el período desde junio; no se sustituye por una ventana móvil. Se incluyen recuentos de los últimos 30 y 90 días para separar experiencia reciente y antigua. Se cuentan tareas y días distintos, sin evaluar rendimiento. Los porcentajes de participación no son exclusivos en tareas compartidas.

Las tareas completadas con asignación son evidencia de asignación en una tarea completada, no prueba de ejecución individual. Pendientes/en curso pasadas se muestran separadamente; canceladas/estados desconocidos no añaden experiencia. `task_assignments` tiene prioridad y se usa `cleaner_id` antiguo solo cuando no hay asignaciones. Un conflicto excluye la tarea del aprendizaje. No se vinculan nombres parecidos. Las relaciones de edificio son las actuales; no se afirma reconstruir su evolución pasada.

No se crean preferencias ni titularidades. Se conservan los equipos configurados, incluidas exclusiones aunque estén inactivas. Activo/disponible son cosas diferentes: cualquier propuesta futura debe consultar asignaciones, disponibilidad, ausencias, sede, carga y solapes en directo. Una persona sin histórico no se considera no apta.

## Actualización y continuidad

El lanzador instalado en `integrations/limpatex-history/run.ps1` ofrece `refresh`, `status`, `record`, `query` y `mcp`. Resuelve el runtime actual de Hermes. El colector usa la credencial de lectura de Operaciones y no contiene claves ni SQL genérico.

La comprobación se añade a la revisión periódica existente, que conserva GPT-6 Astra/high. `refresh` solo intenta actualizar una vez por fecha de Madrid, a partir de las 06:00; incluye hasta ayer, sin aprender del futuro. Con PC/Codex apagados se recupera en la siguiente revisión disponible. No se crea un nuevo agente. Un intento fallido queda señalado y no se reintenta en bucle; `--force` queda reservado a una recuperación manual explícita.

El bloqueo local impide solapar recolectores. Se publica el archivo de forma atómica solo tras dos lecturas completas coincidentes. Las fuentes cambian: esto detecta deriva observada, pero no equivale a una transacción SQL única. Si algo falla se mantiene el archivo anterior y las consultas muestran `desactualizado`. Un cierre inesperado deja el intento visible como en curso/no correcto. La fecha fija se divide en períodos de hasta 365 días para seguir funcionando más adelante.

Los agregados, nombres mínimos e IDs de ejemplos se cifran con Windows DPAPI. No se guardan listados de tareas crudos. Los perfiles comparten usuario de Windows: esto no crea aislamiento del sistema operativo.

`record` registra un resumen técnico idempotente por fecha y huella, sin propuestas de negocio. La revisión Astra ya existente interpreta esa evidencia; puede consultar fichas con `-Action query -Query trabajador|edificio|propiedad -Id ...` y debe respetar paginación y límites. No se crean tareas Todoist por cada ficha o captura. Las propuestas útiles siguen el publicador y deduplicación existentes.

## Verificación

- Pruebas del cálculo, correcciones, estados, recencia, identidad, permisos, paginación, fallo y continuidad en `scripts/assistantHistoryTest.py`; fixtures sintéticos y almacenamiento temporal.
- Prueba de la migración exacta sobre PostgreSQL aislado en `scripts/assistantHistoryDatabaseTest.mjs`: ámbitos, columnas privadas, rol limitado y rechazo de INSERT/UPDATE/DELETE.
- Antes de activar: probar datos reales en lectura, MCP nativo de cada perfil, intento fuera de ámbito, publicación de memoria y segunda ejecución diaria sin nueva captura.

La instalación local, el cambio remoto de lectura y la programación son estados independientes. No declarar activo hasta comprobar los tres.
