

# Buscador Global en el Sidebar

## Objetivo
Implementar un buscador global accesible desde el sidebar (desktop) y el header mobile que permita buscar simultaneamente en **tareas, propiedades, trabajadores y clientes**, mostrando resultados agrupados por categoria con navegacion directa.

## Como funcionara

El buscador aparecera en la parte superior del sidebar como un campo de busqueda. Al hacer clic o escribir, se abrira un dialogo de busqueda (estilo Command Palette) que buscara en tiempo real en las 4 entidades principales.

### Resultados que mostrara

Para cada termino de busqueda, se consultaran estas fuentes:

- **Tareas**: Busca por nombre de propiedad, direccion, nombre del limpiador asignado, cliente, y estado. Muestra fecha, propiedad, limpiador asignado y estado.
- **Propiedades**: Busca por nombre (codigo), direccion. Muestra codigo y direccion.
- **Trabajadores**: Busca por nombre, email, telefono. Muestra nombre y estado (activo/inactivo).
- **Clientes**: Busca por nombre, email, telefono, CIF/NIF. Muestra nombre y tipo de servicio.

Al seleccionar un resultado:
- Tarea: Navega a `/tasks` (con la tarea pre-filtrada en el buscador de la pagina)
- Propiedad: Navega a `/properties`
- Trabajador: Navega a `/workers`
- Cliente: Navega a `/clients`

## Detalles tecnicos

### 1. Nuevo componente: `src/components/navigation/GlobalSearch.tsx`
- Utiliza los componentes `Command`, `CommandDialog`, `CommandInput`, `CommandList`, `CommandGroup`, `CommandItem` ya existentes en el proyecto (`cmdk`)
- Atajo de teclado: `Ctrl+K` / `Cmd+K` para abrir
- Busqueda con debounce de 300ms para no saturar consultas
- Limite de 5 resultados por categoria

### 2. Nuevo hook: `src/hooks/useGlobalSearch.ts`
- Recibe el termino de busqueda
- Consulta directamente a Supabase con `.ilike()` o `.or()` en las 4 tablas (tasks, properties, cleaners, clients)
- Aplica filtro por sede activa (igual que el resto de la app)
- Devuelve resultados agrupados por tipo
- Las consultas se ejecutan en paralelo con `Promise.all`

### 3. Integracion en `DashboardSidebar.tsx` (desktop)
- Agregar un boton de busqueda debajo del header del sidebar
- Al hacer clic, abre el `CommandDialog`
- Cuando el sidebar esta colapsado, muestra solo el icono de lupa

### 4. Integracion en `MobileDashboardHeader.tsx` (mobile)
- Agregar un icono de busqueda junto al boton de menu
- Al hacer clic, abre el mismo `CommandDialog`

### 5. Integracion en `MobileDashboardSidebar.tsx` (drawer mobile)
- Agregar campo de busqueda en la parte superior del drawer

### Consultas a la base de datos

Las busquedas se haran directamente contra Supabase para garantizar resultados completos:

```
-- Tareas: busca en property, address, cleaner
tasks: .or(`property.ilike.%term%,address.ilike.%term%,cleaner.ilike.%term%`)

-- Propiedades: busca en codigo, nombre, direccion  
properties: .or(`codigo.ilike.%term%,nombre.ilike.%term%,direccion.ilike.%term%`)

-- Trabajadores: busca en name, email, telefono
cleaners: .or(`name.ilike.%term%,email.ilike.%term%,telefono.ilike.%term%`)

-- Clientes: busca en nombre, email, telefono, cif_nif
clients: .or(`nombre.ilike.%term%,email.ilike.%term%,telefono.ilike.%term%,cif_nif.ilike.%term%`)
```

Todas las consultas respetan el filtro de sede activa y los permisos RLS existentes.

### Archivos a crear
- `src/hooks/useGlobalSearch.ts` - Hook con logica de busqueda
- `src/components/navigation/GlobalSearch.tsx` - Componente del dialogo de busqueda

### Archivos a modificar
- `src/components/dashboard/DashboardSidebar.tsx` - Agregar boton de busqueda
- `src/components/dashboard/MobileDashboardHeader.tsx` - Agregar icono de busqueda
- `src/components/dashboard/MobileDashboardSidebar.tsx` - Agregar busqueda en drawer

