# Panel «Estado de los PMS»

Ruta `/sincronizaciones` (menú «Sincronizaciones» → «Estado de los PMS»), solo administración, igual que las
pantallas de Smoobu y Little Hotelier. Es de **solo lectura**: reúne lo que cada PMS ya deja registrado. «Actualizar»
vuelve a leer; no inicia sincronizaciones, no escribe y no llama a ningún PMS. La página «Integraciones» de la app es
la importación de empleados de REGISTRO, no de PMS, por eso el panel vive en «Sincronizaciones».

Código: `src/features/pmsHealth/` (`pmsHealthDomain.ts` estados, `pmsHealthEvidence.ts` filas → evidencia,
`pmsHealthReads.ts` lecturas, `usePmsHealth.ts`, `PmsHealthPanel.tsx`) y `src/pages/PmsHealth.tsx`.
Pruebas: `scripts/pmsHealthDomainTest.mjs` (Node, datos ficticios) y `scripts/pmsHealthBrowserTest.mjs` (Chromium local).

## Fuentes reales y límites

| | Smoobu | Little Hotelier |
|---|---|---|
| Historial | `smoobu_sync_runs`: una fila por pasada **terminada** (modo real/simulación, leídas, altas, reprogramadas, canceladas, errores, sin mapear, detalle) | `lh_sync_logs`: una fila por reserva **recibida**; las filas separadas menos de 10 min forman una pasada |
| Peticiones manuales | `smoobu_sync_requests` (pendiente, en curso, completada, error) | no existen |
| Sin vincular | reservas vigentes de `smoobu_reservations` sin mapeo activo en `smoobu_property_mappings` (canceladas fuera) | reservas vigentes de la sede activa en `lh_reservations`: habitaciones sin ningún mapeo activo en `lh_room_mapping`, y reservas sin habitación asignada |
| Horario esperado | 08:00, 15:00 y 19:00 de Madrid (el mismo que declara la pantalla de Smoobu) más 30 min de cortesía | **no declarado en la app**: la pasada corre en un equipo local |
| Sede | sin sede (la pantalla de Smoobu tampoco filtra) | historial sin sede; «sin vincular» se acota a la sede activa |

Limitaciones que el panel no puede salvar:

- **Smoobu no registra el inicio de una pasada automática**, solo su final. «En ejecución» solo se ve en peticiones
  manuales (`en_curso`); una pasada automática colgada antes de escribir su fila aparece como «Datos desactualizados».
- **Little Hotelier** no guarda el resultado de una pasada sin reservas ni un fallo previo al envío: la falta de filas no
  distingue «no se ejecutó» de «se ejecutó sin enviar nada». «Recibiendo datos» se deduce de que haya filas de hace
  menos de 5 min. Las filas no distinguen una reserva modificada de una sin cambios, por eso no se muestran «modificadas».
- Los registros del equipo local (Programador de tareas, vigilancias, ficheros de log) no son accesibles desde la app.
- Ninguna fuente confirma si una integración está activada: **«Desactivada» no se muestra** hasta que exista esa
  configuración. El dominio ya lo soporta (`enabled: false`).
- Las tablas de Smoobu no tienen migración en el repositorio ni tipos generados (se consultan como en su pantalla);
  su política de lectura es la de producción y no se ha inspeccionado.

## Qué significa cada estado

- **Al día**: el último intento importó datos sin fallos y consta la pasada esperada.
  «No hay nuevas reservas» es éxito: hubo lectura y ningún cambio.
- **Con advertencias**: importa, pero hay errores parciales, una pasada que no leyó ninguna reserva (terminar sin error
  no prueba la importación), reservas sin vincular, o alguna lectura del propio panel falló.
- **Datos desactualizados**: falta una pasada que ya debería constar según el horario.
- **Error**: el último intento falló (aunque haya un éxito anterior) o una ejecución manual lleva 30 min o más en curso.
- **En ejecución**: hay una ejecución en marcha. El fallo anterior sigue visible.
- **Sin información suficiente**: historial vacío, diagnóstico no consultable, solo simulaciones, o sin frecuencia de
  referencia para valorar la antigüedad (Little Hotelier: se muestra la antigüedad sin afirmar incumplimiento).
- **Desactivada**: solo si la configuración lo confirma.

Un fallo al consultar el diagnóstico nunca da un estado verde. Los mensajes de error se depuran antes de mostrarse
(sin trazas, correos, enlaces, claves ni números largos) y no se leen cargas de reservas ni nombres de huéspedes.

## Para declarar el horario de Little Hotelier

Cuando Dani confirme las horas, basta rellenar `LITTLE_HOTELIER_SCHEDULE` en `pmsHealthEvidence.ts`; el panel empezará a
valorar «Datos desactualizados» sin más cambios.
