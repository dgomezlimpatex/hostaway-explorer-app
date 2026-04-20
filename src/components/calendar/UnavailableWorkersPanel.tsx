import { useEffect, useState, useMemo } from 'react';
import { ChevronDown, UserX, AlertTriangle } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { Cleaner, Task } from '@/types/calendar';
import { useUnavailableCleaners, UnavailableCleanerInfo } from '@/hooks/useUnavailableCleaners';
import { cn } from '@/lib/utils';

const STORAGE_KEY = 'calendar.unavailableWorkersExpanded';

interface UnavailableWorkersPanelProps {
  cleaners: Cleaner[];
  currentDate: Date;
  currentView: string;
  tasks: Task[];
}

export const UnavailableWorkersPanel = ({
  cleaners,
  currentDate,
  currentView,
  tasks,
}: UnavailableWorkersPanelProps) => {
  const { unavailableList } = useUnavailableCleaners(cleaners, currentDate, currentView);

  const [expanded, setExpanded] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(expanded));
    } catch {
      /* ignore */
    }
  }, [expanded]);

  // Detect cleaners with assigned tasks today (so we can warn)
  const currentDateStr = useMemo(() => currentDate.toISOString().split('T')[0], [currentDate]);
  const cleanersWithTasksToday = useMemo(() => {
    const ids = new Set<string>();
    const namesById: Record<string, string> = {};
    cleaners.forEach(c => (namesById[c.id] = c.name));
    tasks.forEach(t => {
      if (t.date !== currentDateStr) return;
      if (t.cleanerId) ids.add(t.cleanerId);
      if (t.cleaner) {
        // map by name when no id
        const match = cleaners.find(c => c.name === t.cleaner);
        if (match) ids.add(match.id);
      }
    });
    return ids;
  }, [tasks, cleaners, currentDateStr]);

  // Group breakdown for header chips
  const breakdown = useMemo(() => {
    const map: Record<string, { icon: string; count: number; color: string; label: string }> = {};
    unavailableList.forEach(info => {
      const key = info.absenceType;
      if (!map[key]) {
        map[key] = { icon: info.icon, count: 0, color: info.color, label: info.label };
      }
      map[key].count += 1;
    });
    return Object.values(map);
  }, [unavailableList]);

  if (unavailableList.length === 0) return null;

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded} className="flex-shrink-0">
      <div className="rounded-lg border border-border bg-muted/30 overflow-hidden">
        <CollapsibleTrigger className="w-full flex items-center justify-between gap-3 px-3 py-2 hover:bg-muted/50 transition-colors">
          <div className="flex items-center gap-2 min-w-0">
            <UserX className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <span className="text-sm font-medium text-foreground">
              Trabajadoras no disponibles
            </span>
            <Badge variant="secondary" className="h-5 px-1.5 text-xs">
              {unavailableList.length}
            </Badge>
            <div className="hidden sm:flex items-center gap-1.5 ml-2">
              {breakdown.map(b => (
                <span
                  key={b.label}
                  className="text-xs text-muted-foreground flex items-center gap-0.5"
                  title={b.label}
                >
                  <span>{b.icon}</span>
                  <span className="tabular-nums">{b.count}</span>
                </span>
              ))}
            </div>
          </div>
          <ChevronDown
            className={cn(
              'h-4 w-4 text-muted-foreground transition-transform duration-200 flex-shrink-0',
              expanded && 'rotate-180'
            )}
          />
        </CollapsibleTrigger>

        <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
          <div className="p-3 pt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
            {unavailableList.map(info => (
              <UnavailableCleanerCard
                key={info.cleaner.id}
                info={info}
                hasTasksToday={cleanersWithTasksToday.has(info.cleaner.id)}
              />
            ))}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
};

const UnavailableCleanerCard = ({
  info,
  hasTasksToday,
}: {
  info: UnavailableCleanerInfo;
  hasTasksToday: boolean;
}) => {
  const initial = info.cleaner.name.charAt(0).toUpperCase();
  return (
    <div
      className="flex items-center gap-2 p-2 rounded-md bg-card border border-border/50"
      style={{ borderLeftWidth: 3, borderLeftColor: info.color }}
    >
      <div
        className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold text-white flex-shrink-0"
        style={{ backgroundColor: info.color }}
      >
        {initial}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-foreground truncate">
          {info.cleaner.name}
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <span>{info.icon}</span>
          <span className="truncate">{info.label}</span>
          {info.locationName && (
            <span className="truncate"> · {info.locationName}</span>
          )}
        </div>
        {info.notes && (
          <div className="text-[11px] text-muted-foreground/80 truncate mt-0.5">
            {info.notes}
          </div>
        )}
        {hasTasksToday && (
          <div className="flex items-center gap-1 mt-1 text-[11px] text-destructive">
            <AlertTriangle className="h-3 w-3" />
            <span>Tiene tareas asignadas</span>
          </div>
        )}
      </div>
    </div>
  );
};
