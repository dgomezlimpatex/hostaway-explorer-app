# Limpatex · Segunda revisión de Previsión

**22 de septiembre de 2026 · revisión de la versión desplegada · para Daniel y Hermes**

Referencia de aceptación: [Plan completo del 21 de septiembre](<C:/Users/danig/Documents/Nueva carpeta/Limpatex - Plan completo de mejora UI UX 2026-09-21.md>), especialmente apartados 5, 6, 8, 14, 15 y 16. Aplicación: [Gestión Limpatex](https://gestionlimpatex.vercel.app/staffing-forecast).

## Dictamen

**Hay una mejora real y considerable, pero el apartado todavía no supera la aceptación del plan.** Se han implementado muchos componentes y recorridos previstos. No es simplemente un cambio de colores. Sin embargo, persisten diferencias entre lo que una cifra parece significar y lo que realmente representa; además, esta revisión ha encontrado resultados distintos para la misma semana según el horizonte de consulta.

No lo entregaría todavía a una sustituta para que tomase decisiones de personal sin acompañamiento. La presentación es más profesional, pero aún obliga a interpretar demasiadas excepciones, avisos y contextos. La prueba decisiva no es si la pantalla se parece al diseño: es si conduce a la misma decisión correcta con independencia del recorrido utilizado para consultarla.

Esta revisión se centra en **frontend, interpretación de datos y experiencia de uso**. Incluye los destinos de Previsión en Cobertura diaria, candidatos, perfiles, Equipo y Reglas y datos. No certifica el backend ni constituye una nueva auditoría íntegra de Inicio, Centros o Informes. Los resultados visibles incoherentes se señalan aunque su causa pueda estar en datos, cálculo o presentación; no se atribuye una causa interna sin código.

No se han modificado tareas, contratos, personas ni edificios. Se han utilizado filtros y dos simulaciones reversibles, después retiradas.

## 1. Qué ha mejorado y conviene conservar

1. **Navegación más comprensible.** Previsión, Cobertura diaria y Reglas y datos utilizan los nombres propuestos. La barra lateral tiene una identidad consistente y el apartado activo se reconoce.
2. **Contexto temporal más explícito.** Los encabezados muestran rangos completos, «Mes de inicio» distingue el origen del horizonte y las semanas tienen anterior, siguiente y acceso a la actual.
3. **Continuidad semanal corregida en los recorridos probados.** El contador de 47 tareas sin asignar de la semana del 19 al 25 de octubre abre exactamente esa semana, con ese filtro y 47 tareas. Ya no salta silenciosamente al mes.
4. **Contexto mensual del equipo mejorado.** Desde una semana de octubre se abre «Objetivos de octubre». El perfil incorpora selector de mes y los candidatos identifican el mes de su saldo.
5. **Selector de centros utilizable.** Incluye búsqueda, distingue edificio, propiedad independiente y propiedad por identificar. RMA se encuentra y el filtro puede retirarse. Una búsqueda sin coincidencias tiene un mensaje explícito.
6. **Mejor tratamiento de datos desconocidos.** Las duraciones desconocidas aparecen como «—» y dejan huecos en el gráfico. La capacidad se llama «de referencia». Se explica que disponer de horas no garantiza encajar cada tarea.
7. **Gráficos más legibles y consultables.** Tienen tabla equivalente y puntos accesibles por teclado. Activar un punto con Enter mostró la fecha y ambas cifras. La evolución semanal y el resumen por meses naturales están diferenciados.
8. **Reserva separada del trabajo diario.** El cambio a +20 % mantiene las cifras de cada día. La reserva se muestra en el resumen semanal. Octubre conserva 591,2 h conocidas, 118,2 h de reserva y 709,4 h de total tanto aislado como dentro del horizonte observado.
9. **Avisos agrupados.** Las causas tienen títulos de trabajo comprensibles. Los identificadores técnicos completos han pasado a un nivel secundario. Ya se usan correctamente ejemplos de singular como «1 persona» y «1 aviso».
10. **Detalles de tarea mucho más claros.** Ventana del cliente, horario registrado, responsable y propuesta sin guardar aparecen separados. Se señalan horarios fuera de la ventana y las duraciones individuales usan horas y minutos.
11. **Perfiles mejor organizados.** Balance mensual, Esta semana, Disponibilidad y Tareas sustituyen la antigua acumulación de contenido. Se distingue cómputo por hora de fin de ejecución confirmada.
12. **Regreso y cierre de detalles.** «Volver a candidatos» funciona. Escape cierra el detalle probado y devuelve el foco a «Ver candidatos».
13. **Simulador mejor delimitado.** Desde una semana toma esa semana; muestra comparación antes/después, horas utilizadas y no utilizadas y propuestas agrupadas por fecha. Se puede editar y retirar sin desactivar la reserva.
14. **Validación del formulario.** Se rechazaron -1 y una entrada vacía con mensaje junto al campo; se aceptó 15,5 con coma decimal.
15. **Carga y cancelación recuperables.** Cancelar retira los resultados anteriores y ofrece Reintentar. El reintento devolvió los resultados.
16. **Adaptación móvil mejorada.** Hay Menú y Filtrar. En 390 y 1024 px no se observó desbordamiento horizontal de toda la página. La tipografía principal medida en el contenido fue de 15 px.

Estas mejoras deben preservarse. Recomiendo corregir la versión actual, no empezar otro rediseño completo.

## 2. Problemas que impiden dar la revisión por aprobada

Prioridades: **P0** puede inducir una decisión equivocada; **P1** dificulta una operación habitual o deja sin cumplir un requisito importante; **P2** afecta a claridad, consistencia o acabado. No equivalen a la dificultad técnica de la corrección.

### R01 · P0 · La misma semana cambia de capacidad y de riesgo al cambiar el horizonte

Se comparó dos veces la semana **19–25 de octubre**, A Coruña, todos los centros, reserva activada y sin refuerzo. La carga y las tareas se mantuvieron, pero el resultado del equipo cambió:

| Indicador | Inicio septiembre, horizonte 3 meses | Inicio octubre, horizonte 1 mes |
|---|---:|---:|
| Trabajo de la semana | 76,2 h | 76,2 h |
| Reserva semanal | 15,2 h | 15,2 h |
| Tareas por revisar | 11 | 11 |
| Tareas sin asignar | 47 | 47 |
| Personas con horas pendientes de octubre | 0 | 8 |
| Personas por verificar de octubre | 18 | 10 |
| Capacidad de referencia del lunes 19 | 31,3 h | 47,6 h |
| Capacidad de referencia del domingo 25 | 50,4 h | 67,5 h |

La diferencia se reprodujo al volver al horizonte septiembre–noviembre. No es solo que el encabezado esté mal: cambian las cifras que la responsable usaría para decidir.

En octubre aislado, por ejemplo, Asuncion muestra 86,9 h de objetivo y 86,9 h por completar. Dentro del horizonte septiembre–noviembre, el objetivo de octubre aparece por verificar. La interfaz no explica qué dato adicional cambia esa evaluación.

**Corrección requerida:** separar el ámbito de lectura de los datos del ámbito del balance y de la capacidad mostrada. Un balance de octubre debe evaluar octubre con sus dependencias pertinentes; un conflicto ajeno a ese mes no debe contaminarlo silenciosamente. Si existe una dependencia legítima entre periodos, hay que identificarla y mostrar por qué cambia el resultado. Hasta entonces no se puede declarar que el usuario ve un resultado estable para ese mes.

**Aceptación:** repetir ambos recorridos con el mismo conjunto de datos; obtener las mismas cifras o una explicación concreta y verificable de la diferencia. Esta comprobación tiene prioridad sobre el acabado visual.

### R02 · P0 respecto al plan · La aplicación declara eliminados los desplazamientos

En Reglas y datos se lee: **«No se contabiliza tiempo de desplazamiento en esta previsión, según la instrucción vigente de Daniel.»** El plan del 21 de septiembre, apartado 16 y prueba A10, exige **15 minutos entre edificios consecutivos, cero dentro del mismo y sin viaje inicial/final**. Esta conversación conserva esa regla; la petición de no usar distancia se refería a mapas/distancias y al orden de candidatos.

No puedo saber si Daniel cambió esa regla en una conversación externa. Lo verificable aquí es que **la versión actual contradice el documento que se ha pedido comprobar y atribuye al usuario una instrucción diferente**. No debe marcarse como requisito cumplido.

La diferencia ya afecta a propuestas visibles:

| Contexto | Secuencia presentada | Separación mostrada |
|---|---|---:|
| 22 de septiembre, equipo actual | Leslie termina en MARINA30 a las 14:53 y se propone ART BOUTIQUE desde las 14:53 | 0 min |
| 22 de septiembre, candidatos | Asuncion tiene -Jornada Hotel SC hasta las 14:00 y se ofrece para DOWNTOWN LA TORRE de 14:00 a 17:00 | 0 min |
| Refuerzo de 15 h, 23 de septiembre | METROPOLITAN BOUTIQUE 11:00–13:45; MARINA30 13:45–14:18 y 14:18–14:51 | 0 min al cambiar de centro |
| Mismo refuerzo, 24 de septiembre | Santa Lucía 11:00–12:45; MAIN STREET 12:45–14:15; BLUE OCEAN 14:15–16:45 | 0 min en ambos cambios |

No basta con dibujar un icono de viaje. En la secuencia del 23, añadir el desplazamiento sin reorganizar nada terminaría la segunda limpieza de MARINA30 a las 15:06, fuera de su ventana de las 15:00. En la del 24, añadir dos viajes desplazaría el final de BLUE OCEAN a las 17:15.

**Corrección requerida:** reconciliar la regla vigente con el encargo. Si siguen vigentes los 15 minutos, las propuestas deben reservarlos y el frontend debe mostrarlos separados de horas contractuales. No presentar estas secuencias como viables mientras no se comprueben con la regla correcta.

### R03 · P0 · El cero sigue dominando la tarjeta cuando hay personas sin evaluar

La tarjeta principal sigue mostrando **«Personas con horas pendientes · 0»**, con **«18 por verificar»** en texto secundario. En la captura amplia el cero es grande y la advertencia es pequeña y gris. Además, pulsar la tarjeta abre el filtro de riesgo, no las 18 personas pendientes de evaluación; para estas existe otro enlace mucho más abajo.

La nota reduce la ambigüedad anterior, pero no corrige la jerarquía. Quien escanea los cuatro indicadores puede seguir entendiendo «nadie necesita atención». Esta es precisamente la situación que Daniel pidió remarcar siempre.

**Corrección requerida:** con evaluación incompleta, usar una composición como «18 personas pendientes de evaluar» y, en segundo nivel, «0 con déficit confirmado». Cada cifra debe abrir su conjunto. Cuando el déficit sea conocido, presentar nombre, horas faltantes y una acción clara para revisar reparto o buscar otros servicios de Limpatex. El mes del objetivo debe estar junto al título, no solo en el pie.

### R04 · P1 · La lista de atención prioriza días pasados y no explica por qué

El 22 de septiembre, el resumen septiembre–noviembre muestra como primeras diez filas **1–10 de septiembre**. No ofrece un control visible de prioridad, «hoy y próximos días» o un indicador de cuántos días relevantes quedan fuera de esas diez filas.

Es correcto conservar el pasado para el cierre mensual. Lo incorrecto es que una lista titulada «Días que requieren atención» quede ocupada por las primeras fechas del mes, sin distinguir corrección histórica de planificación futura. El 27 de septiembre tiene 93,8 h conocidas y 7 tareas sin asignar; no aparece en esa selección inicial.

**Corrección requerida:** separar «Trabajo por resolver desde hoy» de «Registros anteriores por revisar». Ordenar por necesidad operativa demostrada, proximidad y fecha límite. Identificar el motivo: tareas sin asignar, conflicto horario o datos faltantes. No fijar el domingo como prioridad universal. Añadir «Ver todos los días» y el número de resultados cuando se limite la lista.

### R05 · P1 · «Pendiente de verificar» se ha convertido en un estado casi universal

Los siete días de la semana reciben el mismo estado. Con RMA filtrado, la semana 28 de septiembre–4 de octubre muestra **0 horas y 0 tareas sin asignar todos los días**, pero conserva siete etiquetas «Pendiente de verificar» y un enlace «0 tareas sin asignar · ver candidatos».

Un estado prudente es preferible a inventar cobertura, pero si todos los días son visualmente iguales no sirve para priorizar. Se confunden «no hay tareas registradas», «falta duración», «hay tareas por asignar» y «la asignación registrada es incompatible».

**Corrección requerida:** mantener estados separados y referidos a su ámbito. Mostrar «Sin tareas registradas» cuando eso es lo conocido; indicar aparte que no implica ocupación definitiva. No ofrecer un acceso a candidatos de cero tareas. Reservar el aviso de evaluación incompleta para la métrica afectada e indicar el motivo local.

### R06 · P1 · El detalle semanal aún no muestra otros servicios ni desplazamientos

El plan pedía una lectura diaria de turismo, otros servicios y tiempo de desplazamiento, con separación del cómputo contractual. Actualmente el gráfico y su tabla solo muestran **Trabajo conocido** y **Capacidad de referencia**. Las siete filas incluyen horas conocidas, número sin asignar, estado y enlace.

El párrafo «El mantenimiento reduce la disponibilidad individual…» no sustituye un desglose visible. Una responsable no puede explicar desde aquí por qué dispone de 18,8 h un jueves y 50,4 h un domingo, ni qué parte de la disponibilidad está ocupada por otros servicios.

**Corrección requerida:** incorporar un desglose desplegable de capacidad: compromisos de otros servicios, horas de tareas, libranzas/ausencias y viajes según regla vigente. No sumar mantenimiento a la demanda turística si ya se descuenta de disponibilidad. Mantener unidades y conceptos inequívocos.

**Límite de esta revisión:** no doy por demostrado un doble cómputo de mantenimiento. Las horas del gráfico por sí solas no permiten certificar su composición. Precisamente falta trazabilidad visible para comprobarlo con seguridad.

### R07 · P1 · La gráfica añade capacidad diaria de refuerzo aunque no aporte ningún encaje

En la semana 19–25 de octubre, con horizonte septiembre–noviembre, se simuló una persona de **15,5 h semanales**. La comparación indica **0 h utilizadas**, **0 tareas con encaje hipotético** y **15,5 h sin utilizar**. Sin embargo, la capacidad del gráfico sube todos los días:

| Día | Antes | Con refuerzo |
|---|---:|---:|
| Jueves 22, sin tareas conocidas | 18,8 h | 21 h |
| Domingo 25 | 50,4 h | 52,6 h |

La serie conserva el nombre «Capacidad de referencia». Visualmente parece una mejora diaria, aunque no existe ningún encaje adicional. El formulario describe una persona flexible; el gráfico sugiere un reparto diario que no se identifica como supuesto.

**Corrección requerida:** distinguir gráficamente capacidad del equipo y disponibilidad hipotética del refuerzo. Mostrar la aportación útil en los días donde realmente encaja tareas; no atribuir una mejora operativa diaria a un reparto aritmético. Si no aporta encajes, esa conclusión debe aparecer junto a la simulación y antes de recorrer toda la pantalla.

### R08 · P1 · El resultado del refuerzo necesita explicar su efecto y sus límites

En la semana 21–27 de septiembre, el refuerzo de 15 h presenta:

- 88 tareas sin encaje planificado antes y 74 después.
- 14,9 h utilizadas y 10 tareas con encaje del refuerzo.
- 45 encajes y 52,4 h propuestos con el equipo actual.
- «Tareas por revisar» pasa de 128 a 126.

Estos números no tienen por qué ser aritméticamente incompatibles: la incorporación de una persona puede permitir reorganizar al resto y cada indicador puede medir un conjunto diferente. **La interfaz no explica el puente entre ellos.** La responsable ve una reducción de 14 tareas, 10 asignadas al refuerzo y una tarjeta que solo baja 2; debe interpretar sola qué ha mejorado.

El bloque antes/después aparece después del gráfico y las siete filas, lejos de la franja de simulación. Las propuestas están agrupadas por fecha, pero dentro del 24 de septiembre se muestran primero 14:15, después 12:45 y finalmente 11:00. Cuesta revisar la secuencia de una persona.

**Corrección requerida:** colocar el resultado inmediatamente después de activar la simulación; separar tareas encajables, conflictos del registro y datos sin verificar; explicar los cambios del equipo actual y del refuerzo con conjuntos reconciliables. Ordenar las propuestas por hora dentro de cada fecha. Mostrar el trabajo que sigue pendiente y su motivo, sin convertir una cifra parcial en una recomendación definitiva de contratación.

### R09 · P1 · La última semana parcial parece una caída repentina de plantilla

En septiembre–noviembre, la capacidad semanal termina pasando de aproximadamente **212,9 h a 38,8 h** en el punto del 30 de noviembre. Ese punto representa los días que quedan dentro del horizonte, mientras que el detalle semanal puede abarcar hasta el 6 de diciembre.

El nombre accesible del punto incluye «días dentro del horizonte». Eso no permite distinguir de un vistazo una semana completa de una que solo aporta un día. El trazo continuo convierte la diferencia de duración en una aparente caída de capacidad.

**Corrección requerida:** marcar expresamente las semanas parciales con sus fechas incluidas y número de días, diferenciarlas visualmente y evitar unirlas como observaciones semanales equivalentes. No corregir la forma duplicando tareas de diciembre dentro de noviembre.

### R10 · P1 · Unas duraciones desconocidas dejan vacíos los principales totales

En el horizonte septiembre–noviembre los dos primeros indicadores muestran «—». Se sabe que existen tareas y se muestran semanas y meses con cantidades válidas, pero no se presenta un subtotal conocido ni cuántas tareas impiden cerrar el total. El usuario ve primero dos tarjetas sin cifra y un número muy grande de tareas por revisar.

**Corrección requerida:** si los datos permiten sumar la parte válida, mostrar «Subtotal conocido» y «X tareas sin duración», conservando el total final como pendiente. El subtotal debe incluir todos los registros válidos del ámbito y nunca parecer una estimación completa. Si no puede aislarse, explicar brevemente por qué y enlazar las tareas que bloquean el total. El plan ya pedía no ocultar datos válidos de otros centros por un problema aislado.

### R11 · P1 · Los avisos están agrupados, pero aún no forman una lista eficiente de resolución

«Hay asignaciones incompatibles» agrupa 572 avisos. Otros títulos como «Revisar tareas» o «Revisar ajustes de ausencias y servicios» siguen siendo poco específicos. Se muestran combinaciones como **«Faltan duraciones de propiedades · 10 tareas · 10 centros · 0 propiedades»**; puede reflejar identidades no resueltas, pero la lectura es confusa.

Al filtrar RMA permanecen las 12 causas globales. No se identifica con suficiente claridad si el aviso resume toda la sede o únicamente el centro consultado. En el detalle aparecen varias salidas «Revisar» y referencias de registros aún no identificados; la responsable debe decidir qué vínculo conduce al dato que falta.

**Corrección requerida:** mostrar el ámbito del aviso, ordenar por bloqueo/impacto y fecha relevante y ofrecer una acción principal por causa. Para una duración faltante: «Revisar la duración de estas 10 tareas» o «Identificar primero su propiedad», según corresponda. Ocultar contadores de entidades irrelevantes y evitar ceros que contradigan el título a primera vista. Mantener las referencias de soporte en segundo nivel.

### R12 · P1 · Un perfil comunica otros servicios y disponibilidad de manera aparentemente contradictoria

En el perfil de Asuncion de septiembre, Balance mensual muestra **«Otros servicios ya incluidos: 81 h»**. La pestaña Disponibilidad dice **«No hay otros servicios registrados en este mes»**. Puede existir una diferencia entre tareas importadas clasificadas como otros servicios y compromisos recurrentes de la ficha, pero la UI no la explica.

**Corrección requerida:** unificar los conceptos o nombrar los subconjuntos: por ejemplo, tareas de otros servicios frente a servicios recurrentes de la ficha. La disponibilidad debe permitir reconocer todos los compromisos que realmente ocupan la franja. No basta con indicar un total mensual si se ofrecen candidatos en horarios ya ocupados.

### R13 · P1 · El cierre mensual no está suficientemente presente en una consulta de varios meses

La tabla mensual compara trabajo y reserva, pero no incluye un resumen de objetivos del equipo por cada mes. La tarjeta de personas muestra el mes inicial o el del lunes seleccionado. En una semana que cruza septiembre y octubre se destaca septiembre, sin un acceso equivalente a ambos balances desde esa vista.

No es un error de sumar semanas: es una carencia de la experiencia de decisión. Daniel necesita saber quién no llegará al mínimo cada mes, además de cubrir tareas.

**Corrección requerida:** hacer explícito el mes del objetivo junto a la tarjeta y permitir cambiarlo. En las filas mensuales, añadir un acceso al equipo de ese mes con riesgo confirmado y evaluación pendiente, sin sumar personas de meses distintos como si fueran únicas. En semanas partidas, ofrecer ambos meses de forma reconocible.

## 3. Juicio visual y de interacción

### La base visual es mejor, pero la jerarquía todavía es demasiado plana

Azul oscuro para navegación, superficies blancas, fondo claro y turquesa para trabajo forman una identidad coherente. Los títulos, tarjetas y botones se reconocen mejor. No hace falta añadir ilustraciones, más sombras o una paleta nueva.

El problema es que título, periodo, sede, filtros, aviso, dos grupos de selección, botón de simulación, repetición del periodo y estado compiten antes de llegar al resultado. A 1440 × 900 el gráfico empieza aproximadamente en la parte inferior del primer pantallazo. A 1024 × 768, los indicadores importantes quedan parcialmente por debajo del borde inferior. A 390 × 844, el primer vistazo termina en la primera tarjeta, que contiene «—».

No propongo comprimir todo con letra menor. Propongo eliminar repetición y usar el espacio para la decisión: una cabecera, una barra de controles, una línea de estado accionable y un resumen que muestre primero lo que exige atención. El periodo aparece repetido en demasiados lugares para la información que aporta.

### Sigue habiendo demasiado texto de explicación del sistema

Debajo del gráfico se encadenan párrafos sobre el fondo azul, las horas pasadas, los puntos desconocidos, la capacidad de referencia, el mantenimiento, la reserva y la última tarea registrada. En móvil, las notas ocupan casi una pantalla completa.

El contenido tiene utilidad, pero no todo debe permanecer abierto. La lectura sigue pareciéndose a una explicación del cálculo más que a una herramienta preparada para trabajar. Es el problema que Daniel describió como una pantalla «hecha para que la lea una IA».

Dejaría siempre visible una frase que afecte a la decisión actual —por ejemplo, «No se puede cerrar el total: faltan duraciones en 10 tareas»— y trasladaría reglas estables a «Cómo se calcula». La reserva puede explicarse al lado de su control. Las fechas futuras pueden identificarse en la leyenda. El texto «los puntos desconocidos no se convierten en cero» es una descripción de implementación; al usuario le sirve más saber qué dato falta y qué debe revisar.

### Los estados necesitan contrastes de significado, no solo colores

El mismo ámbar y la misma frase «Pendiente de verificar» aparecen una y otra vez. Un dato incompleto, una tarea sin asignar y un conflicto horario requieren tratamientos distintos. La pantalla puede mantener su sobriedad y, aun así, distinguir dónde actuar primero.

El cero de riesgo no debe conservar el protagonismo cuando la cifra útil son las personas sin evaluar. Tampoco debe aparecer como acción un enlace a cero candidatos. No basta con poner una advertencia global arriba si el resto de los indicadores sigue comunicando normalidad.

### La información mensual aún obliga a hacer parte del trabajo mental

La tabla sí incluye Total con reserva, lo cual está bien. En la vista semanal activada, las tarjetas muestran conocido y reserva separados, pero no un total semanal prominente: 76,2 h y 15,2 h obligan a sumar. Puede mostrarse el total estimado semanal junto al desglose sin añadir otra tarjeta enorme.

Los días del detalle de Previsión usan fechas completas sin el nombre del día de la semana, mientras que Cobertura diaria sí dice Lunes, Martes, etc. Para una operación que se organiza semanalmente, «Dom 27 sept» seguido de una fecha accesible completa suele ser más rápido de leer que repetir «27 de septiembre de 2026» en cada fila.

### Móvil: mejora funcional, adaptación aún incompleta

El menú explícito y los filtros plegables corrigen el problema principal de navegación. La página completa ya no necesita desplazamiento lateral en las medidas comprobadas.

Sin embargo, el gráfico de tres meses se presenta dentro de una superficie desplazable: en 390 px se ven solo las primeras semanas, por lo que la evolución global desaparece. La tabla mensual también requiere desplazamiento lateral y esconde evaluación y acciones a la derecha. Para tres o seis registros mensuales, el plan pedía resúmenes por mes con detalle expandible; conservar la tabla de escritorio dentro de una caja no cumple esa parte.

Recomiendo gráfico de tendencia completo adaptado al ancho, con menos etiquetas y selección de punto, y tarjetas mensuales compactas que muestren conocido, total estimado, estado y acción. La tabla completa puede mantenerse como consulta secundaria. El desplazamiento local es aceptable para una agenda horaria extensa, pero aquí no debe ser la única vía de lectura.

### Acabado pendiente

- El simulador acepta «15,5», pero su franja y la explicación posterior muestran «15.5 h». Unificar formato español.
- Se impone un intervalo de 0,25 h en el formulario. No consta esa limitación en el plan; debe justificarse por una regla real o eliminarse, manteniendo la validación de valores positivos.
- «— conocidas» es una frase incompleta. Usar «Duración pendiente» o «Total pendiente de calcular» según el caso.
- La sede sigue viéndose truncada como «A Coru…» junto a «Coruña», incluso con espacio disponible en escritorio. Mantener el nombre completo cuando quepa.
- «Mes de inicio» y «Horizonte» son más precisos que antes, pero un acceso rápido a «Próximos tres meses» puede facilitar la operación habitual sin cambiar el cierre por meses naturales.
- El menú móvil no se cerró con Escape en la prueba. Al ser un desplegable no modal, lo considero una mejora de comodidad, no un bloqueo: el botón sí lo cierra.
- No se ha medido toda la matriz de contrastes ni realizado un recorrido completo con lector de pantalla. Una paleta más oscura no permite declarar accesibilidad completa.

## 4. Matriz de aplicación del plan anterior

«Aplicado» se refiere al comportamiento observado, no a una certificación de todas sus variantes. «Parcial» significa que existe el cambio, pero falta un requisito o una validación esencial. No se asigna un porcentaje artificial de cumplimiento.

| Referencia | Resultado | Evidencia / trabajo pendiente |
|---|---|---|
| UI-01 · Riesgo y desconocidos | Parcial | Se menciona «por verificar», pero el cero sigue dominando; además cambia el riesgo con el horizonte. R01/R03. |
| UI-02 · Contexto temporal | Parcial | Encabezados y enlaces a octubre corregidos. Cifras dependientes del horizonte y acceso a ambos meses en semana partida pendientes. |
| UI-03 · Contador y destino | Aplicado en la prueba semanal | 47 tareas abre 47, semana correcta, filtro Sin asignar. |
| UI-04 · Fiabilidad y cobertura | Parcial | Capacidad renombrada y datos parciales indicados; estados universales y simulación aún ambiguos. |
| UI-05 · Gráfico de Informes | Fuera de esta revisión | No se ha revalidado el anillo de Informes. |
| UI-06 · Horario, ventana y propuesta | Aplicado en los ejemplos revisados | Se distingue horario registrado y propuesta; se señala el conflicto. La viabilidad con viajes queda abierta por R02. |
| UI-07 · Avisos | Parcial | Agrupados y más humanos; falta prioridad local y acción más específica. |
| UI-08 · Cobertura por día/semana/mes | Parcialmente comprobado | Día agrupado por centros y semana por días mejorados. Vista mensual completa no reauditada. |
| UI-09 · Equipo en ancho reducido | Mejora observada | En el ancho inicial se ofrecen fichas con datos y acceso visible. No auditadas todas las variantes de tabla. |
| UI-10 · Perfiles | Parcial | Pestañas, vacíos y regreso implementados; contradicción de otros servicios. |
| UI-11 · Comparación de simulación | Parcial | Mismo ámbito y desglose disponibles; ubicación, reconciliación y capacidad hipotética pendientes. |
| UI-12 · Reglas y datos | Aplicado | Nombre y contenido de consulta coherentes. |
| UI-13 · Reglas comprensibles | Parcial | Fórmula mensual, 130 %, cómputo y reserva explícitos; viajes contradicen el plan. |
| UI-14 · Centros buscables | Aplicado en búsqueda y retirada probadas | Edificios e independientes diferenciados; RMA y vacío correctos. |
| UI-15 · Móvil | Parcial | Menú/filtros y ancho de página corregidos; tabla mensual y gráfico requieren adaptación. |
| UI-16 · Exportar CSV | Fuera de esta revisión | No se ha probado la exportación en esta nueva versión. |
| UI-17 · Jerarquía y tipografía | Parcial | Texto más legible; mucha altura previa a resultados y explicación repetida. |
| UI-18 · Idioma y microtextos | Parcial | Cerrar y singular/plural mejorados; decimal con punto y textos vacíos pendientes. |
| UI-19 · Plantilla y exclusiones | Mejora observada | Se distinguen 24 incluidas y 3 excluidas, con filtros. No certifica todas las reglas de exclusión. |
| UI-20 · Horizonte lejano | Parcial | Advierte de reservas aún no recibidas; falta señal visual de cobertura de datos y semanas parciales. |
| Apartado 8 · Desglose diario | No aplicado por completo | No aparecen otros servicios ni viajes en gráfico/tabla diarios. |
| Apartado 14 · Formulario sencillo | Aplicado con reserva | Horas semanales, contexto y validación; intervalo de cuarto de hora no justificado en el plan. |
| Apartado 15 · Cancelar/reintentar | Aplicado en prueba | Cancelación explícita y recuperación observadas. |
| A10 · 15 minutos entre edificios | Contradicción explícita | Reglas actuales dicen que se han eliminado; propuestas muestran cero separación. |
| A23 · Teclado y foco | Parcialmente validado | Punto del gráfico, tabla, Escape y regreso al disparador probados; falta auditoría completa. |

## 5. Pruebas realizadas y límites

| Recorrido | Resultado observado |
|---|---|
| Primera entrada, septiembre–noviembre | Periodo, filtros, avisos, cuatro indicadores, gráfico, diez días y tabla mensual revisados. |
| Semanas Aug 31, Sep 21, Sep 28 y Oct 19 | Fechas y controles consultados; anterior/siguiente/actual funcionan. |
| +20 % en Oct 19–25 | Conocido diario permanece igual; 15,2 h de reserva semanal separada. |
| Octubre dentro del horizonte y aislado | Conocido y reserva mensual coinciden; riesgo y capacidad de la misma semana no coinciden. Reproducción de ida y vuelta. |
| Horizonte de seis meses | Tabla hasta febrero de 2027; última tarea indicada el 20 de febrero; advertencia de futuras reservas presente. |
| Búsqueda de centro inexistente / RMA / quitar centro | Vacío explicado, filtrado y retirada correctos; avisos globales y días cero ambiguos. |
| Gráfico con teclado y tabla | Enter revela la fecha y cifras; tabla equivalente accesible. |
| Día 22 de septiembre | 17 tareas, ventanas y horarios, conflictos y propuestas inspeccionados. |
| Tarea Downtown → candidatos → perfil → volver → Escape | Contexto y regreso correctos; foco vuelve a Ver candidatos; compromiso previo incompatible con viaje de 15 min. |
| Enlace a 47 tareas de Oct 19–25 | Abre Cobertura semanal con 47 tareas y filtro correcto. |
| Objetivos de octubre, pendientes y por verificar | Filtros funcionan; 8 pendientes en octubre aislado frente a 0 en horizonte amplio. |
| Simular -1, vacío y 15,5 | Negativo/vacío rechazados; decimal con coma aceptado. |
| Simular 15,5 en Oct 19–25 | Cero encajes adicionales; capacidad gráfica aumenta. Edición y retirada probadas. |
| Simular 15 en Sep 21–27 | 14,9 h utilizadas y 10 tareas; propuestas por fecha; secuencias sin viajes. Retirada posterior. |
| Actualizar → cancelar → reintentar | Estado cancelado sin cifras antiguas, reintento correcto. |
| 390 × 844, 768 × 1024, 1024 × 768, 1440 × 900 | Observación visual de jerarquía y componentes; tamaño original restaurado. |
| Móvil: Menú, Filtrar, gráfico y tabla mensual | Controles utilizables; tabla y gráfico con desplazamiento local; demasiada longitud vertical. |
| Reglas y datos | Fórmulas y reglas leídas; detectada discrepancia de viajes. |

No se han forzado caídas de red o errores de servidor; no se ha probado toda la navegación con lector de pantalla, contraste de cada combinación, zoom de texto ni todos los límites numéricos. No se han recorrido todas las tareas/personas ni validado las jerarquías completas de titular/suplente/backup con casos controlados. El enlace al calendario operativo y a la ficha de gestión está presente, pero no se ha guardado nada ni certificado el recorrido operativo completo. No se ha comprobado el algoritmo de libranza flexible ni el cálculo interno de ausencias.

Estas limitaciones no ocultan un bloqueo para la revisión: son el límite entre evidencia de uso del frontend y una certificación funcional con datos controlados.

## 6. Cómo orientaría la siguiente corrección

**Primero, coherencia y reglas.** Resolver R01 y reconciliar R02. Unificar los otros servicios entre balance/disponibilidad. No maquillar estas diferencias con textos más prudentes.

**Después, decisiones en primer plano.** Rehacer la tarjeta de riesgo; mostrar qué personas necesitan completar horas o ser evaluadas; separar lo que debe resolverse desde hoy del registro histórico; mostrar el motivo local de cada día y subtotales válidos cuando sea posible.

**Después, simulación.** Colocar el antes/después cerca de su activación, separar disponibilidad hipotética de mejora útil, explicar qué tareas cambian de estado y ordenar propuestas por fecha y hora. Mantener el formulario sencillo y la reserva independiente.

**Finalmente, composición y móvil.** Quitar repeticiones, condensar ayuda estable, adaptar tabla mensual y gráfico a pantallas estrechas y revisar formatos y contraste. Conservar los componentes que ya funcionan.

La primera vista debería permitir leer, sin reconstruir reglas:

1. Periodo, centro y estado de los datos.
2. Cuánto trabajo conocido y adicional se prevé, con su grado de completitud.
3. Qué tareas próximas necesitan decisión y qué personas tienen horas pendientes o no pueden evaluarse.
4. Qué puede resolver el equipo y, al simular, qué aporta de verdad el refuerzo.

## 7. Encargo para Hermes

> Revisa la versión actual del apartado Previsión de Gestión Limpatex contra esta auditoría del 22 de septiembre y el plan del 21. El objetivo sigue siendo que una responsable nueva pueda prever carga y personal, entender el cierre mensual y resolver picos dentro de las ventanas de los clientes. Conserva la nueva navegación, el selector de centros buscable, los encabezados temporales, las tablas accesibles, las pestañas de perfiles, la separación de propuestas y los controles reversibles del simulador.
>
> Antes de retocar el aspecto, reproduce R01: misma semana 19–25 de octubre, misma sede, todos los centros, reserva activada y sin refuerzo; comparar inicio septiembre/horizonte 3 con inicio octubre/horizonte 1. Hoy la carga es 76,2 h en ambos contextos, pero el riesgo de octubre cambia de 0/18 por verificar a 8/10 y la capacidad del domingo cambia de 50,4 a 67,5 h. Determina la causa y evita que el ámbito consultado altere silenciosamente la interpretación de un mismo mes o día. Si una dependencia cambia legítimamente el resultado, identifícala y explícalo con datos concretos.
>
> Reconcilia la regla de viajes con el requisito vigente. El plan exige 15 minutos entre edificios, pero Reglas y datos afirma que Daniel los eliminó. No des por válida una atribución a Daniel sin la instrucción correspondiente. Si se mantiene el plan, reserva esos intervalos y vuelve a comprobar las propuestas: existen cambios de centro sin separación, incluso secuencias que saldrían de ventana al introducir el viaje. Los viajes ocupan disponibilidad y no completan contrato según el criterio operativo acordado.
>
> Corrige la jerarquía de riesgo: si hay personas sin evaluar, esa cifra debe ser principal y abrir ese conjunto. Mantén aparte el déficit confirmado. Explica el mes del objetivo y da acceso a quienes necesitan más horas y a otros servicios de Limpatex; no escondas esa decisión debajo del gráfico. Unifica la terminología de otros servicios entre balance y disponibilidad.
>
> Sustituye la lista de primeras fechas por una lista de trabajo priorizada: hoy y futuro por necesidad real; incidencias históricas separadas. Distingue ausencia de tareas, tarea sin asignar, conflicto y datos insuficientes. Añade motivo, alcance y acceso al conjunto completo. No fijes los domingos como única prioridad. No uses un mismo estado global para todos los días y centros sin indicar qué bloquea su evaluación.
>
> Completa el detalle semanal con un desglose comprensible de turismo, otros compromisos y viajes según la regla vigente. Muestra el total semanal con reserva sin obligar a sumar, manteniendo el +20 % global y sin repartirlo artificialmente entre días. Marca semanas parciales; evita que un día residual parezca una caída semanal de plantilla. Conserva los totales por mes natural y los datos desconocidos como desconocidos; muestra subtotales válidos solo cuando puedan aislarse correctamente.
>
> Revisa la simulación: el gráfico no puede comunicar como mejora diaria un reparto de 15,5 h que aporta cero tareas. Diferencia capacidad hipotética de trabajo encajado. Acerca el resultado a la activación, muestra qué mejora con el equipo y con el refuerzo, reconcilia los contadores y ordena propuestas por fecha y hora. Mantén retirar refuerzo y reserva como decisiones independientes. No inventes restricciones de entrada de horas que no figuren en las reglas del producto.
>
> Reduce la altura anterior a los resultados y la explicación permanente bajo los gráficos. Lleva reglas estables a ayuda desplegable y deja visible lo necesario para la decisión actual. En móvil, transforma los tres/seis meses de la tabla en resúmenes con acción visible y ofrece una tendencia que quepa en el ancho; no resuelvas toda la adaptación con scroll lateral. Unifica decimales en español, nombres de fechas, textos vacíos y tamaños de acciones.
>
> Verifica los recorridos de esta auditoría con datos controlados y los cuatro anchos indicados. Entrega una matriz con cada R01–R13: causa, corrección, evidencia y lo que siga pendiente. No marques completo un cambio porque exista el componente o una frase que diga que la regla se respeta. La aceptación requiere resultados coherentes, secuencias viables según la regla vigente y acciones comprensibles desde el primer vistazo.

## 8. Criterio de cierre

Se podrá dar por preparada cuando una responsable pueda abrir el mismo periodo desde distintos recorridos y obtener el mismo significado; identificar quién necesita completar horas o ser evaluado; distinguir registro, propuesta y cobertura comprobada; reconocer el día que debe resolver; y explicar la utilidad real de un refuerzo sin leer varios párrafos de reglas.

**Estado de esta revisión: mejoras sustanciales verificadas; aceptación pendiente por coherencia de resultados, discrepancia de desplazamientos, jerarquía de riesgo y decisiones todavía insuficientemente claras.**
