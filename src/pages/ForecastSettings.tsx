import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import {
  useMyForecastSubscription,
  useUpsertForecastSubscription,
  useForecastSubscriptions,
  useForecastAlertsLog,
} from '@/hooks/useForecastSubscriptions';
import { StaffingTargetsConfig } from '@/components/forecast/StaffingTargetsConfig';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Bell, Settings as SettingsIcon, Send, Mail, History } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { SidebarProvider } from '@/components/ui/sidebar';
import { DashboardSidebar } from '@/components/dashboard/DashboardSidebar';
import { MobileDashboardHeader } from '@/components/dashboard/MobileDashboardHeader';
import { useIsMobile } from '@/hooks/use-mobile';

const ForecastSettings = () => {
  const { user } = useAuth();
  const { data: mySub } = useMyForecastSubscription();
  const { data: allSubs } = useForecastSubscriptions();
  const { data: alertsLog } = useForecastAlertsLog(30);
  const upsert = useUpsertForecastSubscription();

  const [targetsOpen, setTargetsOpen] = useState(false);
  const [email, setEmail] = useState(mySub?.email ?? user?.email ?? '');
  const [dailyDigest, setDailyDigest] = useState(mySub?.daily_digest ?? true);
  const [instantRed, setInstantRed] = useState(mySub?.instant_red_alerts ?? true);
  const [minDays, setMinDays] = useState(mySub?.min_days_advance ?? 7);
  const [isActive, setIsActive] = useState(mySub?.is_active ?? true);
  const [testing, setTesting] = useState(false);
  const isMobile = useIsMobile();

  // Sincronizar al cargar
  if (mySub && email !== mySub.email && email === (user?.email ?? '')) {
    setEmail(mySub.email);
    setDailyDigest(mySub.daily_digest);
    setInstantRed(mySub.instant_red_alerts);
    setMinDays(mySub.min_days_advance);
    setIsActive(mySub.is_active);
  }

  const handleSave = () => {
    upsert.mutate({
      email,
      daily_digest: dailyDigest,
      instant_red_alerts: instantRed,
      min_days_advance: minDays,
      is_active: isActive,
    });
  };

  const handleTestEmail = async () => {
    if (!email) {
      toast({ title: 'Falta email', variant: 'destructive' });
      return;
    }
    setTesting(true);
    try {
      const { error } = await supabase.functions.invoke('daily-staffing-forecast', {
        body: { test: true, email },
      });
      if (error) throw error;
      toast({
        title: 'Email de prueba enviado',
        description: `Revisa la bandeja de ${email}.`,
      });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setTesting(false);
    }
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen w-full bg-background">
        <MobileDashboardHeader />
        <div className="flex min-h-screen w-full">
          {!isMobile && <DashboardSidebar />}
          <main className="flex-1 overflow-auto">
            <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-5">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Bell className="h-6 w-6 text-primary" />
            Ajustes de previsión
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configura tus alertas de plantilla y los objetivos mínimos por día de la semana.
          </p>
        </div>

        {/* Mi suscripción */}
        <Card className="p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-primary" />
            <h2 className="font-semibold">Mi suscripción</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="email">Email destinatario</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="tu@email.com"
              />
            </div>
            <div>
              <Label htmlFor="minDays">Antelación mínima (días)</Label>
              <Input
                id="minDays"
                type="number"
                min={1}
                max={30}
                value={minDays}
                onChange={e => setMinDays(Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Recibirás alertas de días dentro de este rango.
              </p>
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="active">Suscripción activa</Label>
                <p className="text-xs text-muted-foreground">Desactiva para pausar todos los emails.</p>
              </div>
              <Switch id="active" checked={isActive} onCheckedChange={setIsActive} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="digest">Resumen diario</Label>
                <p className="text-xs text-muted-foreground">Email cada mañana con días en alerta.</p>
              </div>
              <Switch id="digest" checked={dailyDigest} onCheckedChange={setDailyDigest} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="instant">Alertas instantáneas</Label>
                <p className="text-xs text-muted-foreground">
                  Email cuando un día pase a rojo tras una sincronización.
                </p>
              </div>
              <Switch id="instant" checked={instantRed} onCheckedChange={setInstantRed} />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-2">
            <Button onClick={handleSave} disabled={upsert.isPending}>
              Guardar cambios
            </Button>
            <Button variant="outline" onClick={handleTestEmail} disabled={testing || !email}>
              <Send className="h-4 w-4 mr-1" />
              {testing ? 'Enviando…' : 'Probar email ahora'}
            </Button>
          </div>
        </Card>

        {/* Objetivos */}
        <Card className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SettingsIcon className="h-4 w-4 text-primary" />
              <div>
                <h2 className="font-semibold">Objetivos mínimos de plantilla</h2>
                <p className="text-xs text-muted-foreground">
                  Personas y horas mínimas por día de la semana.
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => setTargetsOpen(true)}>
              Configurar
            </Button>
          </div>
        </Card>

        {/* Suscriptores en mi sede */}
        <Card className="p-5 space-y-3">
          <h2 className="font-semibold flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            Suscriptores activos en esta sede
          </h2>
          {!allSubs?.length ? (
            <p className="text-sm text-muted-foreground">Aún no hay suscriptores.</p>
          ) : (
            <ul className="text-sm divide-y">
              {allSubs.map(s => (
                <li key={s.id} className="py-2 flex items-center justify-between">
                  <span>{s.email}</span>
                  <span className="text-xs text-muted-foreground">
                    {s.is_active ? 'Activa' : 'Pausada'} · {s.min_days_advance}d
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Log alertas */}
        <Card className="p-5 space-y-3">
          <h2 className="font-semibold flex items-center gap-2">
            <History className="h-4 w-4 text-primary" />
            Últimas alertas enviadas
          </h2>
          {!alertsLog?.length ? (
            <p className="text-sm text-muted-foreground">Aún no se han enviado alertas.</p>
          ) : (
            <ul className="text-sm divide-y">
              {alertsLog.map((a: any) => (
                <li key={a.id} className="py-2 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{a.recipient_email}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(a.sent_at), "d MMM yyyy 'a las' HH:mm", { locale: es })}
                    </p>
                  </div>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      a.alert_type === 'red'
                        ? 'bg-destructive/10 text-destructive'
                        : 'bg-amber-500/10 text-amber-700'
                    }`}
                  >
                    {a.alert_date} · {a.alert_type}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
            </div>
          </main>
        </div>

        <StaffingTargetsConfig open={targetsOpen} onOpenChange={setTargetsOpen} />
      </div>
    </SidebarProvider>
  );
};

export default ForecastSettings;
