import { Cleaner, Task } from "@/types/calendar";
import { useClientData } from "@/hooks/useClientData";
import { getClientColor } from "@/utils/clientColors";
import { useMemo } from "react";

interface CalendarFooterSummaryProps {
  tasks: Task[];
  cleaners: Cleaner[];
}

export const CalendarFooterSummary = ({ tasks, cleaners }: CalendarFooterSummaryProps) => {
  const { clients, getClientName } = useClientData();

  const stats = useMemo(() => {
    const activeCleanerIds = new Set<string>();
    const activeClientIds = new Set<string>();

    tasks.forEach(t => {
      if (t.cleanerId) activeCleanerIds.add(t.cleanerId);
      else if (t.cleaner) {
        const match = cleaners.find(c => c.name === t.cleaner);
        if (match) activeCleanerIds.add(match.id);
      }
      if (t.clienteId) activeClientIds.add(t.clienteId);
    });

    return {
      tasksCount: tasks.length,
      workersCount: activeCleanerIds.size,
      clientsCount: activeClientIds.size,
      clientIds: Array.from(activeClientIds),
    };
  }, [tasks, cleaners]);

  // Limit visible legend chips to keep the bar tidy
  const MAX_CHIPS = 8;
  const visibleClientIds = stats.clientIds.slice(0, MAX_CHIPS);
  const remaining = stats.clientIds.length - visibleClientIds.length;

  return (
    <div className="rounded-xl border border-border/50 bg-card shadow-sm px-3 md:px-5 py-2.5 md:py-3">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        {/* Resumen numérico */}
        <div className="flex items-center gap-4 md:gap-6 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="text-xl md:text-2xl font-bold text-foreground tabular-nums">
              {stats.tasksCount}
            </span>
            <span className="text-xs md:text-sm text-muted-foreground">
              {stats.tasksCount === 1 ? 'servicio hoy' : 'servicios hoy'}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xl md:text-2xl font-bold text-foreground tabular-nums">
              {stats.workersCount}
            </span>
            <span className="text-xs md:text-sm text-muted-foreground">
              {stats.workersCount === 1 ? 'trabajadora' : 'trabajadoras'}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xl md:text-2xl font-bold text-foreground tabular-nums">
              {stats.clientsCount}
            </span>
            <span className="text-xs md:text-sm text-muted-foreground">
              {stats.clientsCount === 1 ? 'cliente' : 'clientes'}
            </span>
          </div>
        </div>

        {/* Leyenda de clientes */}
        {stats.clientIds.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            {visibleClientIds.map(clientId => {
              const color = getClientColor(clientId);
              const name = getClientName(clientId) || 'Cliente';
              return (
                <div
                  key={clientId}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-muted/60"
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: color.dot }}
                  />
                  <span className="text-[11px] md:text-xs font-medium text-foreground truncate max-w-[120px]">
                    {name}
                  </span>
                </div>
              );
            })}
            {remaining > 0 && (
              <span className="text-[11px] md:text-xs text-muted-foreground font-medium">
                +{remaining} más
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
