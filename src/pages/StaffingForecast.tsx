import { useState } from 'react';
import { useStaffingForecast } from '@/hooks/useStaffingForecast';
import { HeatmapWeek } from '@/components/forecast/HeatmapWeek';
import { ForecastSummaryStats } from '@/components/forecast/ForecastSummaryStats';
import { DayDeficitDrawer } from '@/components/forecast/DayDeficitDrawer';
import { StaffingTargetsConfig } from '@/components/forecast/StaffingTargetsConfig';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { TrendingUp, Settings, RefreshCw, AlertTriangle } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

const StaffingForecast = () => {
  const [rangeDays, setRangeDays] = useState<number>(45);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [configOpen, setConfigOpen] = useState(false);
  const { data, isLoading, refetch, isFetching } = useStaffingForecast(rangeDays);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <TrendingUp className="h-6 w-6 text-primary" />
              Previsión de personal
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Anticipa días pico cruzando reservas Avantio + clientes con la capacidad real de plantilla.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Tabs value={String(rangeDays)} onValueChange={v => setRangeDays(Number(v))}>
              <TabsList>
                <TabsTrigger value="30">30 días</TabsTrigger>
                <TabsTrigger value="45">45 días</TabsTrigger>
                <TabsTrigger value="60">60 días</TabsTrigger>
              </TabsList>
            </Tabs>
            <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setConfigOpen(true)}>
              <Settings className="h-4 w-4 mr-1" /> Objetivos
            </Button>
          </div>
        </div>

        {/* Stats */}
        {data && (
          <ForecastSummaryStats
            totalDays={data.summary.totalDays}
            redDays={data.summary.redDays}
            yellowDays={data.summary.yellowDays}
            greenDays={data.summary.greenDays}
            worstDay={data.summary.worstDay}
            anomalies={data.summary.anomalies}
          />
        )}

        {/* Anomalías warning */}
        {data && data.summary.anomalies > 0 && (
          <Card className="p-3 border-amber-500/40 bg-amber-500/5">
            <div className="flex items-start gap-2 text-sm">
              <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <p className="text-amber-700">
                Se han detectado <strong>{data.summary.anomalies} día(s)</strong> con un volumen de checkouts inusualmente alto (&gt;100). 
                Pueden ser datos de sincronización antiguos. Revisa estos días manualmente antes de planificar.
              </p>
            </div>
          </Card>
        )}

        {/* Heatmap */}
        <Card className="p-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              Calculando previsión…
            </div>
          ) : data ? (
            <>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Próximos {rangeDays} días
                </h2>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" /> Holgado
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-amber-500" /> Ajustado
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-destructive" /> Déficit
                  </span>
                </div>
              </div>
              <HeatmapWeek days={data.days} onDayClick={d => setSelectedDate(d)} />
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Sin datos.</p>
          )}
        </Card>

        <p className="text-xs text-muted-foreground text-center">
          Los cálculos se basan en reservas confirmadas, disponibilidad declarada y ausencias registradas. 
          Click en un día para ver el detalle y candidatas para reforzar.
        </p>
      </div>

      <DayDeficitDrawer date={selectedDate} onClose={() => setSelectedDate(null)} />
      <StaffingTargetsConfig open={configOpen} onOpenChange={setConfigOpen} />
    </div>
  );
};

export default StaffingForecast;
