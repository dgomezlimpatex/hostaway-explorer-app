import { TRASH_SACK_START } from '@/utils/trashSacks';

export const COST_ITEMS = [
  { id: 'trashSack100L', label: 'Sacos de basura 100 L', category: 'supplies', unit: 'saco', mills: 100 },
  { id: 'labor', label: 'Personal', category: 'personal', unit: 'hora por trabajador', mills: 14500 },
  { id: 'doubleSheet', label: 'Sábana matrimonio', category: 'laundry', unit: 'prenda', mills: 550 },
  { id: 'singleSheet', label: 'Sábana individual', category: 'laundry', unit: 'prenda', mills: 510 },
  { id: 'suiteSheet', label: 'Sábana suite', category: 'laundry', unit: 'prenda', mills: 570 },
  { id: 'pillowcase', label: 'Funda de almohada', category: 'laundry', unit: 'prenda', mills: 247 },
  { id: 'bathTowel', label: 'Toalla de baño', category: 'laundry', unit: 'prenda', mills: 535 },
  { id: 'handTowel', label: 'Toalla de manos', category: 'laundry', unit: 'prenda', mills: 226 },
  { id: 'bathMat', label: 'Alfombrín de ducha', category: 'laundry', unit: 'prenda', mills: 226 },
  { id: 'duvet', label: 'Nórdico', category: 'laundry', unit: 'prenda', mills: 10537 },
  { id: 'pillow', label: 'Almohada', category: 'laundry', unit: 'prenda', mills: 3159 },
  { id: 'mattressCover', label: 'Cubrecolchón', category: 'laundry', unit: 'prenda', mills: 3159 },
  { id: 'kitchenCloth', label: 'Paño de cocina', category: 'laundry', unit: 'prenda', mills: 150 },
  { id: 'kitchenKit', label: 'Kit amenities cocina', category: 'supplies', unit: 'kit', mills: 870 },
  { id: 'bathKit', label: 'Kit amenities baño', category: 'supplies', unit: 'kit', mills: 890 },
  { id: 'foodKit', label: 'Kit amenities alimentarios', category: 'supplies', unit: 'kit', mills: 1910 },
  { id: 'toiletPaper', label: 'Papel higiénico', category: 'supplies', unit: 'rollo', mills: 130 },
  { id: 'products', label: 'Productos de limpieza', category: 'products', unit: 'importe de limpieza', mills: 3000 },
  { id: 'tourismSalary', label: 'Salario dirección turismo', category: 'salary', unit: 'mes · coste de empresa', mills: 2317000 },
  { id: 'kitchenClothIncome', label: 'Cobro de paño de cocina', category: 'income', unit: 'limpieza con paño configurado', mills: 250 },
] as const;
export const QUANTITY_ITEMS = COST_ITEMS.filter(item => item.category === 'laundry' || item.category === 'supplies');
export type ItemId = typeof COST_ITEMS[number]['id'];
export type Category = 'personal' | 'laundry' | 'supplies' | 'products' | 'salary' | 'other';
export type Quantities = Partial<Record<ItemId, number>>;
export interface Rate { item: ItemId; date: string; mills: number; workerId?: string }
export interface WorkerHours { id: string; name: string; minutes: number | null; actual: boolean }
export interface FinancialService {
  additionalRevenue?: number;
  kitchenClothRevenue?: number;
  unpricedConsumptions?: string[];
  type: string;
  id: string; date: string; clientId: string; clientName: string; propertyId: string; propertyName: string;
  revenue: number | null; revenueEstimated: boolean; workers: WorkerHours[]; quantities: Quantities;
}
export interface ServiceAdjustment { quantities?: Quantities; reviewed?: boolean; minutes?: Record<string, number> }
export interface Expense {
  automatic?: boolean;
  id: string; date: string; label: string; cents: number; category: Category;
  clientId: string; propertyId: string; workerId: string;
}
export interface ConsumptionPolicy { clientId: string; propertyId: string; laundry?: boolean; kits?: boolean; consumables?: boolean; minutes?: number; personnelOnly?: boolean; kitchenClothIncome?: boolean }
export interface FinancialIncome {
  id: string; label: string; mode: 'manual' | 'monthly' | 'perCleaning'; start: string; end: string;
  income: number; cost: number | null; weeklyHours: number; costCategory: Category;
  clientId: string; propertyId: string; workerId: string; notes: string;
  overrides: Record<string, { income: number; cost: number | null; weeklyHours: number }>;
}
export interface FinanceSettings { version: 1; rates: Rate[]; adjustments: Record<string, ServiceAdjustment>; expenses: Expense[]; incomes?: FinancialIncome[]; policies?: ConsumptionPolicy[] }
export interface Filters { start: string; end: string; clients: string[]; properties: string[]; workers: string[] }
export const newSettings = (): FinanceSettings => ({ version: 1, rates: [], adjustments: {}, expenses: [] });
export const validDate = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date) &&
  Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date;
