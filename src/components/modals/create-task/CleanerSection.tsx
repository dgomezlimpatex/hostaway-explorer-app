import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCleaners } from "@/hooks/useCleaners";

interface CleanerSectionProps {
  formData: {
    cleaner: string;
  };
  onFieldChange: (field: string, value: string) => void;
}

export const CleanerSection = ({ formData, onFieldChange }: CleanerSectionProps) => {
  const { cleaners, isLoading } = useCleaners();

  // Ordenar limpiadoras alfabéticamente por nombre
  const sortedCleaners = [...cleaners].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="space-y-2">
      <Label htmlFor="cleaner">Limpiadora (Opcional)</Label>
      <Select 
        value={formData.cleaner} 
        onValueChange={(value) => onFieldChange('cleaner', value)}
        disabled={isLoading}
      >
        <SelectTrigger>
          <SelectValue placeholder={isLoading ? "Cargando..." : "Seleccionar limpiadora"} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">Sin asignar</SelectItem>
          {sortedCleaners
            .filter(cleaner => cleaner.isActive)
            .map((cleaner) => (
              <SelectItem key={cleaner.id} value={cleaner.name}>
                {cleaner.name}
              </SelectItem>
            ))
          }
        </SelectContent>
      </Select>
    </div>
  );
};