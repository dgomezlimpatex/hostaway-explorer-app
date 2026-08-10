import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  Calculator,
  CheckCircle2,
  Clock3,
  FileDown,
  History,
  MapPinned,
  Save,
  Send,
  Settings2,
  Sparkles,
  Truck,
  UserPlus,
  XCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSede } from '@/contexts/SedeContext';
import { useClients, useCreateClient } from '@/hooks/useClients';
import { useProperties } from '@/hooks/useProperties';

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
import {
  DEFAULT_LOGISTICS_RATES,
  type LogisticsDensity,
} from './logisticsCalculator';
import {
  activateTouristBudget,
  createBudgetRateProfile,
  createBudgetRateProfileVersion,
  createTouristBudget,
  getTouristBudget,
  listBudgetRateProfiles,
  listTouristBudgets,
  saveTouristBudgetVersion,
  transitionTouristBudget,
  uploadBudgetPdf,
  type BudgetItemDraft,
  type BudgetRecord,
  type BudgetSnapshot,
  type BudgetStatus,
  type BudgetTotalsSnapshot,
} from './budgetEstimatorService';
import {
  downloadCommercialBudgetPdf,
  getCommercialPdfFileName,
} from './budgetPdf';

const money = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });
const pct = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const statusLabels: Record<BudgetStatus, string> = {
  draft: 'Borrador', review: 'En revisión', sent: 'Enviado', accepted: 'Aceptado',
  rejected: 'Rechazado', expired: 'Caducado', archived: 'Archivado',
};

const statusVariant = (status: BudgetStatus) => {
  if (status === 'accepted') return 'default' as const;
  if (status === 'rejected' || status === 'expired') return 'destructive' as const;
  return 'secondary' as const;
};

const formatDuration = (minutes: number) => {
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  if (!hours) return `${remaining} min`;
  return remaining ? `${hours} h ${remaining} min` : `${hours} h`;
};

const numberValue = (value: string, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

interface NumberFieldProps {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
  step?: number;
  suffix?: string;
  min?: number;
  readOnly?: boolean;
}

function NumberField({ id, label, value, onChange, step = 1, suffix, min = 0, readOnly = false }: NumberFieldProps) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type="number"
          min={min}
          step={step}
          value={value}
          readOnly={readOnly}
          onChange={(event) => onChange(numberValue(event.target.value))}
          className={`h-10 rounded-xl pr-12 font-semibold ${readOnly ? 'bg-slate-100' : 'bg-white'}`}
        />
        {suffix && <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-bold text-slate-400">{suffix}</span>}
      </div>
    </div>
  );
}

function FeatureField({ id, label, value, onChange }: { id: string; label: string; value: number; onChange: (value: number) => void }) {
  return <NumberField id={id} label={label} value={value} onChange={onChange} step={1} />;
}

function LineFields({
  prefix,
  label,
  cost,
  salePrice,
  onCost,
  onSale,
}: {
  prefix: string;
  label: string;
  cost: number;
  salePrice: number;
  onCost: (value: number) => void;
  onSale: (value: number) => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="mb-3 font-bold text-slate-900">{label}</p>
      <div className="grid grid-cols-2 gap-3">
        <NumberField id={`${prefix}-cost`} label="Coste interno" value={cost} onChange={onCost} step={0.01} suffix="€" />
        <NumberField id={`${prefix}-sale`} label="Precio de venta" value={salePrice} onChange={onSale} step={0.01} suffix="€" />
      </div>
    </div>
  );
}