export const parseAmount = (value: string, decimals = 3): number | null => {
  const normalized = value.trim().replace(',', '.');
  if (!new RegExp(`^\\d+(?:\\.\\d{1,${decimals}})?$`).test(normalized)) return null;
  const result = Math.round(Number(normalized) * 10 ** decimals);
  return Number.isSafeInteger(result) && result <= 1000000000 ? result : null;
};
export function priceAt(rates: Rate[], item: ItemId, date: string, workerId = ''): number {
  const applicable = rates.filter(rate => rate.item === item && rate.date <= date && (!rate.workerId || rate.workerId === workerId));
  const specific = applicable.filter(rate => rate.workerId === workerId && !!workerId);
  const latest = [...(specific.length ? specific : applicable.filter(rate => !rate.workerId))].sort((a, b) => b.date.localeCompare(a.date))[0];
  return latest?.mills ?? COST_ITEMS.find(cost => cost.id === item)!.mills;
}
export function setRate(rates: Rate[], rate: Rate): Rate[] {
  return [...rates.filter(old => !(old.item === rate.item && old.date === rate.date && (old.workerId || '') === (rate.workerId || ''))), rate];
}
export interface CalculatedService extends FinancialService {
  costs: Record<Category, number>; expense: number; result: number | null; pending: string[]; estimated: boolean;
}
export function calculateService(service: FinancialService, settings: FinanceSettings): CalculatedService {
  const adjustment = settings.adjustments[service.id];
  const pending: string[] = (service.unpricedConsumptions || []).map(name => `Tarifa pendiente: ${name}`);
  let laborMills = 0;
  let estimated = service.revenueEstimated;
  if (service.revenue === null) pending.push('Ingreso pendiente');
  if (!service.workers.length) pending.push('Personal sin asignar');
  for (const worker of service.workers) {
    const override = adjustment?.minutes?.[worker.id];
    const minutes = override ?? worker.minutes;
    if (minutes === null) pending.push(`Horas pendientes: ${worker.name}`);
    else laborMills += minutes * priceAt(settings.rates, 'labor', service.date, worker.id) / 60;
    if (override === undefined && !worker.actual) estimated = true;
  }
  const quantities = { ...service.quantities, ...adjustment?.quantities };
  let laundryMills = 0;
  let supplyMills = 0;
  for (const item of QUANTITY_ITEMS) {
    const quantity = item.id === 'trashSack100L' && service.date < TRASH_SACK_START ? 0 : quantities[item.id] ?? (item.id === 'trashSack100L' ? 0 : undefined);
    if (quantity === undefined) {
      if (!adjustment?.reviewed) pending.push(`Cantidad pendiente: ${item.label}`);
      continue;
    }
    const amount = quantity * priceAt(settings.rates, item.id, service.date);
    if (item.category === 'laundry') laundryMills += amount;
    else supplyMills += amount;
  }
  if (!adjustment?.reviewed) estimated = true;
  const cleaning = service.type.trim().toLowerCase().startsWith('limpieza') || service.type.trim().toLowerCase() === 'cleaning';
  if (!service.type.trim()) pending.push('Tipo de servicio pendiente para productos');
  if (cleaning && service.revenue === null) pending.push('Base de productos pendiente');
  const products = cleaning && service.revenue !== null ? Math.round((service.revenue - (service.additionalRevenue || 0)) * priceAt(settings.rates, 'products', service.date) / 100000) : 0;
  const costs = { personal: Math.round(laborMills / 10), laundry: Math.round(laundryMills / 10), supplies: Math.round(supplyMills / 10), products, salary: 0, other: 0 };
  const expense = Object.values(costs).reduce((sum, amount) => sum + amount, 0);
  return { ...service, costs, expense, result: service.revenue === null ? null : service.revenue - expense, pending, estimated };
}
export interface Summary {
  revenue: number; costs: Record<Category, number>; expense: number; result: number; margin: number | null;
  pending: number; estimated: number; services: number;
}
function summarize(services: CalculatedService[], expenses: Expense[]): Summary {
  const costs = { personal: 0, laundry: 0, supplies: 0, products: 0, salary: 0, other: 0 };
  for (const service of services) for (const key of Object.keys(costs) as Category[]) costs[key] += service.costs[key];
  for (const expense of expenses) costs[expense.category] += expense.cents;
  const revenue = services.reduce((sum, service) => sum + (service.revenue ?? 0), 0);
  const expense = Object.values(costs).reduce((sum, amount) => sum + amount, 0);
  return { revenue, costs, expense, result: revenue - expense, margin: revenue > 0 ? (revenue - expense) / revenue * 100 : null,
    pending: services.filter(service => service.pending.length).length, estimated: services.filter(service => service.estimated).length, services: services.length };
}
export function monthlySalaryExpenses(rates: Rate[], start: string, end: string): Expense[] {
  if (!validDate(start) || !validDate(end) || start > end) return [];
  const result: Expense[] = [];
  const cursor = new Date(start + 'T00:00:00Z');
  const endTime = Date.parse(end + 'T00:00:00Z');
  let month = ''; let totalMills = 0; let includedDays = 0; let lastDate = '';
  const finishMonth = () => {
    const monthEnd = new Date(month + '-01T00:00:00Z');
    monthEnd.setUTCMonth(monthEnd.getUTCMonth() + 1, 0);
    const daysInMonth = monthEnd.getUTCDate();
    result.push({ id: `salary:${month}`, date: lastDate, label: `Salario dirección turismo · ${month} · ${includedDays}/${daysInMonth} días`,
      cents: Math.round(totalMills / daysInMonth / 10), category: 'salary', clientId: '', propertyId: '', workerId: '', automatic: true });
  };
  while (cursor.getTime() <= endTime) {
    const day = cursor.toISOString().slice(0, 10);
    if (month && month !== day.slice(0, 7)) { finishMonth(); totalMills = 0; includedDays = 0; }
    month = day.slice(0, 7); lastDate = day; includedDays += 1;
    totalMills += priceAt(rates, 'tourismSalary', day);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  finishMonth();
  return result;
}
export function analyze(services: FinancialService[], settings: FinanceSettings, filters: Filters) {
  const inPeriod = (date: string) => date >= filters.start && date <= filters.end;
  const match = (ids: string[], id: string) => !ids.length || ids.includes(id);
  const candidates = services.map(service => applyFinanceRules(service, settings)).filter(service => inPeriod(service.date) && match(filters.clients, service.clientId) &&
    match(filters.properties, service.propertyId) && (!filters.workers.length || service.workers.some(worker => filters.workers.includes(worker.id))));
  const excludedIncomeServices = candidates.filter(service => service.revenue === null || service.revenue <= 0);
  const selected = candidates.filter(service => service.revenue !== null && service.revenue > 0)
    .map(service => calculateService(service, settings));
  const expenses = [...settings.expenses, ...monthlySalaryExpenses(settings.rates, filters.start, filters.end)].filter(expense => inPeriod(expense.date) && match(filters.clients, expense.clientId) &&
    match(filters.properties, expense.propertyId) && match(filters.workers, expense.workerId));
  const incomes = buildExternalIncomes(settings, filters);
  const combined = [...selected, ...incomes];
  const ids = [...new Set([...selected.map(service => service.clientId), ...incomes.filter(service => service.clientId).map(service => service.clientId), ...expenses.filter(expense => expense.clientId).map(expense => expense.clientId)])];
  const clients = ids.map(id => ({ id, name: services.find(service => service.clientId === id)?.clientName || 'Cliente sin servicios en este periodo',
    ...summarize([...selected.filter(service => service.clientId === id), ...incomes.filter(service => !!id && service.clientId === id)], expenses.filter(expense => !!id && expense.clientId === id)) }));
  return { services: selected, incomes, excludedIncomeServices, expenses, clients, total: { ...summarize(combined, expenses), services: selected.length }, general: summarize(incomes.filter(service => !service.clientId), expenses.filter(expense => !expense.clientId)) };
}
// Validate imported/local JSON before it can participate in a financial calculation.
export function readSettings(value: unknown): FinanceSettings {
  const data = value as FinanceSettings;
  if (!data || data.version !== 1 || !Array.isArray(data.rates) || !Array.isArray(data.expenses) ||
    !data.adjustments || typeof data.adjustments !== 'object' || Array.isArray(data.adjustments)) throw new Error('Formato de copia no válido');
  const number = (n: unknown, max = 1000000000) => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0 && n <= max;
  for (const rate of data.rates) if (!rate || !COST_ITEMS.some(item => item.id === rate.item) || !validDate(rate.date) || !number(rate.mills) ||
    (rate.item === 'products' && rate.mills > 100000) ||
    (rate.workerId !== undefined && typeof rate.workerId !== 'string')) throw new Error('Tarifa no válida');
  for (const expense of data.expenses) if (!expense || !validDate(expense.date) || !number(expense.cents) ||
    !['personal', 'laundry', 'supplies', 'products', 'salary', 'other'].includes(expense.category) || expense.automatic !== undefined ||
    ['id', 'label', 'clientId', 'propertyId', 'workerId'].some(key => typeof expense[key] !== 'string')) throw new Error('Gasto no válido');
  if (new Set(data.expenses.map(expense => expense.id)).size !== data.expenses.length) throw new Error('Gastos duplicados');
  for (const adjustment of Object.values(data.adjustments)) {
    if (!adjustment || typeof adjustment !== 'object' || (adjustment.reviewed !== undefined && typeof adjustment.reviewed !== 'boolean')) throw new Error('Ajuste no válido');
    for (const [key, quantity] of Object.entries(adjustment.quantities || {})) if (!QUANTITY_ITEMS.some(item => item.id === key) || !number(quantity, 100000)) throw new Error('Cantidad no válida');
    for (const minutes of Object.values(adjustment.minutes || {})) if (!number(minutes, 1440)) throw new Error('Horas no válidas');
    if (adjustment.reviewed && QUANTITY_ITEMS.some(item => item.id !== 'trashSack100L' && adjustment.quantities?.[item.id] === undefined)) throw new Error('Faltan cantidades revisadas');
  }
  validateFinanceExtras(data);
  return data;
}

export function applyFinanceRules(service: FinancialService, settings: FinanceSettings): FinancialService {
  let result = { ...service, quantities: { ...service.quantities } };
  const policies = (settings.policies || []).filter(p => p.propertyId ? p.propertyId === service.propertyId : !!p.clientId && p.clientId === service.clientId)
    .sort((a, b) => Number(!!a.propertyId) - Number(!!b.propertyId));
  const checkIn = /^check[\s-]*in/i.test(service.propertyName) || /^check[\s-]*in$/i.test(service.type.trim());
  if (checkIn) policies.push({ clientId: '', propertyId: service.propertyId, minutes: 60, personnelOnly: true });
  const effective: ConsumptionPolicy = Object.assign({ clientId: '', propertyId: '' }, ...policies);
  for (const p of [effective]) {
    for (const item of QUANTITY_ITEMS) if (p.personnelOnly || item.category === 'laundry' && p.laundry === false || ['kitchenKit','bathKit','foodKit'].includes(item.id) && p.kits === false || ['toiletPaper', 'trashSack100L'].includes(item.id) && p.consumables === false) result.quantities[item.id] = 0;
    if (p.minutes !== undefined) result = { ...result, workers: result.workers.map(w => ({ ...w, minutes: p.minutes! / result.workers.length })) };
    if (p.personnelOnly) result.type = 'check-in';
    if (p.personnelOnly || p.laundry === false && p.kits === false && p.consumables === false) result.unpricedConsumptions = [];
  }
  if (result.revenue !== null && result.revenue > 0 && (result.type.trim().toLowerCase().startsWith('limpieza') || result.type.trim().toLowerCase() === 'cleaning')) {
    // Existing inventory quantities on other clients do not imply a billing agreement.
    const chargeCloth = effective.kitchenClothIncome ?? service.clientId === '669948a6-e5c3-4a73-a151-6ccca5c82adf';
    const clothQuantity = settings.adjustments[service.id]?.quantities?.kitchenCloth ?? result.quantities.kitchenCloth;
    const kitchenClothRevenue = chargeCloth && effective.laundry !== false && (clothQuantity ?? 0) > 0
      ? Math.round(priceAt(settings.rates, 'kitchenClothIncome', service.date) / 10) : 0;
    const extra = (settings.incomes || []).filter(i => i.mode === 'perCleaning' && i.start <= service.date && (!i.end || i.end >= service.date) && (!i.clientId || i.clientId === service.clientId) && (!i.propertyId || i.propertyId === service.propertyId))
      .filter(i => !i.workerId || service.workers.some(w => w.id === i.workerId)).reduce((n, i) => n + (i.overrides[service.date.slice(0,7)]?.income ?? i.income), 0);
    result = { ...result, revenue: result.revenue + extra + kitchenClothRevenue, additionalRevenue: extra + kitchenClothRevenue, kitchenClothRevenue };
  }
  return result;
}

export function buildExternalIncomes(settings: FinanceSettings, filters: Filters): CalculatedService[] {
  if (!validDate(filters.start) || !validDate(filters.end) || filters.start > filters.end) return [];
  const result: CalculatedService[] = [];
  for (const entry of settings.incomes || []) {
    if (entry.mode === 'perCleaning' || filters.clients.length && !filters.clients.includes(entry.clientId) || filters.properties.length && !filters.properties.includes(entry.propertyId) || filters.workers.length && !filters.workers.includes(entry.workerId)) continue;
    const periods = new Map<string, { date: string; days: number; monthDays: number; labor: number }>();
    const cursor = new Date(filters.start + 'T00:00:00Z');
    while (cursor.toISOString().slice(0,10) <= filters.end) {
      const day = cursor.toISOString().slice(0,10), month = day.slice(0,7);
      if (day >= entry.start && (!entry.end || day <= entry.end) && (entry.mode !== 'manual' || day === entry.start)) {
        const days = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth()+1,0)).getUTCDate();
        const p = periods.get(month) || { date: day, days: 0, monthDays: days, labor: 0 };
        const values = entry.overrides[month] || entry;
        p.days++; p.date = day; p.labor += values.weeklyHours * 4.345 * priceAt(settings.rates, 'labor', day, entry.workerId) / 10 / days;
        periods.set(month,p);
      }
      cursor.setUTCDate(cursor.getUTCDate()+1);
    }
    for (const [month,p] of periods) {
      const values = entry.overrides[month] || entry, factor = entry.mode === 'manual' ? 1 : p.days / p.monthDays;
      const costs = { personal: Math.round(p.labor), laundry: 0, supplies: 0, products: 0, salary: 0, other: 0 };
      if (values.cost !== null) costs[entry.costCategory] += Math.round(values.cost * factor);
      const expense = Object.values(costs).reduce((n,c)=>n+c,0), revenue = Math.round(values.income * factor);
      result.push({ id: `income:${entry.id}:${month}`, type: 'external-income', date: p.date, clientId: entry.clientId, clientName: entry.label, propertyId: entry.propertyId, propertyName: entry.label, revenue, revenueEstimated: false, workers: [], quantities: {}, costs, expense, result: revenue-expense, pending: values.cost === null ? ['Coste externo pendiente'] : [], estimated: values.weeklyHours > 0 || values.cost === null });
    }
  }
  return result;
}

