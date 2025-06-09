
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
      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
          <div className="flex items-center gap-4">
            <Link to="/">
              <Button variant="outline" size="sm" className="flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                Volver al menú
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Gestión de Propiedades
              </h1>
              <p className="text-gray-600 mt-1">
                Administra todas las propiedades y sus características
              </p>
            </div>
          </div>
          <CreatePropertyModal />
        </div>

        {/* Property List */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Lista de Propiedades
            </h2>
            <p className="text-gray-600 text-sm">
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
