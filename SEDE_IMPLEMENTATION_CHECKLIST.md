# Plan de Implementación Multi-Sede - Lista de Verificación

## ✅ FASE 1: ARQUITECTURA DE BASE DE DATOS

### 1.1 Creación de Tablas Base
- [x] Crear tabla `sedes` con campos básicos
- [x] Crear tabla `user_sede_access` para permisos
- [x] Ejecutar migración de base de datos
- [x] Verificar que las tablas se crearon correctamente

### 1.2 Modificación de Tablas Principales
- [x] Agregar campo `sede_id` a tabla `clients`
- [x] Agregar campo `sede_id` a tabla `properties`
- [x] Agregar campo `sede_id` a tabla `cleaners`
- [x] Agregar campo `sede_id` a tabla `tasks`
- [x] Agregar campo `sede_id` a tabla `inventory_products`
- [x] Agregar campo `sede_id` a tabla `inventory_stock`
- [x] Agregar campo `sede_id` a tabla `logistics_picklists`
- [x] Agregar campo `sede_id` a tabla `logistics_deliveries`

### 1.3 Actualización de Políticas RLS
- [x] Actualizar RLS de `clients` para filtrar por sede
- [x] Actualizar RLS de `properties` para filtrar por sede
- [x] Actualizar RLS de `cleaners` para filtrar por sede
- [x] Actualizar RLS de `tasks` para filtrar por sede
- [x] Actualizar RLS de `inventory_products` para filtrar por sede
- [x] Actualizar RLS de `inventory_stock` para filtrar por sede
- [x] Actualizar RLS de `logistics_picklists` para filtrar por sede
- [x] Actualizar RLS de `logistics_deliveries` para filtrar por sede
- [x] Crear políticas para tabla `sedes`
- [x] Crear políticas para tabla `user_sede_access`

### 1.4 Migración de Datos Existentes
- [x] Crear sede por defecto ("Sede Principal")
- [x] Asignar todos los datos existentes a la sede por defecto
- [x] Verificar integridad de datos después de la migración
- [x] Crear backup antes de la migración

## ✅ FASE 2: TIPOS Y CONTEXTO

### 2.1 Definición de Tipos
- [x] Crear tipos `Sede` en `/types/sede.ts`
- [x] Crear tipos `UserSedeAccess` en `/types/sede.ts`
- [x] Actualizar tipos existentes para incluir `sede_id`

### 2.2 Contexto de Sede
- [x] Crear `SedeContext` en `/contexts/SedeContext.tsx`
- [x] Implementar provider con estado de sede activa
- [x] Crear funciones para cambiar sede activa
- [x] Implementar persistencia en localStorage

### 2.3 Hook de Sedes
- [x] Crear hook `useSedes` en `/hooks/useSedes.ts`
- [x] Implementar funciones para obtener sedes
- [x] Implementar funciones para verificar permisos
- [x] Implementar manejo de errores

## ✅ FASE 3: SERVICIOS CORE

### 3.1 Servicio de Sedes
- [x] Crear `SedeStorageService` en `/services/storage/sedeStorage.ts`
- [x] Implementar mappers para sede
- [x] Crear funciones CRUD básicas
- [x] Implementar función para obtener sedes de usuario

### 3.2 Actualización BaseStorage
- [x] Modificar `BaseStorageService` para incluir filtro por sede
- [x] Actualizar método `getAll()` con filtro automático
- [x] Actualizar método `create()` para incluir sede_id
- [x] Actualizar método `update()` para mantener sede_id
- [x] Verificar que `delete()` respete permisos de sede

### 3.3 Servicios Específicos
- [x] Actualizar `PropertyStorageService`
- [x] Actualizar `TaskStorageService` 
- [x] Actualizar servicios de inventario
- [x] Actualizar servicios de logística
- [x] Verificar que todos los servicios usen filtro de sede

## ✅ FASE 4: COMPONENTES UI

### 4.1 Selector de Sede
- [x] Crear componente `SedeSelector` en `/components/sede/SedeSelector.tsx`
- [x] Implementar dropdown con sedes disponibles
- [x] Mostrar sede activa
- [x] Implementar cambio de sede
- [x] Agregar indicador visual de sede activa

### 4.2 Integración en Layout
- [x] Agregar `SedeSelector` al header/navbar
- [x] Configurar posición y estilo
- [x] Verificar responsividad
- [x] Agregar indicador de sede activa en el título

### 4.3 Componentes de Administración
- [x] Crear formulario para crear nueva sede
- [x] Crear formulario para editar sede existente
- [x] Crear componente para gestionar accesos de usuarios
- [x] Crear página de administración de sedes
- [x] Integrar en rutas de administración

## ✅ FASE 5: HOOKS Y QUERIES

### 5.1 Actualización de Hooks Existentes
- [x] Modificar hooks de propiedades para usar sede activa
- [x] Modificar hooks de tareas para usar sede activa
- [x] Modificar hooks de limpiadores para usar sede activa
- [x] Modificar hooks de clientes para usar sede activa
- [x] Modificar hooks de inventario para usar sede activa
- [x] Modificar hooks de logística para usar sede activa

