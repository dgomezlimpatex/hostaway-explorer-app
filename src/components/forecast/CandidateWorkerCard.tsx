import { CandidateWorker } from '@/hooks/useStaffingCandidates';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { UserPlus, AlertCircle } from 'lucide-react';

interface Props {
  candidate: CandidateWorker;
  onPropose?: (cleanerId: string) => void;
}

export const CandidateWorkerCard = ({ candidate, onPropose }: Props) => {
  const blocked = candidate.hasAbsence;
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 px-3 py-2.5 rounded-md border',
        blocked
          ? 'bg-destructive/5 border-destructive/30 opacity-70'
          : candidate.isFixedDayOff
          ? 'bg-amber-500/5 border-amber-500/30'
          : 'bg-card border-border hover:bg-muted/40'
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-medium text-sm truncate">{candidate.name}</p>
          {candidate.hoursAvailableThisWeek > 0 && !blocked && (
            <Badge variant="secondary" className="text-[10px]">
              {candidate.hoursAvailableThisWeek}h libres
            </Badge>
          )}
          {candidate.sundaysWorkedLast90d >= 3 && (
            <Badge variant="outline" className="text-[10px]">
              ⭐ {candidate.sundaysWorkedLast90d}× histórico
            </Badge>
          )}
          {blocked && (
            <Badge variant="destructive" className="text-[10px]">
              <AlertCircle className="h-3 w-3 mr-1" /> Ausencia
            </Badge>
          )}
          {candidate.isFixedDayOff && !blocked && (
            <Badge className="text-[10px] bg-amber-500/20 text-amber-700 hover:bg-amber-500/30 border-amber-500/30">
              Día libre
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 truncate">{candidate.reason}</p>
      </div>
      {!blocked && onPropose && (
        <Button size="sm" variant="outline" onClick={() => onPropose(candidate.cleanerId)}>
          <UserPlus className="h-3.5 w-3.5 mr-1" />
          Proponer
        </Button>
      )}
    </div>
  );
};
