
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
      to: '/calendar',
      gradientFrom: 'from-blue-500',
      gradientTo: 'to-blue-600',
      iconColor: 'text-white',
      hoverBorderColor: 'hover:border-blue-200'
    },
    {
      title: 'Tareas',
      description: 'Lista completa de tareas y gestión avanzada',
      icon: CheckSquare,
      to: '/tasks',
      gradientFrom: 'from-green-500',
      gradientTo: 'to-green-600',
      iconColor: 'text-white',
      hoverBorderColor: 'hover:border-green-200'
    },
    {
      title: 'Clientes',
      description: 'Gestión de clientes y su información',
      icon: Users,
      to: '/clients',
      gradientFrom: 'from-purple-500',
      gradientTo: 'to-purple-600',
      iconColor: 'text-white',
      hoverBorderColor: 'hover:border-purple-200'
    },
    {
      title: 'Propiedades',
      description: 'Administra propiedades y sus características',
      icon: Building2,
      to: '/properties',
      gradientFrom: 'from-orange-500',
      gradientTo: 'to-orange-600',
      iconColor: 'text-white',
      hoverBorderColor: 'hover:border-orange-200'
    },
    {
      title: 'Personal',
      description: 'Gestión del equipo de limpieza',
      icon: UserCheck,
      to: '/workers',
      gradientFrom: 'from-teal-500',
      gradientTo: 'to-teal-600',
      iconColor: 'text-white',
      hoverBorderColor: 'hover:border-teal-200'
    },
    {
      title: 'Asignación Automática',
      description: 'Sistema inteligente de asignación de tareas',
      icon: Settings,
      to: '/property-groups',
      gradientFrom: 'from-indigo-500',
      gradientTo: 'to-indigo-600',
      iconColor: 'text-white',
      hoverBorderColor: 'hover:border-indigo-200'
    },
    {
      title: 'Reportes',
      description: 'Análisis y reportes del negocio',
      icon: BarChart3,
      to: '/reports',
      gradientFrom: 'from-pink-500',
      gradientTo: 'to-pink-600',
      iconColor: 'text-white',
      hoverBorderColor: 'hover:border-pink-200'
    },
    {
      title: 'Integración Hostaway',
      description: 'Sincronización y logs de Hostaway',
      icon: FileText,
      to: '/hostaway-sync-logs',
      gradientFrom: 'from-gray-500',
      gradientTo: 'to-gray-600',
      iconColor: 'text-white',
      hoverBorderColor: 'hover:border-gray-200'
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
            <NavigationCard key={item.to} {...item} />
          ))}
        </div>
      </div>
    </div>
  );
};
