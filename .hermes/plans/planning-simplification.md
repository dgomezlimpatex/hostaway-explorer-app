# Simplificación del planificador diario

## Alcance aprobado

Simplificar la experiencia diaria de `/planning` para que una persona pueda elegir día/sede, preparar una propuesta, revisar excepciones y guardar/avisar sin entender el motor técnico.

## Reglas no negociables

- Mantener `/planning` como ruta oficial.
- No tocar el motor de propuestas, persistencia ni RPCs en esta primera ola.
- Una única acción normal de asignación: revisar la propuesta y guardar el reparto.
- No guardar ni notificar desde tarjetas aisladas de la vista diaria.
- Mantener validaciones de disponibilidad, `No apta`, solapes y bloqueo antes de aplicar.
- Dejar lo técnico bajo divulgación progresiva.
- No borrar configuración de edificios ni herramientas avanzadas; retirarlas del flujo diario visible.

## Olas

### Ola 1 — Flujo diario

- Retirar del cockpit diario la cola de asignación directa, el panel copilot duplicado y la guía repetida.
- Mantener solo filtros/diagnóstico explícitamente avanzados.
- Quitar handlers de asignación directa de la página diaria.
- Hacer que la revisión de propuesta empiece en lista/agenda y deje el calendario horario como vista opcional.
- Conservar guardado único `Guardar reparto y avisar` y descarte.

### Ola 2 — Navegación

- Dejar `/planning` como entrada diaria.
- Renombrar el acceso antiguo de `/planning-settings` para que se entienda como configuración avanzada.
- Mantener rutas antiguas accesibles durante la transición, sin presentarlas como planificación diaria.

### Ola 3 — Verificación

- Actualizar contratos UI para la nueva arquitectura.
- Añadir regresión contra asignación directa desde `/planning`.
- Ejecutar tests de dominio, propuesta, aplicación, UI, typecheck, lint dirigido y build.
- Revisar manualmente la ruta con sesión autenticada antes de declarar operativo el cambio.
