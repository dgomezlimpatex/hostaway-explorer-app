

# Crear documento de planificacion para la sincronizacion con Google Sheets

## Que se hara

Se creara un archivo `docs/google-sheets-sync-plan.md` en la raiz del proyecto con toda la documentacion del plan de sincronizacion automatica con Google Sheets. Este archivo quedara versionado en el repositorio y sera accesible para cualquier miembro del equipo.

## Contenido del documento

El archivo incluira:

- Resumen del objetivo (sincronizar reservas desde Google Sheets)
- Prerequisitos (cuenta de servicio, permisos de lectura)
- Frecuencia de ejecucion (cada 5 horas: 07:00, 12:00, 17:00, 22:00)
- Tabla de mapeo de columnas del Sheets a la base de datos
- Estructura de las tablas nuevas (`sheets_reservations`, `sheets_sync_logs`)
- Logica de sincronizacion completa (crear, actualizar, cancelar)
- Secretos necesarios para la configuracion
- Detalles de la Edge Function

## Detalles tecnicos

### Archivo a crear
- `docs/google-sheets-sync-plan.md`

No se modifica ningun archivo existente ni se altera el comportamiento de la aplicacion. Es solo documentacion.

