# Corrección del contexto del proceso automático

La primera ejecución de la PR #148 encontró la protección productiva
`guard_route_v2_tracking_write`: exige `auth.role() = service_role`, mientras
que pg_cron ejecuta como postgres sin JWT. Las 25 operaciones de hoy quedaron
bloqueadas y cada subtransacción deshizo todos sus movimientos y eventos.

La migración correctiva configura ese contexto únicamente durante la ejecución
de `complete_scheduled_laundry_bag`, que ya es privada para postgres. PostgreSQL
restaura el contexto al retornar o fallar. No cambia la protección, RLS, permisos
de clientes ni credenciales. Reabre solo bloqueos con ese mensaje exacto de rutas
de hoy/futuras. El siguiente tick repite todas las validaciones e idempotencia;
otros bloqueos e históricos quedan intactos.

`node scripts/laundrySchedulerServerContextTest.mjs` reproduce primero el fallo
con las definiciones productivas de auth.role y del guard, verifica rollback total,
aplica la migración y comprueba entrega única, restauración de contexto incluso
tras error, permisos intactos y rechazo de escritura directa. Prueba aislada,
sin conexión a producción.

La segunda migración requiere autorización específica; se ha solicitado a Dani.
No se debe afirmar operativo el registro automático hasta aplicar la corrección
y verificar el resultado real del cron y la ausencia de duplicados.
