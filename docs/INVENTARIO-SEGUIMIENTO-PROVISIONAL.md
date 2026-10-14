# Seguimiento provisional mientras se completa el recuento

El resumen de Inventario incluye una comparación de recepciones confirmadas de
ropa y contenido de bolsas nuevas. Es útil cuando todavía no se conoce la ropa
que había antes de empezar a registrar entradas. No representa existencias físicas
ni sustituye la apertura del circuito completo por ubicación y estado.

- La fecha puede elegirse en pantalla y se conserva en `seguimientoDesde` en el
  enlace. Sin fecha explícita se propone la primera recepción del último mes.
- Las recepciones usan su día operativo en Madrid, aunque se confirmen más tarde.
  Los movimientos de corrección suman solo su diferencia, incluida una reducción.
  Los borradores no generan movimientos y no se incluyen.
- Cada tarea preparada se cuenta una vez, con su última composición registrada.
  Se consulta el historial anterior para excluir las bolsas que solo se volvieron
  a marcar. Si cambia la ropa de una bolsa anterior al inicio, la comparación pide
  revisión, en lugar de afirmar un saldo sin esa corrección.
- Los negativos se conservan como diferencias. No se convierten en stock cero ni
  bloquean el reparto. Un producto sin correspondencia o sin detalle de bolsa se
  muestra pendiente de comprobar, sin afirmar un consumo cero.
- El historial consultado no acredita desempaquetados ni devoluciones físicas.
  Las reglas actuales de las propiedades no reescriben las bolsas históricas.

Amenities y consumibles muestran la última cantidad introducida y el saldo ya
registrado. No se descuenta de nuevo su contenido de bolsas. El consumo estimado
de tareas anteriores a la fecha elegida se muestra como aviso, porque el mecanismo
existente puede haber descontado cantidades después de introducir nuevas entradas.
Un ajuste usa el saldo final introducido; no se presenta el valor absoluto de la
diferencia como una entrada nueva.

Las consultas son de solo lectura, paginadas y sujetas a los permisos existentes.
La vista completa se muestra a administración y gestión, los roles que ya pueden
leer todo el historial necesario. No modifica rutas, políticas ni acceso a datos.
Se actualiza cada minuto con la pantalla abierta y al recuperar el foco; los
saldos registrados se vuelven a leer en la misma actualización. Una consulta
fallida o incompleta oculta la comparación anterior. Un cambio de sede o de usuario
tiene una caché distinta. No hay escrituras, RPC, activación de flags, despliegues
de funciones ni carga de stock mediante esta vista.

Validación local sin sesiones ni red:

```text
node scripts/provisionalInventoryTest.mjs
node scripts/provisionalInventoryBrowserTest.mjs
node scripts/inventorySimplificationTest.mjs
node scripts/inventorySimplificationBrowserTest.mjs
```
