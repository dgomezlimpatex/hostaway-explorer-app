

# Plan de Optimización de Backend y Base de Datos

## Resumen Ejecutivo

Este plan implementa 5 optimizaciones que harán la aplicación más rápida y eficiente, con especial atención a tu requisito de **cargar solo tareas de 1 mes antes/después** mientras mantienes accesibles las tareas antiguas.

---

## Las 5 Optimizaciones Explicadas de Forma Sencilla

### 1. Velocidad de búsqueda (Índices)

**Qué haremos:** Añadir "índices" a la base de datos

**Resultado esperado:** El calendario cargará en menos de 1 segundo (ahora tarda 2-4 segundos)

**Cambios específicos:**
- Crear un índice combinado para buscar tareas por fecha + sede + estado
- Crear un índice para acelerar la verificación de permisos de usuario

**Riesgo:** Ninguno. Los índices son como el índice de un libro - no cambian los datos, solo ayudan a encontrarlos más rápido.

---

### 2. Cargar solo lo necesario (Ventana de 1 mes)

**Qué haremos:** Modificar la aplicación para que solo cargue tareas dentro de una "ventana" de 1 mes antes y 1 mes después de la fecha actual.

**Tu preocupación resuelta:** Cuando quieras ver tareas más antiguas:
- El sistema detectará que estás buscando fuera de la ventana normal
- Mostrará un pequeño indicador de "cargando..."
- Traerá esas tareas específicas sin recargar todo

**Cómo funcionará para ti:**
| Acción | Velocidad | Datos cargados |
|--------|-----------|----------------|
| Abrir calendario | Rápido (~0.5s) | Solo 1 mes ± |
| Ir a febrero 2026 | Instantáneo | Ya en memoria |
| Ir a diciembre 2024 | 1-2 segundos | Carga bajo demanda |
| Ver reporte de 2024 | 1-2 segundos | Consulta directa a BD |

---

### 3. Corrección del error de sedes

**Qué haremos:** Corregir un error donde el sistema a veces usa "no-sede" en lugar de la sede real.

**Resultado:** 
- No verás tareas de otras sedes mezcladas
- La caché funcionará correctamente al cambiar de sede

---

### 4. Optimización de reportes

**Qué haremos:** Los reportes consultarán directamente la base de datos con filtros, en lugar de cargar todas las tareas y filtrar después.

**Resultado:**
- Reportes de meses pasados cargarán en 1-2 segundos
- No afectará la memoria del navegador

---

### 5. Limpieza de mensajes internos (console.logs)

**Qué haremos:** Eliminar los mensajes de depuración que ralentizan la aplicación.

**Resultado:** La aplicación será ligeramente más fluida, especialmente en móviles.

---

## Detalles Técnicos (para referencia)

### Fase 1: Índices de Base de Datos

```sql
-- Índice para búsquedas frecuentes del calendario
CREATE INDEX CONCURRENTLY idx_tasks_date_sede_status 
ON tasks(date, sede_id, status);

-- Índice para verificación de roles (acelera cada petición)
CREATE INDEX CONCURRENTLY idx_user_roles_user_role 
ON user_roles(user_id, role);

-- Índice para acceso a sedes
CREATE INDEX CONCURRENTLY idx_user_sede_access_composite 
ON user_sede_access(user_id, sede_id, can_access);

-- Índice para fotos (la tabla más grande: 15MB, 38,960 fotos)
CREATE INDEX CONCURRENTLY idx_task_media_task_id 
ON task_media(task_id);
```

La palabra `CONCURRENTLY` significa que se crean sin bloquear la aplicación - los usuarios pueden seguir trabajando.

---

### Fase 2: Carga de Tareas por Ventana Temporal

**Archivos a modificar:**

1. **`src/services/storage/taskStorage.ts`**
   - Añadir parámetros `dateFrom` y `dateTo` al método `getTasks()`
   - Por defecto: 1 mes antes y 1 mes después de hoy

2. **`src/hooks/useOptimizedTasks.ts`**
   - Calcular automáticamente la ventana de fechas según la vista actual
   - Detectar cuando el usuario navega fuera del rango cargado
   - Cargar datos adicionales solo cuando sea necesario

