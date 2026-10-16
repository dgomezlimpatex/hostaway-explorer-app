# Corrección del proceso automático de lavandería

La primera ejecución de PR148 bloqueó 25 bolsas por el guard de rutas V2: cron ejecuta como postgres sin JWT. Todas las operaciones se revirtieron, sin eventos ni stock parcial.

Supabase rechazó dos propuestas que configuraban parámetros en la función (JWT y señal personalizada). Ambas transacciones se revirtieron completas; sus reservas fueron canceladas y reconciliadas, sin merge ni publicación.

La solución final no configura parámetros. El guard conserva el acceso del servidor de rutas y admite también la conexión interna session_user=postgres, sin rol JWT, exclusivamente para registrar delivered/collected de una bolsa con operación privada pendiente y enlace coincidente. No confunde session_user con el propietario de SECURITY DEFINER. Conserva el guard del ciclo físico, los permisos y RLS. El proceso privado valida fecha, tarea, bolsa, ruta y stock antes del registro atómico.

Reabre únicamente el error conocido de rutas de hoy/futuras. El siguiente tick repite las validaciones e idempotencia. No toca otros bloqueos ni históricos.

Dani autorizó explícitamente ajustar el guard para admitir al proceso interno manteniendo bloqueados los clientes y reprocesar las 25 bolsas.

Prueba aislada: node scripts/laundrySchedulerServerContextTest.mjs. Reproduce el fallo y rollback; comprueba éxito y descuento único tras corrección, ausencia de duplicados, rechazo de escritura directa sin operación pendiente y rechazo de conexión API authenticator incluso con operación pendiente. No conecta a producción.
