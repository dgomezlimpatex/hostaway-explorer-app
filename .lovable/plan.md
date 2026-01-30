
# Plan: Optimización de Creación Múltiple de Tareas

## Resumen
Implementar optimizaciones tanto en backend (Edge Function batch) como en frontend (UI de selección mejorada) para permitir crear hasta 30+ tareas simultáneas de forma rápida y eficiente.

---

## Parte 1: Backend - Edge Function `batch-create-tasks`

### 1.1 Nueva Edge Function

Crear una función que procese múltiples tareas en una sola llamada HTTP:

**Funcionalidades:**
- Recibe array de tareas (hasta 50)
- INSERT batch en una sola operación
- Agrupa emails por cleaner (1 email resumen en lugar de 30 individuales)
- Retorna resultado con IDs creados y estadísticas

```text
┌─────────────────┐     1 llamada      ┌──────────────────────┐
│   Frontend      │ ─────────────────► │  batch-create-tasks  │
│ (30 tareas)     │                    │                      │
└─────────────────┘                    │  ┌────────────────┐  │
                                       │  │ INSERT batch   │  │
                                       │  │ (30 en 1 op)   │  │
                                       │  └────────────────┘  │
                                       │         │            │
                                       │  ┌────────────────┐  │
                                       │  │ Email resumen  │  │
                                       │  │ por cleaner    │  │
                                       │  └────────────────┘  │
                                       └──────────────────────┘
```

### 1.2 Email Consolidado

Nuevo template que lista todas las tareas asignadas:

```text
📋 Se te han asignado 15 nuevas tareas

Tareas para el 30 de enero 2026:
• Habitación 22 - 09:00 a 10:00
• Habitación 23 - 10:00 a 11:00
... (lista completa)
```

---

## Parte 2: Frontend - Grid de Habitaciones

### 2.1 Nuevo Diseño de Botones

Transformar el selector actual de checkboxes pequeños a botones grandes estilo "grid de hotel":

```text
┌───────────────────────────────────────────────────────────────┐
│  HERRAMIENTAS:  [Todas] [Invertir] [Limpiar]  Rango: [22-35] │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐  │
│  │   22   │  │   23   │  │   24   │  │   25   │  │   26   │  │
│  │ 45€    │  │ 45€    │  │ 45€    │  │ 45€    │  │ 45€    │  │
│  │ 60min  │  │ 60min  │  │ 60min  │  │ 60min  │  │ 60min  │  │
│  └────────┘  └────────┘  └────────┘  └────────┘  └────────┘  │
│  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐  │
│  │   27   │  │   28   │  │   29   │  │   30   │  │   31   │  │
│  │ 45€    │  │ 45€    │  │ 45€    │  │ 45€    │  │ 45€    │  │
│  │ 60min  │  │ 60min  │  │ 60min  │  │ 60min  │  │ 60min  │  │
│  └────────┘  └────────┘  └────────┘  └────────┘  └────────┘  │
│                                                               │
│  ✓ 12 seleccionadas                                          │
└───────────────────────────────────────────────────────────────┘
```

**Características:**
- Botones táctiles grandes (~80x80px mínimo)
- Número de habitación prominente (fuente 2xl/3xl)
- Info secundaria: precio y duración
- Estado visual claro: seleccionado = borde azul + fondo azul claro
- Grid responsivo: 6 columnas desktop, 4 tablet, 3 móvil

### 2.2 Barra de Herramientas Rápidas

- **Botón "Todas"**: Seleccionar/deseleccionar todas
- **Botón "Invertir"**: Invertir selección actual
- **Botón "Limpiar"**: Deseleccionar todas
- **Input de Rango**: Escribir "22-35" y presionar Enter para seleccionar ese rango
- **Contador**: Badge flotante "15 seleccionadas"

### 2.3 Atajos de Teclado

- `Ctrl+A` / `Cmd+A`: Seleccionar todas
- `Escape`: Limpiar selección

### 2.4 Indicador de Progreso

Durante la creación batch:
- Barra de progreso: "Creando tareas..."
- Estado del botón cambia a spinner + texto
- Toast de éxito al finalizar

---

## Sección Técnica

### Archivos a Crear

| Archivo | Propósito |
|---------|-----------|
| `supabase/functions/batch-create-tasks/index.ts` | Edge Function para creación batch con INSERT múltiple y emails consolidados |
| `src/components/modals/batch-create/PropertyGridSelector.tsx` | Nuevo componente de grid de habitaciones con botones grandes |
| `src/components/modals/batch-create/PropertyGridToolbar.tsx` | Barra de herramientas con selector de rango y botones rápidos |

### Archivos a Modificar

| Archivo | Cambios |
|---------|---------|
| `src/components/modals/batch-create/MultiPropertySelector.tsx` | Reemplazar layout de columnas por el nuevo PropertyGridSelector |
| `src/components/modals/BatchCreateTaskModal.tsx` | Añadir indicador de progreso durante creación |
| `src/hooks/tasks/useTasksPageActions.ts` | Nuevo método que llama a la Edge Function batch |
| `src/hooks/useTasks.ts` | Añadir método `batchCreateTasks` para llamar a la Edge Function |
| `supabase/config.toml` | Registrar nueva función batch-create-tasks |

### Estructura de la Edge Function

```typescript
interface BatchCreateRequest {
  tasks: Array<{
    property: string;
    address: string;
    date: string;
    startTime: string;
    endTime: string;
    type: string;
    status: string;
    checkIn: string;
    checkOut: string;
    clienteId: string;
    propertyId: string;
    duration: number;
    cost: number;
    paymentMethod: string;
    supervisor: string;
    cleanerId?: string;
    cleanerName?: string;
    cleanerEmail?: string;
  }>;
  sedeId: string;
  sendEmails: boolean;
}

interface BatchCreateResponse {
  success: boolean;
  created: number;
  taskIds: string[];
  emailsSent: number;
  errors?: Array<{ index: number; error: string }>;
}
```

### Flujo de Datos Optimizado

```text
FLUJO ACTUAL:
Frontend → createTask() x30 → 30 INSERT → 30 emails → 30 invalidaciones
Tiempo: ~6 segundos

FLUJO NUEVO:
Frontend → batchCreate() x1 → 1 INSERT batch → 2-3 emails → 1 invalidación  
Tiempo: ~0.5 segundos
```

### CSS del Grid

```css
/* Grid responsivo */
grid-template-columns: repeat(6, 1fr);  /* Desktop */
grid-template-columns: repeat(4, 1fr);  /* Tablet (lg) */
grid-template-columns: repeat(3, 1fr);  /* Móvil (sm) */
```

### Componente de Botón de Habitación

Estado normal:
- Borde gris claro (`border-gray-200`)
- Fondo blanco
- Hover: fondo gris muy claro

Estado seleccionado:
- Borde azul (`border-blue-500`)
- Fondo azul claro (`bg-blue-50`)
- Texto azul (`text-blue-700`)

---

## Resumen de Mejoras

| Aspecto | Antes | Después |
|---------|-------|---------|
| Tiempo creación 30 tareas | ~6 segundos | ~0.5 segundos |
| Llamadas HTTP | 30 | 1 |
| Emails enviados | 30 individuales | 2-3 consolidados |
| Invalidaciones cache | 30 | 1 |
| Tamaño botones | Checkbox pequeño | Botón 80x80px |
| Selección de rango | Click individual | "22-35" automático |
| Layout | Columnas verticales | Grid horizontal |

