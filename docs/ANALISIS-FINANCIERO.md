# Análisis financiero · configuración compartida

## Conservación de la vista

El selector «Mes» aplica desde el primer hasta el último día del mes y año elegidos, incluido febrero bisiesto. Conserva los filtros de cliente, propiedad y trabajador. Las fechas Desde/Hasta siguen disponibles para periodos personalizados; el selector refleja un mes solo cuando las fechas cubren ese mes completo. La selección se recupera desde las fechas recordadas.

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

Los importes admiten decimales con coma o punto y miles con punto cuando llevan coma decimal (por ejemplo, 1234,56, 1234.56 o 1.234,56). Se rechazan agrupaciones incorrectas y exceso de decimales. Un punto decimal sin coma conserva su significado anterior, incluido 0.247 en las tarifas. El formulario de ingresos identifica si el error corresponde al ingreso o al coste; añadirlo sigue creando un borrador hasta «Guardar cambios».

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

## Panel visual — octubre 2026

General mantiene cuatro indicadores sin IVA y añade columnas agrupadas de ingresos, gastos y resultado, distribución de gastos por columnas, columnas del origen de los ingresos y rentabilidad por cliente en euros o porcentaje. Los gráficos suman los céntimos del mismo resultado de `analyze`, sin cambiar las tarifas, costes ni reglas del motor. Los suplementos y el cobro del paño se separan de la tarifa base sin duplicar ingresos. Los ingresos externos aparecen por su concepto configurado. La actividad general se muestra aparte y no se reparte entre clientes.

El selector de mes incorpora anterior/siguiente. Fechas personalizadas y filtros están plegados, con un resumen de la selección visible. Las reglas se consultan en «Cómo se calcula». La configuración se despliega al existir borrador o error; se conserva el guardado explícito. Las tablas siguen disponibles. Al abrir un cliente, Servicios muestra también sus ingresos externos y permite seleccionar una propiedad desde su nombre.

«Revisar» abre el editor real de cada servicio con margen bajo/negativo o coste pendiente; los ingresos externos pendientes enlazan a su gestión. Las tareas excluidas por ingreso cero o precio pendiente no aportan gastos. Las estimaciones y datos pendientes siguen visibles; los gráficos no certifican un cierre contable.

La evolución carga seis meses al solicitarla, mediante el lector existente de solo lectura y los mismos filtros de cliente/propiedad/trabajador. Cada mes se recalcula con `analyze`, incluido el prorrateo de fijos y salario, evitando agrupar todos los contratos en el último día. Por defecto compara del día 1 al día final seleccionado (con límite al último día del mes); puede cambiarse a meses completos. Este intervalo propio se explica incluso si el filtro superior era personalizado. Las variaciones son importes absolutos entre los dos últimos periodos. Se muestran sus fechas, costes y precios pendientes y número de ingresos puntuales registrados: no se supone que un mes sin registro manual tenga cero ingresos reales. Los datos son provisionales y utilizan la tarifa actual de las propiedades. Fallos de lectura ocultan la comparación; dispone de actualización y reintento propios.

`node scripts/financialChartsTest.mjs` comprueba conciliación de columnas, gastos generales, suplementos/paños, filtros, ausencia de actividad, pérdidas, límites de meses/bisiestos y prorrateos de evolución con el motor real. El navegador verifica gráficos renderizados, flechas de mes, cambio euros/porcentaje, detalle de cliente sin limpiezas, accesos de revisión, evolución y sus errores, móvil con datos y vacío, sin desbordamiento, además de las regresiones existentes. El CSS del arnés se compila desde la fuente sin red; no requiere un build previo ni sesión productiva.


## Columnas comparables — referencia visual de Dani

Los gráficos utilizan columnas verticales adyacentes, sin apilar, con el mismo cero y escala monetaria. Balance compara ingresos/gastos/resultado; las otras dos vistas comparan categorías de gasto y conceptos de ingreso. Cada concepto tiene un color, leyenda y tooltip; los importes exactos y accesos al origen siguen debajo. Los gastos son sus importes completos positivos, no descuentos flotantes de una cascada. Los resultados negativos se representan por debajo de cero. En móvil, el desplazamiento horizontal queda dentro del gráfico.

La evolución agrupa las columnas por mes y permite alternar Balance, Tipos de gasto y Origen de ingresos. Personal, lavandería, amenities, productos, dirección y otros conservan colores por categoría. Los conceptos de ingreso mantienen el color por identificador en todos los meses. Los importes mensuales de cada grupo se concilian con el mismo motor del análisis, sin introducir presupuestos o datos ficticios. La leyenda y tabla de respaldo permiten consultar los valores sin depender del color. Pruebas de navegador verifican geometría adyacente, cero común, colores distintos, resultado negativo, cambio de vista mensual y navegación del origen; las pruebas locales concilian los totales por concepto y mes.

## Vista anual

«Vista Anual», junto al selector de mes, selecciona del 1 de enero al 31 de diciembre del año del periodo actual. Permite elegir año y avanzar o retroceder; «Vista Mensual» recupera las fechas anteriores cuando pertenecen al mismo año, o ese mes en el nuevo año. Se mantienen los filtros de cliente, propiedad y trabajador. Año, comparación y fechas de retorno se conservan en la misma sesión, por cuenta y sede.

