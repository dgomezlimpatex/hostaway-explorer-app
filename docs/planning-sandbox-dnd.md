# Drag & Drop del sandbox de Hermes — auditoría, decisiones y especificación

## Fase 0 — Auditoría verificada

### Anatomía

- `src/components/cleaning-planning/CleaningPlanningPage.tsx`: obtiene tareas, limpiadoras, disponibilidad efectiva y datos de edificios; genera la propuesta y abre el sandbox.
- `src/components/cleaning-planning/AssignmentProposalPanel.tsx`: mantiene `draftProposals` en estado React y `sessionStorage`; solo envía el borrador al pulsar **Guardar reparto**.
- `src/components/cleaning-planning/PlanningProposalCalendar.tsx`: renderiza agenda móvil y timeline desktop por columnas de trabajadora.
- `src/utils/cleaning-planning/proposalEngine.ts`: fuente de verdad de candidatura, disponibilidad, capacidad, ventanas, buffers, solapes, límites y roles.

Una propuesta es `AssignmentProposal`: `taskId`, `cleanerId/name`, edificio, rol, duración, horario propuesto, posición para tareas multi-limpiadora, confianza, razones/avisos y capacidad posterior. El semáforo se deriva del rol/origen: titular verde; suplente/backup o cambio manual ámbar; sin cubrir rojo.

Edición previa: tocar/clicar tarjeta → diálogo **Elegir responsable** → elegir candidata. Base: 2 interacciones. Una roja seguía el mismo flujo: tocar roja → elegir candidata, 2 interacciones. El timeline desktop es horizontal, columnas de 250 px y tarjetas absolutas; móvil era una lista. La bandeja roja era un bloque inferior siempre visible si había rojos.

Inventario: no había librería DnD. El calendario operativo antiguo usa HTML5 Drag Events, insuficiente para táctil/accesibilidad. Estado del sandbox: local + `sessionStorage`, sin persistencia real antes de aprobar. El selector filtraba equipo/no-apta, pero no reutilizaba la validación integral del motor.

## Fase 1 — Test del principiante

La UI inicial no hacía descubrible el arrastre: no había asa, elevación ni destinos reactivos. Una coordinadora nueva no podía saber dónde soltar ni por qué un destino era inválido. Para deshacer solo existía **Restablecer propuesta**, que revierte todo. Resultado: falla el test del principiante.

Criterio adoptado: asa visible (sin tutorial), tarjeta elevada al coger, destinos verdes/rojos con motivo, cancelación al soltar fuera/Esc y aviso inmediato con **Deshacer**.

## Fase 2 — Registro de decisiones

### DECISIÓN #1: técnica DnD
- Posturas: UX pide feedback y cancelación; Frontend compara dnd-kit, Pangea y Pointer Events; Móvil exige sensores táctiles; Diablo exige teclado/cancelación.
- Resolución: `@dnd-kit/core`, sin `sortable`.
- Justificación: Pointer/Touch/Keyboard, colisiones y overlay sin imponer estructura de lista. Pangea encaja peor con timeline libre; nativo duplicaría accesibilidad y sensores.

### DECISIÓN #2: inicio del gesto móvil
- Posturas: Móvil rechaza arrastre inmediato; UX pide affordance explícita; Ops prioriza evitar accidentes.
- Resolución: asa dedicada de al menos 44 px y TouchSensor con espera de 250 ms y tolerancia de movimiento; el resto de la tarjeta abre Reasignar.
- Justificación: preserva scroll horizontal/vertical y hace el gesto deliberado.

### DECISIÓN #3: zona Sin cubrir
- Posturas: Ops exige rojos imposibles de ignorar; UX pide bandeja propia; Diablo cuestiona desasignar.
- Resolución: bandeja roja propia, visible mientras haya tareas sin cubrir y origen de arrastre. No se permite trabajador → Sin cubrir en v1.
- Justificación: cubre el alcance solicitado sin añadir una acción destructiva no pedida. Desasignar seguirá fuera de esta misión.

### DECISIÓN #4: validación de destinos
- Posturas: Ops/Diablo exigen no corromper; Frontend exige fuente única; UX pide explicación.
- Resolución: híbrido estricto: restricciones del motor son bloqueos duros; no hay override. Los destinos se precalculan con `validateDraftAssignmentMove`, extraído dentro de `proposalEngine.ts` usando sus helpers. Avisos no restrictivos pueden mostrarse, pero no saltarse reglas duras.
- Justificación: un drop válido queda en un gesto; uno inválido nunca muta el borrador.

