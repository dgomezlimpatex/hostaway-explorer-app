

## Optimizacion del Sistema de Control de Horas (Workload)

### Analisis del sistema actual

He revisado todos los archivos del sistema de workload. Actualmente consta de:

- **WorkloadDashboard** (`/workload`): Pagina completa con navegacion semanal/mensual, tarjetas de resumen (4 KPIs), alertas, y lista de tarjetas individuales por trabajador.
- **WorkloadWidget**: Widget en el dashboard principal que muestra barras de progreso de los 5 primeros trabajadores.
- **WorkloadOverviewCard**: Tarjeta expandible por trabajador con desglose detallado (turisticas, mantenimiento, ajustes).
- **HourAdjustmentModal**: Modal para anadir/restar horas manualmente.
- **useWorkloadCalculation**: Hook que calcula horas desde 3 fuentes: tareas turisticas, mantenimiento recurrente y ajustes manuales.

### Problemas detectados

1. **Demasiada informacion dispersa**: 4 tarjetas KPI + alertas + tarjetas expandibles = mucho scroll y ruido visual.
2. **Cada trabajador es una tarjeta separada** que hay que expandir individualmente para ver el desglose.
3. **No hay vista de tabla compacta**: imposible comparar trabajadores de un vistazo.
4. **El widget del dashboard** solo muestra 5 trabajadores y es poco informativo.
5. **No se ve facilmente quien necesita atencion**: hay que leer todas las tarjetas.

### Solucion propuesta

Redisenar la pagina de WorkloadDashboard con una interfaz mas compacta y visual:

#### 1. Reemplazar las 4 tarjetas KPI por una barra de resumen compacta
- Una sola fila horizontal con: total trabajadores, en rango, horas extra, deficit.
- Iconos con numeros inline, no tarjetas separadas. Ahorra mucho espacio vertical.

#### 2. Reemplazar las tarjetas individuales por una tabla compacta
En lugar de tarjetas expandibles, una tabla con columnas:

| Trabajador | Contrato | Turisticas | Mant. | Ajustes | Total | Diferencia | Estado |
|---|---|---|---|---|---|---|---|
| Maria | 30h | 18.5h | 8h | +2h | 28.5h | -1.5h | (barra verde) |
| Pedro | 25h | 15h | 6h | 0h | 21h | -4h | (barra amarilla) |

- Cada fila incluye una mini barra de progreso integrada.
- Columna "Diferencia" con color: verde si OK, ambar si extra, rojo si deficit.
- Boton de "+" en cada fila para anadir ajuste rapido.
- Click en la fila para expandir y ver el desglose detallado (ajustes individuales, etc.).

#### 3. Mejorar el Widget del dashboard
- Mostrar todos los trabajadores con contrato (no solo 5).
- Formato mas compacto: nombre + barra + diferencia en una sola linea.
- Resaltar en rojo/ambar solo los que necesitan atencion.

#### 4. Ordenacion inteligente por defecto
- Ordenar trabajadores por "quien necesita mas atencion": primero los de deficit critico, luego deficit, luego extra, luego OK.

### Cambios tecnicos

**Archivos a modificar:**
- `src/pages/WorkloadDashboard.tsx` - Rediseno completo: barra de resumen compacta + tabla en lugar de tarjetas
- `src/components/workload/WorkloadOverviewCard.tsx` - Convertir en fila expandible de tabla o eliminar en favor de un nuevo componente de tabla
- `src/components/workload/WorkloadWidget.tsx` - Hacerlo mas compacto y mostrar todos los trabajadores

**Sin cambios en:**
- `src/hooks/useWorkloadCalculation.ts` - La logica de calculo esta bien
- `src/types/workload.ts` - Los tipos son correctos
- `src/components/workload/HourAdjustmentModal.tsx` - El modal funciona bien

### Resultado esperado

- Vista principal pasa de ~6 secciones con scroll a 2 secciones (resumen + tabla).
- Comparar trabajadores es inmediato en la tabla.
- Los que necesitan atencion aparecen primero y destacados visualmente.
- Menos clicks necesarios para ver la informacion importante.

