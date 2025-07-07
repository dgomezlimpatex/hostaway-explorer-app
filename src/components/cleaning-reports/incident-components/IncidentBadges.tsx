import React from 'react';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Clock, CheckCircle } from 'lucide-react';

export const getSeverityBadge = (severity: string) => {
  const config = {
    low: { variant: 'secondary' as const, label: 'Baja', color: 'text-green-600' },
    medium: { variant: 'default' as const, label: 'Media', color: 'text-yellow-600' },
    high: { variant: 'destructive' as const, label: 'Alta', color: 'text-red-600' },
  };
  
  const severityConfig = config[severity as keyof typeof config] || config.medium;
  
  return (
    <Badge variant={severityConfig.variant} className={severityConfig.color}>
      {severityConfig.label}
    </Badge>
  );
};

export const getStatusBadge = (status: string) => {
  const config = {
    open: { variant: 'destructive' as const, label: 'Abierta', icon: AlertTriangle },
    in_progress: { variant: 'default' as const, label: 'En progreso', icon: Clock },
    resolved: { variant: 'secondary' as const, label: 'Resuelta', icon: CheckCircle },
  };
  
  const statusConfig = config[status as keyof typeof config] || config.open;
  const Icon = statusConfig.icon;
  
  return (
    <Badge variant={statusConfig.variant} className="flex items-center gap-1">
      <Icon className="h-3 w-3" />
      {statusConfig.label}
    </Badge>
  );
};