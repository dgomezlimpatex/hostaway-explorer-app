# Análisis financiero · configuración compartida

## Conservación de la vista

Recuperar el foco de la pestaña del navegador no vuelve a consultar automáticamente las fuentes financieras. «Actualizar datos» permite solicitar una consulta expresamente; la pantalla y los formularios permanecen montados mientras se actualizan los datos ya cargados. Los errores de fuente siguen ocultando los totales parciales.

Fechas, filtros, sección y filtro de rentabilidad se conservan en sessionStorage por usuario y sede para volver al apartado o recargar en la misma pestaña. Esta memoria de presentación no guarda ajustes financieros ni sustituye «Guardar cambios».

## Consumos y cobro de paños

Las bolsas de basura forman parte del 3% de productos de limpieza; las bayetas son propias del trabajador. Ninguna genera un gasto adicional ni un aviso de tarifa pendiente. Otros artículos sin precio conservan sus avisos.

El paño tiene un coste inicial de 0,15 € por unidad configurada y un ingreso inicial de 0,25 € una vez por limpieza con paño. El cobro se activa inicialmente solo para Turquoise y únicamente si la propiedad tiene cantidad positiva; no se aplica a check-in ni a servicios sin ingreso. Las reglas de Consumos personalizados permiten activar o excluir ese cobro por cliente o propiedad. Ambos precios se pueden editar por fecha en Tarifas. El suplemento se muestra separado de la tarifa de propiedad y no aumenta la base del 3%.

Petición de Dani: vista general y por cliente, personalizada por fechas, clientes, propiedades y trabajadores; colores morados de Limpatex; precios iniciales sin IVA facilitados el 06/10/2026.

Ruta: `/financial-analysis`, desde Facturación en los menús de escritorio y móvil. Usa el módulo existente `reports` sin modificar roles, permisos ni políticas.

## Cálculo y procedencia

- Solo los servicios con ingreso positivo participan en el balance y en sus costes automáticos. Los servicios con cero o precio pendiente quedan en una lista visible, filtrada por periodo/cliente/propiedad/trabajador, sin sumar personal, lavandería, consumibles ni productos. El precio de propiedad se resuelve antes de esta exclusión. Un precio pendiente no se interpreta como gratuito. El salario y los gastos adicionales registrados permanecen independientes.

