-- Instalar pg_net para permitir llamadas HTTP desde cron jobs
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Verificar que ambas extensiones estén instaladas
SELECT extname, extversion FROM pg_extension WHERE extname IN ('pg_cron', 'pg_net');