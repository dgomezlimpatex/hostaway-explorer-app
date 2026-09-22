Incidencias actuales reproducidas

### N01 · Prioridad máxima · El perfil omite un compromiso futuro visible en el calendario

**Caso:** Asuncion Fojo Quintas, octubre de 2026.

En Equipo y en su balance mensual, el previsor muestra 0 h computadas, 0 h futuras y 0 h de otros servicios. El objetivo es 86,9 h y las 86,9 h aparecen pendientes. En Disponibilidad no aparecen tareas de octubre ni otro compromiso adicional de ficha para ese mes.

En el calendario operativo del lunes 19 de octubre, la fila de Asuncion muestra Hotel SC de 09:30 a 14:00. El detalle identifica el servicio como tarea recurrente y muestra 4 h 30 min. El compromiso es futuro en la fecha de esta revisión.

**Consecuencia:** una responsable ve una persona sin compromisos futuros en una pantalla y ocupada en otra. Esto compromete la interpretación de las horas por completar y de su disponibilidad. No he demostrado qué propuestas concretas del motor dependen de esa omisión; esa parte requiere investigar la implementación.

**Corrección exigida:** reconciliar la lectura de compromisos recurrentes y tareas materializadas entre calendario y previsor. Si existe una exclusión deliberada, explicarla y tratar su efecto sobre el balance y la disponibilidad. No mostrar cero como si se hubiera comprobado la ausencia de trabajo cuando una fuente relevante no se incorpora.

**Aceptación:** abrir ambas pantallas con la misma persona y fecha. El servicio debe ser reconocible en su agenda, sumar donde corresponda y bloquear su franja una sola vez. Repetir con una recurrencia futura y otra ya materializada para evitar duplicados.

### N02 · P1 · «Tareas sin encaje» mezcla problemas diferentes

**Caso:** semana 19–25 de octubre, todos los centros. El simulador muestra cero tareas sin encaje antes y después; la tarjeta principal contiene once tareas por revisar. La diferencia podría ser correcta si esos once casos fueran problemas del registro y no falta de capacidad. La interfaz todavía no mantiene esa separación de manera consistente.

En el detalle diario, el lunes 19 aparece como «Tareas sin encaje». Al seguir el caso se encuentra la tarea 101 Huésped de MARINA30: duración de 33 minutos, ventana de 12:00 a 15:00, sin persona asignada y horario registrado 11:00–11:33, fuera de esa ventana. La misma interfaz presenta una propuesta para Daiane de 12:00–12:33 y ofrece candidatos elegibles.

La tarea tiene un horario registrado problemático y una propuesta viable según el propio previsor. Llamarla sin encaje no describe lo que se está mostrando. El contador de conflictos del registro de la simulación tampoco explica esos once casos con suficiente consistencia.

**Consecuencia:** quien vea cero en la simulación y una lista de tareas «sin encaje» puede concluir que el simulador falla, contratar un refuerzo innecesario o ignorar un aviso válido. Es un defecto de significado y clasificación, aunque parte de los cálculos pudiera ser correcta.

**Corrección exigida:** usar las mismas definiciones en resumen, estados diarios, filtros, simulador y detalle de tarea. Distinguir al menos: sin asignar, registro por corregir, propuesta disponible, sin propuesta viable y datos insuficientes. Una misma tarea puede tener más de un atributo; no convertirlos en un único estado engañoso.

**Aceptación:** la tarea del ejemplo debe comunicar su conflicto de horario y su propuesta disponible. Si once casos no requieren refuerzo, decirlo de forma breve junto al resultado, con un enlace a esos once registros. No solucionar la diferencia cambiando un número sin aclarar su población.

### N03 · P1 · El enlace a cuatro duraciones ausentes abre 91 días

Desde el subtotal septiembre–noviembre, el enlace de cuatro tareas sin duración lleva a Cobertura diaria con el filtro correcto y un contador de cuatro resultados. Sin embargo, conserva 91 tarjetas/enlaces de día, incluidos los días sin coincidencias. Los casos corresponden al 4, 11, 18 y 25 de septiembre.

El ámbito y el contador están mejor que antes; el recorrido de resolución sigue siendo malo. La responsable tiene que recorrer una agenda completa para encontrar cuatro incidencias. Además, aparecen estados del día completo en días donde el filtro no encuentra tareas, mezclando el contexto general con los resultados filtrados.

**Corrección exigida:** en este recorrido, mostrar primero las cuatro tareas agrupadas en sus cuatro fechas. Ocultar días sin resultados o dejarlos en una opción secundaria explícita. La navegación a un calendario completo puede seguir disponible.

**Aceptación:** pulsar «4 tareas sin duración» y poder identificar las cuatro, su fecha, propiedad y acción sin recorrer días vacíos. El número de resultados debe coincidir con el origen.

