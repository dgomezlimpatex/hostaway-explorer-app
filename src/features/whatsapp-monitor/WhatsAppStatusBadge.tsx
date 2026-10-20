import { AlertCircle, CheckCheck, CircleHelp, Clock3, Eye, HelpCircle, Send, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { isUnconfirmed, statusInfo, type DeliveryRow, type StatusKey } from './whatsappMonitorModel';

const STYLE: Record<StatusKey, { className: string; icon: typeof Send }> = {
  queued: { className: 'bg-slate-100 hover:bg-slate-100 text-slate-700', icon: Clock3 },
  uncertain: { className: 'bg-orange-100 hover:bg-orange-100 text-orange-900', icon: HelpCircle },
  sent: { className: 'bg-blue-100 hover:bg-blue-100 text-blue-700', icon: Send },
  delivered: { className: 'bg-emerald-100 hover:bg-emerald-100 text-emerald-700', icon: CheckCheck },
  read: { className: 'bg-violet-100 hover:bg-violet-100 text-violet-700', icon: Eye },
  failed: { className: 'bg-red-100 hover:bg-red-100 text-red-700', icon: XCircle },
  undeliverable: { className: 'bg-red-100 hover:bg-red-100 text-red-700', icon: XCircle },
  skipped: { className: 'bg-amber-100 hover:bg-amber-100 text-amber-800', icon: AlertCircle },
  unknown: { className: 'bg-slate-200 hover:bg-slate-200 text-slate-800', icon: CircleHelp },
};

export function WhatsAppStatusBadge({ row }: { row: DeliveryRow }) {
  const info = statusInfo(row);
  const style = STYLE[info.key];
  const Icon = style.icon;
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Badge className={`${style.className} gap-1 border-0`}><Icon aria-hidden className="h-3 w-3" />{info.label}</Badge>
      {isUnconfirmed(row) && <span className="text-xs font-medium text-amber-800">Sin confirmar +30 min</span>}
    </span>
  );
}