3. **`src/hooks/tasks/useTasksPageState.ts`**
   - Implementar paginación desde el servidor para la lista de tareas
   - Solo traer 50 tareas a la vez con opción de "cargar más"

**Nuevo flujo de datos:**

```
┌─────────────────────────────────────────────────────────────┐
│  Usuario abre calendario (30 Ene 2026)                      │
├─────────────────────────────────────────────────────────────┤
│  Sistema calcula: 30 Dic 2025 → 28 Feb 2026                 │
│  Carga: ~100 tareas (estimado)                              │
│  Tiempo: <1 segundo                                         │
└─────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────┐
│  Usuario navega a Octubre 2025                              │
├─────────────────────────────────────────────────────────────┤
│  Sistema detecta: fuera del rango cargado                   │
│  Nueva consulta: 1 Sep 2025 → 30 Nov 2025                   │
│  Muestra indicador de carga                                 │
│  Tiempo: 1-2 segundos                                       │
└─────────────────────────────────────────────────────────────┘
```

---

### Fase 3: Corrección del Error de Sedes

**Archivo:** `src/hooks/useTasks.ts`

Cambiar todas las líneas con:
```typescript
const sedeId = 'no-sede'; // TODO: get from context
```

Por:
```typescript
const { activeSede } = useSede();
const sedeId = activeSede?.id || 'no-sede';
```

Esto afecta a las líneas 42, 77, 93, 217, 283 del archivo.

---

### Fase 4: Reportes con Paginación Servidor

**Archivos a modificar:**

1. **`src/hooks/reports/useReportData.ts`**
   - Añadir filtros de fecha directamente en la consulta SQL
   - En lugar de traer todas las tareas y filtrar en el navegador

2. **`src/services/storage/taskStorage.ts`**
   - Nuevo método: `getTasksForReports(filters)` que aplica filtros en la base de datos

**Consulta optimizada para reportes:**
```sql
SELECT * FROM tasks 
WHERE date BETWEEN '2025-01-01' AND '2025-01-31'
AND sede_id = 'tu-sede-id'
ORDER BY date, start_time
```

En lugar de cargar 4,500 tareas y filtrar 100.

---

### Fase 5: Limpieza de Console.logs

**Archivos afectados:** 70 archivos con ~1,746 mensajes de depuración

**Solución:** Crear un sistema de logging condicional:

```typescript
// src/utils/logger.ts
const isDev = import.meta.env.DEV;

export const logger = {
  log: (...args: any[]) => isDev && console.log(...args),
  warn: (...args: any[]) => isDev && console.warn(...args),
  error: (...args: any[]) => console.error(...args), // Errores siempre se muestran
};
```

Y reemplazar progresivamente los `console.log` por `logger.log`.

---

## Orden de Implementación Recomendado

| Paso | Optimización | Tiempo estimado | Impacto |
|------|-------------|-----------------|---------|
| 1 | Índices de base de datos | 10 minutos | Alto - mejora inmediata |
| 2 | Corrección sedes (useTasks.ts) | 15 minutos | Medio - evita bugs |
| 3 | Ventana temporal de tareas | 1 hora | Alto - reduce datos cargados |
| 4 | Reportes con filtros BD | 45 minutos | Medio - reportes más rápidos |
| 5 | Limpieza console.logs | 30 minutos | Bajo - app más fluida |

---

## Métricas Esperadas Después de las Optimizaciones

| Métrica | Antes | Después |
|---------|-------|---------|
| Tiempo carga calendario | 2-4 segundos | <1 segundo |
| Datos transferidos por sesión | ~5 MB | <1 MB |
| Tareas en memoria | 4,500 | ~100 (1 mes) |
| Tiempo de reporte mensual | 3-5 segundos | 1-2 segundos |
| Escaneos BD por día | 6 mil millones | <100 millones |

---

## Seguridad de los Cambios

- **Los índices** no modifican datos, solo aceleran búsquedas
- **La ventana temporal** no elimina tareas, solo cambia cuándo se cargan
- **La corrección de sedes** es un fix de bug existente
- **Los reportes** seguirán mostrando los mismos datos, solo más rápido
- **La limpieza de logs** no afecta funcionalidad, solo rendimiento