### N04 · Regla pendiente de reconciliar · Los desplazamientos siguen excluidos

Reglas y datos declara: «No se contabiliza tiempo de desplazamiento en esta previsión, según la instrucción vigente de Daniel». La conversación disponible acuerda 15 minutos entre edificios, cero dentro del mismo, sin mapas ni cálculo de distancia. La página no es evidencia suficiente de que Daniel haya sustituido ese acuerdo; por eso se ha solicitado aclaración.

La exclusión también se ve en las propuestas del refuerzo: el 25 de septiembre termina Santa Lucia Gallery Apartment 1A a las 13:00 y empieza ART Boutique Apartment 1 a las 13:00; el 26 ocurre una transición equivalente entre Santa Lucía y Downtown La Torre.

**Si Daniel confirmó posteriormente excluir desplazamientos, no debe abrirse un bug por incumplir esa nueva regla. Si mantiene los 15 minutos, estas secuencias incumplen el requisito.** La regla no puede cerrarse por una frase de la propia aplicación. No se atribuye una aprobación nueva al usuario sin su confirmación.

## Juicio crítico del frontend

### La apariencia ya es consistente; el orden de lectura aún no responde a las decisiones

La navegación azul oscuro, el fondo claro, las superficies blancas y las series turquesa/azul forman una base profesional. Los controles tienen un tamaño razonable y los estados ya se distinguen mejor. Añadir más tarjetas, iconos o efectos no resolverá lo pendiente.

La debilidad principal es la arquitectura vertical. En la vista mensual aparecen primero cabecera, filtros, avisos, selectores, simulación, mes del objetivo, cuatro indicadores, gráfico y una lista de días. El resumen de los meses llega después de todo eso.

En 390 × 844, el título «Resumen por mes natural» empieza aproximadamente a 4474 px desde el inicio del documento. En 1024 × 768, a 3260 px; en 1440 × 900, a 2811 px. Son medidas de esta sesión, no umbrales universales, pero ilustran el problema: el contenido que da nombre a la vista está enterrado.

Recomiendo: resumen de objetivos y trabajo, tendencia, comparación entre meses y, después, próximos problemas diarios. La lista de trabajo por resolver debe mostrar un adelanto compacto, con acceso al resto. En semanal, el detalle de siete días sí merece más protagonismo.

### El riesgo confirmado debe competir en igualdad con lo desconocido

En octubre la tarjeta muestra como cifra principal cinco personas pendientes de evaluar. Las trece con déficit confirmado y las 854,7 h por completar quedan en una línea secundaria. Es mejor que el cero de la versión anterior, pero todavía no refleja la prioridad de Daniel: detectar de forma muy visible a quien no llegará a sus horas.

Presentaría dos cifras con nombre inequívoco y accesos separados: «13 con horas por completar» y «5 pendientes de evaluar». El mes debe figurar en esa misma tarjeta; su selector puede integrarse en la cabecera de la tarjeta y ahorrar una fila independiente. Los desconocidos necesitan atención sin eclipsar los déficits conocidos.

Además, mientras exista N01, «déficit confirmado» es una formulación demasiado fuerte para una conclusión cuya fuente de compromisos futuros no está reconciliada. Una etiqueta prudente ayuda, pero no sustituye corregir la omisión.

### Hay menos texto superfluo, pero los contadores todavía hablan demasiado del sistema

«Cómo se calcula» y los desgloses plegados son mejoras claras. Conviene mantener visibles las limitaciones específicas del contexto y guardar las reglas estables en el segundo nivel.

«12 causas por revisar en este ámbito» es preciso para quien conoce el motor, pero poco orientativo para quien busca la siguiente acción. En lugar de eliminar información, mostraría un resumen operativo: qué bloquea la evaluación, cuántas tareas/personas afecta y un único acceso principal. «Revisar ajustes de ausencias y servicios» también necesita concretar la acción al desplegarse.

No hace falta volver a explicar el algoritmo en cada tarjeta. Hace falta que «por revisar», «sin asignar» y «sin encaje» nunca parezcan sinónimos.

### El refuerzo mejora, pero no debe convertirse en una segunda página completa

La comparación junto al aviso de simulación es un acierto. La fórmula de reconciliación ayuda a auditar el resultado, pero es larga. Mantendría un mensaje principal como «7 tareas adicionales; 14,1 de 15 h utilizadas; quedan 51» y dejaría la reconciliación detallada en un desplegable cercano.

Las propuestas deben seguir ordenadas por fecha, conservar su etiqueta «sin guardar» y distinguir cambio recomendado de asignación existente. Esto ya se ve en los ejemplos revisados y conviene preservarlo.

### Acabado pendiente

