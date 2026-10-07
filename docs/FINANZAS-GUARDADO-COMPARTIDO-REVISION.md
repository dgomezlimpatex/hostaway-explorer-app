# Revisión de entrega financiera · 07/10/2026

La pantalla anterior guardaba ajustes en un navegador, tomaba importes antiguos de tareas y no incorporaba contratos externos ni las exclusiones de consumos confirmadas. Esta entrega usa tarifa actual de propiedad, personal a 14,50 €/h, reglas editables por cliente/propiedad e ingresos puntuales, mensuales o por limpieza, con coste asociado y excepción mensual.

Autorización específica de Dani en este chat: «adelante, haz todo eso por orden», después de acordar incorporar las correcciones, ingresos externos, guardado compartido y revisión de septiembre. Incluye crear la persistencia financiera y cargar los valores que facilitó. Se conserva además su autorización de entrega funcional mediante la cola protegida. No se usa la ruta automática que exige declarar ausentes los efectos sobre backend/datos.

## Efectos revisados

- Una tabla nueva `financial_settings` con un documento por sede. RLS y grants exclusivos de esta tabla: lectura/edición por administrador o gestor con sede accesible, sin anónimos, supervisores o limpiadoras. No se cambia el acceso de tablas existentes.
- Trigger sin privilegios elevados: registra autor/fecha y exige incremento de revisión. El guardado compara la revisión leída; un conflicto conserva el borrador.
- Carga inicial solo en esta tabla nueva, fuera del repositorio: tarifas y reglas/ingresos acordados. No se actualizan tareas, propiedades, clientes, inventario, partes, facturas o usuarios. Sin operaciones PMS, comunicaciones, pagos ni despliegues de Edge Functions.
- La migración se aplica únicamente tras obtener la reserva activa de la publicación revisada; se comprueba inmediatamente antes de cada operación. La inicialización es una inserción transaccional, sin upsert ni sustitución de datos existentes. Tras aplicarla se verifican tabla, permisos, configuración y lectura bajo RLS.
- La página no muestra balances si falla cualquier fuente o la configuración compartida. Los ajustes anteriores del navegador se conservan; importarlos sustituye el borrador únicamente tras revisión y requiere guardar explícitamente.

## Verificación realizada

- `financialAnalysisTest.mjs`: cálculo, duración total multioperaria, tarifas, precisión, exclusión de tareas sin ingreso, asignaciones/NOT COUNT, filtros, salario y precios de propiedad.
- `financialExternalIncomeTest.mjs`: factor 4,345, prorrateo inclusivo, varios meses, excepción sustitutiva, coste pendiente frente a cero, suplementos sin productos, reglas de consumo y prioridad de propiedad, check-in y Montse.
- `financialSettingsDatabaseTest.mjs`: migración real en Postgres aislado PGlite; roles/sedes, prohibición de acceso anónimo y borrado, validación básica del documento, incremento de revisión y conflicto de dos editores.
- `financialAnalysisBrowserTest.mjs`: página, lectores y guardado reales con backend simulado; ingresos/costes, excepción mensual, dos contextos independientes, recarga, fallo de lectura/guardado, conflicto, filtros de rentabilidad, escritorio y móvil. Sin red productiva ni sesiones reales.
- Build y lint focalizado correctos. Tipos de aplicación comparados con la base: 102 diagnósticos heredados y 102 actuales, ninguno añadido; Node sin errores. El `tsc` raíz también se ejecuta, pero la comparación de aplicación se hace con `tsconfig.app.json` explícito.
- Revisión de septiembre con una extracción de solo lectura y datos minimizados, usando el código real: ingresos coinciden con la revisión previa; las reglas activas añaden únicamente los paños de cocina que faltaban. Salario general contado una sola vez al sumar sedes. Los costes sin tarifa y consumos históricos no confirmados siguen marcados como pendientes/estimados; no se presenta beneficio contable definitivo.

## Recuperación y límites

Si la migración falla, no se carga configuración ni se incorpora/publica la PR hasta auditar el estado. Si la inicialización tiene resultado incierto, se lee antes de cualquier reintento. Si la publicación falla después del backend, se conserva la tabla financiera aislada y se reconcilian backend/GitHub/Vercel con la reserva; no se borran datos automáticamente. El código anterior no usa esta tabla.

La vista continúa acotada a la sede seleccionada. SP55 permanece identificado por su concepto en actividad general porque no existe un cliente operativo equivalente. Los fijos comienzan en septiembre y las dos entradas variables de lavandería se registran solo ese mes. Los importes son editables y sin IVA. Comprobación final obligatoria del workflow y los dos dominios canónicos.
