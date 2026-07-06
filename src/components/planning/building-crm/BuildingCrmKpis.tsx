import { Activity, BarChart3, Clock, UserCheck } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { PlanningBuildingCrmSummary } from '@/types/operationalPlanning';
import { formatCrmHours } from './buildingCrmFormatters';

interface BuildingCrmKpisProps {
  summary: PlanningBuildingCrmSummary;
  rangeDays: number;
}

const kpiClass = 'rounded-3xl border border-[#310984]/10 bg-white p-4 shadow-sm shadow-[#310984]/5';

export const BuildingCrmKpis = ({ summary, rangeDays }: BuildingCrmKpisProps) => {
  const totalCleanings = summary.confirmedCleanings + summary.forecastCleanings;

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Card className={kpiClass}>
        <CardContent className="flex items-start justify-between gap-3 p-0">
          <div>
            <p className="text-sm font-medium text-[#6b627a]">Limpiezas próximas</p>
            <p className="mt-2 text-3xl font-bold text-[#171321]">{totalCleanings}</p>
            <p className="mt-1 text-xs text-[#6b627a]">{summary.confirmedCleanings} confirmadas · {summary.forecastCleanings} previstas</p>
          </div>
          <div className="rounded-2xl bg-[#310984]/10 p-3 text-[#310984]"><Activity className="h-5 w-5" /></div>
        </CardContent>
      </Card>

      <Card className={kpiClass}>
        <CardContent className="flex items-start justify-between gap-3 p-0">
          <div>
            <p className="text-sm font-medium text-[#6b627a]">Horas servicio</p>
            <p className="mt-2 text-3xl font-bold text-[#171321]">{formatCrmHours(summary.serviceMinutes)}</p>
            <p className="mt-1 text-xs text-[#6b627a]">Media diaria {formatCrmHours(summary.averageDailyServiceMinutes)}</p>
          </div>
          <div className="rounded-2xl bg-[#310984]/10 p-3 text-[#310984]"><Clock className="h-5 w-5" /></div>
        </CardContent>
      </Card>

      <Card className={kpiClass}>
        <CardContent className="flex items-start justify-between gap-3 p-0">
          <div>
            <p className="text-sm font-medium text-[#6b627a]">Horas-persona</p>
            <p className="mt-2 text-3xl font-bold text-[#171321]">{formatCrmHours(summary.personMinutes)}</p>
            <p className="mt-1 text-xs text-[#6b627a]">Pico diario {formatCrmHours(summary.peakDailyPersonMinutes)}</p>
          </div>
          <div className="rounded-2xl bg-[#f4d35e]/30 p-3 text-[#7c5b00]"><BarChart3 className="h-5 w-5" /></div>
        </CardContent>
      </Card>

      <Card className={kpiClass}>
        <CardContent className="flex items-start justify-between gap-3 p-0">
          <div>
            <p className="text-sm font-medium text-[#6b627a]">Personal recomendado</p>
            <p className="mt-2 text-3xl font-bold text-[#171321]">{summary.recommendedStableStaff}</p>
            <p className="mt-1 text-xs text-[#6b627a]">{summary.pressureDays} días a vigilar en {rangeDays} días</p>
          </div>
          <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-700"><UserCheck className="h-5 w-5" /></div>
        </CardContent>
      </Card>
    </div>
  );
};