### 5.2 Nuevos Hooks de Sede
- [x] Crear hook `useActiveSedeId`
- [x] Crear hook `useSedePermissions`
- [x] Crear hook `useSedeData`
- [x] Implementar invalidación de queries al cambiar sede

## ✅ FASE 6: FORMULARIOS Y CREACIÓN

### 6.1 Actualización de Formularios
- [ ] Modificar formularios de propiedades para incluir sede_id automáticamente
- [ ] Modificar formularios de tareas para incluir sede_id automáticamente
- [ ] Modificar formularios de limpiadores para incluir sede_id automáticamente
- [ ] Modificar formularios de clientes para incluir sede_id automáticamente
- [ ] Modificar formularios de inventario para incluir sede_id automáticamente

### 6.2 Validación de Datos
- [ ] Implementar validación de sede_id en formularios
- [ ] Verificar que usuarios solo puedan crear datos en sus sedes permitidas
- [ ] Implementar mensajes de error apropiados

## ✅ FASE 7: REPORTES Y EXPORTACIONES

### 7.1 Filtros en Reportes
- [ ] Actualizar reportes para incluir filtro por sede
- [ ] Mostrar nombre de sede en reportes generados
- [ ] Implementar reportes multi-sede para administradores

### 7.2 Exportaciones
- [ ] Actualizar exportaciones para incluir información de sede
- [ ] Verificar que las exportaciones respeten permisos de sede
- [ ] Agregar filtros de sede en exportaciones

## ✅ FASE 8: TESTING

### 8.1 Testing de Base de Datos
- [ ] Probar creación de sedes
- [ ] Probar asignación de usuarios a sedes
- [ ] Probar filtros RLS
- [ ] Probar integridad de datos

### 8.2 Testing de Aplicación
- [ ] Probar cambio de sede activa
- [ ] Probar filtros automáticos
- [ ] Probar creación de datos con sede correcta
- [ ] Probar permisos de acceso

### 8.3 Testing de UI
- [ ] Probar selector de sede
- [ ] Probar indicadores visuales
- [ ] Probar responsividad
- [ ] Probar flujos de usuario

## ✅ FASE 9: OPTIMIZACIÓN Y PERFORMANCE

### 9.1 Caché y Performance
- [ ] Implementar caché de sedes disponibles
- [ ] Optimizar queries con índices en sede_id
- [ ] Implementar lazy loading donde sea necesario
- [ ] Monitorear performance de queries

### 9.2 Experiencia de Usuario
- [ ] Implementar loading states al cambiar sede
- [ ] Agregar transiciones suaves
- [ ] Implementar manejo de errores elegante
- [ ] Agregar tooltips y ayudas

## ✅ FASE 10: SEGURIDAD

### 10.1 Validación de Permisos
- [ ] Verificar que usuarios no puedan acceder a datos de otras sedes
- [ ] Implementar auditoría de accesos
- [ ] Probar intentos de acceso no autorizado
- [ ] Verificar que las políticas RLS funcionen correctamente

### 10.2 Logs y Monitoreo
- [ ] Implementar logs de cambios de sede
- [ ] Monitorear accesos sospechosos
- [ ] Implementar alertas de seguridad
- [ ] Crear dashboard de monitoreo

## ✅ CHECKPOINTS CRÍTICOS

### Checkpoint 1: Base de Datos ✅
- [x] Todas las tablas creadas
- [x] Políticas RLS funcionando
- [x] Datos migrados correctamente
- [x] Backup realizado

### Checkpoint 2: Servicios Core ✅
- [x] BaseStorage actualizado
- [x] Todos los servicios filtran por sede
- [x] SedeContext funcionando
- [x] Hooks básicos implementados

### Checkpoint 3: UI Básica ✅
- [x] Selector de sede funcionando
- [x] Cambio de sede sin errores
- [x] Filtros automáticos aplicados
- [x] Indicadores visuales correctos

### Checkpoint 4: Testing Completo ✅
- [ ] Todos los tests pasando
- [ ] No hay regresiones
- [ ] Performance aceptable
- [ ] Seguridad verificada

## ✅ POST-IMPLEMENTACIÓN

### Monitoreo Continuo
- [ ] Configurar alertas de performance
- [ ] Monitorear uso de memoria
- [ ] Revisar logs de errores regularmente
- [ ] Monitorear satisfacción de usuarios

### Documentación
- [ ] Crear guía de usuario para sedes
- [ ] Documentar API changes
- [ ] Crear troubleshooting guide
- [ ] Actualizar documentación técnica

## 🚨 ROLLBACK PLAN

### En caso de problemas críticos:
- [ ] Plan de rollback de base de datos preparado
- [ ] Backup de código anterior disponible
- [ ] Procedimiento de rollback documentado
- [ ] Equipo de soporte notificado

---

## 📋 NOTAS IMPORTANTES

### Antes de empezar:
- Crear backup completo de la base de datos
- Notificar a usuarios sobre mantenimiento
- Tener equipo de soporte disponible

### Durante la implementación:
- Seguir el orden de las fases estrictamente
- No saltarse checkpoints críticos
- Probar cada cambio antes de continuar
- Documentar cualquier problema encontrado

### Después de completar:
- Monitorear la aplicación por 48 horas
- Recoger feedback de usuarios
- Ajustar según sea necesario
- Celebrar el éxito! 🎉