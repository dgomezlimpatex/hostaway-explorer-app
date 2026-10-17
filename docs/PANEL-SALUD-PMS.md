# Panel «Estado de los PMS»

Ruta `/sincronizaciones` (menú «Sincronizaciones» → «Estado de los PMS»), solo administración, igual que las
pantallas de Smoobu y Little Hotelier. Es de **solo lectura**: reúne lo que cada PMS ya deja registrado. «Actualizar»
vuelve a leer; no inicia sincronizaciones, no escribe y no llama a ningún PMS. La página «Integraciones» de la app es
la importación de empleados de REGISTRO, no de PMS, por eso el panel vive en «Sincronizaciones».

Código: `src/features/pmsHealth/` (`pmsHealthDomain.ts` estados, `pmsHealthEvidence.ts` filas → evidencia,
`pmsHealthReads.ts` lecturas, `usePmsHealth.ts`, `PmsHealthPanel.tsx`) y `src/pages/PmsHealth.tsx`.
Pruebas: `scripts/pmsHealthDomainTest.mjs` (Node, datos ficticios) y `scripts/pmsHealthBrowserTest.mjs` (Chromium local).
Propuesta de registro por ejecución (no aplicada): `docs/PROPUESTA-REGISTRO-POR-EJECUCION-LH.md`.

## Fuentes reales y límites

| | Smoobu | Little Hotelier |
|---|---|---|
| Historial | `smoobu_sync_runs`: una fila por pasada **terminada** (modo real/simulación, leídas, altas, reprogramadas, canceladas, errores, sin mapear, detalle) | `lh_sync_logs`: **eventos por reserva recibida**, no un registro por pasada; las filas separadas menos de 10 min se agrupan como una pasada |
| Peticiones manuales | `smoobu_sync_requests` (pendiente, en curso, completada, error) | no existen |
| Horario esperado | 08:00, 15:00 y 19:00 de Madrid (el que declara la pantalla de Smoobu) + 30 min de margen | 09:00, 14:00 y 20:00 de Madrid, declarado por Dani para la automatización local + 30 min de margen. La app no puede comprobar que siga activa |
| Estado | global: sus registros no llevan sede | global («Estado global de Little Hotelier»): los eventos no llevan sede |
| Sin vincular | reservas vigentes de `smoobu_reservations` sin mapeo activo en `smoobu_property_mappings` (canceladas fuera). No tienen propiedad, luego tampoco sede | ver abajo |

### Little Hotelier: programación, ejecución e importación confirmada

Son tres cosas distintas y el panel no las mezcla:

- **Programación**: el horario esperado. Solo es una intención.
- **Ejecución**: ninguna fuente consultable la registra (el resumen de cada pasada vive en un fichero local del
  equipo). El panel muestra «Sin información de ejecución».
- **Importación confirmada**: la última pasada con reservas recibidas y ningún error. No prueba que se recibieran todas.

«Datos desactualizados» compara con la **última pasada esperada ya vencida** (hora + margen), no con un límite fijo:
de noche no avisa mientras no venza la siguiente. El texto dice «No constan reservas recibidas de la pasada de
las HH:MM» y explica que puede no haberse ejecutado, haber fallado antes de enviar o no haber encontrado reservas:
esos tres casos no dejan ningún evento. Una pasada que empieza claramente fuera de horario se rotula «fuera de
horario (posible manual)»; es una inferencia y cuenta como datos recibidos.

### Little Hotelier: casos de vinculación y sede

La sede NO se toma de `lh_reservations.sede_id` (el receptor antiguo la rellenaba con la del primer mapeo
encontrado). Se deduce del mapeo de la habitación (`lh_room_mapping.sede_id`), comprobando la sede de su propiedad.

- Reserva sin habitación identificada → sin sede atribuible. Cuenta para el estado global.
- Habitación sin ninguna propiedad vinculada → sin sede atribuible. Cuenta para el estado global.
- Habitación con todos sus mapeos pausados → se asocia a la sede de esos mapeos; solo se ve en esa sede.
- Mapeo de salida pendiente / mapeo de estancia pendiente → **«Configuración por revisar»**, en la sede del mapeo
  que sí existe. Nada en la configuración (`properties`, `lh_room_mapping`) indica qué servicios necesita cada
  habitación, así que no se trata como obligatorio ni cambia el estado global; se muestran los casos concretos.
- La sede del mapeo no coincide con la de su propiedad → «Configuración por revisar», visible en las dos sedes.

Cada sede ve solo lo suyo y lo que no tiene sede. Sin sede activa, el panel dice «Sin información disponible por
sede». Cambiar de sede no vuelve a leer datos: solo cambia lo que se muestra.

### Limitaciones que el panel no puede salvar

- **Smoobu no registra el inicio de una pasada automática**, solo su final. «En ejecución» solo se ve en peticiones
  manuales (`en_curso`); una pasada automática colgada antes de escribir su fila aparece como «Datos desactualizados».
- **Little Hotelier**: sin cero reservas, fallos previos al envío ni peticiones perdidas en el registro; el receptor
  desplegado (v84) no escribe `lh_sync_logs` por sí mismo y la función SQL que lo haga no está en el repositorio.
  «Recibiendo datos» se deduce de eventos de hace menos de 5 min. Las filas no distinguen una reserva modificada
  de una sin cambios (no se muestran «modificadas»).
- Los registros del equipo local (Programador de tareas, ficheros de log, estado del ejecutor) no son accesibles desde la app.
- Ninguna fuente confirma si una integración está activada: **«Desactivada» no se muestra** y la falta de registros
  nunca se interpreta como desactivada. El dominio ya lo soporta (`enabled: false`).
- Las tablas de Smoobu no tienen migración en el repositorio ni tipos generados; su política de lectura no se ha inspeccionado.

## Qué significa cada estado

- **Al día**: el último intento importó datos sin fallos y consta la pasada esperada.
  «No hay nuevas reservas» es éxito: hubo lectura y ningún cambio.
- **Con advertencias**: importa, pero hay errores parciales, una pasada que no leyó ninguna reserva (terminar sin error
  no prueba la importación), reservas sin vincular ni sede, o alguna lectura del propio panel falló.
- **Datos desactualizados**: falta una pasada que ya debería constar según el horario.
- **Error**: el último intento falló (aunque haya un éxito anterior) o una ejecución manual lleva 30 min o más en curso.
- **En ejecución**: hay una ejecución en marcha. El fallo anterior sigue visible.
- **Sin información suficiente**: historial vacío, diagnóstico no consultable, solo simulaciones, o sin frecuencia de
  referencia para valorar la antigüedad.
- **Desactivada**: solo si la configuración lo confirma.

Un fallo al consultar el diagnóstico nunca da un estado verde. Los mensajes de error se depuran antes de mostrarse
(sin trazas, correos, enlaces, claves ni números largos) y no se leen cargas de reservas ni nombres de huéspedes.
