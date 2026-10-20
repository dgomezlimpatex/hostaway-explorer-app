import React, { useState } from "react";
import { AlertTriangle, ChevronDown, ChevronRight, X } from "lucide-react";
import { Cleaner } from "@/types/calendar";
import { OverlapAlert } from "./OverlapAlert";
import type { TaskOverlap } from "./utils/multiDayCalendar";

interface OverlapAlertsBannerProps {
  overlapsByCleanerMap: Record<string, TaskOverlap[]>;
  cleaners: Cleaner[];
  showDate?: boolean;
  /** Visible period. Hiding the banner only applies to the period where it was hidden. */
  resetKey?: string;
  /** Opens the detail of a task from its chip. */
  onTaskSelect?: (taskId: string) => void;
}

export const OverlapAlertsBanner: React.FC<OverlapAlertsBannerProps> = ({
  overlapsByCleanerMap,
  cleaners,
  showDate = false,
  resetKey = '',
  onTaskSelect,
}) => {
  const [expanded, setExpanded] = useState(true);
  const [dismissedKey, setDismissedKey] = useState<string | null>(null);
  const dismissed = dismissedKey === resetKey;

  const entries = Object.entries(overlapsByCleanerMap);
  if (entries.length === 0 || dismissed) return null;

  // Distinct tasks: a shared task overlapping in two rows counts once.
  const totalOverlaps = new Set(entries.flatMap(([, arr]) => arr.map((task) => task.id))).size;

  return (
    <div className="mb-2 flex-shrink-0 border border-line bg-paper dark:bg-red-950/20 dark:border-red-900/50 rounded-md text-sm">
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-2 flex-1 min-w-0 text-left text-danger dark:text-red-200 hover:opacity-80"
        >
          {expanded ? (
            <ChevronDown className="h-4 w-4 flex-shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 flex-shrink-0" />
          )}
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          <span className="font-semibold truncate">
            {entries.length} {entries.length === 1 ? 'trabajadora con solapes' : 'trabajadoras con solapes'}
            {' '}({totalOverlaps} {totalOverlaps === 1 ? 'tarea' : 'tareas'})
          </span>
        </button>
        <button
          type="button"
          onClick={() => setDismissedKey(resetKey)}
          className="text-danger/70 hover:text-danger dark:text-red-400/70 dark:hover:text-red-300 flex-shrink-0"
          aria-label="Ocultar avisos"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      {expanded && (
        <div className="px-3 pb-3 space-y-1.5">
          {entries.map(([cleanerId, overlaps]) => {
            const cleaner = cleaners.find((c) => c.id === cleanerId);
            return cleaner ? (
              <OverlapAlert
                key={cleanerId}
                overlappingTasks={overlaps}
                cleanerName={cleaner.name}
                showDate={showDate}
                onTaskSelect={onTaskSelect}
              />
            ) : null;
          })}
        </div>
      )}
    </div>
  );
};

