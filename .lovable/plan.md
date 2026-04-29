## Problema

En el portal de clientes (pestaña "Añadir"), al alcanzar 11 reservas en el formulario, el sistema deja de permitir añadir nuevas filas.

## Diagnóstico

Tras revisar `src/components/client-portal/QuickAddReservations.tsx` y `useCreateReservations` en `src/hooks/useClientPortal.ts`, **no existe un límite numérico hardcodeado** (ni 11, ni similar). El bug está en la lógica que controla la visibilidad del botón "Añadir otra reserva":

```ts
// Línea ~352 de QuickAddReservations.tsx
{rows.every(row => isRowComplete(row)) && (
  <Button ...>Añadir otra reserva</Button>
)}
```

El botón solo aparece cuando **todas** las filas están completas. A partir de cierto número de filas (probablemente cuando el contenedor scrollea fuera de vista o cuando una fila intermedia queda con un `Popover` abierto / un campo vacío sin advertir), el botón se oculta y el usuario percibe el límite. Además, el botón de envío `Guardar N reservas` aparece solo si `validRows.length > 0`, pero el botón de "añadir otra" se vuelve dependiente de la perfección de todas — frágil cuando hay muchas filas.

El número "11" probablemente coincide con el viewport del usuario: a partir de ahí el botón queda oculto fuera del scroll, o un `Popover` / `Select` queda sin cerrar y `isRowComplete` devuelve `false` para esa fila.

## Solución

Hacer la creación realmente ilimitada y desacoplar el botón "Añadir otra reserva" del estado de completitud:

### 1. `src/components/client-portal/QuickAddReservations.tsx`

- **Mostrar "Añadir otra reserva" siempre** (no solo cuando todas están completas). Si hay filas incompletas, el botón sigue visible; al pulsarlo añade una nueva fila vacía al final.
- **Mostrar el botón "Guardar N reservas" siempre** que `validRows.length > 0`, y mantener el contador correcto (filas válidas vs totales).
- Añadir un pequeño indicador "X de Y completas" para que el usuario sepa cuáles le faltan, en lugar de ocultar acciones.
- Asegurar que el contenedor de filas no impone `max-height` ni overflow oculto que esconda filas adicionales.

### 2. Verificar el envío masivo

`useCreateReservations` itera secuencialmente con `for...of` sobre `reservations` sin límite. Confirmado: no hay tope, pero para muchas reservas (50+) puede ser lento. Añadir:

- Indicador de progreso en el botón: "Guardando 5 de 30…".
- Mantener el `try/catch` global; si una falla, informar cuáles se crearon y cuáles no.

### 3. QA

- Probar añadiendo 20-30 reservas seguidas en el portal y verificar que el botón "Añadir otra" sigue accesible.
- Verificar en móvil (viewport pequeño) que el botón no queda oculto por la barra inferior.

## Archivos a modificar

- `src/components/client-portal/QuickAddReservations.tsx` (cambio principal de UI)
- `src/hooks/useClientPortal.ts` (opcional: feedback de progreso en `useCreateReservations`)

No se requieren cambios de base de datos ni de edge functions.
