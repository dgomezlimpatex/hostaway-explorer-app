# Corrección del contexto del proceso automático

La primera ejecución de la PR #148 encontró la protección productiva
`guard_route_v2_tracking_write`: exige `auth.role() = service_role`, mientras
que pg_cron ejecuta como postgres sin JWT. Las 25 operaciones de hoy quedaron
bloqueadas y cada subtransacción deshizo todos sus movimientos y eventos.

El primer intento de corrección configuraba request.jwt.claim.role en la función;
Supabase lo rechazó por ser un parámetro protegido. La transacción se revirtió
completa y se canceló/reconcilió la reserva, sin merge ni despliegue ni movimientos.

La propuesta revisada configura una señal interna únicamente durante la ejecución
de `complete_scheduled_laundry_bag`, que ya es privada para postgres. PostgreSQL
restaura la señal al retornar o fallar. Ajusta el guard para reconocer esa señal
solo cuando session_user es postgres: la identidad real de la conexión, no el
propietario de la función SECURITY DEFINER. Clientes API no pueden suplantarla.
No modifica JWT, RLS, grants ni credenciales. Reabre solo bloqueos con ese mensaje exacto de rutas
de hoy/futuras. El siguiente tick repite todas las validaciones e idempotencia;
otros bloqueos e históricos quedan intactos.

`node scripts/laundrySchedulerServerContextTest.mjs` reproduce primero el fallo
con las definiciones productivas de auth.role y del guard, verifica rollback total,
aplica la migración y comprueba entrega única, restauración de contexto incluso
tras error, permisos intactos, rechazo de escritura directa y de una conexión
authenticator que falsifica la señal. Prueba aislada,
sin conexión a producción.

Dani autorizó la primera versión y el reproceso de las 25 bolsas. Esta revisión
requiere autorización específica adicional para ajustar el guard, ya que la
autorización anterior indicaba expresamente conservarlo sin cambios.
No se debe afirmar operativo el registro automático hasta aplicar la corrección
y verificar el resultado real del cron y la ausencia de duplicados.
