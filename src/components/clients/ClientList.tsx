import { ChevronRight, MapPin } from 'lucide-react';
import { Client } from '@/types/client';
import { cn } from '@/lib/utils';
import { CLIENT_SERVICE_LABELS, clientInitials } from './clientPresentation';

interface ClientListProps {
  clients: Client[];
  selectedClientId?: string;
  onSelect: (client: Client) => void;
}

export const ClientList = ({ clients, selectedClientId, onSelect }: ClientListProps) => (
  <div className="space-y-2">
    {clients.map(client => (
      <button
        key={client.id}
        type="button"
        aria-pressed={selectedClientId === client.id}
        onClick={() => onSelect(client)}
        className={cn(
          'flex w-full items-center gap-3 rounded-xl border p-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#310984] focus-visible:ring-offset-2',
          selectedClientId === client.id ? 'border-[#310984]/30 bg-violet-50 ring-1 ring-[#310984]/20' : 'border-slate-200 bg-white hover:border-violet-300 hover:bg-slate-50',
        )}
      >
        <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-black', selectedClientId === client.id ? 'bg-white text-[#310984]' : 'bg-slate-100 text-slate-600')}>
          {clientInitials(client.nombre)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block break-words text-sm font-black leading-tight text-slate-950">{client.nombre}</span>
          <span className="mt-1 block truncate text-xs text-slate-500">{CLIENT_SERVICE_LABELS[client.tipoServicio] || client.tipoServicio}</span>
          <span className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
            <span className={cn('rounded-full px-2 py-0.5 font-bold', client.isActive !== false ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600')}>{client.isActive !== false ? 'Activo' : 'Inactivo'}</span>
            {client.ciudad && <span className="flex min-w-0 items-center gap-1"><MapPin className="h-3 w-3 shrink-0" /><span className="truncate">{client.ciudad}</span></span>}
          </span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
      </button>
    ))}
  </div>
);
