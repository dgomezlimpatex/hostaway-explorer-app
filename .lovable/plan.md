# Módulo de incidencias en limpiezas

**Quién manda:** la limpiadora **reporta** durante la limpieza, Limpatex **aprueba o descarta** (filtro de calidad), y el cliente **gestiona** el ciclo de vida una vez aprobada. Limpatex también puede **crear** incidencias en tareas asignadas a sus limpiadoras.

**Activación por cliente:** el módulo de incidencias es **opcional por cliente**. Se activa/desactiva desde el panel de Portales de Clientes (admin Limpatex), igual que ya se hace con "Reservas" y "Solicitudes extraordinarias".

---

## 0. Activación del módulo por cliente

- Nuevo toggle **"Permitir incidencias"** en la ficha de cada cliente dentro de **Portales de Clientes** (admin Limpatex).
- Por defecto: **desactivado**.
- Cuando está **desactivado** para un cliente:
  - Las limpiadoras **no ven** el botón "Reportar incidencia" en tareas de ese cliente.
  - Admin/Manager Limpatex **no pueden crear** incidencias en tareas de ese cliente.
  - El cliente **no ve** la pestaña "Incidencias" en su portal.
  - Las incidencias antiguas migradas siguen existiendo internamente, pero no son visibles en el portal hasta que se active el toggle.
- Cuando está **activado**: aplica todo el flujo descrito en las secciones siguientes.

---

## 1. Flujo de la limpiadora (quien reporta)

### ¿Cuándo puede reportar?
- **Únicamente durante la ejecución de una tarea** (estado *en progreso*).
- Una vez finalizada la tarea, **no se puede reportar nada más**.
- Solo si el cliente de esa tarea tiene el módulo activado.

### ¿Cómo lo hace?
Botón **"Reportar incidencia"** visible en la pantalla de checklist móvil.

Formulario **paso a paso, basado en desplegables**, mobile-first:

| Paso | Campo | Obligatorio | Notas |
|---|---|---|---|
| 1 | **Categoría** (desplegable) | Sí | Opciones **personalizadas** gestionables por admin Limpatex. Catálogo inicial: Roturas, Material faltante, Avería, Otros |
| 2 | **Ubicación** dentro de la propiedad | No | Texto libre corto (ej. "Salón", "Baño principal") |
| 3 | **Descripción** | Sí | Texto libre |
| 4 | **Fotos / vídeo** | Sí (**mínimo 2**) | Reutiliza el sistema de subida existente |

> Toda incidencia reportada nace **Oculta para el cliente** y queda pendiente de aprobación de Limpatex.

### Registro
- Asociada a **tarea + propiedad + limpiadora + cliente**.
- Estado inicial: **Pendiente Limpatex** (no visible para el cliente).
- Aparece en la bandeja de Limpatex "Pendientes de aprobar".

### Notas
- Una tarea puede tener varias incidencias.
- La limpiadora puede editar/eliminar las suyas **mientras la tarea siga en progreso**.
- Una vez finalizada la tarea, pierde acceso a tocarla.

---

## 2. Flujo de Limpatex (filtro de calidad y creación)

### 2.1 Aprobar / Descartar
Toda incidencia reportada aparece en una **bandeja "Pendientes de aprobar"** en el panel de Limpatex.

- **Aprobar** → pasa a **Abierta**, visible para el cliente en su portal.
- **Descartar** → archivada con motivo. Nunca llega al cliente. Auditoría interna.
- **Editar antes de aprobar** → corregir categoría, descripción, ubicación, añadir fotos.

### 2.2 Crear incidencias propias
Admin/Manager Limpatex puede crear incidencias directamente sobre una tarea asignada a una limpiadora (mismo formulario), siempre que el cliente tenga el módulo activado. Estas incidencias pueden:
- Publicarse directamente al cliente (estado **Abierta**), o
- Quedarse internas (no visibles para el cliente, solo seguimiento Limpatex).

