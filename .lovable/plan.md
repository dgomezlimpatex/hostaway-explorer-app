
# Plan: Sistema de Control de Horas Trabajadas vs Contrato (Actualizado)

## Cambios Solicitados

1. **Contar TODAS las tareas asignadas**, no solo las completadas (ya que a veces no terminan el formulario pero sí hacen el servicio)
2. **Añadir/modificar horas manualmente** sin crear tareas
3. **Widget en el dashboard principal** con resumen de horas y alertas

---

## Parte 1: Ajustes Manuales de Horas

### 1.1 Nueva Tabla: `worker_hour_adjustments`

Tabla para registrar ajustes manuales de horas (positivos o negativos):

```text
┌──────────────────────────────────────────────────────────────────────────┐
│  AJUSTES MANUALES DE HORAS                                               │
├──────────────────────────────────────────────────────────────────────────┤
│  + 2.5h  │  28 Ene  │  Horas extra formación   │  Añadido por: Admin    │
│  - 1.0h  │  27 Ene  │  Llegada tarde           │  Añadido por: Manager  │
│  + 3.0h  │  26 Ene  │  Limpieza emergencia     │  Añadido por: Admin    │
└──────────────────────────────────────────────────────────────────────────┘
```

**Campos:**
- `cleaner_id`: ID del trabajador
- `date`: Fecha del ajuste
- `hours`: Horas (positivo = añadir, negativo = restar)
- `reason`: Motivo del ajuste
- `category`: Tipo (extra, formación, ausencia, corrección, otro)
- `created_by`: Quién añadió el ajuste
- `notes`: Notas adicionales

### 1.2 Formulario de Ajuste Manual

Desde el detalle del trabajador o desde el dashboard:

```text
┌────────────────────────────────────────────────────────────────────┐
│  Añadir Ajuste de Horas                                            │
├────────────────────────────────────────────────────────────────────┤
│  Trabajador:  [Lilia Mercedes        v]                            │
│  Fecha:       [28/01/2026           📅]                            │
│  Tipo:        ( ) Añadir horas  ( ) Restar horas                  │
│  Horas:       [2.5    ] horas                                      │
│  Categoría:   [Horas extra          v]                             │
│  Motivo:      [Formación nuevo producto________________]           │
│                                                                    │
│                          [Cancelar]  [Guardar Ajuste]              │
└────────────────────────────────────────────────────────────────────┘
```

---

## Parte 2: Calculo de Horas (Actualizado)

### 2.1 Fuentes de Horas

El sistema sumará horas de **tres fuentes**:

1. **Limpiezas turísticas**: Tareas asignadas a la limpiadora (cualquier estado excepto canceladas)
2. **Limpiezas de mantenimiento**: Horas fijas de `worker_maintenance_cleanings`
3. **Ajustes manuales**: De la nueva tabla `worker_hour_adjustments`

```text
TOTAL = Turísticas + Mantenimiento + Ajustes Manuales
        (tareas)    (fijo semanal)   (+ o -)
```

### 2.2 Cálculo de Horas Turísticas

Ya no filtra por `status = 'completed'`:

```typescript
// ANTES (solo completadas)
tasks.filter(t => t.cleanerId === cleanerId && t.status === 'completed')

// AHORA (todas las asignadas, excluyendo canceladas)
tasks.filter(t => 
  t.cleanerId === cleanerId && 
  t.status !== 'cancelled'
)
```

---

## Parte 3: Widget en Dashboard Principal

### 3.1 Nuevo Widget: Control de Horas

Añadir al dashboard un widget compacto que muestre:

```text
┌────────────────────────────────────────────────────────────────────────┐
│  Control de Horas - Esta Semana                      [Ver Completo >] │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  ┌───────────────────────────────────────────────────────────────────┐│
│  │ Lilia Mercedes    ████████████████████░░░ 22/25h         Verde -3h││
│  │ Carlos Astorga    ████████████████████████ 17.5/15h  Amarillo +2.5││
│  │ Kianay Anandra    █████████████░░░░░░░░░░░ 18/30h        Rojo -12h││
│  └───────────────────────────────────────────────────────────────────┘│
│                                                                        │
│  Alertas: 2 trabajadores con horas extra | 1 con déficit significativo│
└────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Notificaciones en Dashboard

Mostrar toast automáticas cuando:
- Una limpiadora supera el 100% de sus horas contractuales
- Una limpiadora está por debajo del 80% a mitad de semana
- Hay ajustes manuales pendientes de revisión

---

## Parte 4: Dashboard Completo de Horas

### 4.1 Página Dedicada `/workload`

Vista completa con más detalles:

```text
┌────────────────────────────────────────────────────────────────────────────┐
│  CONTROL DE HORAS - Semana 27 Ene - 2 Feb 2026                            │
│  [Semana anterior] [Siguiente]  [Vista: Semanal v]  [+ Añadir Ajuste]     │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐ │
│  │ LILIA MERCEDES                              Contrato: 25h/semana     │ │
│  │ ████████████████████░░░░ 22h                          Verde -3h     │ │
│  │                                                                      │ │
│  │ Desglose:                                                            │ │
│  │   Turísticas:    14.0 h  (12 tareas)                                │ │
│  │   Mantenimiento:  8.0 h  (fijo semanal)                             │ │
│  │   Ajustes:       +0.0 h                                              │ │
│  │   ─────────────────────                                              │ │
│  │   TOTAL:         22.0 h                                              │ │
│  │                                                                      │ │
│  │   [Ver Detalle]  [+ Ajustar Horas]                                   │ │
│  └──────────────────────────────────────────────────────────────────────┘ │
│                                                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐ │
│  │ CARLOS ASTORGA                              Contrato: 15h/semana     │ │
│  │ ████████████████████████████ 17.5h                Amarillo +2.5h    │ │
│  │                                                                      │ │
│  │ Desglose:                                                            │ │
│  │   Turísticas:    17.5 h  (14 tareas)                                │ │
│  │   Mantenimiento:  0.0 h                                              │ │
│  │   Ajustes:       +0.0 h                                              │ │
│  │   ─────────────────────                                              │ │
│  │   TOTAL:         17.5 h                                              │ │
│  └──────────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## Seccion Tecnica

