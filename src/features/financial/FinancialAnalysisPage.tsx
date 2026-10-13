import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Plus, Settings2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useSede } from '@/contexts/SedeContext';
import { formatMadridDate } from '@/utils/date';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useFinancialData } from './useFinancialData';
import { COST_ITEMS, applyFinanceRules, newSettings, parseAmount, priceAt, readSettings, setRate, validDate,
  type Category, type FinanceSettings, type FinancialService, type Filters, type ItemId } from './financialModel';
import type { DirectoryEntry } from './financialSource';
import { loadFinance, saveFinance } from './financialPersistence';
import { IncomePanel, ConsumptionPanel } from './FinancialConfiguration';
import { loadFinancialView, saveFinancialView, financialMonthRange, selectedFinancialMonth, financialYearRange, selectedFinancialYear, validDetailConcept, type FinancialDrilldown } from './financialView';
import { FinancialTrend, type FinancialTrendView } from './FinancialEvolution';
import { FinancialExternalIncomes, FinancialServices } from './FinancialServices';
import { ServiceEditor } from './FinancialServiceEditor';
import { formatRate } from './financialRateFormat';
import { adjacentMonth, categoryNames, dashboardSeries, type ComparisonView } from './financialCharts';
import { FinancialAnnual } from './FinancialAnnual';
import { FinancialDetail } from './FinancialDetail';
import { isIncomeConcept } from './financialDrilldown';
import { money, decimal, financialName } from './financialFormat';
import { FinancialMonthHero, FinancialSummarySkeleton } from './FinancialMonthHero';
import { FinancialMonthBar } from './FinancialMonthBar';
import { ActiveFilterChips, FinancialFilterPanel, type FilterKey } from './FinancialFilterPanel';
import './financialTheme.css';
import { FinancialProfitability } from './FinancialProfitability';
import { financialHistoryRange, financialInsights } from './financialInsights';
import { analyzeWithAllocation, scopeBuildings, type Allocation, type AlertRules } from './financialAnalytics';
import { FinancialComparisons } from './FinancialComparisons';
import { FinancialReview } from './FinancialReview';
import { FinancialReports } from './FinancialReports';


