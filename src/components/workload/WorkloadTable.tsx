import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus, ChevronDown, ChevronUp, Home, Wrench, Edit } from 'lucide-react';
import { WorkloadSummary, getProgressBarColor, getStatusColor, getStatusBgColor } from '@/types/workload';
import { cn } from '@/lib/utils';

interface WorkloadTableProps {
  workers: WorkloadSummary[];
  onAddAdjustment: (cleanerId: string) => void;
}

const statusOrder: Record<WorkloadSummary['status'], number> = {
  'critical-deficit': 0,
  'deficit': 1,
  'overtime': 2,
  'on-track': 3,
};

const getStatusLabel = (status: WorkloadSummary['status']): string => {
  switch (status) {
    case 'on-track': return 'OK';
    case 'overtime': return 'Extra';
    case 'deficit': return 'Bajo';
    case 'critical-deficit': return 'Déficit';
    default: return '';
  }
};

export const WorkloadTable = ({ workers, onAddAdjustment }: WorkloadTableProps) => {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  // Sort: attention-needed first
  const sorted = [...workers].sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);

  const getDiffText = (w: WorkloadSummary) => {
    if (w.overtimeHours > 0) return `+${w.overtimeHours.toFixed(1)}h`;
    if (w.remainingHours > 0) return `-${w.remainingHours.toFixed(1)}h`;
    return '0h';
  };

  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[180px]">Trabajador</TableHead>
            <TableHead className="text-right w-[80px]">Contrato</TableHead>
            <TableHead className="text-right w-[80px] hidden sm:table-cell">Turísticas</TableHead>
            <TableHead className="text-right w-[70px] hidden sm:table-cell">Mant.</TableHead>
            <TableHead className="text-right w-[70px] hidden md:table-cell">Ajustes</TableHead>
            <TableHead className="text-right w-[80px]">Total</TableHead>
            <TableHead className="text-right w-[90px]">Diferencia</TableHead>
            <TableHead className="w-[140px]">Progreso</TableHead>
            <TableHead className="w-[50px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map(w => (
            <React.Fragment key={w.cleanerId}>
              <TableRow
                className="cursor-pointer"
                onClick={() => setExpandedRow(expandedRow === w.cleanerId ? null : w.cleanerId)}
              >
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    {expandedRow === w.cleanerId ? (
                      <ChevronUp className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    )}
                    <span className="truncate">{w.cleanerName}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right tabular-nums">{w.contractHoursPerWeek}h</TableCell>
                <TableCell className="text-right tabular-nums hidden sm:table-cell">{w.touristHours.toFixed(1)}h</TableCell>
                <TableCell className="text-right tabular-nums hidden sm:table-cell">{w.maintenanceHours.toFixed(1)}h</TableCell>
                <TableCell className="text-right tabular-nums hidden md:table-cell">
                  {w.adjustmentHours !== 0 ? (
                    <span className={w.adjustmentHours > 0 ? 'text-green-600' : 'text-red-600'}>
                      {w.adjustmentHours > 0 ? '+' : ''}{w.adjustmentHours.toFixed(1)}h
                    </span>
                  ) : '—'}
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">{w.totalWorked.toFixed(1)}h</TableCell>
                <TableCell className="text-right">
                  <Badge
                    variant="outline"
                    className={cn(
                      "font-medium text-xs",
                      getStatusBgColor(w.status),
                      getStatusColor(w.status)
                    )}
                  >
                    {getDiffText(w)}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Progress
                      value={Math.min(w.percentageComplete, 120)}
                      className="h-2 w-full"
                      indicatorClassName={getProgressBarColor(w.status)}
                    />
                    <span className="text-xs text-muted-foreground tabular-nums w-[32px] text-right">
                      {w.percentageComplete.toFixed(0)}%
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddAdjustment(w.cleanerId);
                    }}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </TableCell>
              </TableRow>

              {/* Expanded detail row */}
              {expandedRow === w.cleanerId && (
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableCell colSpan={9} className="p-0">
                    <div className="px-6 py-4 space-y-3">
                      {/* Breakdown - visible on mobile since columns are hidden */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                        <div className="flex items-center gap-1.5">
                          <Home className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-muted-foreground">Turísticas:</span>
                          <span className="font-medium">{w.touristHours.toFixed(1)}h</span>
                          <span className="text-xs text-muted-foreground">({w.touristTaskCount})</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Wrench className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-muted-foreground">Mantenimiento:</span>
                          <span className="font-medium">{w.maintenanceHours.toFixed(1)}h</span>
                        </div>
                        {w.adjustmentHours !== 0 && (
                          <div className="flex items-center gap-1.5">
                            <Edit className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-muted-foreground">Ajustes:</span>
                            <span className={cn("font-medium", w.adjustmentHours > 0 ? 'text-green-600' : 'text-red-600')}>
                              {w.adjustmentHours > 0 ? '+' : ''}{w.adjustmentHours.toFixed(1)}h
                            </span>
                          </div>
                        )}
                        <div className="flex items-center gap-1.5">
                          <span className="text-muted-foreground">Total:</span>
                          <span className="font-bold">{w.totalWorked.toFixed(1)}h / {w.contractHoursPerWeek}h</span>
                        </div>
                      </div>

                      {/* Adjustments list */}
                      {w.adjustments.length > 0 && (
                        <div className="space-y-1.5">
                          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Ajustes aplicados</h4>
                          <div className="space-y-1">
                            {w.adjustments.map(adj => (
                              <div key={adj.id} className="flex items-center justify-between text-sm bg-background rounded px-3 py-1.5">
                                <span className="text-muted-foreground text-xs">
                                  {new Date(adj.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                                </span>
                                <span className="flex-1 mx-3 truncate">{adj.reason}</span>
                                <span className={cn("font-medium tabular-nums", adj.hours > 0 ? 'text-green-600' : 'text-red-600')}>
                                  {adj.hours > 0 ? '+' : ''}{adj.hours}h
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </React.Fragment>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
