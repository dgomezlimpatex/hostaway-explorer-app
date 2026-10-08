# Sacos de basura 100 L

Petición de Dani (08/10/2026): producto independiente de las bolsas pequeñas, coste 0,10 EUR por unidad, uso desde 09/10/2026. Inicializar una cantidad editable por cocina en todas las propiedades existentes. Existencia declarada: 500 unidades en A Coruña, Simón Bolívar. No duplicar propiedades ni contabilizar el valor de apertura como gasto adicional al consumo.

- Fuente única de cantidades: stock_property_consumption_rules, producto SKU SACOS-BASURA-100L por sede. No se añade una columna duplicada a properties. El formulario y detalle muestran el producto como campo de consumos; cero explícito prevalece sobre el cálculo inicial.
- La apertura crea las reglas una sola vez y preserva ajustes posteriores. Solo Simón Bolívar recibe stock físico. No se inventa stock en las otras sedes.
- Se conserva la ubicación al editar cantidades. No se cambia el descuento de otros productos ni se activa un motor desactivado.
- Ruta V2: la cantidad aparece en amenities.trashSacks100L y forma parte de la firma de contenido. Cambiarla reabre preparación; antes del 09/10 vale cero. Los sacos no sustituyen los consumibles antiguos. Las páginas antiguas deben recargarse para preparar una bolsa que ya incluya sacos.
- Ruta clásica: el RPC filtra por fecha del servicio; los sacos se muestran además de los consumibles anteriores.
- Finanzas: tarifa editable de 0,10 EUR sin IVA; fecha del servicio, no fecha de preparación. No se imputa retrospectivamente, tampoco mediante ajustes antiguos. Conserva las políticas de consumibles por cliente/propiedad y los servicios de solo personal. Las bolsas pequeñas siguen dentro del porcentaje de productos; los sacos son independientes.
- CSV diario: columna adicional al final, conservando las posiciones anteriores.

## Entrega revisada

Con reserva activa: comprobar que las tres funciones SQL siguen coincidiendo con las definiciones inspeccionadas; aplicar scripts/trashSacksDateGuards.sql antes de la apertura; desplegar únicamente laundry-route-workflow, manage-laundry-route-v2-links y daily-report-csv con sus dependencias verificadas; ejecutar scripts/trashSacksOpening.sql una sola vez; comprobar existencias, una entrada inicial, cantidades, conservación de propiedades/bolsas/cocinas y políticas. Después incorporar la PR protegida y entregar la publicación al workflow revisado. No ejecutar el cron ni reconciliar rutas manualmente como prueba sobre datos reales.

Pruebas: trashSacksTest.mjs (PostgreSQL aislado, apertura/repetición, RPC de ruta y motor estimado con reloj de prueba), trashSacksBrowserTest.mjs, propertyAmenitiesDisplayTest.mjs, financialAnalysisTest.mjs, financialExternalIncomeTest.mjs, financialAnalysisBrowserTest.mjs y laundryAutomaticUpdatesTest.mjs. Compilación, tipos Node y lint focalizado; tipos de aplicación mantienen 102 errores previos, sin nuevos.