function validateFinanceExtras(settings: FinanceSettings) {
  const amount = (v: unknown) => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 && v <= 1000000000;
  if (settings.incomes !== undefined && !Array.isArray(settings.incomes) || settings.policies !== undefined && !Array.isArray(settings.policies)) throw new Error('Configuración financiera no válida');
  const ids = new Set<string>();
  for (const i of settings.incomes || []) {
    if (!i || typeof i.id !== 'string' || ids.has(i.id) || !['manual','monthly','perCleaning'].includes(i.mode) || !validDate(i.start) || i.end && (!validDate(i.end) || i.end < i.start) || !Object.keys({personal:0,laundry:0,supplies:0,products:0,salary:0,other:0}).includes(i.costCategory) || ['label','clientId','propertyId','workerId','notes','end'].some(k=>typeof i[k] !== 'string') || !i.label.trim()) throw new Error('Ingreso no válido');
    ids.add(i.id);
    if (!i.overrides || typeof i.overrides !== 'object' || Array.isArray(i.overrides)) throw new Error('Excepciones no válidas');
    for (const [month,v] of Object.entries(i.overrides)) if (!/^\d{4}-\d{2}$/.test(month) || !validDate(month+'-01') || !v) throw new Error('Mes no válido');
    for (const v of [i,...Object.values(i.overrides)]) if (!amount(v.income) || v.cost !== null && !amount(v.cost) || !Number.isFinite(v.weeklyHours) || v.weeklyHours < 0 || v.weeklyHours > 168) throw new Error('Importe de ingreso no válido');
    if (i.mode === 'perCleaning' && [i,...Object.values(i.overrides)].some(v => v.cost !== 0 || v.weeklyHours !== 0)) throw new Error('El suplemento no admite costes duplicados');
    if (i.mode === 'manual' && [i,...Object.values(i.overrides)].some(v => v.weeklyHours !== 0)) throw new Error('Un ingreso puntual no admite horas semanales');
  }
  for (const p of settings.policies || []) if (!p || typeof p.clientId !== 'string' || typeof p.propertyId !== 'string' || !p.clientId && !p.propertyId || ['laundry','kits','consumables','personnelOnly','kitchenClothIncome'].some(k=>p[k] !== undefined && typeof p[k] !== 'boolean') || p.minutes !== undefined && (!amount(p.minutes) || p.minutes > 1440)) throw new Error('Regla de consumos no válida');
}