### Permisos
- Aprobar / Descartar / Crear: **Admin** y **Manager** Limpatex.
- Supervisor: solo ve, no aprueba ni crea.

---

## 3. Flujo del cliente (gestiona, una vez aprobada)

Solo si el cliente tiene el módulo activado. Solo ve incidencias aprobadas por Limpatex.

### Dónde lo ve
- Nueva pestaña **"Incidencias"** en el portal del cliente, junto a Reservas y Solicitudes extraordinarias.
- Badge con número de incidencias abiertas.

### Vista principal
- Agrupadas por propiedad (acordeones).
- Cada incidencia: fecha de la limpieza, categoría, estado actual, foto miniatura.

### Filtros
- Propiedad, estado, rango de fechas, categoría.
- Por defecto: abiertas + en gestión de los últimos 90 días.

### Detalle
- Descripción completa + galería de fotos/vídeo.
- Línea de tiempo de cambios de estado (quién, cuándo, nota).
- **Acciones del cliente:**
  - Cambiar estado: Abierta → En gestión → Resuelta / Descartada / Reabrir.
  - Nota al cambiar estado (**obligatoria al resolver o descartar**).
  - Adjuntar fotos/documentos propios (presupuestos, partes del seguro, etc.).
  - Asignar **responsable interno** (texto libre).
  - **Solicitar acción extraordinaria a Limpatex** (atajo que pre-rellena el formulario existente).

> **No hay comentarios libres.** Solo notas asociadas a cambios de estado + adjuntos.

### Quién puede gestionar
- **Cualquier usuario del portal** con acceso a esa propiedad.
- Cada acción queda registrada con nombre del usuario.

### Lo que el cliente NO ve
- Incidencias pendientes o descartadas por Limpatex.
- Incidencias marcadas como Internas.

---

## 4. Ciclo de vida

```text
                  [ Pendiente Limpatex ]
                          │
              ┌───────────┴───────────┐
              │ Limpatex aprueba      │ Limpatex descarta
              ▼                       ▼
        [ Abierta ]              [ Descartada Limpatex ]
              │                  (no llega al cliente)
   cliente    │
              ▼
       [ En gestión ]  ── cliente ──▶  [ Resuelta ]
              │                              │
              │                              └── cliente puede Reabrir → Abierta
              │
              └── cliente ──▶  [ Descartada ]
```

| Estado | Quién lo activa |
|---|---|
| Pendiente Limpatex | Automático al reportar |
| Descartada Limpatex | Admin/Manager Limpatex |
| Abierta | Admin/Manager Limpatex al aprobar o crear visible |
| En gestión | Cliente |
| Resuelta | Cliente (nota obligatoria) |
| Descartada | Cliente (motivo obligatorio) |
| Reabierta | Cliente → vuelve a Abierta |

### Reglas
- Tras aprobar, **solo el cliente** cambia estados. Limpatex no cierra/reabre.
- Cada cambio queda registrado: quién, cuándo, nota.
- Admin Limpatex puede **eliminar** (auditado): duplicados, abuso, error grave.
- Una incidencia puede quedarse en *Abierta* indefinidamente. **Sin recordatorios ni escalado por tiempo.**

---

## 5. Notificaciones

**Cero emails al cliente.** Todo en portal/panel.

- **Limpiadora reporta** → bandeja "Pendientes" + email/badge a admin/manager Limpatex.
- **Limpatex aprueba** → aparece en portal cliente (sin email).
- **Limpatex descarta** → solo panel interno.
- **Cliente cambia estado** → email/badge a admins Limpatex.

---

## 6. Visibilidad interna en Limpatex

Reutilizar la pestaña **"Incidencias"** existente en Reportes de Limpieza.

### Vistas
- **Pendientes de aprobar** (prioridad visual).
- **Bandeja activa**: aprobadas, ordenadas por antigüedad.
- Por propiedad / por limpiadora / por cliente.
- Históricas (resueltas, descartadas por cliente y por Limpatex).

