
import { NavigationCard } from '@/components/dashboard/NavigationCard';
import { useRolePermissions } from '@/hooks/useRolePermissions';
import { OperationalModeSwitcher } from '@/components/auth/OperationalModeSwitcher';
import { 
  Calendar, 
  ClipboardList, 
  Users, 
  MapPin, 
  Settings,
  UserPlus,
  Layers,
  FileText,
  Shirt,
  RefreshCw,
  Link2,
  AlertTriangle,
  ClipboardCheck,
  Hotel,
  Building2,
  Calculator,
} from 'lucide-react';

export const RoleBasedNavigation = () => {
  const { canAccessModule, hasPermission, isAdminOrManager } = useRolePermissions();

  return (
    <div className="min-h-screen bg-paper py-12">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-semibold tracking-tight text-ink mb-3">
            Panel de Control
          </h1>
          <p className="text-base text-ink-3">
            Selecciona la sección a la que deseas acceder
          </p>
          <div className="mt-4 flex justify-center">
            <OperationalModeSwitcher />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {canAccessModule('calendar') && (
            <NavigationCard
              to="/calendar"
              title="Calendario"
              description="Visualiza y gestiona las tareas programadas en el calendario"
              icon={Calendar}
            />
          )}

          {hasPermission('tasks', 'canEdit') && (
            <NavigationCard
              to="/planning"
              title="Planificación"
              description="Planifica las limpiezas del día por sede, edificio y disponibilidad real, y revisa el reparto propuesto"
              icon={Layers}
            />
          )}

          {hasPermission('tasks', 'canEdit') && (
            <NavigationCard
              to="/planning/buildings"
              title="Edificios"
              description="Consulta carga futura, equipo, propiedades y decisiones por edificio"
              icon={Building2}
            />
          )}

          {canAccessModule('propertyGroups') && (
            <NavigationCard
              to="/planning-settings"
              title="Configuración de planificación"
              description="Configura edificios y reglas. No es necesario entrar aquí para repartir el día."
              icon={ClipboardList}
            />
          )}

          {isAdminOrManager() && (
            <NavigationCard
              to="/checklist-templates"
              title="Plantillas de Checklist"
              description="Gestiona las plantillas de checklist para diferentes propiedades"
              icon={FileText}
            />
          )}

          {canAccessModule('workers') && (
            <NavigationCard
              to="/workers"
              title="Trabajadores"
              description="Gestiona el equipo de limpieza y su disponibilidad"
              icon={Users}
            />
          )}

          {canAccessModule('clients') && (
            <NavigationCard
              to="/clients"
              title="Clientes"
              description="Administra la información de tus clientes"
              icon={Users}
            />
          )}

          {canAccessModule('properties') && (
            <NavigationCard
              to="/properties"
              title="Propiedades"
              description="Gestiona las propiedades y sus características"
              icon={MapPin}
            />
          )}

          {canAccessModule('admin') && (
            <NavigationCard
              to="/presupuestador"
              title="Presupuestador"
              description="Simula costes, precio y rentabilidad de apartamentos turísticos"
              icon={Calculator}
            />
          )}

          {isAdminOrManager() && (
            <NavigationCard
              to="/recurring-tasks"
              title="Tareas Recurrentes"
              description="Configura servicios que se repiten automáticamente"
              icon={RefreshCw}
            />
          )}

          {canAccessModule('supervision') && (
            <NavigationCard
              to="/supervision"
              title="Supervisión y calidad"
              description="Rutas, checklist, comprobaciones, fotos e incidencias por sede"
              icon={ClipboardCheck}
            />
          )}

          {canAccessModule('reports') && (
            <NavigationCard
              to="/cleaning-reports?tab=incidents"
              title="Incidencias"
              description="Revisa y gestiona incidencias pendientes de aprobar"
              icon={AlertTriangle}
            />
          )}


          {canAccessModule('reports') && (
            <NavigationCard
              to="/lavanderia/gestion"
              title="Lavandería"
              description="Gestiona enlaces compartibles para repartidores de lavandería"
              icon={Shirt}
            />
          )}

          {/* Nueva sección para gestión de usuarios - solo para admin/manager */}
          {isAdminOrManager() && (
            <NavigationCard
              to="/user-management"
              title="Gestión de Usuarios"
              description="Invita nuevos usuarios y gestiona el acceso al sistema"
              icon={UserPlus}
            />
          )}

          {isAdminOrManager() && (
            <NavigationCard
              to="/integraciones"
              title="Integraciones · REGISTRO"
              description="Sincroniza empleados desde REGISTRO sin perder tareas asignadas"
              icon={Link2}
            />
          )}

          {isAdminOrManager() && (
            <NavigationCard
              to="/little-hotelier"
              title="Little Hotelier"
              description="Reservas y mapeo de habitaciones para el hotel After Surf"
              icon={Hotel}
            />
          )}

          {isAdminOrManager() && (
            <NavigationCard
              to="/integraciones/avirato"
              title="Avirato Hotel"
              description="Reservas hoteleras, limpiezas diarias y checkout automatico"
              icon={Hotel}
            />
          )}
        </div>
      </div>
    </div>
  );
};
