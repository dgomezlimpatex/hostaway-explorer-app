
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface CostPaymentSectionProps {
  formData: {
    coste: number;
    metodoPago: string;
    supervisor: string;
  };
}

export const CostPaymentSection = ({ formData }: CostPaymentSectionProps) => {
  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="coste">Coste (€)</Label>
          <Input
            id="coste"
            type="number"
            step="0.01"
            value={formData.coste}
            readOnly
            className="bg-gray-50"
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="metodoPago">Método de Pago</Label>
          <Input
            id="metodoPago"
            value={formData.metodoPago}
            readOnly
            className="bg-gray-50"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="supervisor">Supervisor</Label>
        <Input
          id="supervisor"
          value={formData.supervisor}
          readOnly
          className="bg-gray-50"
        />
      </div>
    </>
  );
};
