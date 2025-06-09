import { CreateClientModal } from './CreateClientModal';
import { ClientList } from './ClientList';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useClients } from '@/hooks/useClients';
import { Users, Building, Star, CreditCard } from 'lucide-react';
const StatsCard = ({
  title,
  value,
  icon: Icon,
  description
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  description: string;
}) => <Card>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      <Icon className="h-4 w-4 text-muted-foreground" />
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{value}</div>
      <p className="text-xs text-muted-foreground">{description}</p>
    </CardContent>
  </Card>;
export const ClientsPage = () => {
  const {
    data: clients
  } = useClients();
  const stats = {
    total: clients?.length || 0,
    airbnb: clients?.filter(c => c.tipoServicio === 'airbnb').length || 0,
    conFactura: clients?.filter(c => c.factura).length || 0,
    transferencia: clients?.filter(c => c.metodoPago === 'transferencia').length || 0
  };
  return <div className="container mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Gestión de Clientes
          </h1>
          <p className="text-gray-600 mt-1">
            Administra todos tus clientes y su información
          </p>
        </div>
        <CreateClientModal />
      </div>

      {/* Stats Cards */}
      

      {/* Client List */}
      <div>
        <ClientList />
      </div>
    </div>;
};