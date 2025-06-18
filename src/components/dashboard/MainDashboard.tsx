
import { NavigationCard } from './NavigationCard';
import { 
  Calendar, 
  CheckSquare, 
  Users, 
  Building2, 
  FileText,
  UserCheck,
  Settings,
  BarChart3
} from 'lucide-react';

export const MainDashboard = () => {
  const navigationItems = [
    {
      title: 'Calendario',
      description: 'Gestiona y visualiza todas las tareas de limpieza',
      icon: Calendar,
      href: '/calendar',
      color: 'bg-blue-500'
    },
    {
      title: 'Tareas',
      description: 'Lista completa de tareas y gestión avanzada',
      icon: CheckSquare,
      href: '/tasks',
      color: 'bg-green-500'
    },
    {
      title: 'Clientes',
      description: 'Gestión de clientes y su información',
      icon: Users,
      href: '/clients',
      color: 'bg-purple-500'
    },
    {
      title: 'Propiedades',
      description: 'Administra propiedades y sus características',
      icon: Building2,
      href: '/properties',
      color: 'bg-orange-500'
    },
    {
      title: 'Personal',
      description: 'Gestión del equipo de limpieza',
      icon: UserCheck,
      href: '/workers',
      color: 'bg-teal-500'
    },
    {
      title: 'Asignación Automática',
      description: 'Sistema inteligente de asignación de tareas',
      icon: Settings,
      href: '/property-groups',
      color: 'bg-indigo-500'
    },
    {
      title: 'Reportes',
      description: 'Análisis y reportes del negocio',
      icon: BarChart3,
      href: '/reports',
      color: 'bg-pink-500'
    },
    {
      title: 'Integración Hostaway',
      description: 'Sincronización y logs de Hostaway',
      icon: FileText,
      href: '/hostaway-sync-logs',
      color: 'bg-gray-500'
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Sistema de Gestión de Limpieza
          </h1>
          <p className="text-xl text-gray-600">
            Gestiona eficientemente tus operaciones de limpieza
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {navigationItems.map((item) => (
            <NavigationCard key={item.href} {...item} />
          ))}
        </div>
      </div>
    </div>
  );
};