### Nueva Tabla en Base de Datos

```sql
CREATE TABLE worker_hour_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cleaner_id UUID NOT NULL REFERENCES cleaners(id),
  date DATE NOT NULL,
  hours NUMERIC(5,2) NOT NULL,  -- Positivo o negativo
  category TEXT NOT NULL DEFAULT 'other',  -- extra, training, absence, correction, other
  reason TEXT NOT NULL,
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### Archivos a Crear

| Archivo | Proposito |
|---------|-----------|
| `src/pages/WorkloadDashboard.tsx` | Pagina principal del dashboard de control de horas |
| `src/components/workload/WorkloadWidget.tsx` | Widget compacto para el dashboard principal |
| `src/components/workload/WorkloadOverviewCard.tsx` | Card de resumen por trabajador |
| `src/components/workload/WorkloadDetailPanel.tsx` | Panel detallado con desglose |
| `src/components/workload/HourAdjustmentModal.tsx` | Modal para añadir ajustes manuales |
| `src/components/workload/HourAdjustmentsList.tsx` | Lista de ajustes de un trabajador |
| `src/components/workload/WorkloadAlerts.tsx` | Componente de alertas |
| `src/hooks/useWorkloadCalculation.ts` | Hook principal de calculo |
| `src/hooks/useWorkerHourAdjustments.ts` | Hook para ajustes manuales (CRUD) |
| `src/hooks/useMaintenanceHoursCalculation.ts` | Hook para horas de mantenimiento |

### Archivos a Modificar

| Archivo | Cambios |
|---------|---------|
| `src/App.tsx` | Añadir ruta `/workload` |
| `src/components/dashboard/ManagerDashboard.tsx` | Integrar WorkloadWidget |
| `src/components/workers/WorkerDetailModal.tsx` | Añadir pestana de ajustes |
| `src/hooks/useWorkerAlerts.ts` | Usar calculos reales |
| `supabase/config.toml` | (si se necesita edge function) |

### Logica de Calculo Principal

```typescript
interface WorkloadSummary {
  cleanerId: string;
  cleanerName: string;
  contractHoursPerWeek: number;
  
  // Horas turisticas (de tasks asignadas, no canceladas)
  touristHours: number;
  touristTaskCount: number;
  
  // Horas mantenimiento (fijas semanales)
  maintenanceHours: number;
  
  // Ajustes manuales
  adjustmentHours: number;  // Puede ser positivo o negativo
  adjustments: HourAdjustment[];
  
  // Totales
  totalWorked: number;  // tourist + maintenance + adjustments
  remainingHours: number;
  overtimeHours: number;
  
  // Estado
  status: 'on-track' | 'overtime' | 'deficit' | 'critical-deficit';
  percentageComplete: number;
}
```

### Calculo de Horas Turisticas (Actualizado)

```typescript
async function calculateTouristHours(
  cleanerId: string,
  startDate: string,
  endDate: string
): Promise<{ hours: number; taskCount: number }> {
  const { data: tasks } = await supabase
    .from('tasks')
    .select('start_time, end_time, duracion, status')
    .eq('cleaner_id', cleanerId)
    .gte('date', startDate)
    .lte('date', endDate)
    .neq('status', 'cancelled');  // Excluir solo canceladas

  let totalMinutes = 0;
  for (const task of tasks || []) {
    if (task.duracion) {
      totalMinutes += task.duracion;
    } else if (task.start_time && task.end_time) {
      totalMinutes += diffInMinutes(task.end_time, task.start_time);
    }
  }

  return {
    hours: totalMinutes / 60,
    taskCount: tasks?.length || 0
  };
}
```

### Integracion con Dashboard

El widget se añadira despues de `DashboardMetricsCards`:

```tsx
// En ManagerDashboard.tsx
<DashboardMetricsCards ... />

{/* Nuevo widget de control de horas */}
<Suspense fallback={<ComponentLoader />}>
  <WorkloadWidget />
</Suspense>

<LinenControlWidget ... />
```

---

## Resumen de Funcionalidades

| Funcionalidad | Descripcion |
|---------------|-------------|
| Cuenta todas las tareas | No solo completadas, cualquiera asignada (excepto canceladas) |
| Ajustes manuales | Añadir o restar horas sin crear tareas |
| Widget en dashboard | Resumen compacto con barras de progreso |
| Dashboard completo | Pagina dedicada con todos los detalles |
| Desglose por fuente | Ver turisticas, mantenimiento y ajustes por separado |
| Semaforo visual | Verde/Amarillo/Rojo segun estado |
| Notificaciones | Alertas cuando hay desviaciones importantes |
| Vista semanal/mensual | Toggle entre periodos |