- Se contabilizan también las tareas pendientes/en curso asignadas: el cierre del parte no condiciona su inclusión. Se excluyen las canceladas, las tareas de fechas anteriores al día actual en Europe/Madrid sin asignación y las asignadas a NOT COUNT (por identificador del directorio o nombre normalizado en la asignación, incluida la asignación antigua). Si un equipo incluye NOT COUNT, se excluye el servicio entero. Las tareas sin asignar de hoy/futuras siguen siendo provisionales con personal pendiente. Los ingresos corresponden a servicios por fecha, no a facturas ni cobros. Se utiliza siempre `properties.coste_servicio` actual, también cuando el importe positivo antiguo de la tarea es distinto. Si falta o no es válido, el ingreso queda pendiente.
- Personal: duración total de propiedad cuando es positiva y finita; si falta, duración de tarea (`duracion`) y, en último caso, intervalo de tarea. La propiedad tiene prioridad porque la duración guardada por el planificador en la tarea puede estar ya repartida por persona y no debe dividirse dos veces. Siempre se divide entre las personas asignadas, incluida una sola persona. No se multiplica la duración total por el equipo ni se sustituye por los tiempos de apertura/cierre del parte. Se conserva el total sin redondear al alza cada persona; las horas automáticas son estimadas. Sin trabajador/horas, datos pendientes. Los ajustes manuales del análisis por persona prevalecen y mantienen tramos de 0,25 horas.
- Lavandería y amenities: dotación actual de propiedad por tarifa aplicable en la fecha del servicio. Las reglas activas de `stock_property_consumption_rules` reemplazan el campo antiguo correspondiente, nunca se suman ambos; si hay productos equivalentes, prevalece la regla más recientemente actualizada (orden estable por fecha e ID). El control de amenities respeta la propiedad y hereda del cliente. Los productos sin tarifa configurada permanecen pendientes y se muestran en el editor. La dotación actual no prueba el consumo histórico y se indica como estimada. Nórdicos, almohadas, cubrecolchones y paños sin dato quedan pendientes. El formulario permite registrar cantidades de todos los artículos y confirmar su revisión, indicando cero explícito si no se usaron.
- Las tarifas iniciales conservan tres decimales como milésimas enteras. Se redondea cada categoría por servicio a céntimos; los totales suman esos importes. Las tarifas fechadas sustituyen la inicial a partir de su fecha, con excepción específica de personal por trabajador. Reemplazar la misma fecha/concepto/trabajador es una corrección de esa tarifa y afecta ese intervalo histórico.
- Gastos adicionales: importe, categoría, fecha y vínculos opcionales a cliente, propiedad y trabajador. No añadir aquí consumos o personal ya incluidos en un servicio. Los gastos generales se suman una vez y no se reparten a clientes.
- Productos de limpieza: 3 % del ingreso sin IVA de cada servicio de tipo limpieza (incluido mantenimiento de limpieza). Se calcula una vez por servicio, no por trabajador; no aplica a check-in, desplazamientos u otros tipos. El porcentaje es editable en Tarifas con fecha de aplicación y admite entre 0 y 100. Si falta el ingreso o el tipo, se indica pendiente. Los precios de productos se guardan como milésimas de porcentaje; 3000 significa 3 %, no 3 €. Se mantienen compatibles las copias y cantidades revisadas de la configuración compartida. Figura en el desglose general, por cliente, por servicio y CSV.
- Salario dirección turismo: coste de empresa inicial de 2.317 €/mes, imputado íntegramente al resultado general de turismo y separado del personal de los servicios. Se calcula una vez por mes aun sin servicios, proporcional a los días naturales incluidos (intervalo inclusivo; se respeta febrero bisiesto). Las tarifas fechadas aplican a sus días y se redondea al final de cada mes a céntimos. Editable en Tarifas; aparece como gasto automático, no editable/eliminable desde Otros gastos ni guardado como movimiento real. Se excluye al filtrar cliente, propiedad o trabajador como los demás gastos generales sin vínculo. No se reparte a clientes y no calcula nóminas, retenciones, cotizaciones o pagos; se utiliza el coste de empresa ya facilitado. La vista sigue acotada a la sede seleccionada y no consolida sedes.
- Filtro de trabajador: selecciona servicios donde participa y conserva ingreso único y coste del equipo completo. No atribuye rentabilidad individual. Gastos generales sin vínculo se excluyen al filtrar cliente/propiedad/trabajador y se avisa.
- Totales y margen provisionales mientras haya estimaciones o costes incompletos. No hay beneficio neto contable ni cálculo fiscal.

## Guardado y límites

Tarifas, ajustes, reglas personalizadas, ingresos y gastos se guardan en `financial_settings`, una configuración por sede, accesible desde otros dispositivos. Los formularios actualizan un borrador: «Guardar cambios» comparte; «Descartar y recargar» recupera la última versión. El contador de revisión impide que un editor sobrescriba cambios simultáneos. Los errores de carga ocultan balances; los errores de guardado conservan el borrador. Solo administradores y gestores con sede accesible pueden leer/guardar; sin acceso anónimo. Se registra autor y fecha del último cambio. No se modifican permisos existentes ni tareas, propiedades, stock, fichajes, facturas, comunicaciones o PMS.

Las copias JSON anteriores siguen siendo válidas. Importarlas requiere revisar una sustitución completa del borrador y guardar explícitamente; no se borran ni importan automáticamente los ajustes anteriores del navegador. Se exporta configuración JSON y tabla CSV con ingresos generales incluidos.

