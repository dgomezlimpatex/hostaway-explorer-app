import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, CheckCircle2, PackageSearch, Settings2, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { StockLayout } from '@/components/stock/StockLayout';
import { useAuth } from '@/hooks/useAuth';
import { useProperties } from '@/hooks/useProperties';
import {
  useSedeStockConsumptionRules,
  useStockProducts,
  useStockSedeSettings,
  useUpdateStockSedeSettings,
} from '@/hooks/useStock';
import { useSede } from '@/contexts/SedeContext';
import { cn } from '@/lib/utils';
import type { UpdateStockSedeSettingsData } from '@/types/stock';
import { buildInitialStockConsumptions } from '@/components/properties/forms/propertyStockConsumption';

export default function InventoryConfig() {
  const { user } = useAuth();
  const { activeSede } = useSede();
  const { data: properties = [] } = useProperties();
  const { data: products = [] } = useStockProducts();
  const { data: rules = [], isLoading: rulesLoading } = useSedeStockConsumptionRules();
  const { data: settings, isLoading: settingsLoading } = useStockSedeSettings();
  const updateSettings = useUpdateStockSedeSettings();

  const activeProperties = useMemo(
    () => properties.filter((property) => property.isActive !== false),
    [properties]
  );

  const consumableProducts = useMemo(
    () => products.filter((product) => product.is_active && product.is_consumable),
    [products]
  );

  const diagnostics = useMemo(() => {
    const rulesByProperty = new Map<string, typeof rules>();
    const propertiesWithPositiveConsumption = new Set<string>();
    const productsWithUsage = new Set<string>();

    rules.forEach((rule) => {
      if (!rulesByProperty.has(rule.property_id)) rulesByProperty.set(rule.property_id, []);
      rulesByProperty.get(rule.property_id)?.push(rule);

      if (rule.quantity_per_cleaning > 0) {
        productsWithUsage.add(rule.product_id);
      }
    });

    activeProperties.forEach((property) => {
      const effectiveConsumptions = buildInitialStockConsumptions(
        consumableProducts,
        rulesByProperty.get(property.id) || [],
        property
      );

      Object.entries(effectiveConsumptions).forEach(([productId, quantity]) => {
        if (quantity > 0) {
          propertiesWithPositiveConsumption.add(property.id);
          productsWithUsage.add(productId);
        }
      });
    });

    const propertiesWithoutConsumption = activeProperties.filter(
      (property) => !propertiesWithPositiveConsumption.has(property.id)
    );
    const zeroRules = rules.filter((rule) => rule.quantity_per_cleaning <= 0);
    const productsWithoutUsage = consumableProducts.filter((product) => !productsWithUsage.has(product.id));

    return {
      propertiesWithoutConsumption,
      zeroRules,
      productsWithoutUsage,
      propertiesWithPositiveConsumption: propertiesWithPositiveConsumption.size,
      positiveRules: rules.filter((rule) => rule.quantity_per_cleaning > 0).length,
    };
  }, [activeProperties, consumableProducts, rules]);

  const autoConsumptionReady =
    !!settings?.auto_consumption_enabled &&
    !settings?.preparation_mode;

  const handleUpdateSettings = (updates: UpdateStockSedeSettingsData) => {
    updateSettings.mutate({
      ...updates,
      updated_by: user?.id || null,
    });
  };

  return (
    <StockLayout
      title="Configuracion de consumo"
      description="Controla el piloto de stock, reglas por propiedad y activacion del descuento automatico."
      showWarehouseSelect={false}
    >
      <div className="space-y-4">
        <Card className={cn('border-l-4', autoConsumptionReady ? 'border-l-emerald-500' : 'border-l-amber-500')}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              Piloto de consumo automatico
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <StatusMetric label="Sede activa" value={activeSede?.nombre || '-'} />
              <StatusMetric label="Propiedades con consumo" value={`${diagnostics.propertiesWithPositiveConsumption}/${activeProperties.length}`} />
              <StatusMetric label="Reglas explicitas positivas" value={diagnostics.positiveRules} />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <SwitchRow
                title="Modo preparacion"
                description="Impide descuentos automaticos mientras se cargan stock inicial, minimos y objetivos."
                checked={settings?.preparation_mode ?? true}
                disabled={settingsLoading || updateSettings.isPending}
                onCheckedChange={(checked) => handleUpdateSettings({ preparation_mode: checked })}
              />
              <SwitchRow
                title="Descuento automatico"
                description="Permite descontar stock al completar tareas solo si el modo preparacion esta desactivado."
                checked={settings?.auto_consumption_enabled ?? false}
                disabled={settingsLoading || updateSettings.isPending}
                onCheckedChange={(checked) => handleUpdateSettings({ auto_consumption_enabled: checked })}
              />
            </div>

            <div className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
              Estado actual:{' '}
              <Badge variant={autoConsumptionReady ? 'default' : 'outline'}>
                {autoConsumptionReady ? 'Activo para esta sede' : 'Seguro / sin descuentos'}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <DiagnosticCard
            title="Sin consumo"
            value={diagnostics.propertiesWithoutConsumption.length}
            description="Propiedades activas sin ningun consumo positivo efectivo."
            danger={diagnostics.propertiesWithoutConsumption.length > 0}
          />
          <DiagnosticCard
            title="Con consumo"
            value={diagnostics.propertiesWithPositiveConsumption}
            description="Propiedades con consumo desde reglas nuevas o campos antiguos."
            danger={false}
          />
          <DiagnosticCard
            title="Reglas a 0"
            value={diagnostics.zeroRules.length}
            description="Reglas guardadas sin consumo."
            danger={false}
          />
          <DiagnosticCard
            title="Productos sin uso"
            value={diagnostics.productsWithoutUsage.length}
            description="Consumibles sin ninguna regla positiva."
            danger={diagnostics.productsWithoutUsage.length > 0}
          />
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <ActionList
            title="Propiedades sin consumo configurado"
            emptyText="Todas las propiedades activas tienen al menos un consumo positivo."
            items={[
              ...diagnostics.propertiesWithoutConsumption.map((property) => ({
                id: `missing-${property.id}`,
                title: property.codigo,
                description: property.nombre,
                badge: 'Sin consumo',
              })),
            ].slice(0, 30)}
            actionLabel="Editar propiedades"
            to="/properties"
            loading={rulesLoading}
          />

          <ActionList
            title="Productos consumibles sin uso"
            emptyText="Todos los productos consumibles aparecen en alguna regla positiva."
            items={diagnostics.productsWithoutUsage.slice(0, 30).map((product) => ({
              id: product.id,
              title: product.name,
              description: product.category?.name || 'Sin tipo',
              badge: product.category?.kind || 'stock',
            }))}
            actionLabel="Ver stock"
            to="/inventory/stock"
            loading={rulesLoading}
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PackageSearch className="h-5 w-5" />
              Siguiente paso operativo
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
            <p>
              Carga stock actual, minimos y objetivos desde <strong>Stock global</strong>. Cuando el piloto este validado, desactiva modo preparacion y activa descuento automatico para esta sede.
            </p>
            <Button asChild>
              <Link to="/inventory/stock">
                Carga operativa
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </StockLayout>
  );
}

function StatusMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border bg-background p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}

function SwitchRow({
  title,
  description,
  checked,
  disabled,
  onCheckedChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
      <div>
        <p className="font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function DiagnosticCard({
  title,
  value,
  description,
  danger,
}: {
  title: string;
  value: number;
  description: string;
  danger: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="mt-1 text-3xl font-bold">{value}</p>
          </div>
          {danger ? (
            <AlertTriangle className="h-5 w-5 text-amber-600" />
          ) : (
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          )}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

function ActionList({
  title,
  emptyText,
  items,
  actionLabel,
  to,
  loading,
}: {
  title: string;
  emptyText: string;
  items: Array<{ id: string; title: string | null; description: string | null; badge: string }>;
  actionLabel: string;
  to: string;
  loading?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="text-base">{title}</CardTitle>
        <Button asChild variant="outline" size="sm">
          <Link to={to}>{actionLabel}</Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading ? (
          <p className="text-sm text-muted-foreground">Cargando diagnostico...</p>
        ) : items.length === 0 ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
            {emptyText}
          </div>
        ) : (
          items.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{item.title || 'Sin nombre'}</p>
                <p className="truncate text-xs text-muted-foreground">{item.description || '-'}</p>
              </div>
              <Badge variant="outline">{item.badge}</Badge>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
