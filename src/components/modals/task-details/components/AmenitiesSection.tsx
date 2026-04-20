import React from 'react';
import { Shirt } from 'lucide-react';

interface AmenitiesSectionProps {
  propertyData: any;
}

interface RowProps {
  label: string;
  value: number;
  dotColor: string;
}

const Row = ({ label, value, dotColor }: RowProps) => (
  <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-md bg-muted/30 hover:bg-muted/50 transition-colors">
    <div className="flex items-center gap-2 min-w-0">
      <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${dotColor}`} />
      <span className="text-sm text-foreground truncate">{label}</span>
    </div>
    <span className="text-sm font-semibold text-foreground tabular-nums">{value}</span>
  </div>
);

export const AmenitiesSection = ({ propertyData }: AmenitiesSectionProps) => {
  if (!propertyData) return null;

  const items: RowProps[] = [
    { label: 'Sábanas grandes', value: propertyData.numero_sabanas || 0, dotColor: 'bg-orange-400' },
    { label: 'Sábanas pequeñas', value: propertyData.numero_sabanas_pequenas || 0, dotColor: 'bg-red-400' },
    { label: 'Sábanas suite', value: propertyData.numero_sabanas_suite || 0, dotColor: 'bg-indigo-400' },
    { label: 'Toallas grandes', value: propertyData.numero_toallas_grandes || 0, dotColor: 'bg-cyan-400' },
    { label: 'Toallas pequeñas', value: propertyData.numero_toallas_pequenas || 0, dotColor: 'bg-teal-400' },
    { label: 'Alfombrines', value: propertyData.numero_alfombrines || 0, dotColor: 'bg-rose-400' },
    { label: 'Fundas almohada', value: propertyData.numero_fundas_almohada || 0, dotColor: 'bg-violet-400' },
    { label: 'Kit alimentario', value: propertyData.kit_alimentario || 0, dotColor: 'bg-emerald-400' },
    { label: 'Papel higiénico', value: propertyData.cantidad_rollos_papel_higienico || 0, dotColor: 'bg-yellow-400' },
    { label: 'Papel cocina', value: propertyData.cantidad_rollos_papel_cocina || 0, dotColor: 'bg-amber-400' },
  ];

  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        <Shirt className="h-4 w-4 text-orange-500" />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Amenities y textiles
        </h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        {items.map(item => (
          <Row key={item.label} {...item} />
        ))}
      </div>
    </section>
  );
};
