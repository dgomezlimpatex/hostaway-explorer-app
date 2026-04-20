

## Rediseño: Enlaces de Lavandería

Página actual funciona pero se siente desconectada del resto del producto: tarjetas con gradientes, badges grandes, jerarquía visual confusa entre "Hoy/Mañana", "Generar enlace" y "Enlaces activos". Vamos a alinearla con la estética minimalista del calendario y modal de tareas (Notion-like, divisores sutiles, color-accents puntuales) y a mejorar la utilidad operativa.

---

### Parte 1 — Rediseño visual (alineado con calendario/modal de tareas)

**Header (tipo calendario)**
- Quitar `bg-gradient-to-b` de fondo. Fondo plano `bg-background`.
- Header sticky compacto: back arrow + título `text-xl font-semibold` + sede en gris pequeño + botón engranaje a la derecha.
- Divisor `h-px bg-border/60` debajo, igual que en el modal de tareas.

**Quick Day Cards (Hoy / Mañana)**
- Eliminar gradiente y borde de color. Usar el patrón "Section" del modal: fondo `bg-muted/30`, sin sombra, hover sutil.
- Icono de calendario más pequeño (`h-4 w-4`) en color acento (azul para Hoy, violeta para Mañana) en lugar del recuadro grande.
- Reorganizar info en una línea: `Hoy · lun 20 abr` + chip "3 servicios" + acción principal a la derecha.
- Si ya existe enlace: mostrar solo "Copiar" como acción primaria + abrir externo como icono. Sin botón outline duplicado.

**Botón "Generar Enlace de Reparto"**
- Reducir tamaño (de `size="lg"` a default). Pasarlo a `variant="outline"` con icono `+` para no competir con las acciones de Hoy/Mañana, que son el flujo principal del 90% del tiempo.

**Sección "Enlaces Activos"**
- Header tipo modal: icono pequeño coloreado + label uppercase tracking-wider (igual a `Stat` del task modal).
- `LinkCard`: eliminar borde primary en hover y sombra grande. Pasar a fila tipo lista con divisores internos:
  - Línea 1: fecha + chip expiración + chip "Cambios detectados" (warning compact).
  - Línea 2: badges de propiedades (mismo estilo).
  - Línea 3: barra de progreso fina (h-1) + stats inline (16 · 1 prep · 1 entreg · 6%).
  - Footer: URL truncada + icono copy + icono delete (sin botón sólido "Copiar", basta el icono pequeño consistente).
- Acciones (editar/abrir) siempre visibles en pequeño en lugar de aparecer al hover (en desktop hover funciona; en táctil el opacity-0 esconde funcionalidad).

**Enlaces expirados**
- Sin cambios estructurales, solo respetar nuevo estilo de divisores.

**Paleta de acentos por sección** (consistente con modal de tareas):
- Azul: Hoy / progreso preparación
- Violeta: Mañana
- Verde esmeralda: entregado / completado
- Ámbar: cambios detectados
- Rojo destructivo: solo en delete (icono pequeño)

---

### Parte 2 — Mejoras funcionales

**a) Indicador de "salud" del enlace en cabecera**
Pequeño dot de estado al lado de cada `LinkCard`: verde si 100% entregado, azul si en preparación, gris si sin actividad, ámbar si hay cambios pendientes. Permite ver el estado de un vistazo sin leer la barra.

**b) Acción rápida "Recrear con cambios"**
Cuando aparece "Cambios detectados", añadir botón inline "Aplicar cambios" que actualiza `snapshot_task_ids` con las tareas actuales sin tener que abrir el modal de edición. Reduce 3 clics a 1.

**c) Filtro/búsqueda en enlaces activos**
Si hay >5 enlaces, input de búsqueda por fecha/propiedad. Útil cuando se acumulan enlaces de varias semanas.

**d) Estado vacío más útil**
Cuando no hay enlaces activos pero sí hay servicios pendientes para hoy/mañana, mostrar CTA directo a crear el de hoy en vez del mensaje genérico actual.

**e) Toast con acción "Abrir"**
Al copiar un enlace, el toast incluye botón "Abrir" para validar que se generó bien, ahorrando un viaje extra.

**f) Persistencia visual del último enlace creado**
El enlace recién generado se destaca durante 5s con un ring sutil para que el usuario vea claramente cuál acaba de crear (especialmente útil cuando ya hay varios).

**g) Mover el botón engranaje a un menú "..."**
Engranaje aislado se ve desconectado. Pasarlo a dropdown con: Configurar horarios · Ver expirados · Limpiar todos los expirados.

---

### Archivos a modificar

- `src/pages/LaundryShareManagement.tsx` — header, sección activos, footer cards, dropdown ajustes, búsqueda, estado vacío contextual.
- `src/components/laundry-share/QuickDayLinksWidget.tsx` — `QuickDayCard` rediseñado, layout horizontal compacto.
- `src/hooks/useLaundryShareLinks.ts` — añadir mutation `applyTaskChanges(linkId)` para acción "Aplicar cambios" sin abrir modal.

Sin cambios en backend, esquema DB, ni en la vista pública (`/lavanderia/:token`).

---

### Resultado esperado

- Misma estética que calendario y modal de tareas: limpia, jerárquica, sin gradientes innecesarios.
- El flujo más usado (crear/copiar enlace de hoy o mañana) queda visible y a 1 clic.
- "Cambios detectados" deja de ser un aviso pasivo y se convierte en acción directa.
- Vista compacta: en una pantalla caben más enlaces activos sin scroll.

