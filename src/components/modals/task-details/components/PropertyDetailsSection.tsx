import React from 'react';
import { Bed, Bath, Sofa, Clock, Wallet } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface PropertyDetailsSectionProps {
  propertyData: any;
}

interface StatProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  iconColor: string;
}

const Stat = ({ icon, label, value, iconColor }: StatProps) => (
  <div className="flex flex-col items-start gap-1 p-3 rounded-md bg-muted/30 hover:bg-muted/50 transition-colors">
    <div className={`${iconColor}`}>{icon}</div>
    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</span>
    <span className="text-base font-semibold text-foreground">{value}</span>
  </div>
);

export const PropertyDetailsSection = ({ propertyData }: PropertyDetailsSectionProps) => {
  const { userRole } = useAuth();
  if (!propertyData) return null;

  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        <Bed className="h-4 w-4 text-emerald-500" />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Características
        </h3>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
        <Stat
          icon={<Bed className="h-4 w-4" />}
          label="Camas grandes"
          value={propertyData.numero_camas || 0}
          iconColor="text-emerald-500"
        />
        <Stat
          icon={<Bed className="h-4 w-4" />}
          label="Camas peq."
          value={propertyData.numero_camas_pequenas || propertyData.numeroCamasPequenas || 0}
          iconColor="text-teal-500"
        />
        <Stat
          icon={<Bed className="h-4 w-4" />}
          label="Camas suite"
          value={propertyData.numero_camas_suite || propertyData.numeroCamasSuite || 0}
          iconColor="text-violet-500"
        />
        <Stat
          icon={<Sofa className="h-4 w-4" />}
          label="Sofás cama"
          value={propertyData.numero_sofas_cama || propertyData.numeroSofasCama || 0}
          iconColor="text-rose-400"
        />
        <Stat
          icon={<Bath className="h-4 w-4" />}
          label="Baños"
          value={propertyData.numero_banos || 0}
          iconColor="text-blue-500"
        />
        <Stat
          icon={<Clock className="h-4 w-4" />}
          label="Duración"
          value={`${propertyData.duracion_servicio} min`}
          iconColor="text-indigo-500"
        />
        {userRole !== 'cleaner' && (
          <Stat
            icon={<Wallet className="h-4 w-4" />}
            label="Coste"
            value={`${propertyData.coste_servicio} €`}
            iconColor="text-amber-500"
          />
        )}
      </div>
    </section>
  );
};
