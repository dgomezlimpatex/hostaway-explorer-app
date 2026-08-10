import { useMemo, useState } from 'react';
import {
  Building2,
  Calculator,
  CalendarRange,
  CircleDollarSign,
  Clock3,
  Info,
  PackageCheck,
  Shirt,
  Sparkles,
  Truck,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  calculateTouristApartmentBudget,
  DEFAULT_BUDGET_RATES,
} from './budgetCalculator';
import {
  calculateCleaningTimeEstimate,
  DEFAULT_CLEANING_FEATURE_COUNTS,
  DEFAULT_CLEANING_TIME_TEMPLATE,
  type CleaningFeatureCounts,
  type CleaningTimeTemplate,
} from './cleaningTimeEstimator';

const currencyFormatter = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
});

const percentageFormatter = new Intl.NumberFormat('es-ES', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

interface NumberFieldProps {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
  step?: number;
  min?: number;
  suffix?: string;
  readOnly?: boolean;
}

function NumberField({
  id,
  label,
  value,
  onChange,
  step = 0.01,
  min = 0,
  suffix,
  readOnly = false,
}: NumberFieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
        {label}
      </Label>
      <div className="relative">
        <Input
          id={id}
          type="number"
          min={min}
          step={step}
          value={value}
          readOnly={readOnly}
          aria-readonly={readOnly}
          onChange={(event) => onChange(Number(event.target.value))}
          className={`h-11 rounded-xl border-slate-200 pr-12 font-semibold shadow-sm ${readOnly ? 'bg-slate-100 text-slate-500' : 'bg-white'}`}
        />
        {suffix && (
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm font-semibold text-slate-400">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

interface CostSaleFieldsProps {
  idPrefix: string;
  title: string;
  description: string;
  icon: typeof Shirt;
  cost: number;
  salePrice: number;
  onCostChange: (value: number) => void;
  onSalePriceChange: (value: number) => void;
}

function CostSaleFields({
  idPrefix,
  title,
  description,
  icon: Icon,
  cost,
  salePrice,
  onCostChange,
  onSalePriceChange,
}: CostSaleFieldsProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
      <div className="mb-4 flex items-start gap-3">
        <div className="rounded-xl bg-white p-2 text-[#310984] shadow-sm">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="font-bold text-slate-900">{title}</p>
          <p className="text-sm text-slate-500">{description}</p>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <NumberField
          id={`${idPrefix}-coste`}
          label="Coste"
          value={cost}
          onChange={onCostChange}
          suffix="€"
        />
        <NumberField
          id={`${idPrefix}-venta`}
          label="Venta"
          value={salePrice}
          onChange={onSalePriceChange}
          suffix="€"
        />
      </div>
    </div>
  );
}

interface TimeTemplateRowProps {
  id: string;
  label: string;
  description: string;
  quantity: number;
  minutesPerUnit: number;
  subtotalMinutes: number;
  onQuantityChange?: (value: number) => void;
  onMinutesChange?: (value: number) => void;
  derivedLabel?: string;
}

function TimeTemplateRow({
  id,
  label,
  description,
  quantity,
  minutesPerUnit,
  subtotalMinutes,
  onQuantityChange,
  onMinutesChange,
  derivedLabel,
}: TimeTemplateRowProps) {
  return (
    <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:grid-cols-[minmax(180px,1.5fr)_minmax(110px,0.65fr)_minmax(130px,0.75fr)_minmax(100px,0.55fr)] sm:items-end">
      <div className="self-center">
        <p className="font-bold text-slate-900">{label}</p>
        <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
      </div>
      <NumberField
        id={`${id}-quantity`}
        label="Cantidad"
        value={quantity}
        onChange={onQuantityChange ?? (() => undefined)}
        min={0}
        step={1}
        readOnly={!onQuantityChange}
      />
      <NumberField
        id={`${id}-minutes`}
        label={derivedLabel ?? 'Minutos / unidad'}
        value={minutesPerUnit}
        onChange={onMinutesChange ?? (() => undefined)}
        min={0}
        step={1}
        suffix="min"
        readOnly={!onMinutesChange}
      />
      <div className="rounded-xl bg-white px-3 py-2.5 shadow-sm ring-1 ring-slate-200">
        <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">Subtotal</p>
        <p className="mt-1 text-lg font-black text-[#310984]">{subtotalMinutes} min</p>
      </div>
    </div>
  );
}

const formatDuration = (minutes: number) => {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours === 0) return `${remainingMinutes} min`;
  if (remainingMinutes === 0) return `${hours} h`;
  return `${hours} h ${remainingMinutes} min`;
};

interface SummaryCardProps {
  label: string;
  value: string;
  helper: string;
  tone?: 'neutral' | 'positive' | 'warning';
}

function SummaryCard({ label, value, helper, tone = 'neutral' }: SummaryCardProps) {
  const toneClasses = {
    neutral: 'border-slate-200 bg-white text-slate-950',
    positive: 'border-emerald-200 bg-emerald-50 text-emerald-950',
    warning: 'border-amber-200 bg-amber-50 text-amber-950',
  };

  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${toneClasses[tone]}`}>
      <p className="text-xs font-black uppercase tracking-[0.16em] opacity-60">{label}</p>
      <p className="mt-2 text-2xl font-black tracking-tight">{value}</p>
      <p className="mt-1 text-xs font-medium opacity-65">{helper}</p>
    </div>
  );
}

export function BudgetEstimatorPage() {
  const [clientName, setClientName] = useState('');
  const [propertyName, setPropertyName] = useState('');
  const [featureCounts, setFeatureCounts] = useState<CleaningFeatureCounts>({
    ...DEFAULT_CLEANING_FEATURE_COUNTS,
  });
  const [timeTemplate, setTimeTemplate] = useState<CleaningTimeTemplate>({
    ...DEFAULT_CLEANING_TIME_TEMPLATE,
  });
  const [monthlyRotations, setMonthlyRotations] = useState(1);
  const [laborCostPerHour, setLaborCostPerHour] = useState(
    DEFAULT_BUDGET_RATES.laborCostPerHour,
  );
  const [routeAllocationPerHour, setRouteAllocationPerHour] = useState(
    DEFAULT_BUDGET_RATES.routeAllocationPerHour,
  );
  const [cleaningSalePricePerHour, setCleaningSalePricePerHour] = useState(
    DEFAULT_BUDGET_RATES.cleaningSalePricePerHour,
  );
  const [laundryCost, setLaundryCost] = useState(0);
  const [laundrySalePrice, setLaundrySalePrice] = useState(0);
  const [amenitiesCost, setAmenitiesCost] = useState(0);
  const [amenitiesSalePrice, setAmenitiesSalePrice] = useState(0);
  const [otherCost, setOtherCost] = useState(0);
  const [otherSalePrice, setOtherSalePrice] = useState(0);

  const updateFeatureCount = (key: keyof CleaningFeatureCounts, value: number) => {
    setFeatureCounts((current) => ({ ...current, [key]: value }));
  };

  const updateTemplateMinutes = (key: keyof CleaningTimeTemplate, value: number) => {
    setTimeTemplate((current) => ({ ...current, [key]: value }));
  };

  const timeCalculation = useMemo(() => {
    try {
      return {
        data: calculateCleaningTimeEstimate({
          counts: featureCounts,
          minutes: timeTemplate,
        }),
        error: null,
      };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error.message : 'No se pudo calcular el tiempo de limpieza',
      };
    }
  }, [featureCounts, timeTemplate]);

  const calculation = useMemo(() => {
    if (!timeCalculation.data) {
      return { data: null, error: timeCalculation.error };
    }

    try {
      return {
        data: calculateTouristApartmentBudget({
          cleaningHours: timeCalculation.data.cleaningHours,
          monthlyRotations,
          rates: {
            laborCostPerHour,
            routeAllocationPerHour,
            cleaningSalePricePerHour,
          },
          laundry: { cost: laundryCost, salePrice: laundrySalePrice },
          amenities: { cost: amenitiesCost, salePrice: amenitiesSalePrice },
          other: { cost: otherCost, salePrice: otherSalePrice },
        }),
        error: null,
      };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error.message : 'No se pudo calcular el presupuesto',
      };
    }
  }, [
    amenitiesCost,
    amenitiesSalePrice,
    cleaningSalePricePerHour,
    laborCostPerHour,
    laundryCost,
    laundrySalePrice,
    monthlyRotations,
    otherCost,
    otherSalePrice,
    routeAllocationPerHour,
    timeCalculation,
  ]);

  const timeEstimate = timeCalculation.data;
  const result = calculation.data;
  const isProfitable = (result?.rotation.contribution ?? 0) >= 0;

  return (
    <div className="min-h-full bg-[#f6f5f8]">
      <div className="mx-auto max-w-[1500px] space-y-6 p-4 sm:p-6 lg:p-8">
        <section className="overflow-hidden rounded-[2rem] bg-[#210554] text-white shadow-[0_24px_80px_rgba(49,9,132,0.22)]">
          <div className="grid gap-6 bg-[radial-gradient(circle_at_top_right,rgba(190,170,255,0.32),transparent_24rem)] p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-end">
            <div className="max-w-3xl">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <Badge className="border-white/20 bg-white/10 text-white hover:bg-white/10">
                  Simulador sin guardado
                </Badge>
                <Badge className="border-emerald-300/25 bg-emerald-300/20 text-emerald-50 hover:bg-emerald-300/20">
                  Primera versión
                </Badge>
              </div>
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-white/10 p-3 shadow-inner">
                  <Calculator className="h-7 w-7" />
                </div>
                <div>
                  <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
                    Presupuestador turístico
                  </h1>
                  <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-white/70 sm:text-base">
                    Simula el coste completo y la contribución de cada rotación antes de presentar una oferta.
                  </p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 rounded-2xl border border-white/10 bg-black/10 p-3 text-center backdrop-blur">
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-white/50">Coste base</p>
                <p className="mt-1 text-sm font-black">15,50 €/h</p>
              </div>
              <div className="border-x border-white/10 px-2">
                <p className="text-[10px] font-black uppercase tracking-wider text-white/50">Incluye</p>
                <p className="mt-1 text-sm font-black">1 €/h de ruta</p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-white/50">Venta</p>
                <p className="mt-1 text-sm font-black">19,50 €/h</p>
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
          <div className="space-y-6">
            <Card className="rounded-3xl border-slate-200 shadow-sm">
              <CardHeader className="border-b border-slate-100 pb-5">
                <CardTitle className="flex items-center gap-3 text-xl">
                  <Building2 className="h-5 w-5 text-[#310984]" />
                  Cliente y escenario
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 pt-6 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="client-name" className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                    Cliente o prospecto
                  </Label>
                  <Input
                    id="client-name"
                    value={clientName}
                    onChange={(event) => setClientName(event.target.value)}
                    placeholder="Ej. Edificio Marina"
                    className="h-11 rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="property-name" className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                    Apartamento o tipología
                  </Label>
                  <Input
                    id="property-name"
                    value={propertyName}
                    onChange={(event) => setPropertyName(event.target.value)}
                    placeholder="Ej. Apartamento de 2 dormitorios"
                    className="h-11 rounded-xl"
                  />
                </div>
                <div className="rounded-2xl border border-violet-100 bg-violet-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-violet-700">
                    Tiempo calculado
                  </p>
                  <p className="mt-2 text-2xl font-black text-[#310984]">
                    {timeEstimate ? formatDuration(timeEstimate.roundedMinutes) : '—'}
                  </p>
                  <p className="mt-1 text-xs text-violet-700">Redondeado al siguiente bloque de 15 min</p>
                </div>
                <NumberField
                  id="monthly-rotations"
                  label="Rotaciones mensuales"
                  value={monthlyRotations}
                  onChange={setMonthlyRotations}
                  min={1}
                  step={1}
                />
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-slate-200 shadow-sm">
              <CardHeader className="border-b border-slate-100 pb-5">
                <CardTitle className="flex items-center gap-3 text-xl">
                  <Clock3 className="h-5 w-5 text-[#310984]" />
                  Plantilla de tiempos de limpieza
                </CardTitle>
                <p className="text-sm text-slate-500">
                  Ajusta cantidades y minutos de referencia. La habitación cubre superficies y suelo; hacer las camas se suma aparte.
                </p>
              </CardHeader>
              <CardContent className="space-y-3 pt-6">
                {timeCalculation.error && (
                  <div role="alert" aria-live="polite" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800">
                    {timeCalculation.error}
                  </div>
                )}

                <TimeTemplateRow
                  id="fixed-time"
                  label="Tiempo fijo"
                  description="Entrada, preparación, revisión inicial y control final."
                  quantity={1}
                  minutesPerUnit={timeTemplate.fixed}
                  subtotalMinutes={timeEstimate?.lineMinutes.fixed ?? 0}
                  onMinutesChange={(value) => updateTemplateMinutes('fixed', value)}
                />
                <TimeTemplateRow
                  id="kitchens"
                  label="Cocinas"
                  description="Limpieza estándar de cocina y superficies habituales."
                  quantity={featureCounts.kitchens}
                  minutesPerUnit={timeTemplate.kitchen}
                  subtotalMinutes={timeEstimate?.lineMinutes.kitchens ?? 0}
                  onQuantityChange={(value) => updateFeatureCount('kitchens', value)}
                  onMinutesChange={(value) => updateTemplateMinutes('kitchen', value)}
                />
                <TimeTemplateRow
                  id="bathrooms"
                  label="Baños"
                  description="Sanitarios, ducha o bañera, lavabo, espejo y suelo."
                  quantity={featureCounts.bathrooms}
                  minutesPerUnit={timeTemplate.bathroom}
                  subtotalMinutes={timeEstimate?.lineMinutes.bathrooms ?? 0}
                  onQuantityChange={(value) => updateFeatureCount('bathrooms', value)}
                  onMinutesChange={(value) => updateTemplateMinutes('bathroom', value)}
                />
                <TimeTemplateRow
                  id="bedrooms"
                  label="Habitaciones"
                  description="Polvo, mobiliario, revisión y suelo. No incluye hacer camas."
                  quantity={featureCounts.bedrooms}
                  minutesPerUnit={timeTemplate.bedroom}
                  subtotalMinutes={timeEstimate?.lineMinutes.bedrooms ?? 0}
                  onQuantityChange={(value) => updateFeatureCount('bedrooms', value)}
                  onMinutesChange={(value) => updateTemplateMinutes('bedroom', value)}
                />
                <TimeTemplateRow
                  id="double-beds"
                  label="Camas de matrimonio"
                  description="Retirada de ropa usada y preparación completa de la cama."
                  quantity={featureCounts.doubleBeds}
                  minutesPerUnit={timeTemplate.doubleBed}
                  subtotalMinutes={timeEstimate?.lineMinutes.doubleBeds ?? 0}
                  onQuantityChange={(value) => updateFeatureCount('doubleBeds', value)}
                  onMinutesChange={(value) => updateTemplateMinutes('doubleBed', value)}
                />
                <TimeTemplateRow
                  id="single-beds"
                  label="Camas individuales"
                  description="Camas individuales que no forman parte de una litera."
                  quantity={featureCounts.singleBeds}
                  minutesPerUnit={timeTemplate.singleBed}
                  subtotalMinutes={timeEstimate?.lineMinutes.singleBeds ?? 0}
                  onQuantityChange={(value) => updateFeatureCount('singleBeds', value)}
                  onMinutesChange={(value) => updateTemplateMinutes('singleBed', value)}
                />
                <TimeTemplateRow
                  id="bunk-beds"
                  label="Literas"
                  description="Cada litera añade automáticamente dos camas individuales."
                  quantity={featureCounts.bunkBeds}
                  minutesPerUnit={timeTemplate.singleBed * 2}
                  subtotalMinutes={timeEstimate?.lineMinutes.bunkBeds ?? 0}
                  onQuantityChange={(value) => updateFeatureCount('bunkBeds', value)}
                  derivedLabel="2 × cama individual"
                />
                <TimeTemplateRow
                  id="terraces"
                  label="Terrazas"
                  description="Barrido, mobiliario y repaso estándar de zona exterior."
                  quantity={featureCounts.terraces}
                  minutesPerUnit={timeTemplate.terrace}
                  subtotalMinutes={timeEstimate?.lineMinutes.terraces ?? 0}
                  onQuantityChange={(value) => updateFeatureCount('terraces', value)}
                  onMinutesChange={(value) => updateTemplateMinutes('terrace', value)}
                />

                {timeEstimate && (
                  <div className="grid gap-3 rounded-2xl bg-[#210554] p-4 text-white sm:grid-cols-3">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-wider text-white/60">Tiempo calculado</p>
                      <p className="mt-1 text-xl font-black">{formatDuration(timeEstimate.rawMinutes)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-wider text-white/60">Tiempo presupuestado</p>
                      <p className="mt-1 text-xl font-black">{formatDuration(timeEstimate.roundedMinutes)}</p>
                      <p className="mt-1 text-xs text-white/60">Redondeo superior a 15 min</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-wider text-white/60">Camas individuales equivalentes</p>
                      <p className="mt-1 text-xl font-black">{timeEstimate.equivalentSingleBeds}</p>
                      <p className="mt-1 text-xs text-white/60">Incluye 2 por cada litera</p>
                    </div>
                  </div>
                )}

                <div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
                  <Info className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                  <p>
                    Estos minutos son una calibración provisional y editable. Debemos contrastarlos con limpiezas reales antes de convertirlos en una plantilla guardada por cliente.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-slate-200 shadow-sm">
              <CardHeader className="border-b border-slate-100 pb-5">
                <CardTitle className="flex items-center gap-3 text-xl">
                  <CircleDollarSign className="h-5 w-5 text-[#310984]" />
                  Tarifas de limpieza
                </CardTitle>
                <p className="text-sm text-slate-500">
                  Los valores Limpatex aparecen precargados, pero se pueden ajustar para simular cada cliente.
                </p>
              </CardHeader>
              <CardContent className="grid gap-4 pt-6 sm:grid-cols-3">
                <NumberField
                  id="labor-cost"
                  label="Coste laboral / hora"
                  value={laborCostPerHour}
                  onChange={setLaborCostPerHour}
                  suffix="€"
                />
                <NumberField
                  id="route-allocation"
                  label="Ruta imputada / hora"
                  value={routeAllocationPerHour}
                  onChange={setRouteAllocationPerHour}
                  suffix="€"
                />
                <NumberField
                  id="cleaning-sale-price"
                  label="Venta / hora"
                  value={cleaningSalePricePerHour}
                  onChange={setCleaningSalePricePerHour}
                  suffix="€"
                />
                <div className="sm:col-span-3 flex gap-3 rounded-2xl border border-violet-100 bg-violet-50 p-4 text-sm text-violet-950">
                  <Truck className="mt-0.5 h-5 w-5 shrink-0 text-[#310984]" />
                  <p>
                    El euro de ruta se suma al coste interno de cada hora de limpieza. No se vuelve a cobrar como coste aparte en este cálculo.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-slate-200 shadow-sm">
              <CardHeader className="border-b border-slate-100 pb-5">
                <CardTitle className="flex items-center gap-3 text-xl">
                  <PackageCheck className="h-5 w-5 text-[#310984]" />
                  Otros servicios por rotación
                </CardTitle>
                <p className="text-sm text-slate-500">
                  Introduce el coste real para Limpatex y el precio que se presentará al cliente.
                </p>
              </CardHeader>
              <CardContent className="grid gap-4 pt-6 lg:grid-cols-3">
                <CostSaleFields
                  idPrefix="laundry"
                  title="Lavandería"
                  description="Importe estimado de la lavandería externa."
                  icon={Shirt}
                  cost={laundryCost}
                  salePrice={laundrySalePrice}
                  onCostChange={setLaundryCost}
                  onSalePriceChange={setLaundrySalePrice}
                />
                <CostSaleFields
                  idPrefix="amenities"
                  title="Amenities"
                  description="Pack y consumibles incluidos en la bolsa."
                  icon={Sparkles}
                  cost={amenitiesCost}
                  salePrice={amenitiesSalePrice}
                  onCostChange={setAmenitiesCost}
                  onSalePriceChange={setAmenitiesSalePrice}
                />
                <CostSaleFields
                  idPrefix="other"
                  title="Otros conceptos"
                  description="Aparcamiento, suplemento u otro coste directo."
                  icon={Truck}
                  cost={otherCost}
                  salePrice={otherSalePrice}
                  onCostChange={setOtherCost}
                  onSalePriceChange={setOtherSalePrice}
                />
              </CardContent>
            </Card>
          </div>

          <aside className="space-y-6 xl:sticky xl:top-6 xl:self-start">
            <Card className="overflow-hidden rounded-3xl border-slate-200 shadow-lg shadow-slate-200/50">
              <CardHeader className="bg-slate-950 text-white">
                <CardTitle className="flex items-center justify-between gap-4 text-xl">
                  Resultado por rotación
                  <Calculator className="h-5 w-5 text-violet-300" />
                </CardTitle>
                <p className="text-sm text-white/60">
                  {clientName || 'Cliente sin identificar'} · {propertyName || 'Apartamento sin identificar'}
                </p>
              </CardHeader>
              <CardContent className="space-y-5 pt-6">
                {calculation.error && (
                  <div role="alert" aria-live="polite" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800">
                    {calculation.error}
                  </div>
                )}

                {result && (
                  <>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <SummaryCard
                        label="Coste completo"
                        value={currencyFormatter.format(result.rotation.totalCost)}
                        helper="Sin IVA"
                      />
                      <SummaryCard
                        label="Venta propuesta"
                        value={currencyFormatter.format(result.rotation.totalRevenue)}
                        helper="Sin IVA"
                      />
                      <SummaryCard
                        label="Contribución"
                        value={currencyFormatter.format(result.rotation.contribution)}
                        helper="Antes de estructura general"
                        tone={isProfitable ? 'positive' : 'warning'}
                      />
                      <SummaryCard
                        label="Margen"
                        value={`${percentageFormatter.format(result.rotation.marginPercentage)} %`}
                        helper="Sobre la venta"
                        tone={isProfitable ? 'positive' : 'warning'}
                      />
                    </div>

                    <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                        Desglose interno de limpieza
                      </p>
                      {timeEstimate && (
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-500">Tiempo presupuestado</span>
                          <strong>{formatDuration(timeEstimate.roundedMinutes)}</strong>
                        </div>
                      )}
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Coste laboral</span>
                        <strong>{currencyFormatter.format(result.cleaning.laborCost)}</strong>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Ruta imputada</span>
                        <strong>{currencyFormatter.format(result.cleaning.routeAllocation)}</strong>
                      </div>
                      <div className="flex justify-between border-t border-slate-200 pt-3 text-sm">
                        <span className="font-semibold text-slate-700">Coste total de limpieza</span>
                        <strong>{currencyFormatter.format(result.cleaning.totalCost)}</strong>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="font-semibold text-slate-700">Venta de limpieza</span>
                        <strong>{currencyFormatter.format(result.cleaning.salePrice)}</strong>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {result && (
              <Card className="rounded-3xl border-[#310984]/20 bg-[#310984] text-white shadow-lg shadow-violet-200/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-3 text-lg">
                    <CalendarRange className="h-5 w-5 text-violet-200" />
                    Escenario mensual
                  </CardTitle>
                  <p className="text-sm text-white/60">
                    Proyección para {monthlyRotations} {monthlyRotations === 1 ? 'rotación' : 'rotaciones'}.
                  </p>
                </CardHeader>
                <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wider text-white/50">Coste</p>
                    <p className="mt-1 text-lg font-black">{currencyFormatter.format(result.monthly.totalCost)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wider text-white/50">Venta</p>
                    <p className="mt-1 text-lg font-black">{currencyFormatter.format(result.monthly.totalRevenue)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wider text-white/50">Contribución</p>
                    <p className="mt-1 text-lg font-black">{currencyFormatter.format(result.monthly.contribution)}</p>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="flex gap-3 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm leading-6 text-sky-950">
              <Info className="mt-0.5 h-5 w-5 shrink-0 text-sky-600" />
              <p>
                Esta primera versión sirve para validar la fórmula. No guarda clientes, propiedades ni presupuestos y todavía no genera PDF.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
