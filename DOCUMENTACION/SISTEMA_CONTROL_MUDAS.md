# Sistema de Control de Mudas (Linen Control)

## Resumen del Sistema

Sistema implementado para trackear la disponibilidad de ropa limpia (mudas) en más de 100 apartamentos turísticos. Permite supervisar en tiempo real el estado de las entregas de ropa de cama y toallas.

---

## Flujo Operativo: Triple Muda

El sistema opera con un flujo de **triple muda** (tres juegos de ropa):

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   APARTAMENTO   │    │   ALMACÉN       │    │   LAVANDERÍA    │
│                 │    │   EDIFICIO      │    │   EXTERNA       │
│  1 juego en uso │ ←→ │  1 juego limpio │ ←→ │  1 juego sucio  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Ciclo Diario:

1. **Mañana:** Limpiadora usa juego limpio del almacén del edificio, deja juego sucio
2. **Tarde:** Repartidor recoge sucio, deja limpio del almacén central
3. **Lavandería externa:** Turnaround de 24h (entregar sucio → recibir limpio al día siguiente)

---

## Interfaz de Usuario

### Vista Principal (Tabla tipo Excel)

| Columna | Descripción |
|---------|-------------|
| Código Apartamento | Identificador de la propiedad |
| Edificio | Agrupación por almacén compartido |
| Cliente | Nombre del cliente propietario |
| Estado | Indicador visual de disponibilidad |
| Última Entrega | Fecha, hora y persona que entregó |
| Próxima Limpieza | Fecha, hora y limpiador asignado |

### Sistema de Estados (Colores)

| Color | Estado | Significado |
|-------|--------|-------------|
| 🟢 Verde | Disponible | Ropa limpia disponible en almacén |
| 🔴 Rojo | Pendiente | Hora de limpieza llegó, ropa no entregada |
| 🟤 Rojo Oscuro | Atrasado | Entrega significativamente retrasada |

---

## Lógica de Filtrado Jerárquico

### Configuración "Gestión de Lavandería"

El sistema usa una configuración jerárquica para determinar qué propiedades participan:

```
CLIENTE (linen_control_enabled)
    │
    └── PROPIEDAD (linen_control_enabled)
            │
            ├── true  → Activado (override explícito)
            ├── false → Desactivado (override explícito)
            └── null  → Hereda del cliente
```

### Reglas de Herencia:

1. **Propiedad con valor explícito (true/false):** Usa el valor de la propiedad
2. **Propiedad con null:** Hereda el valor del cliente
3. **Cliente desactivado + Propiedad null:** Propiedad NO aparece en el sistema

### Código de Filtrado:

```typescript
const effectiveLinenEnabled = 
  property.linen_control_enabled !== null 
    ? property.linen_control_enabled 
    : client.linen_control_enabled ?? false;
```

---

## Integración con Otros Sistemas

### Links de Distribución de Lavandería

**Constraint crítico:** Las propiedades con linen control desactivado NO deben aparecer en los enlaces de distribución para repartidores.

El filtro se aplica en:
- `LaundryShareLinkModal.tsx` - Creación de enlaces
- `LaundryShareEditModal.tsx` - Edición de enlaces
- Consultas de tareas para distribución

### Widget de Dashboard

El sistema incluye un widget en el dashboard del manager que muestra:
- Alertas de propiedades con ropa pendiente
- Resumen de estados por edificio
- Acceso rápido a la vista completa

---

## Estructura de Base de Datos

### Campos Relevantes

**Tabla `clients`:**
```sql
linen_control_enabled BOOLEAN DEFAULT false
```

**Tabla `properties`:**
```sql
linen_control_enabled BOOLEAN DEFAULT NULL  -- null = hereda del cliente
```

---

## Tipos de Ropa Gestionada

El sistema trackea los siguientes tipos de ropa (según configuración del hotel):

| Tipo | Campo en BD | Descripción |
|------|-------------|-------------|
| Sábanas | `numero_sabanas` | Sábanas estándar/matrimonio |
| Sábanas pequeñas | `numero_sabanas_pequenas` | Sábanas individuales |
| Sábanas suite | `numero_sabanas_suite` | Sábanas para suites |
| Toallas grandes | `numero_toallas_grandes` | Toallas de baño |
| Toallas pequeñas | `numero_toallas_pequenas` | Toallas de mano |
| Alfombrines | `numero_alfombrines` | Alfombras de baño |
| Fundas almohada | `numero_fundas_almohada` | Fundas de almohada |

**Nota:** No existe categoría "sábanas dobles" - el sistema usa las tres categorías específicas mencionadas.

---

## Notas de Implementación

1. **Ejecución Paralela:** Este sistema corre en paralelo con las funcionalidades existentes de lavandería sin modificarlas.

2. **Agrupación por Edificio:** Los edificios comparten almacén de ropa, por lo que se agrupan visualmente.

3. **Permisos:** Solo usuarios con roles admin, manager o supervisor pueden acceder al Control de Mudas.

4. **Tiempo Real:** La tabla se actualiza automáticamente cuando los repartidores marcan entregas.

---

*Documento creado: Diciembre 2024*
*Sistema: Control de Mudas v1.0*
