import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useSede } from '@/contexts/SedeContext';
import { formatMadridDate } from '@/utils/date';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useFinancialData } from './useFinancialData';
import { applyFinanceRules, newSettings, readSettings, validDate,
  type Category, type FinanceSettings, type FinancialService, type Filters } from './financialModel';
import { loadFinance, saveFinance } from './financialPersistence';
import { FinancialSettings, type SettingsTab } from './FinancialSettings';
import { loadFinancialView, saveFinancialView, financialMonthRange, selectedFinancialMonth, financialYearRange, selectedFinancialYear, validDetailConcept, type FinancialDrilldown } from './financialView';
import { FinancialTrend, type FinancialTrendView } from './FinancialEvolution';
import { FinancialExternalIncomes, FinancialServices } from './FinancialServices';
import { ServiceEditor } from './FinancialServiceEditor';
import { adjacentMonth, categoryNames, dashboardSeries, type ComparisonView } from './financialCharts';
import { FinancialAnnual } from './FinancialAnnual';
import { FinancialDetail } from './FinancialDetail';
import { isIncomeConcept } from './financialDrilldown';
import { financialName } from './financialFormat';
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
  const lastSettings = useRef<SettingsTab>(view.tab === 'incomes' || view.tab === 'expenses' ? view.tab : 'rates');
  const settingsOpen = tab === 'incomes' || tab === 'expenses' || tab === 'rates';
  const chooseSettings = (next: SettingsTab) => { lastSettings.current = next; setTab(next); };
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
            {!settingsOpen && <FinancialMonthHero focusConcept={chartFocus.current?.concept} breakdown={{ revenue: dashboardSeries(result).incomes.map(row => ({ key: row.id, name: row.name, value: row.value, concept: row.id, linked: true })), personal: [{ key: 'activity', name: 'Actividad y otros costes de personal', value: result.total.costs.personal, concept: 'personal' }, { key: 'structure', name: 'Dirección y estructura', value: result.total.costs.salary, concept: 'personal' }] }} key={`${filters.start}:${filters.end}:${allocation}`} total={result.total} previous={insights.previous} comparisonLabel={insights.period?.label ?? null} start={filters.start} singleMonth={singleMonth}
              partial={singleMonth && !monthValue} onDetails={id => openDetails(id)} />}
            <nav aria-label="Vistas del análisis" className="flex gap-1 overflow-x-auto border-b border-[var(--fin-line)]">{([['general', 'Resumen'], ['services', 'Servicios']] as const).map(([id, title]) =>
              <button key={id} type="button" aria-pressed={tab === id} className={tabClass(tab === id)} onClick={() => setTab(id)}>{title}</button>)}{tab === 'details' && drilldown && <button type="button" aria-pressed="true" className={tabClass(true)} onClick={() => setTab('details')}>{isIncomeConcept(drilldown.concept) ? 'Ingresos' : 'Desglose de gastos'}</button>}
              <button type="button" aria-pressed={settingsOpen} className={tabClass(settingsOpen)} onClick={() => chooseSettings(lastSettings.current)}>Ajustes</button>
            </nav>
            {tab === 'general' && <>
              {annualYear && <FinancialAnnual services={data?.services || []} settings={settings} filters={effectiveFilters} allocation={allocation} comparison={annualComparison} onComparison={setAnnualComparison} onDetails={openDetails} />}
              <FinancialProfitability result={result} clients={data?.clients || []} properties={data?.properties || []} onClient={selectClient} onProperty={selectProperty} />
              <FinancialReview result={result} rules={alertRules} today={today} clients={data?.clients || []} onRules={setAlertRules} onClient={selectClient} onEdit={setEditing} onIncomes={() => setTab('incomes')} onExcluded={service => { if (service.propertyId) selectProperty(service.propertyId); else { setProfitFilter('all'); setTab('services'); } }} />
              <FinancialComparisons sedeId={sedeId} services={data?.services || []} settings={settings} filters={effectiveFilters} allocation={allocation} summary={result.total} insights={insights} comparison={comparison} budgetId={budgetId} onComparison={setComparison} onBudget={setBudgetId} onDetails={(id, period) => openDetails(id, period, 'comparison')} />
              {!annualYear && <FinancialTrend services={data?.services || []} settings={settings} filters={effectiveFilters} allocation={allocation} view={trendView} onViewChange={patch => setTrendView(current => ({ ...current, ...patch }))} onDetails={openDetails} />}
            </>}
            {tab === 'details' && drilldown && <FinancialDetail result={result} settings={settings} concept={drilldown.concept} filters={filters} clients={data?.clients || []} onBack={returnToChart} />}
            {tab === 'services' && <><FinancialExternalIncomes result={result} onManage={() => chooseSettings('incomes')} /><FinancialServices result={result} filter={profitFilter} onFilter={setProfitFilter} onProperty={id => setFilters(current => ({ ...current, properties: [id] }))} onEdit={setEditing} /></>}
            {(tab === 'incomes' || tab === 'expenses' || tab === 'rates') && <FinancialSettings tab={tab} onTab={chooseSettings} settings={settings} result={result} today={today} start={filters.start} end={filters.end}
              clients={data?.clients || []} properties={data?.properties || []} workers={data?.workers || []} onCommit={commit} legacy={loaded} onImport={setImported} onMessage={setMessage} />}
          </>}
      <ServiceEditor service={editing} settings={settings} onClose={() => setEditing(null)} onSave={adjustment => {
        if (editing && commit({ ...settings, adjustments: { ...settings.adjustments, [editing.id]: adjustment } })) setEditing(null);
      }} />
      <Dialog open={!!imported} onOpenChange={open => !open && setImported(null)}><DialogContent className="fin-dialog rounded-3xl border-[var(--fin-line)] bg-[var(--fin-surface)] text-[var(--fin-ink)]"><DialogHeader><DialogTitle className="fin-display text-2xl">Restaurar copia de costes</DialogTitle></DialogHeader><p className="fin-muted text-sm">Esta copia contiene {imported?.rates.length} tarifas y {imported?.expenses.length} gastos. Sustituirá el borrador completo de esta sede. Revisa los cambios antes de guardarlos y compartirlos. Los servicios de la app no se modifican.</p><div className="flex flex-wrap justify-end gap-2"><Button variant="outline" className="rounded-full" onClick={() => setImported(null)}>Cancelar</Button><Button className="rounded-full" onClick={() => { if (imported && commit(imported)) setImported(null); }}>Restaurar esta copia</Button></div></DialogContent></Dialog>
    </div>
  </main>;
}
