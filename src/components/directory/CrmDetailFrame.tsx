import { useState, type ReactNode } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface CrmDetailFrameProps {
  title: string;
  subtitle: ReactNode;
  avatar: ReactNode;
  status: string;
  metricLabel: string;
  metricValue: ReactNode;
  actions: ReactNode;
  tabs: { id: string; label: string; content: ReactNode }[];
  footer?: ReactNode;
  children?: ReactNode;
}

/** Shared profile layout, following the workers CRM detail panel. */
export function CrmDetailFrame({ title, subtitle, avatar, status, metricLabel, metricValue, actions, tabs, footer, children }: CrmDetailFrameProps) {
  const [activeTab, setActiveTab] = useState(tabs[0].id);
  return (
    <div className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:h-[calc(100dvh-270px)] lg:min-h-[640px]">
      <header className="shrink-0 border-b bg-gradient-to-br from-slate-950 via-slate-900 to-[#310984] p-4 text-white sm:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white text-base font-black text-[#310984]">{avatar}</span>
            <div className="min-w-0">
              <h2 className="break-words text-xl font-black sm:text-2xl">{title}</h2>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-200">
                <span className="break-words">{subtitle}</span>
                <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-semibold text-slate-950">{status}</span>
              </div>
            </div>
          </div>
          <div className="shrink-0 rounded-xl border border-white/10 bg-white/10 px-3 py-2 xl:min-w-[150px]">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-300">{metricLabel}</p>
            <p className="mt-1 text-sm font-black text-white">{metricValue}</p>
          </div>
        </div>
      </header>
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-200 px-4 py-3 [&_button]:h-9 [&_button]:rounded-lg [&_a]:h-9 [&_a]:rounded-lg">{actions}</div>
      <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50 p-3 sm:p-5">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList aria-label={`Secciones de ${title}`} style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }} className="sticky top-0 z-10 grid h-auto rounded-2xl bg-white p-1 shadow-sm">
            {tabs.map(tab => <TabsTrigger key={tab.id} value={tab.id} className="min-w-0 rounded-xl px-1 py-2.5 text-xs sm:text-sm">{tab.label}</TabsTrigger>)}
          </TabsList>
          {tabs.map(tab => <TabsContent key={tab.id} value={tab.id} className="mt-0 space-y-4">{tab.content}</TabsContent>)}
        </Tabs>
      </div>
      {footer && <div className="shrink-0 border-t border-slate-200 px-3 py-2 [&_button]:h-8 [&_button]:text-xs">{footer}</div>}
      {children}
    </div>
  );
}