### Acciones Limpatex
- Ver todo (incl. pendientes, descartadas, internas).
- Aprobar / Descartar pendientes.
- Crear incidencias propias en tareas de limpiadoras.
- Editar contenido antes de aprobar.
- Cambiar visibilidad Pública ↔ Interna.
- Adjuntar fotos/documentos.
- Vincular con Solicitud extraordinaria.
- Gestionar catálogo de categorías.
- Eliminar (admin, auditado).
- ❌ NO cambiar estado tras aprobar.

### Métricas en dashboard admin
- Pendientes de aprobar (urgente).
- Ratio aprobadas vs descartadas (último mes).
- Abiertas / en gestión / resueltas por cliente.
- Tiempo medio de resolución del cliente.
- Top 5 propiedades / categorías.
- Ratio incidencias / limpiezas.
- **Clientes con módulo activo vs total.**

### Permisos resumidos

| Acción | Limpiadora | Cliente | Manager Limpatex | Admin Limpatex |
|---|---|---|---|---|
| Activar/desactivar módulo por cliente | No | No | No | **Sí** |
| Reportar (tarea propia, en progreso, cliente activado) | Sí | No | No | No |
| Crear incidencia en tarea de limpiadora | — | No | Sí | Sí |
| Aprobar / Descartar pendientes | No | No | Sí | Sí |
| Editar antes de aprobar | Sí (suya, en progreso) | No | Sí | Sí |
| Cambiar estado tras aprobar | No | **Sí** | No | No |
| Cambiar visibilidad pública/interna | No | No | Sí | Sí |
| Gestionar catálogo de categorías | No | No | No | Sí |
| Eliminar | No | No | No | Sí (auditado) |

---

## 7. Catálogo de categorías personalizadas

- Tabla `incident_categories` gestionada desde admin Limpatex.
- Catálogo inicial: **Roturas, Material faltante, Avería, Otros**.
- Añadir, renombrar, activar/desactivar. Las desactivadas no aparecen en el desplegable de nuevas, pero sí en incidencias antiguas.

---

## 8. Migración de datos

- Migración definitiva de `issues_found` (JSON en `task_reports`) a `cleaning_incidents`.
- Tras la migración, `issues_found` deja de usarse.
- Se **descarta el campo gravedad**.
- Categorías antiguas que no encajen → **Otros**.
- Las incidencias migradas entran en estado **Abierta**.
- Solo serán visibles en el portal del cliente cuando este tenga el módulo activado.

---

## Fases de implementación

**Fase 1 — Modelo de datos y activación**
- Tablas: `cleaning_incidents`, `cleaning_incident_events`, `incident_categories`.
- Campo `allow_incidents` en `clients` (toggle por cliente).
- Migración definitiva de `issues_found`. Sin `severity`. Sin comentarios.

**Fase 2 — Activación en Portales de Clientes**
- Toggle "Permitir incidencias" en la ficha del cliente (admin Limpatex). Por defecto desactivado.

**Fase 3 — Cara limpiadora**
- Botón "Reportar incidencia" en checklist móvil (solo tarea en progreso + cliente activado).
- Formulario por pasos: categoría → ubicación → descripción → fotos (mín. 2).
- Toda incidencia nace **Pendiente Limpatex**.

**Fase 4 — Cara Limpatex (aprobación, creación, catálogo)**
- Bandeja "Pendientes de aprobar" con Aprobar / Descartar / Editar.
- Botón "Crear incidencia" desde ficha de tarea (admin/manager).
- Gestión del catálogo de categorías.

**Fase 5 — Cara cliente**
- Pestaña "Incidencias" en portal cliente (solo si activada).
- Listado, detalle, cambio de estado, adjuntos del cliente.
- Sin comentarios libres.

**Fase 6 — Notificaciones internas**
- Emails/badges a Limpatex: reporte nuevo (pendiente), cambio de estado del cliente. Sin emails al cliente.

**Fase 7 — Métricas**
- KPIs en dashboard admin.
