# Indicador de estado del calendario

Cambio local en `codex/calendar-task-status-20261005`, basado en la fuente recuperada `f4cceb01` para preservar las mejoras posteriores a la antigua rama main. No representa una publicación ni una comprobación actual de producción.

El fondo de las tareas del calendario mantiene el color del cliente. El indicador independiente muestra rojo/reloj para pendiente (Sin iniciar), ámbar/play para in-progress (En proceso) y verde/check para completed (Finalizada). También hay representación gris de cancelación y de estado desconocido. Usa el estado existente de la tarea; no crea estados ni modifica datos.

Un único componente comparte los símbolos entre calendario, tareas sin asignar, vista de trabajadora, agenda móvil y leyenda. El distintivo del número de personas de las tareas compartidas pasa a la esquina inferior para evitar tapar el estado. Se elimina el parpadeo de toda la tarjeta en proceso.

Verificación: build correcto; tipos de aplicación conservan los 102 diagnósticos preexistentes; tipos Node y comando raíz correctos. Lint focalizado sin errores, con dos avisos previos de dependencias de hooks en CalendarGrid. Diff sin errores de formato.

Ejemplo aislado usando componentes reales y datos ficticios en `C:/Users/danig/.codex/project-audits/calendar-status-20261005/preview.mjs`. Verificación en navegador de colores rojo/ámbar/verde, tamaño de símbolos, fondo de cliente constante, apertura de tarjetas y agenda móvil de 390px sin desbordamiento ni errores de JavaScript. Capturas desktop.png y mobile.png en ese directorio. No se verificó una sesión autenticada ni se conectó el ejemplo al backend.

El 05/10/2026 Dani autorizó publicar el semáforo. Antes de la publicación se verifica la fuente del deployment activo y se integra esa base para preservar los cambios recientes de acceso y planificación. La publicación no incluye cambios de backend ni escrituras en Supabase. La evidencia del despliegue quedará en el directorio de auditoría indicado arriba.
