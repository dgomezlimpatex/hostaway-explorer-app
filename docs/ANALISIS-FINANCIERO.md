# Análisis financiero · primera versión

Petición de Dani: vista general y por cliente, personalizada por fechas, clientes, propiedades y trabajadores; colores morados de Limpatex; precios iniciales sin IVA facilitados el 06/10/2026.

Ruta: `/financial-analysis`, desde Facturación en los menús de escritorio y móvil. Usa el módulo existente `reports` sin modificar roles, permisos ni políticas.

## Cálculo y procedencia

- Se contabilizan también las tareas pendientes/en curso asignadas: el cierre del parte no condiciona su inclusión. Se excluyen las canceladas, las tareas de fechas anteriores al día actual en Europe/Madrid sin asignación y las asignadas a NOT COUNT (por identificador del directorio o nombre normalizado en la asignación, incluida la asignación antigua). Si un equipo incluye NOT COUNT, se excluye el servicio entero. Las tareas sin asignar de hoy/futuras siguen siendo provisionales con personal pendiente. Los ingresos corresponden a servicios por fecha, no a facturas ni cobros. `tasks.coste` incluye un cero explícito; si falta, la tarifa actual de propiedad es una estimación. Si también falta, ingreso pendiente.
- Personal: minutos de reporte por trabajador cuando sus fechas son válidas; en su defecto, intervalo previsto de tarea. Si falta ese intervalo, duración total de la propiedad repartida entre trabajadores y redondeada al cuarto de hora siguiente. Todas estas alternativas previstas se señalan como estimadas. Sin trabajador/horas, datos pendientes. El ajuste manual de horas se introduce en cuartos de hora por trabajador.
- Lavandería y amenities: dotación actual de propiedad por tarifa aplicable en la fecha del servicio. La dotación actual no prueba el consumo histórico y se indica como estimada. Nórdicos, almohadas, cubrecolchones y paños sin dato quedan pendientes. El formulario permite registrar cantidades de todos los artículos y confirmar su revisión, indicando cero explícito si no se usaron.
- Las tarifas iniciales conservan tres decimales como milésimas enteras. Se redondea cada categoría por servicio a céntimos; los totales suman esos importes. Las tarifas fechadas sustituyen la inicial a partir de su fecha, con excepción específica de personal por trabajador. Reemplazar la misma fecha/concepto/trabajador es una corrección de esa tarifa y afecta ese intervalo histórico.
- Gastos adicionales: importe, categoría, fecha y vínculos opcionales a cliente, propiedad y trabajador. No añadir aquí consumos o personal ya incluidos en un servicio. Los gastos generales se suman una vez y no se reparten a clientes.
- Productos de limpieza: 3 % del ingreso sin IVA de cada servicio de tipo limpieza (incluido mantenimiento de limpieza). Se calcula una vez por servicio, no por trabajador; no aplica a check-in, desplazamientos u otros tipos. El porcentaje es editable en Tarifas con fecha de aplicación y admite entre 0 y 100. Si falta el ingreso o el tipo, se indica pendiente. Los precios de productos se guardan como milésimas de porcentaje; 3000 significa 3 %, no 3 €. Se mantienen compatibles las copias y cantidades revisadas de la primera versión. Figura en el desglose general, por cliente, por servicio y CSV.
- Salario dirección turismo: coste de empresa inicial de 2.317 €/mes, imputado íntegramente al resultado general de turismo y separado del personal de los servicios. Se calcula una vez por mes aun sin servicios, proporcional a los días naturales incluidos (intervalo inclusivo; se respeta febrero bisiesto). Las tarifas fechadas aplican a sus días y se redondea al final de cada mes a céntimos. Editable en Tarifas; aparece como gasto automático, no editable/eliminable desde Otros gastos ni guardado como movimiento real. Se excluye al filtrar cliente, propiedad o trabajador como los demás gastos generales sin vínculo. No se reparte a clientes y no calcula nóminas, retenciones, cotizaciones o pagos; se utiliza el coste de empresa ya facilitado. La vista sigue acotada a la sede seleccionada y no consolida sedes.
- Filtro de trabajador: selecciona servicios donde participa y conserva ingreso único y coste del equipo completo. No atribuye rentabilidad individual. Gastos generales sin vínculo se excluyen al filtrar cliente/propiedad/trabajador y se avisa.
- Totales y margen provisionales mientras haya estimaciones o costes incompletos. No hay beneficio neto contable ni cálculo fiscal.

## Guardado y límites

Tarifas, ajustes y gastos adicionales se guardan en localStorage por usuario y sede. No se comparten entre equipos, navegadores ni dominios. Se exporta/restaura copia JSON validada con confirmación de sustitución y se exporta la tabla en CSV. Restaurar sustituye los ajustes locales, no servicios ni datos productivos. Una configuración corrupta nunca se sobrescribe silenciosamente.

Se leen tablas existentes con el cliente y permisos actuales, acotando sede y fechas y paginando con orden estable. Un fallo de cualquier fuente impide mostrar un total parcial. No se modifica Supabase, stock, tareas, fichajes, facturas, comunicaciones ni PMS. Para compartir estos ajustes entre equipos hace falta una siguiente fase de persistencia revisada y autorización específica de esquema/datos.

## Verificación

`node scripts/financialAnalysisTest.mjs`: código real de cálculo y adaptación; catálogo, precisión, dos personas, tarifas históricas/específicas, filtros, gasto general y gasto sin servicios, cantidades/horas ausentes, cero explícito, validación JSON y paginación/error.

`node scripts/financialAnalysisBrowserTest.mjs`: página y lector reales con cliente Supabase simulado sin red productiva; sede, cantidades, filtros, tarifas, gasto general, editor, recarga, escritorio y móvil. Usa CSS generado por build. El navegador no usa una sesión real.

Build, tipos de aplicación y Node comparados con la base y lint focalizado antes de entrega. La cola repite la prueba de cálculo sin red.
