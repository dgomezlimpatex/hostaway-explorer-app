import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Clock, XCircle, HelpCircle, ShieldCheck, MinusCircle } from 'lucide-react';
import type { ApprovalStatus } from '@/types/notifications';

interface TaskApprovalBadgeProps {
  status?: ApprovalStatus | null;
  className?: string;
}

const CONFIG: Record<ApprovalStatus, { label: string; className: string; Icon: typeof Clock }> = {
  not_required: { label: 'Sin aprobación', className: 'bg-muted text-muted-foreground', Icon: MinusCircle },
  pending: { label: 'Pendiente de aprobar', className: 'bg-amber-100 text-amber-800 border-amber-200', Icon: Clock },
  approved: { label: 'Aprobada', className: 'bg-emerald-100 text-emerald-800 border-emerald-200', Icon: CheckCircle2 },
  rejected: { label: 'Rechazada', className: 'bg-red-100 text-red-800 border-red-200', Icon: XCircle },
  expired: { label: 'Sin respuesta', className: 'bg-orange-100 text-orange-800 border-orange-200', Icon: HelpCircle },
  auto_approved_by_admin: { label: 'Aprobada por admin', className: 'bg-blue-100 text-blue-800 border-blue-200', Icon: ShieldCheck },
};

/**
 * Badge del estado de aprobación de una tarea.
 * Si el estado es undefined/null o 'not_required', no renderiza nada (no ensucia
 * la UI actual mientras WhatsApp está en preparación).
 */
export function TaskApprovalBadge({ status, className }: TaskApprovalBadgeProps) {
  if (!status || status === 'not_required') return null;
  const cfg = CONFIG[status];
  if (!cfg) return null;
  const { label, className: badgeClass, Icon } = cfg;
  return (
    <Badge variant="outline" className={`${badgeClass} ${className ?? ''} gap-1`}>
      <Icon className="h-3 w-3" />
      {label}
    </Badge>
  );
}

export default TaskApprovalBadge;
