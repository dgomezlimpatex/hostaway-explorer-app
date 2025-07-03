# Roadmap: Vista de Calendario Móvil para Cleaners

## Objetivo
Crear una vista de calendario móvil personalizada para el rol de CLEANER, basada en el concepto de diseño proporcionado. Esta vista debe ser exclusiva para móvil y solo visible para usuarios con rol de limpiador.

## Fase 1: Estructura Base y Detección ✅ COMPLETADA
### 1.1 Crear componente principal ✅
- [x] Crear `CleanerMobileCalendar.tsx` en `src/components/calendar/`
- [x] Implementar detección de rol y dispositivo móvil
- [x] Integrar con el calendario existente solo para cleaners en móvil

### 1.2 Configurar enrutamiento condicional ✅
- [x] Modificar `CalendarContainer.tsx` para renderizar condicionalmente
- [x] Asegurar que desktop siga funcionando igual
- [x] Solo afectar vista móvil para cleaners

## Fase 2: Vista "HOY" y Navegación de Fechas ✅ COMPLETADA
### 2.1 Implementar vista inicial "Today" ✅
- [x] Crear header con fecha actual grande (formato: "13.12 DEC")
- [x] Mostrar día de la semana
- [x] Implementar botones de navegación (anterior/siguiente día)

### 2.2 Navegación entre días ✅
- [x] Crear hooks para navegación de fechas
- [x] Implementar swipe gestures (opcional)
- [x] Actualizar datos al cambiar fecha

## Fase 3: Resumen de Tareas
### 3.1 Calcular estadísticas
- [ ] Crear hook `useCleanerTaskSummary`
- [ ] Contar tareas de hoy y mañana
- [ ] Filtrar solo tareas del cleaner actual

### 3.2 Mostrar resumen
- [ ] Componente para mostrar "Tareas hoy: X"
- [ ] Componente para mostrar "Tareas mañana: X"
- [ ] Styling responsivo móvil

## Fase 4: Tarjetas de Tareas
### 4.1 Crear componente TaskCard móvil
- [ ] Crear `CleanerTaskCard.tsx`
- [ ] Mostrar: "Nombre del piso - Código del piso"
- [ ] Mostrar: "Hora inicio - Hora finalización"
- [ ] Styling similar al concepto (colores, bordes redondeados)

### 4.2 Lista de tareas del día
- [ ] Renderizar tarjetas en scroll vertical
- [ ] Manejar estados vacíos (sin tareas)
- [ ] Optimizar performance para listas largas

## Fase 5: Integración con Funcionalidad Existente
### 5.1 Navegación a detalles
- [ ] Conectar tap en tarjeta con modal de detalles existente
- [ ] Asegurar que "Comenzar Reporte" funciona
- [ ] Mantener toda funcionalidad actual

### 5.2 Estados de tareas
- [ ] Mostrar estados visuales en tarjetas
- [ ] Actualización en tiempo real
- [ ] Sincronización con backend

## Fase 6: Styling y UX Móvil
### 6.1 Diseño visual
- [ ] Implementar gradientes de colores por día
- [ ] Bordes redondeados y sombras
- [ ] Tipografía optimizada para móvil
- [ ] Paleta de colores consistente

### 6.2 Animaciones y transiciones
- [ ] Transiciones suaves entre días
- [ ] Animaciones de carga
- [ ] Feedback visual en interacciones

## Fase 7: Testing y Optimización
### 7.1 Testing funcional
- [ ] Probar en diferentes tamaños de pantalla móvil
- [ ] Verificar filtrado correcto por cleaner
- [ ] Testear navegación y estados

### 7.2 Performance
- [ ] Optimizar queries de datos
- [ ] Implementar caching apropiado
- [ ] Lazy loading si es necesario

## Consideraciones Técnicas

### Componentes Principales a Crear:
- `CleanerMobileCalendar.tsx` - Componente principal
- `CleanerTaskCard.tsx` - Tarjeta individual de tarea
- `CleanerDateHeader.tsx` - Header con fecha y navegación
- `CleanerTaskSummary.tsx` - Resumen de tareas

### Hooks Necesarios:
- `useCleanerTaskSummary.ts` - Estadísticas de tareas
- `useCleanerMobileNavigation.ts` - Navegación de fechas

### Integración:
- Modificar `CalendarContainer.tsx` para renderizado condicional
- Usar hooks existentes: `useOptimizedTasks`, `useCleaners`, `useAuth`
- Mantener compatibilidad con funcionalidad actual

### Restricciones:
- Solo móvil (detectar con `useDeviceType`)
- Solo rol 'cleaner'
- No afectar vista desktop
- No modificar funcionalidad existente para otros roles

## Orden de Implementación Recomendado:
1. Fase 1: Base y detección
2. Fase 2: Vista inicial y navegación
3. Fase 3: Resumen de tareas
4. Fase 4: Tarjetas de tareas
5. Fase 5: Integración
6. Fase 6: Styling
7. Fase 7: Testing

## Archivos a Modificar:
- `src/components/calendar/CalendarContainer.tsx` (renderizado condicional)
- Crear nuevos componentes en `src/components/calendar/cleaner/`
- Posibles ajustes en `src/hooks/useOptimizedTasks.ts` si se necesita