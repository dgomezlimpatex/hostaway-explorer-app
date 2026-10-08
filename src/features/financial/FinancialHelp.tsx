import type { ReactNode } from 'react';
import { Info, X } from 'lucide-react';
import { Close } from '@radix-ui/react-popover';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export function FinancialHelp({ section, children }: { section: string; children: ReactNode }) {
  return <Popover><PopoverTrigger asChild><button aria-label={`Cómo se calcula: ${section}`} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-violet-700 hover:bg-violet-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-600"><Info aria-hidden="true" className="h-4 w-4" />Cómo se calcula</button></PopoverTrigger>
    <PopoverContent align="end" className="max-w-[calc(100vw-2rem)] space-y-2 rounded-xl text-sm leading-relaxed text-slate-600"><div className="flex items-start justify-between gap-2"><h3 className="font-semibold text-[#310984]">{section}</h3><Close aria-label={`Cerrar ayuda: ${section}`} className="rounded-md p-1 text-slate-500 hover:bg-violet-50 focus-visible:outline-violet-600"><X aria-hidden className="h-4 w-4" /></Close></div>{children}</PopoverContent>
  </Popover>;
}