### DECISIÓN #5: feedback durante el gesto
- Posturas: UX pide elevación, atenuación y destinos; Móvil pide targets legibles; Diablo pide razón del bloqueo.
- Resolución: overlay de tarjeta; origen atenuado; zonas válidas verdes e inválidas rojas; texto breve de motivo al pasar/focalizar.
- Justificación: la interacción se entiende sin tutorial.

### DECISIÓN #6: resultado y semáforo
- Posturas: Ops pide semáforo/horas instantáneos; Frontend pide actualización local.
- Resolución: aplicar sincrónicamente resultado del validador (rol, horario, duración y capacidad); la tarjeta cambia a titular o suplente/backup/revisada y los totales se derivan del nuevo draft.
- Justificación: feedback <200 ms sin persistencia ni red.

### DECISIÓN #7: deshacer
- Posturas: UX pide 1 clic; Ops teme perder trabajo; Diablo prueba movimientos rápidos.
- Resolución: guardar snapshot anterior por movimiento y mostrar aviso `Movimiento realizado` con botón **Deshacer**; reemplazar snapshot en cada movimiento.
- Justificación: revierte el último gesto en una interacción; Restablecer conserva su función global.

### DECISIÓN #8: tareas bloqueadas/pineadas
- Posturas: Diablo pide tratamiento explícito.
- Resolución: `[NO ENCONTRADO]` como propiedad de tarea/propuesta. No se inventa pin. `isStale`, tareas existentes y operaciones en curso sí bloquean DnD.
- Justificación: respeta el modelo real.

### DECISIÓN #9: convivencia con Reasignar
- Posturas: Móvil/Accesibilidad prefieren botón; UX evita competencia.
- Resolución: tarjeta/botón sigue abriendo **Elegir responsable**; el asa es una acción secundaria visible. El mismo validador filtra ambos caminos.
- Justificación: fallback accesible y natural en móvil.

### DECISIÓN #10: granularidad
- Posturas: Frontend y Diablo alertan de ambigüedad entre fechas; Ops solo necesita responsables.
- Resolución: exclusivamente entre trabajadoras del mismo día mostrado; el drop no cambia fecha ni hora manualmente.
- Justificación: alcance mínimo y seguro.

## Fase 3 — Especificación

### Presupuestos

- Reasignar válida: coger asa → soltar, un gesto.
- Cubrir roja: coger asa → soltar, un gesto.
- Deshacer: un clic.
- Toda mutación pasa por `validateDraftAssignmentMove`.

### Ciclo desktop

1. Idle: asa visible `Arrastrar [propiedad]`; tarjeta conserva `Reasignar`.
2. Grab: elevación/overlay; se calculan destinos del día.
3. Drag: válidos verdes; inválidos rojos; auto-scroll del contenedor; `Esc` cancela.
4. Drop válido: mutación local inmediata, semáforo/horas recalculados, `Movimiento realizado · Deshacer`.
5. Drop inválido: no muta; `No se puede asignar a [nombre]: [motivo]`.
6. Fuera/mismo origen: cancelación/no-op.

### Ciclo móvil

1. Idle: scroll normal; tarjeta/botón abre selector.
2. Grab: mantener asa 250 ms; feedback visual al activarse.
3. Drag: lista compacta de destinos de al menos 44 px, válida/invalidada; auto-scroll cuando proceda.
4. Drop/cancelación: igual que desktop. Movimiento antes del umbral se interpreta como scroll/cancelación.

### Estado

- `draftProposals` sigue siendo la única copia editable y se conserva en `sessionStorage` con firma del original.
- `previousDraftProposals` conserva solo el snapshot del último movimiento.
- La validación es sincrónica y local porque disponibilidad, tareas, equipo y draft ya están cargados.
- El diff frente a `originalProposals` sigue siendo implícito en el array draft; **Guardar reparto** recibe únicamente el draft cubierto existente.
- No se escribe ninguna asignación real durante drag, validación o deshacer.

### Microcopy

- Asa: `Arrastrar {propiedad}`.
- Éxito: `Movimiento realizado. {propiedad} ahora está con {trabajadora}.`
- Inválido: `No se puede asignar a {trabajadora}: {motivo}`.
- Deshacer: `Deshacer`.
- Estado táctil: `Mantén pulsada el asa y arrastra hasta una responsable.`
