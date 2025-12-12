import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useLinenControl } from '@/hooks/useLinenControl';
import { StatCard } from '@/components/ui/stat-card';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

export const LinenControlWidget = () => {
  const navigate = useNavigate();
  const { stats, alertProperties, isLoading } = useLinenControl();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <LoadingSpinner size="sm" />
      </div>
    );
  }

  const pendingCount = stats.needsLinen + stats.overdue;
  const hasAlerts = pendingCount > 0;

  return (
    <StatCard
      title="Control de Mudas"
      value={hasAlerts ? pendingCount : stats.clean}
      description={
        hasAlerts 
          ? `${stats.overdue > 0 ? `${stats.overdue} atrasado${stats.overdue > 1 ? 's' : ''}, ` : ''}${stats.needsLinen} necesitan entrega`
          : `${stats.clean} apartamentos con muda limpia`
      }
      icon={hasAlerts ? AlertCircle : CheckCircle2}
      accent={hasAlerts ? 'warning' : 'success'}
      cta={{
        label: hasAlerts ? 'Ver pendientes' : 'Ver control',
        onClick: () => navigate('/control-mudas'),
      }}
    >
      {/* Quick list of top alerts */}
      {hasAlerts && alertProperties.length > 0 && (
        <div className="mt-3 space-y-1">
          {alertProperties.slice(0, 3).map(property => (
            <div
              key={property.propertyId}
              className="flex items-center justify-between text-xs"
            >
              <span className="font-mono font-medium">{property.propertyCode}</span>
              <span className={property.status === 'overdue' ? 'text-red-600' : 'text-amber-600'}>
                {property.status === 'overdue' ? 'Atrasado' : 'Pendiente'}
              </span>
            </div>
          ))}
          {alertProperties.length > 3 && (
            <div className="text-xs text-muted-foreground text-center pt-1">
              +{alertProperties.length - 3} más
            </div>
          )}
        </div>
      )}
    </StatCard>
  );
};
