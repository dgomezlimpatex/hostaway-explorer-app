import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Smartphone, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { isWhatsAppNotificationsEnabled } from '@/services/whatsapp/whatsappConfig';

interface HealthCounters {
  cleanersTotal: number;
  cleanersWithPhone: number;
  cleanersWithOptIn: number;
  deliveriesToday: number;
  deliveriesFailed: number;
}

/**
 * Panel "Configuración → WhatsApp Operativo".
 * En modo preparación muestra que el canal aún no está activo y los contadores
 * de salud (teléfonos, opt-in, entregas). No envía nada.
 */
export function WhatsAppStatusPanel() {
  const [loading, setLoading] = useState(true);
  const [counters, setCounters] = useState<HealthCounters | null>(null);
  const live = isWhatsAppNotificationsEnabled();

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [{ count: cleanersTotal }, { count: cleanersWithPhone }, { count: cleanersWithOptIn }] =
          await Promise.all([
            supabase.from('cleaners').select('id', { count: 'exact', head: true }),
            supabase
              .from('cleaners')
              .select('id', { count: 'exact', head: true })
              .not('whatsapp_phone_e164', 'is', null),
            supabase
              .from('cleaners')
              .select('id', { count: 'exact', head: true })
              .eq('whatsapp_opt_in', true),
          ]);

        const { count: deliveriesToday } = await supabase
          .from('notification_deliveries')
          .select('id', { count: 'exact', head: true })
          .eq('channel', 'whatsapp');

        const { count: deliveriesFailed } = await supabase
          .from('notification_deliveries')
          .select('id', { count: 'exact', head: true })
          .eq('channel', 'whatsapp')
          .eq('status', 'failed');

        if (!active) return;
        setCounters({
          cleanersTotal: cleanersTotal ?? 0,
          cleanersWithPhone: cleanersWithPhone ?? 0,
          cleanersWithOptIn: cleanersWithOptIn ?? 0,
          deliveriesToday: deliveriesToday ?? 0,
          deliveriesFailed: deliveriesFailed ?? 0,
        });
      } catch (e) {
        console.error('WhatsAppStatusPanel error:', e);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Smartphone className="h-5 w-5" />
          WhatsApp Operativo
          {live ? (
            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 gap-1">
              <CheckCircle2 className="h-3 w-3" /> Activo
            </Badge>
          ) : (
            <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-200 gap-1">
              <AlertTriangle className="h-3 w-3" /> En preparación (número no configurado)
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Cargando estado…</p>
        ) : counters ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Metric label="Limpiadoras" value={counters.cleanersTotal} />
            <Metric label="Con teléfono WhatsApp" value={counters.cleanersWithPhone} />
            <Metric label="Con consentimiento" value={counters.cleanersWithOptIn} />
            <Metric label="Envíos WhatsApp" value={counters.deliveriesToday} />
            <Metric label="Fallidos" value={counters.deliveriesFailed} highlight={counters.deliveriesFailed > 0} />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No se pudo cargar el estado.</p>
        )}
        {!live && (
          <p className="mt-4 text-xs text-muted-foreground">
            Todo el andamiaje está listo. Para activar WhatsApp hay que configurar el número de Meta,
            los secrets y poner el flag <code>WHATSAPP_NOTIFICATIONS_ENABLED=true</code>.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function Metric({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className="rounded-lg border p-3">
      <div className={`text-2xl font-semibold ${highlight ? 'text-red-600' : ''}`}>{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

export default WhatsAppStatusPanel;
