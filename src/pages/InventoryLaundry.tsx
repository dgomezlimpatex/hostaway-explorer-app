import InventoryStock from './InventoryStock';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useRolePermissions } from '@/hooks/useRolePermissions';

export default function InventoryLaundry() {
  const { isAdminOrManager } = useRolePermissions();
  return (
    <>{isAdminOrManager() && <div className="px-4 pt-4 sm:px-6"><Button asChild><Link to="/inventory/laundry/receipts">Recepciones de ropa limpia</Link></Button></div>}<InventoryStock
      kind="laundry"
      title="Lavandería"
      description="Stock de lenceria y textiles filtrado por almacenes."
    /></>
  );
}
