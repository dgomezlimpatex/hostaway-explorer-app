

## Plan: Hacer la Página de Reportes Responsive para Móvil

### Problemas actuales en móvil

1. **Header**: Título y botones en línea horizontal que se solapan en pantallas pequeñas
2. **Filtros**: Grid de 5 columnas que colapsa a 1 columna pero con mucho espacio y labels innecesariamente largos
3. **Tabla editable**: 13 columnas en una tabla HTML horizontal - imposible de usar en móvil
4. **Barra de cambios pendientes**: Los botones Guardar/Descartar se amontonan en el header de la Card

### Cambios propuestos

#### 1. Header responsive (`Reports.tsx`)
- Apilar título y botones verticalmente en móvil
- Botón "Volver al Menú" como icono solo en móvil
- Botón Exportar a ancho completo en móvil

#### 2. Filtros compactos (`ReportFilters.tsx`)
- Grid de 2 columnas en móvil (en vez de 1) para aprovechar espacio
- Tipo de reporte y Período en la primera fila, Cliente y Trabajador en la segunda
- Selector de sede a ancho completo arriba si es admin

#### 3. Vista de tarjetas para móvil (`EditableTaskTable.tsx`)
- En móvil, reemplazar la tabla por una lista de tarjetas editables
- Cada tarjeta muestra: fecha, propiedad, tipo, estado, trabajador, coste
- Al tocar una tarjeta, se expande mostrando todos los campos editables en vertical
- Mantener la tabla horizontal en desktop (sin cambios)

#### 4. Barra flotante de guardado
- En móvil, los botones Guardar/Descartar se muestran en una barra fija abajo (sticky bottom) cuando hay cambios pendientes
- Badge de cambios pendientes visible siempre

### Archivos a modificar
1. **`src/pages/Reports.tsx`** - Header responsive con stack vertical
2. **`src/components/reports/ReportFilters.tsx`** - Grid 2 columnas en móvil  
3. **`src/components/reports/EditableTaskTable.tsx`** - Vista tarjetas en móvil + barra flotante de guardado

### Detalle técnico
- Se usa `useIsMobile()` para alternar entre vista tabla y vista tarjetas
- Las tarjetas usan los mismos componentes `EditableCell` y `SelectCell` existentes pero en layout vertical
- La barra flotante usa `fixed bottom-0` con `safe-area-pb` para dispositivos con notch