export function BudgetEstimatorPage() {
  const { activeSede } = useSede();
  const queryClient = useQueryClient();
  const { data: clients = [] } = useClients();
  const { data: properties = [] } = useProperties();
  const createClient = useCreateClient();

  const [selectedBudgetId, setSelectedBudgetId] = useState<string | null>(null);
  const [currentVersionId, setCurrentVersionId] = useState<string | null>(null);
  const [currentStatus, setCurrentStatus] = useState<BudgetStatus>('draft');
  const [title, setTitle] = useState('Presupuesto de limpieza turística');
  const [clientName, setClientName] = useState('');
  const [clientCif, setClientCif] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientBillingAddress, setClientBillingAddress] = useState('');
  const [clientPostalCode, setClientPostalCode] = useState('');
  const [clientCity, setClientCity] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [prospectName, setProspectName] = useState('');
  const [propertyName, setPropertyName] = useState('Apartamento turístico');
  const [propertyAddress, setPropertyAddress] = useState('');
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [validityDate, setValidityDate] = useState('');
  const [monthlyRotations, setMonthlyRotations] = useState(1);
  const [featureCounts, setFeatureCounts] = useState<CleaningFeatureCounts>({ ...DEFAULT_CLEANING_FEATURE_COUNTS });
  const [timeTemplate, setTimeTemplate] = useState<CleaningTimeTemplate>({ ...DEFAULT_CLEANING_TIME_TEMPLATE });
  const [laborCostPerHour, setLaborCostPerHour] = useState(DEFAULT_BUDGET_RATES.laborCostPerHour);
  const [routeAllocationPerHour, setRouteAllocationPerHour] = useState(DEFAULT_BUDGET_RATES.routeAllocationPerHour);
  const [cleaningSalePricePerHour, setCleaningSalePricePerHour] = useState(DEFAULT_BUDGET_RATES.cleaningSalePricePerHour);
  const [laundryCost, setLaundryCost] = useState(0);
  const [laundrySalePrice, setLaundrySalePrice] = useState(0);
  const [amenitiesCost, setAmenitiesCost] = useState(0);
  const [amenitiesSalePrice, setAmenitiesSalePrice] = useState(0);
  const [otherCost, setOtherCost] = useState(0);
  const [otherSalePrice, setOtherSalePrice] = useState(0);
  const [logisticsEnabled, setLogisticsEnabled] = useState(false);
  const [density, setDensity] = useState<LogisticsDensity>('B');
  const [bags, setBags] = useState(0);
  const [stops, setStops] = useState(1);
  const [kilometers, setKilometers] = useState(0);
  const [routeHours, setRouteHours] = useState(0);
  const [logisticsSalePrice, setLogisticsSalePrice] = useState(0);
  const [profileName, setProfileName] = useState('');
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const budgetsQuery = useQuery({
    queryKey: ['tourist-budgets', activeSede?.id],
    queryFn: () => listTouristBudgets(activeSede!.id),
    enabled: !!activeSede?.id,
  });
  const profilesQuery = useQuery({
    queryKey: ['budget-rate-profiles', activeSede?.id, selectedClientId],
    queryFn: () => listBudgetRateProfiles(activeSede!.id, selectedClientId),
    enabled: !!activeSede?.id,
  });

  const timeCalculation = useMemo(() => {
    try {
      return { data: calculateCleaningTimeEstimate({ counts: featureCounts, minutes: timeTemplate }), error: null };
    } catch (error) {
      return { data: null, error: error instanceof Error ? error.message : 'No se pudo calcular el tiempo' };
    }
  }, [featureCounts, timeTemplate]);

  const logisticsInput = useMemo(() => logisticsEnabled ? {
    mode: 'activity-based' as const,
    density,
    bags,
    stops,
    kilometers,
    routeHours,
    rates: DEFAULT_LOGISTICS_RATES,
    salePrice: logisticsSalePrice,
  } : undefined, [bags, density, kilometers, logisticsEnabled, logisticsSalePrice, routeHours, stops]);

  const calculation = useMemo(() => {
    if (!timeCalculation.data) return { data: null, error: timeCalculation.error };
    try {
      return {
        data: calculateTouristApartmentBudget({
          cleaningHours: timeCalculation.data.cleaningHours,
          monthlyRotations,
          rates: { laborCostPerHour, routeAllocationPerHour, cleaningSalePricePerHour },
          logistics: logisticsInput,
          laundry: { cost: laundryCost, salePrice: laundrySalePrice },
          amenities: { cost: amenitiesCost, salePrice: amenitiesSalePrice },
          other: { cost: otherCost, salePrice: otherSalePrice },
        }),
        error: null,
      };
    } catch (error) {
      return { data: null, error: error instanceof Error ? error.message : 'No se pudo calcular el presupuesto' };
    }
  }, [amenitiesCost, amenitiesSalePrice, cleaningSalePricePerHour, laborCostPerHour, laundryCost, laundrySalePrice, logisticsInput, monthlyRotations, otherCost, otherSalePrice, routeAllocationPerHour, timeCalculation]);

  const result = calculation.data;
  const currentClient = clients.find((client) => client.id === selectedClientId);
  const clientProperties = properties.filter((property) => !selectedClientId || property.clienteId === selectedClientId);
  const budgets = budgetsQuery.data || [];

  const buildItem = (): BudgetItemDraft | null => {
    if (!result || !timeCalculation.data) return null;
    return {
      propertyId: selectedPropertyId,
      propertyCode: properties.find((property) => property.id === selectedPropertyId)?.codigo || '',
      propertyName,
      propertyAddress,
      featureCounts,
      timeInput: timeTemplate,
      logisticsInput,
      serviceLines: {
        laundry: { cost: laundryCost, salePrice: laundrySalePrice },
        amenities: { cost: amenitiesCost, salePrice: amenitiesSalePrice },
        other: { cost: otherCost, salePrice: otherSalePrice },
      },
      resultSnapshot: {
        durationMinutes: timeCalculation.data.roundedMinutes,
        salePrice: result.cleaning.salePrice,
        monthlySalePrice: result.cleaning.salePrice * monthlyRotations,
        rotation: result.rotation,
        monthly: result.monthly,
      },
      activationAction: selectedPropertyId ? 'update' : 'create',
    };
  };

  const buildSnapshot = (): BudgetSnapshot | null => {
    if (!result) return null;
    return {
      clientName: currentClient?.nombre || clientName || prospectName,
      propertyName,
      monthlyRotations,
      rates: { laborCostPerHour, routeAllocationPerHour, cleaningSalePricePerHour },
      featureCounts,
      timeTemplate,
      logistics: logisticsInput,
    };
  };

  const totals: BudgetTotalsSnapshot | null = result ? {
    totalCost: result.rotation.totalCost,
    totalRevenue: result.rotation.totalRevenue,
    contribution: result.rotation.contribution,
    marginPercentage: result.rotation.marginPercentage,
    monthlyCost: result.monthly.totalCost,
    monthlyRevenue: result.monthly.totalRevenue,
    monthlyContribution: result.monthly.contribution,
  } : null;

  const saveBudget = useMutation({
    mutationFn: async () => {
      if (!activeSede?.id) throw new Error('Selecciona una sede activa antes de guardar');
      if (!title.trim()) throw new Error('El título del presupuesto es obligatorio');
      const snapshot = buildSnapshot();
      const item = buildItem();
      if (!snapshot || !totals || !item) throw new Error('Completa una configuración válida antes de guardar');
      if (selectedBudgetId) {
        return saveTouristBudgetVersion({ budgetId: selectedBudgetId, snapshot, totals, items: [item], changeReason: 'Edición desde el presupuestador' });
      }
      return createTouristBudget({
        sedeId: activeSede.id,
        clientId: selectedClientId,
        title,
        prospectName: currentClient?.nombre || clientName || prospectName,
        validityDate,
        snapshot,
        totals,
        items: [item],
      });
    },
    onSuccess: (saved) => {
      setSelectedBudgetId(saved.budgetId);
      setCurrentVersionId(saved.versionId);
      setCurrentStatus('draft');
      setNotice('Presupuesto guardado con snapshot de cálculo y versión de tarifas.');
      queryClient.invalidateQueries({ queryKey: ['tourist-budgets'] });
    },
    onError: (error) => setNotice(error instanceof Error ? error.message : 'No se pudo guardar el presupuesto'),
  });

  const loadBudget = async (budget: BudgetRecord) => {
    try {
      const detail = await getTouristBudget(budget.id);
      const item = detail.items[0];
      const snapshot = detail.input_snapshot;
      setSelectedBudgetId(budget.id);
      setCurrentVersionId(detail.id);
      setCurrentStatus(budget.status);
      setTitle(budget.title);
      setSelectedClientId(budget.client_id);
      setClientName(snapshot.clientName || budget.prospect_name || '');
      setProspectName(budget.prospect_name || '');
      setMonthlyRotations(snapshot.monthlyRotations || budget.monthly_rotations || 1);
      setFeatureCounts(snapshot.featureCounts || DEFAULT_CLEANING_FEATURE_COUNTS);
      setTimeTemplate(snapshot.timeTemplate || DEFAULT_CLEANING_TIME_TEMPLATE);
      setLaborCostPerHour(Number(snapshot.rates?.laborCostPerHour ?? DEFAULT_BUDGET_RATES.laborCostPerHour));
      setRouteAllocationPerHour(Number(snapshot.rates?.routeAllocationPerHour ?? DEFAULT_BUDGET_RATES.routeAllocationPerHour));
      setCleaningSalePricePerHour(Number(snapshot.rates?.cleaningSalePricePerHour ?? DEFAULT_BUDGET_RATES.cleaningSalePricePerHour));
      if (item) {
        setSelectedPropertyId(item.propertyId || null);
        setPropertyName(item.propertyName);
        setPropertyAddress(item.propertyAddress || '');
        setLaundryCost(item.serviceLines.laundry.cost);
        setLaundrySalePrice(item.serviceLines.laundry.salePrice);
        setAmenitiesCost(item.serviceLines.amenities.cost);
        setAmenitiesSalePrice(item.serviceLines.amenities.salePrice);
        setOtherCost(item.serviceLines.other.cost);
        setOtherSalePrice(item.serviceLines.other.salePrice);
        setLogisticsEnabled(!!item.logisticsInput);
        if (item.logisticsInput) {
          setDensity(item.logisticsInput.density);
          setBags(item.logisticsInput.bags);
          setStops(item.logisticsInput.stops);
          setKilometers(item.logisticsInput.kilometers);
          setRouteHours(item.logisticsInput.routeHours);
          setLogisticsSalePrice(item.logisticsInput.salePrice || 0);
        }
      }
      setNotice(`Cargada la versión ${detail.version_number} de ${budget.quote_number}.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'No se pudo cargar el presupuesto');
    }
  };

  const transition = useMutation({
    mutationFn: (nextStatus: BudgetStatus) => {
      if (!selectedBudgetId) throw new Error('Guarda primero el presupuesto');
      return transitionTouristBudget(selectedBudgetId, nextStatus);
    },
    onSuccess: (data) => {
      setCurrentStatus(data.toStatus);
      setNotice(`Estado actualizado: ${statusLabels[data.toStatus]}.`);
      queryClient.invalidateQueries({ queryKey: ['tourist-budgets'] });
    },
    onError: (error) => setNotice(error instanceof Error ? error.message : 'No se pudo cambiar el estado'),
  });

  const activate = useMutation({
    mutationFn: async () => {
      if (!selectedBudgetId || !currentVersionId) throw new Error('Guarda el presupuesto antes de activarlo');
      if (currentStatus !== 'accepted') throw new Error('El presupuesto debe estar aceptado antes de activarlo');
      const item = buildItem();
      if (!item) throw new Error('No hay configuración operativa que activar');
      return activateTouristBudget({ budgetId: selectedBudgetId, versionId: currentVersionId, items: [item] });
    },
    onSuccess: (data) => {
      setNotice(data.idempotent ? 'La configuración ya estaba activada; no se duplicó.' : 'Configuración activada con snapshot de auditoría.');
      queryClient.invalidateQueries({ queryKey: ['properties'] });
    },
    onError: (error) => setNotice(error instanceof Error ? error.message : 'No se pudo activar la configuración'),
  });

  const generatePdf = async () => {
    if (!result || !timeCalculation.data) return;
    if (!selectedBudgetId || !currentVersionId) {
      setNotice('Guarda el presupuesto antes de registrar el PDF.');
      return;
    }
    const item = buildItem();
    if (!item) return;
    const pdfData = {
      quoteNumber: budgets.find((budget) => budget.id === selectedBudgetId)?.quote_number || 'PRESUPUESTO-BORRADOR',
      title,
      clientName: currentClient?.nombre || clientName || prospectName || 'A la atención del cliente',
      validityDate,
      terms: 'La propuesta queda sujeta a la disponibilidad operativa y a la aceptación del cliente.',
      monthlyRotations,
      items: [{
        name: item.propertyName,
        address: item.propertyAddress,
        durationMinutes: timeCalculation.data.roundedMinutes,
        salePrice: result.cleaning.salePrice,
        monthlySalePrice: result.cleaning.salePrice * monthlyRotations,
        extras: [
          { name: 'Lavandería', salePrice: laundrySalePrice },
          { name: 'Amenities', salePrice: amenitiesSalePrice },
          { name: 'Otros servicios', salePrice: otherSalePrice },
        ].filter((extra) => extra.salePrice > 0),
      }],
      totals: { totalRevenue: result.rotation.totalRevenue, monthlyRevenue: result.monthly.totalRevenue },
    };
    const blob = downloadCommercialBudgetPdf(pdfData);
    try {
      await uploadBudgetPdf({
        budgetId: selectedBudgetId,
        versionId: currentVersionId,
        quoteNumber: pdfData.quoteNumber,
        fileName: getCommercialPdfFileName(pdfData.quoteNumber),
        blob,
      });
      setNotice(`PDF comercial generado, subido a Storage y asociado a la versión (${Math.round(blob.size / 1024)} KB).`);
    } catch (error) {
      setNotice(error instanceof Error ? `${error.message}. El PDF sí se descargó, pero no se ha registrado como documento persistente.` : 'El PDF se descargó, pero no se pudo subir ni registrar en Storage.');
    }
  };

  const saveClient = async () => {
    if (!activeSede?.id) {
      setNotice('Selecciona una sede activa antes de crear un cliente.');
      return;
    }
    if (!clientName.trim() || !clientCif.trim() || !clientBillingAddress.trim() || !clientPostalCode.trim() || !clientCity.trim()) {
      setNotice('Para guardar un cliente nuevo necesitas nombre, CIF/NIF, dirección fiscal, código postal y ciudad.');
      return;
    }
    try {
      const created = await createClient.mutateAsync({
        nombre: clientName.trim(),
        cifNif: clientCif.trim(),
        telefono: clientPhone.trim(),
        email: clientEmail.trim(),
        direccionFacturacion: clientBillingAddress.trim(),
        codigoPostal: clientPostalCode.trim(),
        ciudad: clientCity.trim(),
        tipoServicio: 'limpieza-turistica',
        metodoPago: 'transferencia',
        supervisor: '',
        factura: true,
        isActive: true,
      });
      setSelectedClientId(created.id);
      setProspectName('');
      setNotice('Cliente guardado y vinculado al escenario.');
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'No se pudo guardar el cliente');
    }
  };

  const saveProfile = async () => {
    if (!activeSede?.id || !profileName.trim()) {
      setNotice('Indica un nombre para guardar el perfil tarifario.');
      return;
    }
    try {
      const created = await createBudgetRateProfile({
        sedeId: activeSede.id,
        clientId: selectedClientId,
        name: profileName,
        version: {
          laborCostPerHour,
          routeAllocationPerHour,
          cleaningSalePricePerHour,
          logisticsMode: logisticsEnabled ? 'activity-based' : 'provisional-hourly',
          timeTemplate,
          logisticsConfig: { bags, stops, kilometers, routeHours, density },
          defaultLines: { laundryCost, laundrySalePrice, amenitiesCost, amenitiesSalePrice, otherCost, otherSalePrice },
          commercialTerms: {},
        },
      });
      setSelectedProfileId(created.profile.id);
      setProfileName('');
      setNotice('Perfil tarifario creado como versión 1. Las versiones posteriores serán inmutables.');
      queryClient.invalidateQueries({ queryKey: ['budget-rate-profiles'] });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'No se pudo guardar el perfil tarifario');
    }
  };

  const saveProfileVersion = async () => {
    if (!selectedProfileId) {
      setNotice('Selecciona un perfil existente para crear una nueva versión.');
      return;
    }
    try {
      const profile = profilesQuery.data?.find((candidate) => candidate.id === selectedProfileId);
      const versions = profile?.versions || [];
      await createBudgetRateProfileVersion({
        profileId: selectedProfileId,
        versionNumber: versions.length + 1,
        version: {
          laborCostPerHour,
          routeAllocationPerHour,
          cleaningSalePricePerHour,
          logisticsMode: logisticsEnabled ? 'activity-based' : 'provisional-hourly',
          timeTemplate,
          logisticsConfig: { bags, stops, kilometers, routeHours, density },
          defaultLines: { laundryCost, laundrySalePrice, amenitiesCost, amenitiesSalePrice, otherCost, otherSalePrice },
          commercialTerms: {},
        },
      });
      setNotice(`Nueva versión tarifaria ${versions.length + 1} creada. Los presupuestos anteriores no cambian.`);
      queryClient.invalidateQueries({ queryKey: ['budget-rate-profiles'] });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'No se pudo crear la versión tarifaria');
    }
  };

  const nextStatus: BudgetStatus | null = currentStatus === 'draft' ? 'review' : currentStatus === 'review' ? 'sent' : currentStatus === 'sent' ? 'accepted' : null;
  const currentProperty = properties.find((property) => property.id === selectedPropertyId);

  const selectProperty = (value: string) => {
    if (value === 'new') {
      setSelectedPropertyId(null);
      setPropertyName('Nueva propiedad presupuestada');
      setPropertyAddress('');
      return;
    }
    const property = properties.find((candidate) => candidate.id === value);
    if (!property) return;
    setSelectedPropertyId(property.id);
    setPropertyName(property.nombre);
    setPropertyAddress(property.direccion);
    setFeatureCounts((current) => ({
      ...current,
      bathrooms: property.numeroBanos || current.bathrooms,
      kitchens: property.numeroCocinas || current.kitchens,
      doubleBeds: Math.floor((property.numeroCamas || 0) / 2),
      singleBeds: (property.numeroCamas || 0) % 2,
    }));
    if (property.duracionServicio) {
      const minutes = Math.max(15, Math.round(property.duracionServicio / 15) * 15);
      setTimeTemplate((current) => ({ ...current, fixed: Math.min(minutes, 120) }));
    }
  };

  return (
    <div className="min-h-full bg-[#f6f5f8]">
      <div className="mx-auto max-w-[1600px] space-y-5 p-4 sm:p-6 lg:p-8">
        <section className="overflow-hidden rounded-[2rem] bg-[#210554] text-white shadow-[0_24px_80px_rgba(49,9,132,0.2)]">
          <div className="grid gap-6 p-6 md:grid-cols-[1fr_auto] md:items-end md:p-8">
            <div>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Badge className="border-white/20 bg-white/10 text-white">Solo administración</Badge>
                <Badge className="border-white/20 bg-white/10 text-white">{activeSede?.nombre || 'Sin sede activa'}</Badge>
                {selectedBudgetId && <Badge className="border-white/20 bg-white/10 text-white">Estado del presupuesto: {statusLabels[currentStatus]}</Badge>}
              </div>
              <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Presupuestador persistente</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-white/75">Crea presupuestos versionados, calcula el coste logístico real, genera la vista comercial y activa después una configuración operativa revisable.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => { setSelectedBudgetId(null); setCurrentVersionId(null); setCurrentStatus('draft'); setNotice('Nuevo presupuesto listo.'); }}><Sparkles className="mr-2 h-4 w-4" />Nuevo</Button>
              <Button variant="outline" className="border-white/30 bg-transparent text-white hover:bg-white/10" onClick={() => budgetsQuery.refetch()}><History className="mr-2 h-4 w-4" />Actualizar bandeja</Button>
            </div>
          </div>
        </section>

        {notice && <div role="alert" aria-live="polite" className="rounded-2xl border border-[#cfc4f5] bg-[#f1edff] px-4 py-3 text-sm font-semibold text-[#310984]">{notice}</div>}
        {!activeSede && <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">Selecciona una sede activa antes de guardar, crear clientes o activar propiedades.</div>}

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <main className="space-y-5">
            <Card className="rounded-[1.5rem] border-slate-200 shadow-sm">
              <CardHeader><CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5 text-[#310984]" />Clientes y propiedades · Cliente y escenario</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2"><Label htmlFor="budget-title">Título</Label><Input id="budget-title" value={title} onChange={(event) => setTitle(event.target.value)} /></div>
                  <div className="space-y-2"><Label htmlFor="validity-date">Validez hasta</Label><Input id="validity-date" type="date" value={validityDate} onChange={(event) => setValidityDate(event.target.value)} /></div>
                </div>
                <div className="grid gap-4 lg:grid-cols-[1fr_1fr_auto]">
                  <div className="space-y-2"><Label htmlFor="existing-client">Cliente existente</Label><select id="existing-client" value={selectedClientId || ''} onChange={(event) => { const id = event.target.value || null; setSelectedClientId(id); const client = clients.find((candidate) => candidate.id === id); setClientName(client?.nombre || ''); }} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"><option value="">Prospecto / cliente nuevo</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.nombre}</option>)}</select></div>
                  <div className="space-y-2"><Label htmlFor="prospect-name">Nombre comercial</Label><Input id="prospect-name" value={selectedClientId ? clientName : prospectName} onChange={(event) => selectedClientId ? setClientName(event.target.value) : setProspectName(event.target.value)} placeholder="Cliente o prospecto" /></div>
                  <div className="flex items-end"><Button variant="outline" onClick={saveClient} disabled={createClient.isPending}><UserPlus className="mr-2 h-4 w-4" />Guardar cliente</Button></div>
                </div>
                {!selectedClientId && <div className="grid gap-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 md:grid-cols-2 lg:grid-cols-3"><div className="space-y-2"><Label htmlFor="client-cif">CIF/NIF para alta</Label><Input id="client-cif" value={clientCif} onChange={(event) => setClientCif(event.target.value)} placeholder="B00000000" /></div><div className="space-y-2"><Label htmlFor="client-email">Email</Label><Input id="client-email" type="email" value={clientEmail} onChange={(event) => setClientEmail(event.target.value)} /></div><div className="space-y-2"><Label htmlFor="client-phone">Teléfono</Label><Input id="client-phone" value={clientPhone} onChange={(event) => setClientPhone(event.target.value)} /></div><div className="space-y-2 lg:col-span-2"><Label htmlFor="client-billing-address">Dirección fiscal</Label><Input id="client-billing-address" value={clientBillingAddress} onChange={(event) => setClientBillingAddress(event.target.value)} placeholder="Calle, número, piso…" /></div><div className="space-y-2"><Label htmlFor="client-postal-code">Código postal</Label><Input id="client-postal-code" inputMode="numeric" value={clientPostalCode} onChange={(event) => setClientPostalCode(event.target.value)} /></div><div className="space-y-2"><Label htmlFor="client-city">Ciudad</Label><Input id="client-city" value={clientCity} onChange={(event) => setClientCity(event.target.value)} /></div><p className="text-xs leading-5 text-slate-500 md:col-span-2 lg:col-span-3">El alta guarda únicamente los datos fiscales introducidos aquí. No se reutiliza la dirección de la propiedad ni se crean valores ficticios.</p></div>}
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2"><Label htmlFor="property-select">Propiedad vinculada</Label><select id="property-select" value={selectedPropertyId || 'new'} onChange={(event) => selectProperty(event.target.value)} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"><option value="new">Nueva propiedad / tipología pendiente</option>{clientProperties.map((property) => <option key={property.id} value={property.id}>{property.codigo} · {property.nombre}</option>)}</select></div>
                  <div className="space-y-2"><Label htmlFor="property-name">Nombre de propiedad</Label><Input id="property-name" value={propertyName} onChange={(event) => setPropertyName(event.target.value)} /></div>
                </div>
                <div className="space-y-2"><Label htmlFor="property-address">Dirección</Label><Input id="property-address" value={propertyAddress} onChange={(event) => setPropertyAddress(event.target.value)} placeholder="Se conserva como propuesta hasta activar" /></div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500"><MapPinned className="h-4 w-4" />{currentProperty ? 'Datos precargados desde la propiedad existente; no se modifican al seleccionar.' : 'La propiedad nueva se creará solo después de aceptar y confirmar la activación.'}</div>
              </CardContent>
            </Card>

            <Card className="rounded-[1.5rem] border-slate-200 shadow-sm">
              <CardHeader><CardTitle className="flex items-center gap-2"><Clock3 className="h-5 w-5 text-[#310984]" />Plantilla de tiempos de limpieza</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-slate-500">El motor calcula el tiempo y aplica <strong>Redondeo superior a 15 min</strong>. Cada litera añade automáticamente dos camas individuales.</p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <FeatureField id="kitchens" label="Cocinas" value={featureCounts.kitchens} onChange={(value) => setFeatureCounts((current) => ({ ...current, kitchens: value }))} />
                  <FeatureField id="bathrooms" label="Baños" value={featureCounts.bathrooms} onChange={(value) => setFeatureCounts((current) => ({ ...current, bathrooms: value }))} />
                  <FeatureField id="bedrooms" label="Habitaciones" value={featureCounts.bedrooms} onChange={(value) => setFeatureCounts((current) => ({ ...current, bedrooms: value }))} />
                  <FeatureField id="terraces" label="Terrazas" value={featureCounts.terraces} onChange={(value) => setFeatureCounts((current) => ({ ...current, terraces: value }))} />
                  <FeatureField id="double-beds" label="Camas de matrimonio" value={featureCounts.doubleBeds} onChange={(value) => setFeatureCounts((current) => ({ ...current, doubleBeds: value }))} />
                  <FeatureField id="single-beds" label="Camas individuales" value={featureCounts.singleBeds} onChange={(value) => setFeatureCounts((current) => ({ ...current, singleBeds: value }))} />
                  <FeatureField id="bunk-beds" label="Literas" value={featureCounts.bunkBeds} onChange={(value) => setFeatureCounts((current) => ({ ...current, bunkBeds: value }))} />
                  <NumberField id="monthly-rotations" label="Rotaciones / mes" value={monthlyRotations} onChange={setMonthlyRotations} min={1} suffix="x" />
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{([
                  ['fixed', 'Tiempo fijo'], ['kitchen', 'Min / cocina'], ['bathroom', 'Min / baño'], ['bedroom', 'Min / habitación'], ['doubleBed', 'Min / cama matrimonio'], ['singleBed', 'Min / cama individual'], ['terrace', 'Min / terraza'],
                ] as Array<[keyof CleaningTimeTemplate, string]>).map(([key, label]) => <NumberField key={key} id={`time-${key}`} label={label} value={timeTemplate[key]} onChange={(value) => setTimeTemplate((current) => ({ ...current, [key]: value }))} suffix="min" />)}</div>
                {timeCalculation.error && <p className="text-sm font-semibold text-red-700">{timeCalculation.error}</p>}
                {timeCalculation.data && <div className="flex flex-wrap gap-3 rounded-2xl bg-slate-100 p-4 text-sm font-semibold text-slate-700"><span>Tiempo bruto: {timeCalculation.data.rawMinutes} min</span><span>Tiempo operativo: {formatDuration(timeCalculation.data.roundedMinutes)}</span><span>Camas individuales equivalentes: {timeCalculation.data.equivalentSingleBeds}</span></div>}
              </CardContent>
            </Card>

            <Card className="rounded-[1.5rem] border-slate-200 shadow-sm">
              <CardHeader><CardTitle className="flex items-center gap-2"><Truck className="h-5 w-5 text-[#310984]" />Logística por actividad</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold"><input type="checkbox" checked={logisticsEnabled} onChange={(event) => setLogisticsEnabled(event.target.checked)} />Activar coste logístico real por bolsa, parada, kilómetro, ruta y edificio.</label>
                {logisticsEnabled && <>
                  <div className="grid gap-3 sm:grid-cols-3"><div className="space-y-2"><Label htmlFor="density">Densidad del edificio</Label><select id="density" value={density} onChange={(event) => setDensity(event.target.value as LogisticsDensity)} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"><option value="A">A · Baja</option><option value="B">B · Normal</option><option value="C">C · Alta</option></select></div><NumberField id="bags" label="Bolsas" value={bags} onChange={setBags} /><NumberField id="stops" label="Paradas" value={stops} onChange={setStops} /></div>
                  <div className="grid gap-3 sm:grid-cols-3"><NumberField id="kilometers" label="Kilómetros" value={kilometers} onChange={setKilometers} step={0.1} suffix="km" /><NumberField id="route-hours" label="Horas de ruta" value={routeHours} onChange={setRouteHours} step={0.25} suffix="h" /><NumberField id="logistics-sale" label="Venta logística" value={logisticsSalePrice} onChange={setLogisticsSalePrice} step={0.01} suffix="€" /></div>
                  {result && <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-2xl bg-slate-100 p-4"><p className="text-xs uppercase text-slate-500">Coste logístico</p><p className="mt-1 text-xl font-black">{money.format(result.logistics.totalCost)}</p></div><div className="rounded-2xl bg-slate-100 p-4"><p className="text-xs uppercase text-slate-500">Precio logístico</p><p className="mt-1 text-xl font-black">{money.format(result.logistics.salePrice)}</p></div><div className="rounded-2xl bg-slate-100 p-4"><p className="text-xs uppercase text-slate-500">Base sin densidad</p><p className="mt-1 text-xl font-black">{money.format(result.logistics.baseCost)}</p></div></div>}
                </>}
              </CardContent>
            </Card>

            <Card className="rounded-[1.5rem] border-slate-200 shadow-sm">
              <CardHeader><CardTitle className="flex items-center gap-2"><Settings2 className="h-5 w-5 text-[#310984]" />Tarifas y líneas comerciales</CardTitle></CardHeader>
              <CardContent className="space-y-4"><div className="grid gap-3 sm:grid-cols-3"><NumberField id="labor-rate" label="Coste laboral / hora" value={laborCostPerHour} onChange={setLaborCostPerHour} step={0.01} suffix="€" /><NumberField id="route-rate" label="Ruta provisional / hora" value={routeAllocationPerHour} onChange={setRouteAllocationPerHour} step={0.01} suffix="€" /><NumberField id="sale-rate" label="Venta limpieza / hora" value={cleaningSalePricePerHour} onChange={setCleaningSalePricePerHour} step={0.01} suffix="€" /></div><div className="grid gap-3 md:grid-cols-3"><LineFields prefix="laundry" label="Lavandería" cost={laundryCost} salePrice={laundrySalePrice} onCost={setLaundryCost} onSale={setLaundrySalePrice} /><LineFields prefix="amenities" label="Amenities" cost={amenitiesCost} salePrice={amenitiesSalePrice} onCost={setAmenitiesCost} onSale={setAmenitiesSalePrice} /><LineFields prefix="other" label="Otros conceptos" cost={otherCost} salePrice={otherSalePrice} onCost={setOtherCost} onSale={setOtherSalePrice} /></div><div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4"><div className="grid gap-3 md:grid-cols-[1fr_auto_auto]"><div className="space-y-2"><Label htmlFor="profile-name">Perfil tarifario versionado</Label><Input id="profile-name" value={profileName} onChange={(event) => setProfileName(event.target.value)} placeholder="Turístico estándar · A Coruña" /></div><Button variant="outline" className="self-end" onClick={saveProfile}>Guardar perfil v1</Button><Button variant="outline" className="self-end" onClick={saveProfileVersion} disabled={!selectedProfileId}>Nueva versión</Button></div>{profilesQuery.data && profilesQuery.data.length > 0 && <select value={selectedProfileId || ''} onChange={(event) => setSelectedProfileId(event.target.value || null)} className="mt-3 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"><option value="">Seleccionar perfil guardado</option>{profilesQuery.data.map((profile) => <option key={profile.id} value={profile.id}>{profile.name} · {(profile.versions || []).length} versión(es)</option>)}</select>}</div></CardContent>
            </Card>

            <div className="flex flex-wrap gap-2"><Button onClick={() => saveBudget.mutate()} disabled={saveBudget.isPending || !activeSede}><Save className="mr-2 h-4 w-4" />{saveBudget.isPending ? 'Guardando…' : 'Guardar presupuesto'}</Button>{nextStatus && <Button variant="outline" disabled={!selectedBudgetId || transition.isPending} onClick={() => transition.mutate(nextStatus)}><Send className="mr-2 h-4 w-4" />{nextStatus === 'review' ? 'Enviar a revisión' : nextStatus === 'sent' ? 'Marcar como enviado' : 'Marcar como aceptado'}</Button>}{currentStatus === 'accepted' && <Button variant="outline" disabled={activate.isPending} onClick={() => activate.mutate()}><CheckCircle2 className="mr-2 h-4 w-4" />Activar configuración</Button>}<Button variant="secondary" disabled={!selectedBudgetId || !currentVersionId || !result} onClick={generatePdf}><FileDown className="mr-2 h-4 w-4" />Generar PDF comercial</Button></div>
            {currentStatus === 'accepted' && <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-950"><p className="font-black">Revisión de activación</p><p className="mt-1">{selectedPropertyId ? 'Se actualizará la propiedad existente con duración, precio operativo y perfil planning_*.' : 'Se creará una propiedad nueva vinculada al cliente y se registrará el snapshot antes/después.'} No se crearán tareas ni facturas automáticamente.</p></div>}
          </main>

          <aside className="space-y-5 xl:sticky xl:top-4 xl:self-start">
            <Card className="rounded-[1.5rem] border-slate-200 shadow-sm"><CardHeader><CardTitle className="flex items-center gap-2"><Calculator className="h-5 w-5 text-[#310984]" />Resultado y escenario mensual</CardTitle></CardHeader><CardContent>{calculation.error && <p className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-800">{calculation.error}</p>}{result && <div className="space-y-3"><div className="grid grid-cols-2 gap-3"><div className="rounded-2xl bg-slate-100 p-4"><p className="text-xs uppercase text-slate-500">Coste / rotación</p><p className="mt-1 text-xl font-black">{money.format(result.rotation.totalCost)}</p></div><div className="rounded-2xl bg-[#eee9ff] p-4 text-[#310984]"><p className="text-xs uppercase">Venta / rotación</p><p className="mt-1 text-xl font-black">{money.format(result.rotation.totalRevenue)}</p></div></div><div className="rounded-2xl border border-slate-200 p-4"><div className="flex justify-between text-sm"><span>Contribución</span><strong>{money.format(result.rotation.contribution)}</strong></div><div className="mt-2 flex justify-between text-sm"><span>Margen</span><strong>{pct.format(result.rotation.marginPercentage)} %</strong></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full ${result.rotation.contribution >= 0 ? 'bg-emerald-500' : 'bg-red-500'}`} style={{ width: `${Math.max(0, Math.min(100, result.rotation.marginPercentage))}%` }} /></div></div><div className="rounded-2xl bg-[#210554] p-4 text-white"><p className="text-xs uppercase text-white/70">Escenario mensual</p><p className="mt-1 text-3xl font-black">{money.format(result.monthly.totalRevenue)}</p><p className="mt-1 text-xs text-white/70">Venta estimada con {monthlyRotations} rotación(es). Contribución: {money.format(result.monthly.contribution)}</p></div><p className="text-xs text-slate-500">El PDF comercial solo mostrará precios de venta y no contiene costes, margen ni datos internos.</p></div>}</CardContent></Card>

            <Card className="rounded-[1.5rem] border-slate-200 shadow-sm"><CardHeader><CardTitle className="flex items-center gap-2"><History className="h-5 w-5 text-[#310984]" />Presupuestos guardados · Historial de versiones</CardTitle></CardHeader><CardContent className="space-y-2">{budgetsQuery.isLoading && <p className="text-sm text-slate-500">Cargando presupuestos…</p>}{budgetsQuery.error && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-800">No se pudo cargar la bandeja. Revisa la migración del módulo.</div>}{!budgetsQuery.isLoading && !budgetsQuery.error && budgets.length === 0 && <p className="text-sm text-slate-500">Aún no hay presupuestos persistidos.</p>}{budgets.map((budget) => <button key={budget.id} type="button" onClick={() => loadBudget(budget)} className={`w-full rounded-2xl border p-3 text-left transition hover:border-[#8b75d1] ${selectedBudgetId === budget.id ? 'border-[#310984] bg-[#f1edff]' : 'border-slate-200 bg-white'}`}><div className="flex items-start justify-between gap-2"><div><p className="font-bold text-slate-900">{budget.quote_number}</p><p className="mt-1 text-xs text-slate-500">{budget.prospect_name || 'Sin cliente'}</p></div><Badge variant={statusVariant(budget.status)}>{statusLabels[budget.status]}</Badge></div><div className="mt-2 flex justify-between text-xs text-slate-500"><span>v{budget.current_version_number}</span><strong className="text-slate-700">{money.format(budget.monthly_revenue)} / mes</strong></div></button>)}</CardContent></Card>

            <Card className="rounded-[1.5rem] border-slate-200 bg-slate-50 shadow-sm"><CardContent className="space-y-2 p-5 text-sm text-slate-600"><p className="flex items-center gap-2 font-bold text-slate-900"><XCircle className="h-4 w-4 text-amber-600" />Fronteras operativas</p><p>Aceptar no crea tareas ni facturas. Activar requiere una acción explícita y deja auditoría de propiedad antes/después.</p><p>Facturación usará el precio operativo de propiedad solo como fallback de futuras tareas.</p></CardContent></Card>
          </aside>
        </div>
      </div>
    </div>
  );
}
