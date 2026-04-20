import React from 'react';
import { User } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface ClientInfoSectionProps {
  clientData: any;
}

interface RowProps {
  label: string;
  value: string;
}

const Row = ({ label, value }: RowProps) => (
  <div className="flex items-center justify-between gap-3 py-1.5">
    <span className="text-xs text-muted-foreground">{label}</span>
    <span className="text-sm text-foreground capitalize">{value}</span>
  </div>
);

export const ClientInfoSection = ({ clientData }: ClientInfoSectionProps) => {
  const { userRole } = useAuth();
  if (!clientData) return null;

  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        <User className="h-4 w-4 text-blue-500" />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Cliente
        </h3>
      </div>

      <div className="rounded-md bg-muted/30 px-3 divide-y divide-border/50">
        <Row label="Tipo de servicio" value={clientData.tipo_servicio || '—'} />
        {userRole !== 'cleaner' && (
          <Row label="Método de pago" value={clientData.metodo_pago || '—'} />
        )}
        <Row label="Supervisor" value={clientData.supervisor || '—'} />
      </div>
    </section>
  );
};
