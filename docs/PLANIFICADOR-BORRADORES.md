# Planificador diario: recuperar el reparto sin guardar

Disponible desde la entrega de 2026-10-17. Pensado para no perder el reparto pendiente si se
recarga la página, se cierra la pestaña o el navegador, o se sale de la pantalla.

## Qué ve el usuario

- Mientras edita el reparto, la barra inferior indica «Borrador conservado en este navegador,
  modificado a las HH:MM. Aún no está aplicado a las limpiezas reales». Solo aparece tras
  confirmar la escritura. Si no se pudo conservar (almacenamiento lleno, bloqueado…) se avisa en
  ámbar y se explica el motivo.
- Al volver, un aviso dice, por ejemplo: «Tienes un reparto sin guardar del 17/10, modificado a
  las 18:42. Afecta a 8 tareas.» con **Recuperar borrador** y **Descartar borrador** (el descarte
  pide confirmación).
- Recuperar deja los cambios pendientes en pantalla. Solo **Guardar cambios** los aplica a las
  tareas reales, con las validaciones de siempre. Recuperar y descartar no escriben tareas ni
  envían avisos.
- Tres estados distintos: borrador conservado en este navegador (chip morado), cambios
  pendientes de aplicar (pie de página del reparto) y reparto guardado de verdad («¡Reparto
  guardado!»).

## Dónde y cómo se conserva

- `localStorage` del navegador, una clave por **usuario + sede + día (o rango 7/30 días) +
  versión del formato**: `limpatex:planning-draft:v1:<usuario>:<sede>:<inicio>:<fin>`.
  Elegido por tamaño (decenas de KB), escritura síncrona (sobrevive al cierre de la pestaña) y
  porque ya es el patrón de la app. No hay dependencias nuevas.
- Se guarda lo mínimo: identificadores de tarea y trabajadora, operación (asignar/desasignar),
  horarios, duración, motivos de la propuesta y una línea base (cómo estaban la tarea y la
  disponibilidad al construir el borrador). No se guardan nombres de trabajadoras, tokens ni
  selecciones visuales.
- Es **solo de este navegador**: no hay recuperación en otro dispositivo ni tras borrar los datos
  del navegador. Los borradores sin cambios durante 30 días se limpian solos. Cerrar sesión no
  borra el borrador, pero solo ese usuario puede verlo.
- Se escribe durante la edición (retardo de 0,5 s) y también al ocultar o cerrar la pestaña.

## Carreras y varias pestañas

- Cada escritura lleva una revisión numerada y solo se hace si lo almacenado sigue siendo la
  revisión que esa pantalla conoce. Si otra pestaña (o una sesión anterior) dejó otra versión, la
  pantalla **no escribe** y pide elegir: «Recuperar borrador» (sustituye lo que ve, con
  confirmación) o «Descartar borrador» (conserva lo de la pantalla).
- Descartar la propuesta o guardar «cierra» el borrador de esa pantalla: una escritura retrasada
  no lo resucita. Tras un guardado confirmado solo se elimina la revisión guardada; si otra
  pestaña dejó una más reciente, se conserva.
- Si el guardado falla o su resultado es incierto, el borrador se conserva y el reintento vuelve
  a leer el estado actual de las tareas antes de escribir (validación habitual).

## Validación al recuperar

Antes de recuperar se relee el estado real y se valida tarea a tarea. Una tarea se recupera
completa o no se recupera. No se recupera si: ya no existe, está cancelada o completada, cambió
de día/horario/responsables/personas necesarias o edificio, la trabajadora ya no está activa, está
marcada como no apta para el edificio o cambió su disponibilidad ese día. Los cambios ajenos a las
tareas del borrador no lo invalidan. Si se puede recuperar solo una parte, se explica qué se
recupera y qué no; si no se puede nada, se bloquea y el borrador se conserva hasta descartarlo.

## Limitaciones conocidas

- No se comparan cambios en las reglas de equipo por edificio (prioridades) más allá de «no
  apta»; cualquier cambio real en horarios o responsables sí se detecta.
- Un borrador de una versión futura de la app no se lee ni se sobrescribe (se avisa).
- Los repartos de varios días se conservan como una sola unidad (el rango real de planificación).
- Las tareas de equipo aparecen una vez por trabajadora en los datos de la pantalla (comportamiento
  previo); el borrador las trata por identificador de tarea.