- A 1024 px el gráfico empieza aproximadamente en y=881, fuera del primer pantallazo. La solución es simplificar las filas de controles, no empequeñecer la letra.
- El resumen semanal presenta 76,2 h + 15,2 h = 91,5 h. Puede deberse al redondeo independiente de valores precisos; no lo califico como error del motor. Sí conviene evitar una suma visible aparentemente incorrecta usando una presentación consistente o indicando aproximación.
- Los estados sin datos han mejorado, pero algunos enlaces de cero siguen aportando poco. Una tarjeta sin asuntos pendientes puede presentar un estado neutro y reservar el enlace para una consulta voluntaria.
- Mantener una tabla accesible del gráfico es acertado. No se ha realizado una certificación con lectores de pantalla ni una medición exhaustiva de contraste; no deben darse por aprobadas sin pruebas específicas.

## Comprobaciones funcionales adicionales

| Recorrido | Resultado observado |
|---|---|
| Riesgo de octubre → Equipo | El enlace a trece personas abre el filtro de horas pendientes de octubre y muestra trece. |
| Semana 28 sept–4 oct | Ofrece enlaces separados a objetivos de septiembre y octubre. |
| RMA sin tareas esa semana | Cero carga, estados diarios «Sin tareas registradas», sin llamada a cero candidatos. |
| Avisos del mismo centro/semana | Dos causas y ámbito RMA/fechas explícito; no las doce causas globales. |
| Capacidad del lunes 19 oct | Desglose visible: 105 − 14 − 2,3 − 1 − 41,4 = 46,3 h; otros servicios computables explicados aparte. |
| Consulta a seis meses | Carga diferenciada, cancelación explícita, sin mostrar resultados anteriores como actuales, reintento exitoso. |
| Próximos tres meses | Restaura septiembre–noviembre en la fecha de la prueba. |
| Móvil | Gráfico ajustado, tarjetas mensuales, menú que cierra con Escape. |

## Encargo de siguiente corrección p

Actúa como ingeniero senior de frontend y diseñador UX de aplicaciones operativas. Conserva la base visual actual de Limpatex. La tercera revisión confirma varias correcciones; no reabras los defectos que ya pasan ni marques todo como terminado por haber añadido componentes.

1. Reproduce N01 con Asuncion en octubre y Hotel SC el 19 de octubre, 09:30–14:00. Reconcilia calendario, balance y disponibilidad. Investiga recurrencias futuras y tareas materializadas sin presuponer la causa. Verifica inclusión una sola vez y bloqueo de la franja.
2. Unifica las definiciones de N02. Reproduce la semana 19–25 de octubre y la tarea 101 Huésped de MARINA30. Un conflicto de horario registrado con propuesta disponible no debe etiquetarse como falta de encaje. Los once registros por revisar deben quedar explicados frente al cero del simulador.
3. Corrige N03: el acceso a cuatro tareas sin duración debe mostrar cuatro resultados identificables, no 91 tarjetas diarias. Mantén el ámbito y el contador actuales.
4. Reconciliar la regla de viajes con la instrucción realmente vigente de Daniel. Si siguen siendo 15 minutos por cambio de edificio, hacer que los intervalos se reflejen en todas las propuestas y en la capacidad. Si existe una instrucción posterior de excluirlos, documentar esa decisión y no restaurarlos por inferencia.
5. Reordena la vista mensual: indicadores, tendencia, meses y adelanto compacto de próximos problemas. Haz visibles por separado déficit mensual conocido y evaluación pendiente. Reduce filas de controles integrando el mes del objetivo en su resumen, sin reducir legibilidad.
6. Mantén las mejoras verificadas: invariancia del horizonte en el caso probado, subtotales, extremos parciales, refuerzo basado en trabajo realmente encajado, formularios positivos con decimal español, tarjetas móviles y navegación por meses.

Entrega evidencia por caso: contexto, resultado antes/después, datos incluidos y límites de la validación. Prueba 390, 768, 1024 y 1440 px y repite los recorridos desde el contador hasta el registro. No uses textos más prudentes para ocultar discrepancias de fuentes ni afirmes que la simulación está validada solo porque termina de ejecutarse.

## Criterio para cerrar esta iteración

Una responsable nueva debe poder responder sin ayuda: qué mes está evaluando; quién tiene horas por completar y quién no se puede evaluar; qué tareas necesitan corregirse frente a cuáles necesitan capacidad; cuánto aporta un refuerzo; y dónde revisar cada caso.

Esta versión se acerca considerablemente a ese objetivo. La aprobación queda pendiente de reconciliar N01, N02 y N03, resolver la regla vigente de desplazamientos y mejorar la posición del resumen mensual. Los retoques de acabado pueden ir después.
