import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { parseAmount, readSettings, validDate, type FinanceSettings, type FinancialIncome, type Category, type ConsumptionPolicy, type analyze } from './financialModel';
import type { DirectoryEntry } from './financialSource';

const select = 'h-10 w-full rounded-md border border-input bg-white px-3 text-sm';
const panel = 'rounded-2xl border border-violet-100 bg-white p-5 shadow-sm';
const money = (cents: number) => new Intl.NumberFormat('es-ES', {style:'currency',currency:'EUR'}).format(cents/100);
type Directories = { clients: DirectoryEntry[]; properties: (DirectoryEntry & {clientId:string})[]; workers: DirectoryEntry[] };
type Props = Directories & { settings: FinanceSettings; onChange: (settings: FinanceSettings) => boolean };
const modes = { manual:'Puntual · una fecha', monthly:'Fijo mensual', perCleaning:'Suplemento por limpieza' };
const categories: Record<Category,string> = {personal:'Personal',laundry:'Lavandería',supplies:'Consumibles',products:'Productos',salary:'Dirección turismo',other:'Otros'};
function LinkFields({ clients, properties, workers, clientId, propertyId, workerId, onChange }: Directories & {clientId:string;propertyId:string;workerId:string;onChange:(client:string,property:string,worker:string)=>void}) {
  return <><label className="text-sm">Cliente del ingreso<select className={select} value={clientId} onChange={e=>onChange(e.target.value,'',workerId)}><option value="">General · sin cliente</option>{clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
    <label className="text-sm">Propiedad del ingreso<select className={select} value={propertyId} onChange={e=>onChange(properties.find(p=>p.id===e.target.value)?.clientId || clientId,e.target.value,workerId)}><option value="">Sin propiedad</option>{properties.filter(p=>!clientId || p.clientId===clientId).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
    <label className="text-sm">Trabajador del ingreso<select className={select} value={workerId} onChange={e=>onChange(clientId,propertyId,e.target.value)}><option value="">Sin trabajador</option>{workers.filter(w=>w.name.trim().toUpperCase()!=='NOT COUNT').map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select></label></>;
}
export function IncomePanel({settings,result,date,onChange,...directories}: Props & {result:ReturnType<typeof analyze>;date:string}) {
  const [editing,setEditing] = useState<FinancialIncome | null>(null);
  const [formKey,setFormKey] = useState(0);
  const remove = (id:string) => { if (onChange({...settings,incomes:(settings.incomes || []).filter(i=>i.id!==id)})) { setEditing(null);setFormKey(n=>n+1); } };
  return <section className={`${panel} space-y-5`}><h2 className="font-semibold text-[#310984]">Otros ingresos · sin IVA</h2>
    <p className="text-sm text-slate-600">Los fijos se generan una vez por mes y se prorratean por los días seleccionados. Un cambio para un mes sustituye el fijo de ese mes. Los puntuales se cuentan en su fecha. Personal mensual = horas semanales × 4,345 × coste/hora. Estos ingresos no generan el 3% de productos.</p>
    <IncomeForm key={`${editing?.id || 'new'}:${formKey}`} {...directories} date={date} entry={editing} onCancel={()=>{setEditing(null);setFormKey(n=>n+1);}} onSave={entry=>{if(onChange({...settings,incomes:[...(settings.incomes || []).filter(i=>i.id!==entry.id),entry]})){setEditing(null);setFormKey(n=>n+1);return true;}return false;}} />
    <h3 className="font-semibold text-[#310984]">Servicios configurados</h3>
    {(settings.incomes || []).map(entry=><div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-violet-50 p-3 text-sm" key={entry.id}><div><strong>{entry.label}</strong><p>{modes[entry.mode]} · {money(entry.income)} · desde {entry.start}{entry.end && ` hasta ${entry.end}`}</p><p>{entry.cost===null?'Coste pendiente':`Coste adicional: ${money(entry.cost)}`}{entry.weeklyHours>0 && ` · ${entry.weeklyHours} h/semana`} · {directories.clients.find(c=>c.id===entry.clientId)?.name || 'General'}</p>{Object.entries(entry.overrides).map(([month,v])=><p key={month}>Excepción {month}: {money(v.income)} · coste {v.cost===null?'pendiente':money(v.cost)} · {v.weeklyHours} h/semana <button className="text-violet-800 underline" onClick={()=>{const overrides={...entry.overrides};delete overrides[month];onChange({...settings,incomes:(settings.incomes || []).map(i=>i.id===entry.id?{...entry,overrides}:i)});}}>Quitar excepción</button></p>)}</div><div className="flex gap-2"><Button variant="outline" onClick={()=>setEditing(entry)}>Editar ingreso</Button><Button variant="outline" onClick={()=>remove(entry.id)}>Quitar ingreso</Button></div></div>)}
    {!settings.incomes?.length && <p className="text-sm text-slate-500">Todavía no hay ingresos externos.</p>}
    <h3 className="font-semibold text-[#310984]">Ingresos externos incluidos en este periodo</h3>
    <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr>{['Concepto / mes','Ingresos','Gastos','Resultado'].map(h=><th className="p-2 text-left" key={h}>{h}</th>)}</tr></thead><tbody>{result.incomes.map(i=><tr key={i.id} className="border-t"><th className="p-2 text-left font-normal">{i.propertyName} · {i.date.slice(0,7)}{i.pending.length>0 && <span className="block text-amber-800">Coste pendiente · resultado provisional</span>}</th><td className="p-2">{money(i.revenue || 0)}</td><td className="p-2">{money(i.expense)}</td><td className="p-2">{money(i.result || 0)}</td></tr>)}</tbody></table></div>
    <p className="text-xs text-slate-500">Los suplementos por limpieza aparecen en los ingresos de cada servicio, junto a su tarifa base; no se añaden de nuevo en esta tabla.</p>
  </section>;
}
function IncomeForm({entry,date,onSave,onCancel,...directories}: Directories & {entry:FinancialIncome|null;date:string;onSave:(entry:FinancialIncome)=>boolean;onCancel:()=>void}) {
  const [label,setLabel]=useState(entry?.label || ''); const [mode,setMode]=useState<FinancialIncome['mode']>(entry?.mode || 'manual');
  const [start,setStart]=useState(entry?.start || date); const [end,setEnd]=useState(entry?.end || '');
  const [income,setIncome]=useState(String((entry?.income || 0)/100)); const [cost,setCost]=useState(entry?.cost===null?'':String((entry?.cost || 0)/100));
  const [hours,setHours]=useState(String(entry?.weeklyHours || 0)); const [category,setCategory]=useState<Category>(entry?.costCategory || 'other');
  const [clientId,setClient]=useState(entry?.clientId || ''); const [propertyId,setProperty]=useState(entry?.propertyId || '');const [workerId,setWorker]=useState(entry?.workerId || '');
  const [notes,setNotes]=useState(entry?.notes || '');const [month,setMonth]=useState('');const [error,setError]=useState('');
  const selectMonth=(value:string)=>{setMonth(value);const values=entry?.overrides[value] || entry;if(values){setIncome(String(values.income/100));setCost(values.cost===null?'':String(values.cost/100));setHours(String(values.weeklyHours));}};
  return <form className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-4" onSubmit={e=>{e.preventDefault();const amount=parseAmount(income,2),expense=cost.trim()?parseAmount(cost,2):null,weekly=Number(hours.replace(',','.'));
    if(!label.trim() || amount===null || cost.trim() && expense===null || !validDate(start) || end && (!validDate(end) || end<start) || !Number.isFinite(weekly) || weekly<0 || weekly>168 || month && (!entry || !validDate(month+'-01') || month+'-01'<start.slice(0,7)+'-01' || end && month>end.slice(0,7))) {setError('Revisa el concepto, las fechas, los importes y las horas.');return;}
    const values={income:amount,cost:mode==='perCleaning'?0:expense,weeklyHours:mode==='monthly'?weekly:0};
    const result:FinancialIncome={id:entry?.id || crypto.randomUUID(),label:label.trim(),mode,start,end:mode==='manual'?'':end,clientId,propertyId,workerId,notes,costCategory:category,...values,overrides:entry?.mode===mode?{...entry.overrides}:{}};
    if(month && entry && mode!=='manual'){Object.assign(result,{income:entry.income,cost:entry.cost,weeklyHours:entry.weeklyHours});result.overrides[month]=values;}
    try{readSettings({version:1,rates:[],expenses:[],adjustments:{},incomes:[result]});if(onSave(result))setError('');}catch{setError('Configuración de ingreso no válida.');}
  }}>
    <label className="text-sm">Concepto del ingreso<Input value={label} maxLength={200} onChange={e=>setLabel(e.target.value)} /></label>
    <label className="text-sm">Tipo de ingreso<select className={select} value={mode} onChange={e=>{setMode(e.target.value as FinancialIncome['mode']);setMonth('');}}>{Object.entries(modes).map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>
    <label className="text-sm">Ingreso sin IVA<Input inputMode="decimal" value={income} onChange={e=>setIncome(e.target.value)} /></label>
    <label className="text-sm">{mode==='manual'?'Fecha del ingreso':'Inicio del servicio'}<Input type="date" value={start} onChange={e=>setStart(e.target.value)} /></label>
    {mode!=='manual' && <label className="text-sm">Fin del servicio · opcional<Input type="date" value={end} onChange={e=>setEnd(e.target.value)} /></label>}
    {mode!=='perCleaning' && <><label className="text-sm">Coste externo sin IVA<Input inputMode="decimal" value={cost} placeholder="Vacío = pendiente; 0 = sin coste" onChange={e=>setCost(e.target.value)} /></label><label className="text-sm">Categoría del coste<select className={select} value={category} onChange={e=>setCategory(e.target.value as Category)}>{Object.entries(categories).map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label></>}
    {mode==='monthly' && <label className="text-sm">Horas de personal por semana<Input inputMode="decimal" value={hours} onChange={e=>setHours(e.target.value)} /></label>}
    <LinkFields {...directories} clientId={clientId} propertyId={propertyId} workerId={workerId} onChange={(c,p,w)=>{setClient(c);setProperty(p);setWorker(w);}} />
    <label className="text-sm">Notas<Input value={notes} maxLength={1000} onChange={e=>setNotes(e.target.value)} /></label>
    {entry && mode!=='manual' && <label className="text-sm">Cambiar importes solo este mes · opcional<Input type="month" value={month} onChange={e=>selectMonth(e.target.value)} /></label>}
    <Button type="submit" className="bg-[#310984]">{entry?'Actualizar ingreso':'Añadir ingreso'}</Button>{entry && <Button type="button" variant="outline" onClick={onCancel}>Cancelar edición</Button>}
    {error && <p role="alert" className="col-span-full text-sm text-red-700">{error}</p>}
  </form>;
}
export function ConsumptionPanel({settings,clients,properties,onChange}:Omit<Props,'workers'>) {
  const [clientId,setClient]=useState('');const [propertyId,setProperty]=useState('');const [laundry,setLaundry]=useState(true);const [kits,setKits]=useState(true);const [consumables,setConsumables]=useState(true);const [minutes,setMinutes]=useState('');const [error,setError]=useState('');
  const selectRule=(client:string,property:string)=>{setClient(client);setProperty(property);const p=settings.policies?.find(p=>property?p.propertyId===property:!p.propertyId && p.clientId===client);setLaundry(p?.laundry!==false);setKits(p?.kits!==false);setConsumables(p?.consumables!==false);setMinutes(p?.minutes===undefined?'':String(p.minutes/60));};
  return <div className="space-y-3 border-t pt-4"><h3 className="font-semibold text-[#310984]">Consumos personalizados</h3><p className="text-sm text-slate-600">Las cantidades vienen de cada propiedad y sus reglas activas de inventario. Aquí puedes excluir categorías de gasto y corregir la duración total. La regla de propiedad prevalece sobre la de cliente. Los check-in cuentan una hora total y solo personal.</p>
    <form className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-4" onSubmit={e=>{e.preventDefault();const value=minutes.trim()?parseAmount(minutes,2):null;if(!clientId && !propertyId || minutes.trim() && (value===null || value%25 || value>2400)){setError('Selecciona cliente o propiedad. Las horas deben ir en tramos de 0,25, hasta 24.');return;}const policy:ConsumptionPolicy={clientId,propertyId,laundry,kits,consumables,...(value===null?{}:{minutes:value/100*60})};if(onChange({...settings,policies:[...(settings.policies || []).filter(p=>propertyId?p.propertyId!==propertyId:p.propertyId || p.clientId!==clientId),policy]}))setError('');}}>
      <label className="text-sm">Cliente de la regla<select className={select} value={clientId} onChange={e=>selectRule(e.target.value,'')}><option value="">Selecciona cliente</option>{clients.map(c=><option value={c.id} key={c.id}>{c.name}</option>)}</select></label>
      <label className="text-sm">Propiedad de la regla<select className={select} value={propertyId} onChange={e=>selectRule(properties.find(p=>p.id===e.target.value)?.clientId || clientId,e.target.value)}><option value="">Todas las propiedades del cliente</option>{properties.filter(p=>!clientId || p.clientId===clientId).map(p=><option value={p.id} key={p.id}>{p.name}</option>)}</select></label>
      <label className="text-sm">Horas totales · vacío = ficha<Input inputMode="decimal" value={minutes} onChange={e=>setMinutes(e.target.value)} /></label>
      <div className="space-y-2 text-sm">{([['Lavandería',laundry,setLaundry],['Kits de amenities',kits,setKits],['Papel higiénico',consumables,setConsumables]] as const).map(([name,value,change])=><label key={name} className="flex gap-2"><input type="checkbox" checked={value} onChange={e=>change(e.target.checked)} />{name}</label>)}</div><Button className="bg-[#310984]" type="submit">Aplicar regla al borrador</Button>{error && <p role="alert" className="col-span-full text-red-700">{error}</p>}
    </form>
    {(settings.policies || []).map((p,index)=><div key={`${p.propertyId}:${p.clientId}`} className="flex flex-wrap justify-between gap-3 rounded-lg bg-violet-50 p-3 text-sm"><span>{properties.find(property=>property.id===p.propertyId)?.name || clients.find(c=>c.id===p.clientId)?.name || 'Regla personalizada'} · lavandería {p.laundry===false?'no':'según ficha'} · amenities {p.kits===false?'no':'según ficha'} · papel {p.consumables===false?'no':'según ficha'}{p.minutes!==undefined && ` · ${p.minutes/60} h totales`}</span><div className="flex gap-2"><Button variant="outline" size="sm" onClick={()=>selectRule(p.clientId,p.propertyId)}>Editar regla</Button><Button variant="outline" size="sm" onClick={()=>onChange({...settings,policies:settings.policies?.filter((_,i)=>i!==index)})}>Quitar regla</Button></div></div>)}
  </div>;
}