## Reglas acordadas e ingresos externos

- Personal general 14,50 €/h; Montse 1,5 h totales, sin lavandería ni amenities/consumibles; check-in por tipo o nombre de propiedad: 1 h total, solo personal.
- Marina30: sin lavandería, kits ni papel; Panfalas: lavandería según ficha, sin kits. Las reglas son editables por cliente/propiedad; la de propiedad tiene prioridad. Los ajustes manuales explícitos por servicio permanecen prioritarios.
- Productos: 3% sobre la tarifa base de limpieza; se excluye el suplemento de recepción virtual.
- Marina30 virtual: 627,35 €/mes. Santa Catalina nocturna: 1.329,60 €/mes y 16 h/semana. Albergue SP55: 2.493,69 €/mes y 35 h/semana. Sin otros costes fijos añadidos.
- Personal mensual de estos servicios: horas semanales × 4,345 × tarifa horaria. Prorrateo por días naturales inclusivos y tarifa vigente cada día; redondeo por contrato y mes.
- Turquoise: 2,75 € adicionales por cada limpieza contabilizable de todas sus propiedades; se excluyen check-in y servicios sin ingreso. Figura en el ingreso del servicio, no como un segundo ingreso externo.
- Lavandería externa septiembre: Santa Catalina ingreso 2.505,45 €, coste 2.024,70 €; SP55 ingreso 1.217,35 €, coste 845,66 €. Son entradas puntuales de septiembre, no se repiten automáticamente.
- Un servicio mensual tiene una sola entrada por contrato/mes. La excepción mensual reemplaza importes y horas, no añade otra entrada. Los ingresos puntuales usan una fecha. Vínculos opcionales de cliente, propiedad y trabajador; mismo criterio de filtros que gastos. Los costes externos vacíos quedan pendientes, mientras 0 es un coste confirmado nulo.
- Inicio de los fijos: septiembre 2026; editable. SP55 se registra como actividad general porque no existe cliente/propiedad equivalente en el directorio; no se crea un cliente operativo nuevo.
- Dirección turismo se imputa en A Coruña; tarifa 0 en las demás sedes para no duplicar los 2.317 € al sumar los análisis. La página continúa mostrando la sede seleccionada; no consolida sedes.
- «Servicios» permite revisar resultado negativo o margen inferior al 10%; ambos son provisionales cuando faltan datos.

La migración se limita a una tabla nueva y sus permisos/trigger de revisión, se prueba localmente en Postgres aislado y se entrega mediante reserva revisada. La configuración inicial real se carga fuera de Git únicamente durante ese turno y con la autorización específica de Dani.

## Verificación

`node scripts/financialAnalysisTest.mjs`: código real de cálculo y adaptación; catálogo, precisión, dos personas, tarifas históricas/específicas, filtros, gasto general y gasto sin servicios, cantidades/horas ausentes, cero explícito, validación JSON y paginación/error.

`node scripts/financialAnalysisBrowserTest.mjs`: página y lector reales con cliente Supabase simulado sin red productiva; sede, cantidades, filtros, tarifas, gasto general, editor, recarga, escritorio y móvil. Usa CSS generado por build. El navegador no usa una sesión real.

Build, tipos de aplicación y Node comparados con la base y lint focalizado antes de entrega. La cola repite la prueba de cálculo sin red.

`node scripts/financialExternalIncomeTest.mjs`: ingresos fijos/puntuales/suplementos, factor semanal, periodos y excepciones, filtros, reglas personalizadas, tarifas de propiedad y validación.

`node scripts/financialSettingsDatabaseTest.mjs`: migración real en PGlite aislado, RLS por rol/sede, bloqueo anónimo/borrado y concurrencia por revisión.

El navegador prueba además guardado compartido entre dos contextos, errores de carga/guardado y conflicto de revisiones, con backend simulado sin acceso a producción.
