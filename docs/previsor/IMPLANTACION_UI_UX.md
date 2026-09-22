# Implantación UI/UX del previsor — 22 de septiembre de 2026

Objetivo activo: implantar `PLAN_UI_UX_20260921.md` sobre los datos reales.

## Base y alcance

- Rama: `codex/previsor-ui-ux-20260922`, base `3c4ae307`.
- Ambos dominios verificados: `dpl_2obWJESyXrh7UMLmp1Lok7di1SGV`.
- `origin/main` continúa en `c1c538d8`; la base reconciliada contiene el trabajo posterior de Hermes y los cambios publicados de este previsor. No se sustituye por el main antiguo.
- Cambios concentrados en el previsor y sus pruebas/documentación. No modificar los servicios de asignación o las notificaciones por WhatsApp/correo.
- El documento adjunto es una especificación; sus notas sobre esperar la revisión y su encargo a Hermes son contexto histórico. La petición actual autoriza implantarlo.
- Prevalecen las instrucciones directas de Daniel: sin tiempo de viajes; mantenimiento fuera de demanda/calendarios del previsor y dentro de compromisos/cómputo individual. A10 se valida como ausencia de viajes.
- Los enlaces operativos pedidos en este plan se abren explícitamente en otra pestaña. Se conserva el contexto del previsor. El calendario existente admite `date` y `task`; no requiere cambiar sus operaciones de escritura.

## Dirección visual

Conservar azul tinta #18334b, azul acción #285d94, turquesa #168486, fondo #f4f8fb, ámbar #795719 y bordes #d5e1e8. Se ha utilizado Segoe UI con Arial como alternativa local, sin dependencias ni descargas de fuentes. Texto operativo de 15–16 px, secundarios de 14 px, controles de 44 px. La lista de asuntos pendientes dirige Inicio; cada asunto abre su conjunto exacto. Comparativas y estados priman sobre decoración.

## Entregas y trazabilidad

| Bloque | Alcance | Casos de aceptación | Estado |
|---|---|---|---|
| A | UI-01–07: contexto, desconocidos, enlaces, propuestas, gráficos, incidencias agrupadas | A02–05, A12–14, A18 | Implementado y probado localmente |
| B | Contexto común, buscadores, formatos, móvil, detalles y estados | A19, A20, A22, A23 | Implementado y probado localmente |
| C | Inicio, previsión y comparación de simulación en el mismo ámbito | A01, A08, A11, A17, A24 | Implementado; falta prueba humana A01 |
| D | Equipo, perfiles y cobertura diaria/semanal/mensual, candidatos y calendario | A03, A05–10, A13–16 | Implementado; falta recorrido autenticado |
| E | Centros, informes/CSV y reglas/datos | A07, A18, A21 | Implementado y probado localmente |
| F | Pruebas, capturas, teclado, anchos 390/768/1024/1440, revisión de alcance | A01–24 | Automatización local terminada; QA real y comprensión pendientes |

## Validación

La suite `test:forecast` pasa (34 casos de contrato más acceso, caché y lector). `test:forecast:ui-ux` añade 14 pruebas de presentación y 16 recorridos/comprobaciones de interfaz. Las pruebas visuales usan fixtures señalados como sintéticos y comprueban que no hay llamadas de red; la aplicación conserva el lector real. La compilación y el lint de archivos nuevos/modificados de interfaz pasan. Los 101 errores existentes del typecheck completo de la aplicación permanecen idénticos a la línea base.

Consulta [RESULTADOS_UI_UX.md](RESULTADOS_UI_UX.md) para el detalle de aceptación, incidencias anteriores, alcance y reversión. La prueba de comprensión con una persona ajena al desarrollo se registrará separada de la comprobación técnica, sin inventar resultados ni tiempos. La sesión local está en `/auth`; no se ha declarado realizada la QA con registros reales.

No se declara terminado un bloque solo por compilar. La publicación se hará únicamente de una versión validada y tras volver a inspeccionar la fuente vigente de producción.