const panel = 'min-w-0 rounded-2xl border border-[var(--fin-line)] bg-[var(--fin-surface)] p-5';
const selectClass = 'h-10 rounded-md border border-input bg-background px-3 text-sm w-full';
function download(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const tabClass = (active: boolean) => `fin-focus relative shrink-0 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${active ? 'text-[var(--fin-ink)] after:absolute after:inset-x-3 after:-bottom-px after:h-0.5 after:rounded-full after:bg-[var(--fin-ink)]' : 'fin-muted hover:text-[var(--fin-ink)]'}`;
const headerButton = 'fin-focus inline-flex h-10 items-center justify-center rounded-full border border-[var(--fin-line)] bg-[var(--fin-surface)] px-3 text-[13px] font-medium sm:px-4 sm:text-sm transition-colors hover:bg-[var(--fin-sunk)] disabled:opacity-50';
export default function FinancialAnalysisPage() {
  const { activeSede } = useSede();
  const { user } = useAuth();
  if (!activeSede || !user) return <div className="p-8">Selecciona una sede para consultar el análisis financiero.</div>;
  return <FinancialWorkspace key={`${user.id}:${activeSede.id}`} storageKey={`limpatex-financial-v1:${user.id}:${activeSede.id}`} sedeId={activeSede.id} sedeName={activeSede.nombre} />;
}

export function FinancialWorkspace({ storageKey, sedeId, sedeName }: { storageKey: string; sedeId: string; sedeName: string }) {
  const today = formatMadridDate(new Date());
  const [view] = useState(() => loadFinancialView(storageKey, today));
  const [filters, setFilters] = useState<Filters>(view.filters);
  const [monthlyPeriod, setMonthlyPeriod] = useState(view.monthlyPeriod);
  const [annualComparison, setAnnualComparison] = useState<ComparisonView>(view.annualComparison || 'balance');
  const [allocation, setAllocation] = useState<Allocation>(view.allocation || 'none');
  const [comparison, setComparison] = useState<'previous' | 'year' | 'budget'>(view.comparison || 'previous');
  const [budgetId, setBudgetId] = useState(view.budgetId || '');
  const [alertRules, setAlertRules] = useState<AlertRules>(view.alerts || { margin: 10, days: 7, zero: true });
  const annualYear = selectedFinancialYear(filters);
  const [loaded] = useState(() => {
    try { const saved = localStorage.getItem(storageKey); return { settings: saved ? readSettings(JSON.parse(saved)) : newSettings(), hasLocal: !!saved, error: '' }; }
    catch { return { settings: newSettings(), hasLocal: false, error: 'No se pudo leer la configuración antigua del navegador.' }; }
  });
  const [settings, setSettings] = useState(newSettings);
  const [storageError, setStorageError] = useState('');
  const [revision, setRevision] = useState<number | null>(null);
  const [sharedReady, setSharedReady] = useState(false);
  const [reload, setReload] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    let active = true;
    setSharedReady(false); setStorageError('');
    loadFinance(sedeId).then(value => {
      if (!active) return;
      setSettings(value?.settings || newSettings()); setRevision(value?.revision ?? null); setDirty(false); setSharedReady(true);
    }).catch(error => { if (active) setStorageError(error.message); });
    return () => { active = false; };
  }, [sedeId, reload]);
  const [message, setMessage] = useState('');
  const [tab, setTab] = useState(view.tab === 'clients' || view.tab === 'properties' ? 'general' : view.tab);
  const [drilldown, setDrilldown] = useState<FinancialDrilldown | undefined>(view.drilldown);
  const workspace = useRef<HTMLElement>(null);
  const chartFocus = useRef<{ concept: string; month?: string; origin?: 'comparison' } | null>(null);
  const [trendView, setTrendView] = useState<FinancialTrendView>({ open: true, matchingDays: true, comparison: 'balance', chart: 'lines' });
  const [editing, setEditing] = useState<FinancialService | null>(null);
  const [profitFilter, setProfitFilter] = useState(view.profitFilter);
  const [filtersOpen, setFiltersOpen] = useState(false);
  useEffect(() => { saveFinancialView(storageKey, { filters, tab, profitFilter, ...(drilldown ? { drilldown } : {}), ...(monthlyPeriod ? { monthlyPeriod } : {}), annualComparison, allocation, comparison, budgetId, alerts: alertRules }); }, [storageKey, filters, tab, profitFilter, drilldown, monthlyPeriod, annualComparison, allocation, comparison, budgetId, alertRules]);
  const [imported, setImported] = useState<FinanceSettings | null>(null);
  const history = financialHistoryRange(filters, comparison);
  const query = useFinancialData(sedeId, history.start, history.end);
  const data = query.data;
  const effectiveFilters = useMemo(() => scopeBuildings(filters, data?.buildings || []), [filters, data]);
  const insights = useMemo(() => financialInsights(data?.services || [], settings, effectiveFilters, allocation, comparison), [data, settings, effectiveFilters, allocation, comparison]);
  const result = useMemo(() => analyzeWithAllocation(data?.services || [], settings, effectiveFilters, allocation), [data, settings, effectiveFilters, allocation]);
  useEffect(() => {
    if (tab !== 'general' || !sharedReady || query.isPending || query.error || !chartFocus.current) return;
    const target = chartFocus.current;
    const region = target.origin === 'comparison' ? workspace.current?.querySelector('[aria-label="Comparativas financieras"]') : target.month ? workspace.current?.querySelector(annualYear ? '[aria-label="Resumen anual por meses"]' : '[aria-label="Evolución mensual"]') : workspace.current?.querySelector('[aria-label="Comparativa del periodo"]');
    if (!region) return;
    // ResponsiveContainer measures after mounting. Restore focus once its SVG
    // exists, rather than focusing a temporary legend before the bars appear.
    const observer = new MutationObserver(() => restoreFocus());
    const restoreFocus = () => {
      if (annualYear && region.querySelector('[data-financial-empty]')) {
        observer.disconnect(); chartFocus.current = null; (region as HTMLElement).focus(); return;
      }
      const candidates = [...region.querySelectorAll<HTMLElement | SVGElement>('[data-financial-concept]')].filter(node => node.getAttribute('data-financial-concept') === target.concept).flatMap(node => {
        const element = node.matches('button') ? node : node.querySelector<SVGElement>('[role="button"]');
        return element ? [{ element, month: node.getAttribute('data-period-start') }] : [];
      });
      const selected = candidates.find(candidate => !target.month || candidate.month === target.month) || candidates.at(-1);
      if (!selected?.element.closest('section')?.querySelector('svg.recharts-surface, .fin-wf')) return;
      observer.disconnect(); chartFocus.current = null; selected.element.focus();
    };
    observer.observe(region, { childList: true, subtree: true });
    restoreFocus();
    return () => observer.disconnect();
  }, [tab, sharedReady, query.isPending, query.error, annualYear]);
  const commit = (next: FinanceSettings) => {
    if (!sharedReady || saving) return false;
    try { setSettings(readSettings(next)); setDirty(true); setMessage('Borrador actualizado. Pulsa Guardar cambios para compartirlo.'); return true; }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Configuración no válida'); return false; }
  };
  const save = async () => {
    setSaving(true);
    try { const saved = await saveFinance(sedeId, settings, revision); setSettings(saved.settings); setRevision(saved.revision); setDirty(false); setMessage('Cambios guardados y compartidos en esta sede.'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo guardar. El borrador se conserva.'); }
    finally { setSaving(false); }
  };
  const clientName = (id: string) => financialName(data?.clients.find(client => client.id === id)?.name || 'Sin cliente identificado');
  const selectClient = (id: string) => { setFilters({ ...filters, clients: [id] }); setProfitFilter('all'); setTab('services'); };
  const selectProperty = (id: string) => { setFilters(current => ({ ...current, properties: [id] })); setProfitFilter('all'); setTab('services'); };
  const openDetails = (concept: string, period?: Pick<Filters, 'start' | 'end'>, origin?: 'comparison') => {
    if (!validDetailConcept(concept)) return;
    setDrilldown({ concept, returnFilters: filters, monthly: !!period, ...(origin ? { origin } : {}) });
    if (period) setFilters(current => ({ ...current, ...period }));
    setTab('details');
  };
  const returnToChart = () => {
    if (drilldown) chartFocus.current = { concept: drilldown.concept, ...(drilldown.monthly || drilldown.origin ? { month: filters.start } : {}), ...(drilldown.origin ? { origin: drilldown.origin } : {}) };
    if (drilldown?.monthly) { setFilters(drilldown.returnFilters); if (!selectedFinancialYear(drilldown.returnFilters)) setTrendView(current => ({ ...current, open: true })); }
    setTab('general');
  };
  const moveMonth = (offset: number) => { const range = annualYear ? financialYearRange(String(Number(annualYear) + offset).padStart(4, '0')) : adjacentMonth(filters.start, offset); if (range) setFilters(current => ({ ...current, ...range })); };
  const showAnnual = () => {
    const range = financialYearRange(filters.end.slice(0, 4));
    if (!range) return;
    if (!annualYear) setMonthlyPeriod({ start: filters.start, end: filters.end });
    setFilters(current => ({ ...current, ...range })); setTab('general');
  };
  const showMonthly = () => {
    const range = monthlyPeriod?.start.slice(0, 4) === annualYear ? monthlyPeriod : financialMonthRange(`${annualYear}-${(monthlyPeriod?.end || today).slice(5, 7)}`);
    if (range) setFilters(current => ({ ...current, ...range }));
    setTab('general');
  };
  const updateFilter = (key: 'clients' | 'properties' | 'workers' | 'buildings' | 'types' | 'categories', ids: string[]) => setFilters(current => ({ ...current, [key]: ids }));
  const monthValue = selectedFinancialMonth(filters);
  const singleMonth = !annualYear && filters.start.slice(0, 7) === filters.end.slice(0, 7);
  const filterKeys: FilterKey[] = ['clients', 'properties', 'workers', 'buildings', 'types', 'categories'];
  const filterGroups = [
    { key: 'clients' as const, label: 'Clientes', entries: data?.clients || [] },
    { key: 'properties' as const, label: 'Propiedades', entries: data?.properties || [] },
    { key: 'buildings' as const, label: 'Edificios', entries: data?.buildings || [] },
    { key: 'workers' as const, label: 'Trabajadores', entries: data?.workers || [] },
    { key: 'types' as const, label: 'Tipos de servicio', entries: [...new Set([...(data?.services.map(service => applyFinanceRules(service, settings).type) || []), 'external-income'])].map(type => ({ id: type, name: type === 'external-income' ? 'Ingresos externos' : type || 'Tipo pendiente' })) },
    { key: 'categories' as const, label: 'Categorías de gasto', entries: ['personal', 'laundry', 'supplies', 'products', 'other'].map(category => ({ id: category, name: category === 'personal' ? 'Personal · incluye dirección' : categoryNames[category as Category] })) },
  ];
  const chips = filterGroups.flatMap(group => ((filters[group.key] as string[] | undefined) || []).map(id => ({ key: group.key, id, label: `${group.label}: ${financialName(group.entries.find(entry => entry.id === id)?.name || id)}` })));
  const filterCount = filterKeys.reduce((sum, key) => sum + (((filters[key] as string[] | undefined) || []).length ? 1 : 0), 0) + (allocation !== 'none' ? 1 : 0);
  const years = [...new Set([...Array.from({ length: 26 }, (_, index) => String(Number(today.slice(0, 4)) - 20 + index)), annualYear].filter(Boolean))].sort((a, b) => Number(b) - Number(a));
  const pickMonth = (month: string) => { const range = financialMonthRange(month); if (range) setFilters(current => ({ ...current, ...range })); };
  const resetFilters = () => { setFilters({ start: `${today.slice(0, 7)}-01`, end: today, clients: [], properties: [], workers: [] }); setAllocation('none'); };
  return <main ref={workspace} className="fin-root min-h-screen p-4 sm:p-6 lg:p-8">
    <div className="mx-auto max-w-[1280px] space-y-6">
      <header className="fin-rise relative z-40 flex flex-wrap items-end justify-between gap-4">
        <div><p className="fin-muted text-xs font-semibold uppercase tracking-[0.14em]">APP GESTIÓN LIMPATEX · {sedeName}</p><h1 className="fin-display mt-1 text-3xl font-bold sm:text-4xl">Análisis financiero</h1></div>
        <div className="flex flex-wrap gap-2"><button className={headerButton} disabled={!sharedReady || query.isFetching} onClick={() => query.refetch()}>{query.isFetching ? 'Actualizando datos…' : 'Actualizar datos'}</button><FinancialReports disabled={!data || !sharedReady || query.isFetching || !!query.error || !!storageError || !validDate(filters.start) || !validDate(filters.end) || filters.start > filters.end} input={{ result, filters: effectiveFilters, sedeName, clients: data?.clients || [], properties: data?.properties || [], workers: data?.workers || [], buildings: data?.buildings || [], allocation, rows: insights.rows, draft: dirty }} /><Link className={headerButton} to="/" aria-label="Volver"><ArrowLeft aria-hidden className="h-4 w-4 sm:hidden" /><span className="hidden sm:inline">Volver</span></Link></div>
      </header>
      <details open={dirty || !!storageError || revision === null} className="fin-rise rounded-2xl border border-[var(--fin-line)] bg-[var(--fin-surface)] px-4 py-2.5 text-sm" style={{ ['--i' as string]: 1 }}>
        <summary className="cursor-pointer font-medium">{dirty ? 'Cambios sin guardar' : 'Configuración compartida de esta sede'}</summary>
        <p className="fin-muted mt-2">Configuración compartida por sede · Los cambios quedan en borrador hasta «Guardar cambios». Los servicios utilizan siempre la tarifa actual de la propiedad. Todo sin IVA.</p>
        <div className="mt-3 flex flex-wrap gap-2 pb-1"><Button className="rounded-full" disabled={!sharedReady || saving || !dirty && revision !== null} onClick={save}>{saving ? 'Guardando…' : 'Guardar cambios'}</Button><Button className="rounded-full" variant="outline" disabled={saving} onClick={() => { setMessage(''); setReload(n => n + 1); }}>Descartar y recargar</Button>
          {dirty && <span className="self-center">Cambios sin guardar</span>}</div>
      </details>
      {storageError && <p role="alert" className="rounded-xl bg-amber-50 p-3 text-amber-900">{storageError}</p>}
      {message && <p role="status" className="text-sm">{message}</p>}
      <section className="space-y-3" aria-label="Filtros del análisis">
        <FinancialMonthBar start={filters.start} end={filters.end} annualYear={annualYear} monthValue={monthValue} filterCount={filterCount} busy={query.isFetching} rows={insights.rows}
          onMove={moveMonth} onPickMonth={pickMonth} onMonthInput={pickMonth} onFullMonth={() => pickMonth(filters.start.slice(0, 7))} onAnnual={showAnnual} onMonthly={showMonthly} filtersOpen={filtersOpen} onToggleFilters={() => setFiltersOpen(open => !open)} years={years} onYear={year => { const range = financialYearRange(year); if (range) setFilters(current => ({ ...current, ...range })); }} />
        <ActiveFilterChips chips={chips} onRemove={(key, id) => updateFilter(key, ((filters[key] as string[] | undefined) || []).filter(value => value !== id))} />
        <FinancialFilterPanel id="financial-filters" open={filtersOpen} filters={filters} groups={filterGroups} allocation={allocation} onChange={updateFilter} onDates={patch => setFilters(current => ({ ...current, ...patch }))} onAllocation={setAllocation} onReset={resetFilters} />
        {!!filters.categories?.length && <p role="status" className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900">Vista parcial de gastos: los ingresos se mantienen; resultado y margen solo descuentan las categorías elegidas. No representan el margen completo.</p>}
        {(!!filters.clients.length || !!filters.properties.length || !!filters.workers.length) && <p className="fin-muted text-xs">{!!filters.workers.length && 'Servicios en los que participa el trabajador; ingreso único y coste de todo el equipo. '}Los gastos generales sin vínculo quedan fuera de estos filtros.</p>}
      </section>
      {!filters.start || !filters.end || filters.start > filters.end ? <p role="alert">Selecciona un intervalo de fechas válido.</p> : storageError ? <p role="alert" className={panel}>Configuración sin cargar. No se muestran balances; pulsa Descartar y recargar para reintentar.</p> : query.error ?
        <div role="alert" className={panel}><p>No se pudieron cargar los datos. No se muestran totales parciales.</p><Button variant="outline" onClick={() => query.refetch()}>Reintentar</Button></div> : query.isPending ?
          <FinancialSummarySkeleton /> : !sharedReady ? <FinancialSummarySkeleton /> : <>
            <FinancialMonthHero focusConcept={chartFocus.current?.concept} breakdown={{ revenue: dashboardSeries(result).incomes.map(row => ({ key: row.id, name: row.name, value: row.value, concept: row.id, linked: true })), personal: [{ key: 'activity', name: 'Actividad y otros costes de personal', value: result.total.costs.personal, concept: 'personal' }, { key: 'structure', name: 'Dirección y estructura', value: result.total.costs.salary, concept: 'personal' }] }} key={`${filters.start}:${filters.end}:${allocation}`} total={result.total} previous={insights.previous} comparisonLabel={insights.period?.label ?? null} start={filters.start} singleMonth={singleMonth}
              partial={singleMonth && !monthValue} onDetails={id => openDetails(id)} />
            <nav aria-label="Vistas del análisis" className="flex flex-wrap items-end justify-between gap-x-6 border-b border-[var(--fin-line)]">
              <div className="flex gap-1 overflow-x-auto">{([['general', 'Resumen'], ['services', 'Servicios']] as const).map(([id, title]) =>
                <button key={id} type="button" aria-pressed={tab === id} className={tabClass(tab === id)} onClick={() => setTab(id)}>{title}</button>)}{tab === 'details' && drilldown && <button type="button" aria-pressed="true" className={tabClass(true)} onClick={() => setTab('details')}>{isIncomeConcept(drilldown.concept) ? 'Ingresos' : 'Desglose de gastos'}</button>}</div>
              <div className="flex items-center gap-1 overflow-x-auto"><span className="fin-muted pr-1 text-xs uppercase tracking-wider">Ajustes</span>{([['incomes', 'Otros ingresos'], ['expenses', 'Otros gastos'], ['rates', 'Tarifas']] as const).map(([id, title]) =>
                <button key={id} type="button" aria-pressed={tab === id} className={tabClass(tab === id)} onClick={() => setTab(id)}>{title}</button>)}</div>
            </nav>
            {tab === 'general' && <>
              {annualYear && <FinancialAnnual services={data?.services || []} settings={settings} filters={effectiveFilters} allocation={allocation} comparison={annualComparison} onComparison={setAnnualComparison} onDetails={openDetails} />}
              <FinancialProfitability result={result} clients={data?.clients || []} properties={data?.properties || []} onClient={selectClient} onProperty={selectProperty} />
              <FinancialReview result={result} rules={alertRules} today={today} clients={data?.clients || []} onRules={setAlertRules} onClient={selectClient} onEdit={setEditing} onIncomes={() => setTab('incomes')} onExcluded={service => { if (service.propertyId) selectProperty(service.propertyId); else { setProfitFilter('all'); setTab('services'); } }} />
              <FinancialComparisons sedeId={sedeId} services={data?.services || []} settings={settings} filters={effectiveFilters} allocation={allocation} summary={result.total} insights={insights} comparison={comparison} budgetId={budgetId} onComparison={setComparison} onBudget={setBudgetId} onDetails={(id, period) => openDetails(id, period, 'comparison')} />
              {!annualYear && <FinancialTrend services={data?.services || []} settings={settings} filters={effectiveFilters} allocation={allocation} view={trendView} onViewChange={patch => setTrendView(current => ({ ...current, ...patch }))} onDetails={openDetails} />}
            </>}
            {tab === 'details' && drilldown && <FinancialDetail result={result} settings={settings} concept={drilldown.concept} filters={filters} clients={data?.clients || []} onBack={returnToChart} />}
            {tab === 'incomes' && <IncomePanel settings={settings} result={result} clients={data?.clients || []} properties={data?.properties || []} workers={data?.workers || []} date={filters.start} onChange={commit} />}
            {tab === 'services' && <><FinancialExternalIncomes result={result} onManage={() => setTab('incomes')} /><FinancialServices result={result} filter={profitFilter} onFilter={setProfitFilter} onProperty={id => setFilters(current => ({ ...current, properties: [id] }))} onEdit={setEditing} /></>}
            {tab === 'expenses' && <section className={panel}><h2 className="text-lg mb-2 font-semibold text-[#310984]">Gastos adicionales del análisis</h2><p className="mb-4 text-sm text-slate-500">Registra solo gastos no incluidos ya en los servicios. Sin cliente, se consideran generales. El salario de dirección de turismo se calcula automáticamente; no lo añadas de nuevo.</p>
              <ExpenseForm clients={data?.clients || []} properties={data?.properties || []} workers={data?.workers || []} date={today} onAdd={expense => commit({ ...settings, expenses: [...settings.expenses, expense] })} />
              <div className="mt-5 space-y-2">{result.expenses.map(expense => <div key={expense.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-violet-50 p-3 text-sm"><div><strong>{expense.label}</strong><p>{expense.date} · {expense.clientId ? clientName(expense.clientId) : 'General'} · {categoryNames[expense.category]}</p></div><div className="flex items-center gap-3"><strong>{money(expense.cents)}</strong><>{expense.automatic ? <span className="text-xs text-violet-700">Calculado desde Tarifas</span> : <Button size="sm" variant="outline" onClick={() => commit({ ...settings, expenses: settings.expenses.filter(item => item.id !== expense.id) })}>Quitar del análisis</Button>}</></div></div>)}{!result.expenses.length && <p className="text-sm text-slate-500">Sin gastos adicionales en este periodo.</p>}</div>
            </section>}
            {tab === 'rates' && <section className={`${panel} space-y-5`}><h2 className="text-lg flex items-center gap-2 font-semibold text-[#310984]"><Settings2 className="h-5 w-5" />Tarifas personalizables · sin IVA</h2><p className="text-sm text-slate-500">Conservamos tres decimales por unidad y redondeamos cada categoría por servicio a céntimos. Los precios iniciales se aplican hasta que exista una tarifa fechada.</p>
              <RateForm workers={data?.workers || []} today={today} onSave={rate => commit({ ...settings, rates: setRate(settings.rates, rate) })} />
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">{COST_ITEMS.map(item => <div key={item.id} className="rounded-xl bg-violet-50 p-3 text-sm"><p className="font-medium">{item.label}</p><p className="text-[#310984]">{formatRate(item.id, priceAt(settings.rates, item.id, filters.end))} / {item.unit}</p></div>)}</div>
              <p className="text-xs text-slate-500">Tarifa general vigente al {filters.end}. Las excepciones por trabajador figuran en el historial.</p>
              <div className="space-y-2">{[...settings.rates].sort((a, b) => b.date.localeCompare(a.date)).map(rate => <p className="text-sm" key={`${rate.item}:${rate.date}:${rate.workerId || ''}`}>{rate.date} · {COST_ITEMS.find(item => item.id === rate.item)?.label} · {rate.workerId ? data?.workers.find(worker => worker.id === rate.workerId)?.name || 'Trabajador' : 'General'} · <strong>{formatRate(rate.item, rate.mills)}</strong></p>)}</div>
              <div className="flex flex-wrap items-center gap-3 border-t pt-4"><Button variant="outline" onClick={() => download('limpatex-costes-copia.json', JSON.stringify(settings, null, 2), 'application/json')}>Exportar copia de ajustes</Button>
                {!loaded.error && loaded.hasLocal && <Button variant="outline" onClick={() => setImported(loaded.settings)}>Importar ajustes antiguos de este navegador</Button>}
                <label className="cursor-pointer rounded-md border bg-white px-4 py-2 text-sm">Restaurar copia<input className="sr-only" type="file" accept=".json,application/json" onChange={async event => { const file = event.target.files?.[0]; event.target.value = ''; if (!file) return; try { if (file.size > 5000000) throw new Error('Archivo demasiado grande'); setImported(readSettings(JSON.parse(await file.text()))); } catch { setMessage('La copia no es válida. No se ha cambiado ningún dato.'); } }} /></label>
              </div>
              <ConsumptionPanel settings={settings} clients={data?.clients || []} properties={data?.properties || []} onChange={commit} />
            </section>}
          </>}
      <ServiceEditor service={editing} settings={settings} onClose={() => setEditing(null)} onSave={adjustment => {
        if (editing && commit({ ...settings, adjustments: { ...settings.adjustments, [editing.id]: adjustment } })) setEditing(null);
      }} />
      <Dialog open={!!imported} onOpenChange={open => !open && setImported(null)}><DialogContent><DialogHeader><DialogTitle>Restaurar copia de costes</DialogTitle></DialogHeader><p>Esta copia contiene {imported?.rates.length} tarifas y {imported?.expenses.length} gastos. Sustituirá el borrador completo de esta sede. Revisa los cambios antes de guardarlos y compartirlos. Los servicios de la app no se modifican.</p><Button variant="outline" onClick={() => setImported(null)}>Cancelar</Button><Button onClick={() => { if (imported && commit(imported)) setImported(null); }}>Restaurar esta copia</Button></DialogContent></Dialog>
    </div>
  </main>;
}

function RateForm({ workers, today, onSave }: { workers: DirectoryEntry[]; today: string; onSave: (rate: FinanceSettings['rates'][number]) => boolean }) {
  const [item, setItem] = useState<ItemId>('labor'); const [date, setDate] = useState(today); const [amount, setAmount] = useState('14,50'); const [workerId, setWorkerId] = useState(''); const [error, setError] = useState('');
  return <form className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-5" onSubmit={event => { event.preventDefault(); const mills = parseAmount(amount); if (mills === null || !validDate(date) || (item === 'products' && mills > 100000)) { setError('Introduce una fecha y un valor válido con hasta tres decimales; el porcentaje debe estar entre 0 y 100.'); return; } if (onSave({ item, date, mills, ...(item === 'labor' && workerId ? { workerId } : {}) })) setError(''); }}>
    <label className="text-sm">Concepto<select aria-label="Concepto" className={selectClass} value={item} onChange={event => { const id = event.target.value as ItemId; setItem(id); setAmount(String(COST_ITEMS.find(cost => cost.id === id)!.mills / 1000)); }}>{COST_ITEMS.map(cost => <option key={cost.id} value={cost.id}>{cost.label}</option>)}</select></label>
    <label className="text-sm">{item === 'products' ? 'Porcentaje sobre limpieza' : item === 'tourismSalary' ? 'Coste de empresa mensual' : 'Precio unitario sin IVA'}<Input inputMode="decimal" value={amount} onChange={event => setAmount(event.target.value)} /></label>
    <label className="text-sm">Aplicar desde<Input type="date" value={date} onChange={event => setDate(event.target.value)} /></label>
    <label className="text-sm">Trabajador<select disabled={item !== 'labor'} className={selectClass} value={workerId} onChange={event => setWorkerId(event.target.value)}><option value="">Todos · tarifa general</option>{workers.map(worker => <option value={worker.id} key={worker.id}>{worker.name}</option>)}</select></label>
    <Button className="bg-[#310984]" type="submit">Guardar tarifa</Button>{error && <p role="alert" className="col-span-full text-sm text-red-700">{error}</p>}
  </form>;
}

function ExpenseForm({ clients, properties, workers, date, onAdd }: { clients: DirectoryEntry[]; properties: (DirectoryEntry & { clientId: string })[]; workers: DirectoryEntry[]; date: string; onAdd: (expense: FinanceSettings['expenses'][number]) => boolean }) {
  const [label, setLabel] = useState(''); const [amount, setAmount] = useState(''); const [expenseDate, setDate] = useState(date); const [category, setCategory] = useState<Category>('other');
  const [clientId, setClient] = useState(''); const [propertyId, setProperty] = useState(''); const [workerId, setWorker] = useState(''); const [error, setError] = useState('');
  return <form className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-4" onSubmit={event => { event.preventDefault(); const cents = parseAmount(amount, 2); if (!label.trim() || cents === null || !validDate(expenseDate)) { setError('Completa el concepto, la fecha y el importe sin IVA.'); return; } if (onAdd({ id: crypto.randomUUID(), date: expenseDate, label: label.trim(), cents, category, clientId, propertyId, workerId })) { setLabel(''); setAmount(''); setError(''); } }}>
    <label className="text-sm">Concepto del gasto<Input value={label} maxLength={200} onChange={event => setLabel(event.target.value)} /></label><label className="text-sm">Importe sin IVA<Input inputMode="decimal" value={amount} onChange={event => setAmount(event.target.value)} /></label>
    <label className="text-sm">Fecha del gasto<Input type="date" value={expenseDate} onChange={event => setDate(event.target.value)} /></label>
    <label className="text-sm">Categoría<select className={selectClass} value={category} onChange={event => setCategory(event.target.value as Category)}>{Object.entries(categoryNames).map(([id, name]) => <option value={id} key={id}>{name}</option>)}</select></label>
    <label className="text-sm">Cliente del gasto<select className={selectClass} value={clientId} onChange={event => { setClient(event.target.value); setProperty(''); }}><option value="">General · sin cliente</option>{clients.map(client => <option value={client.id} key={client.id}>{financialName(client.name)}</option>)}</select></label>
    <label className="text-sm">Propiedad del gasto<select className={selectClass} value={propertyId} onChange={event => { const id = event.target.value; setProperty(id); if (id) setClient(properties.find(property => property.id === id)!.clientId); }}><option value="">Sin propiedad</option>{properties.filter(property => !clientId || property.clientId === clientId).map(property => <option value={property.id} key={property.id}>{property.name}</option>)}</select></label>
    <label className="text-sm">Trabajador del gasto<select className={selectClass} value={workerId} onChange={event => setWorker(event.target.value)}><option value="">Sin trabajador</option>{workers.map(worker => <option value={worker.id} key={worker.id}>{worker.name}</option>)}</select></label>
    <Button className="bg-[#310984]" type="submit"><Plus className="mr-2 h-4 w-4" />Añadir al análisis</Button>{error && <p role="alert" className="col-span-full text-sm text-red-700">{error}</p>}
  </form>;
}
