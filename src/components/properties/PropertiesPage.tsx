
import { CreatePropertyModal } from './CreatePropertyModal';
import { PropertyList } from './PropertyList';
import { Button } from '@/components/ui/button';
import { useProperties } from '@/hooks/useProperties';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export const PropertiesPage = () => {
  const { data: properties } = useProperties();

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100">
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start gap-3 sm:gap-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <Link to="/">
              <Button variant="outline" size="icon" className="sm:hidden h-8 w-8">
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" className="hidden sm:flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                Volver al menú
              </Button>
            </Link>
            <div>
              <h1 className="text-xl sm:text-3xl font-bold text-gray-900">
                Propiedades
              </h1>
              <p className="text-gray-600 text-xs sm:text-base mt-0.5 sm:mt-1">
                Administra propiedades y características
              </p>
            </div>
          </div>
          <CreatePropertyModal />
        </div>

        {/* Property List */}
        <div className="bg-white rounded-lg shadow-sm p-3 sm:p-6">
          <div className="mb-4 sm:mb-6">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-1 sm:mb-2">
              Lista de Propiedades
            </h2>
            <p className="text-gray-600 text-xs sm:text-sm">
              {properties && properties.length > 0 
                ? `Mostrando ${properties.length} propiedad${properties.length !== 1 ? 'es' : ''}`
                : 'No hay propiedades registradas aún'
              }
            </p>
          </div>
          <PropertyList />
        </div>
      </div>
    </div>
  );
};
