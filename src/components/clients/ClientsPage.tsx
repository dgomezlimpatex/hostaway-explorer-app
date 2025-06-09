
import { CreateClientModal } from './CreateClientModal';
import { ClientList } from './ClientList';
import { Button } from '@/components/ui/button';
import { useClients } from '@/hooks/useClients';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export const ClientsPage = () => {
  const { data: clients } = useClients();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
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
                Gestión de Clientes
              </h1>
              <p className="text-gray-600 mt-1">
                Administra todos tus clientes y su información
              </p>
            </div>
          </div>
          <CreateClientModal />
        </div>

        {/* Client List */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Lista de Clientes
            </h2>
            <p className="text-gray-600 text-sm">
              {clients && clients.length > 0 
                ? `Mostrando ${clients.length} cliente${clients.length !== 1 ? 's' : ''}`
                : 'No hay clientes registrados aún'
              }
            </p>
          </div>
          <ClientList />
        </div>
      </div>
    </div>
  );
};
