import { Check, Clock, HelpCircle, Play, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const statusStyles = {
  pending: { Icon: Clock, label: 'Sin iniciar', color: 'bg-red-600' },
  'in-progress': { Icon: Play, label: 'En proceso', color: 'bg-amber-600' },
  completed: { Icon: Check, label: 'Finalizada', color: 'bg-green-600' },
  cancelled: { Icon: X, label: 'Cancelada', color: 'bg-gray-600' },
};

export function TaskStatusBadge({
  status,
  showLabel = false,
  className,
}: {
  status: string;
  showLabel?: boolean;
  className?: string;
}) {
  const { Icon, label, color } = statusStyles[status as keyof typeof statusStyles] ?? {
    Icon: HelpCircle, label: 'Estado desconocido', color: 'bg-gray-600',
  };

  return (
    <span
      className={cn('inline-flex shrink-0 items-center gap-1.5', className)}
      title={`Estado: ${label}`}
      aria-label={`Estado: ${label}`}
      role="img"
    >
      <span className={cn(
        'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white shadow-sm ring-2 ring-white',
        color,
      )}>
        <Icon className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" />
      </span>
      {showLabel && <span className="text-xs font-medium">{label}</span>}
    </span>
  );
}