General añade doce grupos de columnas adyacentes: ingresos, personal (incluida dirección/estructura), lavandería, amenities y consumibles, productos y otros gastos cuando existen. Puede alternarse a tipos de gasto u origen de ingresos. Cada barra abre el concepto de ese mes; la leyenda abre el total anual; «Volver al gráfico» recupera año, filtros, comparación y foco. La tabla desplegable ofrece los doce meses con ingresos, cada tipo de gasto, resultado, margen y datos pendientes. Gráfico y tabla se desplazan dentro del panel en móvil.

La lectura anual usa el lector existente y su caché; los doce meses se calculan en memoria con `analyze` y los mismos datos, sin doce consultas adicionales. Sus importes se concilian con el total anual, incluidos fijos, excepciones mensuales y dirección, sin repetir ingresos puntuales. El año completo incluye fijos configurados y tareas futuras asignadas; se explican las tarifas actuales, estimaciones y ausencia de ingresos puntuales registrados. No se guardan datos del negocio al cambiar de vista. Las pruebas verifican límites de año/bisiestos, categorías y filtros, persistencia, navegación por ratón/teclado, retorno desde un año vacío y móvil sin desbordamiento.

## Revisión visual P0 — 8 octubre 2026

La rentabilidad por cliente utiliza Recharts y nace del cero real, también con pérdidas o resultados mezclados. En gráficos de un solo periodo cada concepto aparece bajo su columna; en los mensuales se conserva el agrupamiento por mes. La distribución de gastos pasa a mostrar composición porcentual con un gráfico circular, diferenciándose de la comparativa de importes.

El formato común usa coma decimal, separador de miles incluso en importes de cuatro cifras y porcentaje sin espacio. Las correcciones de nombres son de presentación y conservan los identificadores y textos guardados. Los tooltips desaparecen cuando dejan de estar activos. Cada barra tiene un solo control de clic/teclado y su leyenda un único botón por concepto. Un gráfico plegado no conserva ejes en el DOM.

El buscador y encabezado lateral conservan su altura; la navegación dispone de su propio desplazamiento. Las pruebas comprueban los primeros y últimos enlaces y el buscador en escritorio de altura reducida y móvil. No se reprodujo el solapamiento reportado en las alturas probadas antes del ajuste; se verifica el comportamiento final sin atribuirle una causa no confirmada.

`financialFormattingTest.mjs`, `financialChartPresentationBrowserTest.mjs` y `financialSidebarBrowserTest.mjs` comprueban formato, geometría positiva/negativa/mixta, etiquetas, tooltip, una sola activación por gesto, composición porcentual y navegación lateral real con datos locales. Se mantiene el navegador completo de regresión financiera. Estas verificaciones no usan sesión ni datos productivos.

## Revisión visual P1 — 8 octubre 2026

Los cuatro indicadores incorporan variación, una línea de los últimos seis meses y distintivo Provisional. Los importes se comparan en euros y porcentaje respecto a la base anterior; el margen cambia en puntos porcentuales. Un mes completo se compara con el anterior completo; los intervalos parciales conservan sus días con límite al último día del mes anterior. Un intervalo entre meses se compara con otro anterior de igual duración y la vista anual con el año anterior. Sin base distinta de cero no se inventa un porcentaje; sin margen anterior no se presenta una variación. Subir gastos se marca como desfavorable. No existe un registro de cierre contable, por lo que no se atribuye el estado Cerrado.

La evolución sustituye los seis meses plegados por doce meses de líneas visibles al abrir General. Mantiene una alternativa de columnas con los conceptos y detalles ya existentes. Las líneas permiten ocultar series y consultar valores mediante tooltip; la tabla de doce meses queda disponible como respaldo. La vista anual conserva sus columnas y añade la tendencia de ingresos, gastos y resultado. Los gráficos plegados se desmontan.

Una lectura paginada del lector existente abarca los datos necesarios para el periodo actual, comparación y evolución. No se hacen consultas por tarjeta ni por mes. El motor sigue filtrando cada periodo en memoria; cambiar cliente, propiedad o trabajador no cambia el intervalo de lectura. Actualizar datos refresca todo junto. Un fallo de fuente oculta balances, comparaciones y evolución en lugar de mostrar datos parciales. El intervalo mensual histórico alcanza el final del mes para permitir comparar meses completos, incluidos servicios futuros, sin incluirlos automáticamente en el balance de fechas parciales.

La tabla de clientes está visible en General y Por cliente, con ordenación por cada columna y páginas de 10, 25 o 50 clientes. Los márgenes sin ingreso quedan al final de la ordenación; los totales y actividad general permanecen fijos y corresponden a todo el análisis, nunca a una página. Seleccionar un cliente conserva su identificador. Los gastos generales no se reparten. Cifras tabulares, márgenes positivos verdes y negativos rojos, y tamaños de títulos diferentes mejoran la lectura.

La ayuda repetida pasa a un único «Cómo se calcula» por sección, con apertura y cierre accesibles por teclado. Los tooltips y leyendas conservan información monetaria real. Las etiquetas del eje monetario se muestran en una sola línea para impedir restos de unidades bajo el gráfico.

`financialInsightsTest.mjs` verifica meses completos/parciales/bisiestos, años e intervalos personalizados, conciliación con el motor real, filtros, bases nulas/cero/negativas, variación de gastos, puntos porcentuales y ordenación estable. `financialDesignBrowserTest.mjs` prueba indicadores, líneas, tooltips, ayuda por teclado, 26 clientes, ordenación, paginación, totales fijos, navegación, filtros/vacío y cuatro anchos de pantalla. El navegador de regresión verifica la página y el lector reales con backend local, incluidos modo anual/mensual, retornos y foco, actualización conjunta, error sin cifras parciales y conservación de borradores. No se escriben datos del negocio en producción.
