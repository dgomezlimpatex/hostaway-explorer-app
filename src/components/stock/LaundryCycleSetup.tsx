import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSede } from '@/contexts/SedeContext';
import { useAuth } from '@/hooks/useAuth';
import { useRolePermissions } from '@/hooks/useRolePermissions';
import { useProperties } from '@/hooks/useProperties';
import { useStockProducts, useStockWarehouses } from '@/hooks/useStock';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { buildOpeningCounts, cycleRpc, type CountKind, type CycleState } from '@/services/laundryCycleService';
import { addInventoryDays, centralWarehouse, normalizeMaterial } from '@/features/inventory/inventoryDomain';
import { formatMadridDate } from '@/utils/date';

const labels: Record<CountKind, string> = { clean: 'Limpia en almacenes', installed: 'Instalada', dirty: 'Sucia por propiedad', outside: 'Pendiente en lavandería',rejected:'Rechazada en el almacén',collected:'Sucia recogida en el almacén' };
type PendingCycleOperation = { name: string; args: Record<string,unknown> };
function stored<T>(key: string): T | null { try { return JSON.parse(localStorage.getItem(key) || 'null') as T | null; } catch { return null; } }
function storeLocal(key: string, value: unknown): boolean { try { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key,JSON.stringify(value)); return true; } catch { return false; } }
export default function LaundryCycleSetup() {
 const { activeSede } = useSede();
 const { user } = useAuth();
 if (!activeSede) return null;
 return <CycleSetup key={`${activeSede.id}:${user?.id}`} sedeId={activeSede.id} storageScope={`${activeSede.id}:${user?.id}`} />;
}
function CycleSetup({ sedeId, storageScope }: { sedeId: string; storageScope: string }) {
 const { isAdminOrManager: checkAdmin } = useRolePermissions();
 const isAdminOrManager = checkAdmin();
 const { data: properties = [] } = useProperties();
 const { data: warehouses = [] } = useStockWarehouses();
 const { data: products = [] } = useStockProducts();
 const query = useQuery({ queryKey: ['laundry-complete-cycle', storageScope], queryFn: () => cycleRpc<CycleState>('read_laundry_cycle_checked', { _sede: sedeId }), retry: false });
 const state = query.data;
 const [selected, setSelected] = useState<string[]>([]);
 const [central, setCentral] = useState('');
 const [start, setStart] = useState(addInventoryDays(formatMadridDate(new Date()), 1));
 const [collection, setCollection] = useState('');
 const [destination, setDestination] = useState('');
 const [rejection, setRejection] = useState('');
 const [strict, setStrict] = useState(false);
 const draftKey=`laundry-cycle-draft-v1:${storageScope}`;
 const pendingKey=`laundry-cycle-operation-v1:${storageScope}`;
 const [values, setValues] = useState<Record<string, string>>(()=>stored<{values:Record<string,string>}>(draftKey)?.values ?? {});
 const [prepared, setPrepared] = useState<Record<string, string>>(()=>stored<{prepared:Record<string,string>}>(draftKey)?.prepared ?? {});
 const [kind, setKind] = useState<CountKind>('clean');
 const [search, setSearch] = useState('');
 const [busy, setBusy] = useState(false);
 const [message, setMessage] = useState('');
 const [confirmed, setConfirmed] = useState(false);
 const [dispatch, setDispatch] = useState(false);
 const [dispatchValues, setDispatchValues] = useState<Record<string,string>>({});
 const [reason, setReason] = useState('');
 const [pendingOperation, setPendingOperation] = useState<PendingCycleOperation | null>(()=>stored<PendingCycleOperation>(pendingKey));
 const [lossProduct, setLossProduct] = useState('');
 const [lossQuantity, setLossQuantity] = useState('');
 const [lossConfirmed, setLossConfirmed] = useState(false);
 const [adopted, setAdopted] = useState<string[]>([]);
 const [adoptLocations, setAdoptLocations] = useState<Record<string,'prepared'|'delivered'>>({});
 const mutationInFlight = useRef(false);
 useEffect(()=>{ const timer=setTimeout(()=>storeLocal(draftKey,{values,prepared}),200); return ()=>clearTimeout(timer); },[draftKey,values,prepared]);
 useEffect(() => {
  if (!state) return;
  if (state.config) { setSelected(state.scope); setCentral(state.config.central_id); setStart(state.config.start_date); setCollection(state.config.collection_mode); setDestination(state.config.collection_destination); setRejection(state.config.rejection_mode); setStrict(state.config.strict_receipts); }
  setValues(old => ({ ...Object.fromEntries(state.requirements.filter(r => r.quantity != null).map(r => [r.key, String(r.quantity)])), ...old }));
  setPrepared(old => ({ ...Object.fromEntries(state.requirements.filter(r => r.preparedQuantity != null).map(r => [r.key, String(r.preparedQuantity)])), ...old }));
 }, [state]);
 const requirements = useMemo(() => state?.requirements ?? [], [state?.requirements]);
 const rows = requirements.filter(r => r.kind === kind && normalizeMaterial(r.productName + ' ' + r.locationName).includes(normalizeMaterial(search)));
 const countReady = useMemo(() => { try { buildOpeningCounts(requirements, values, prepared); return true; } catch { return false; } }, [requirements, values, prepared]);
 const productName = (id: string) => products.find(p => p.id === id)?.name || 'Producto pendiente de identificar';
 async function perform(name: string, args: Record<string,unknown>) {
  if (mutationInFlight.current) return;
  mutationInFlight.current=true;
  if (!storeLocal(pendingKey,{name,args})) { mutationInFlight.current=false; setMessage('El navegador no puede guardar el reintento. Libera espacio o permite el almacenamiento antes de confirmar.'); return; }
  setBusy(true); setMessage(''); setPendingOperation({ name, args });
  try { await cycleRpc(name, args); setPendingOperation(null); storeLocal(pendingKey,null); setConfirmed(false); setDispatchValues({});setLossConfirmed(false);setLossQuantity('');setLossProduct('');setReason('');setAdopted([]); await query.refetch(); setMessage('Guardado correctamente.'); }
  catch (error) {
   const code=(error as Error & {code?:string}).code;
   if (code && ['P0001','40001','42501','22023','PGRST202','42883','23514'].includes(code)) { setPendingOperation(null); storeLocal(pendingKey,null); }
   setMessage(error instanceof Error ? error.message : 'No se pudo guardar.');
  }
  finally { mutationInFlight.current=false; setBusy(false); }
 }
 const unavailable = query.error && ['PGRST202','42883'].includes(String((query.error as Error & {code?:string}).code));
 const locked = busy || Boolean(pendingOperation);
 const editable = isAdminOrManager && !state?.config?.active;
 const eligibleProperties = properties.filter(p => (p.isActive ?? p.clientIsActive ?? false) && (p.linenControlEnabled ?? p.clientLinenControlEnabled ?? false));
 const dispatchRows=state?[...state.collected.filter(p=>p.quantity>0).map(p=>({key:p.product_id,productId:p.product_id,quantity:p.quantity,source:'collected'})),...state.rejected.filter(p=>p.current_quantity>0).map(p=>({key:'rejected:'+p.product_id,productId:p.product_id,quantity:p.current_quantity,source:'rejected'}))]:[];
 const lossRows=state?[...state.outside.filter(p=>p.quantity>0).map(p=>({key:p.product_id,productId:p.product_id,quantity:p.quantity,source:'outside'})),...state.rejected.filter(p=>p.current_quantity>0).map(p=>({key:'rejected:'+p.product_id,productId:p.product_id,quantity:p.current_quantity,source:'rejected'}))]:[];
 return <Card className="border-primary/20">
  <CardHeader><CardTitle className="flex flex-wrap items-center justify-between gap-2">Circuito completo de lavandería<Badge variant={state?.config?.active ? 'default' : 'outline'}>{state?.config?.active ? 'Activo en las propiedades elegidas' : 'Preparación · sin automatizar'}</Badge></CardTitle></CardHeader>
  <CardContent className="space-y-5">
   <p className="text-sm text-muted-foreground">La ropa se prepara por propiedad, se utiliza en la limpieza y se recoge. Lavandería devuelve todo junto; la recepción continúa contando por tipología.</p>
   {query.isLoading && <p role="status">Comprobando el circuito…</p>}
   {query.error && <div role="alert" className="rounded-lg bg-amber-50 p-3 text-sm">{unavailable ? 'El circuito automático aún no está disponible. Puedes seguir consultando el inventario.' : 'No se pudo comprobar el circuito. Reintenta antes de continuar.'}<Button variant="outline" className="ml-2" onClick={() => query.refetch()}>Reintentar consulta</Button></div>}
   {message && <p role="status" className="rounded-lg bg-muted p-3 text-sm">{message}</p>}
   {pendingOperation && !busy && <div role="alert" className="rounded-lg border border-amber-300 p-3"><p>La operación está pendiente de confirmar. Reintentar conserva su identidad.</p><Button onClick={() => perform(pendingOperation.name,pendingOperation.args)}>Reintentar la operación</Button></div>}
   {state && !state.config?.active && <>
    <div className="grid gap-3 sm:grid-cols-2">
     <label className="text-sm">Almacén central<select aria-label="Almacén del circuito" className="mt-1 h-11 w-full rounded-md border bg-background px-3" value={central || centralWarehouse(warehouses)?.id || ''} disabled={!editable || locked || Boolean(state.config?.opened_at)} onChange={e => setCentral(e.target.value)}>{warehouses.filter(w => w.location_type === 'central').map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select></label>
     <label className="text-sm">Primer día de servicios<Input aria-label="Primer día del circuito" type="date" value={start} disabled={!editable || locked || Boolean(state.config?.opened_at)} onChange={e => setStart(e.target.value)} /></label>
     <label className="text-sm">Cantidad que se recoge<select aria-label="Modo de recogida" className="mt-1 h-11 w-full rounded-md border bg-background px-3" value={collection || ''} disabled={!editable || locked || Boolean(state.config?.opened_at)} onChange={e => setCollection(e.target.value)}><option value="">Selecciona la operativa</option><option value="all">Toda la sucia registrada de esa propiedad</option><option value="one">Una muda por visita</option></select></label>
     <label className="text-sm">Destino de la recogida<select aria-label="Destino de la ropa sucia" className="mt-1 h-11 w-full rounded-md border bg-background px-3" value={destination || ''} disabled={!editable || locked || Boolean(state.config?.opened_at)} onChange={e => setDestination(e.target.value)}><option value="">Selecciona el destino</option><option value="central">Se reúne antes de enviar a lavandería</option><option value="laundry">Se envía directamente a lavandería</option></select></label>
     <label className="text-sm">Prendas rechazadas al recibir<select aria-label="Destino de la ropa rechazada" className="mt-1 h-11 w-full rounded-md border bg-background px-3" value={rejection} disabled={!editable || locked || Boolean(state.config?.opened_at)} onChange={e=>setRejection(e.target.value)}><option value="">Selecciona la operativa</option><option value="immediate">Vuelven a lavandería en esa entrega</option><option value="central">Quedan apartadas hasta el siguiente envío</option></select></label>
    </div>
    <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={strict} disabled={!editable || locked || Boolean(state.config?.opened_at)} onChange={e => setStrict(e.target.checked)} />Bloquear recepciones que superen la ropa pendiente registrada. Durante un piloto, el resto de propiedades puede generar recepciones sin seguimiento; aparecerán como incidencias para conciliar.</label>
    {!state.config?.opened_at && <details className="rounded-lg border p-3" open><summary className="font-medium">Propiedades del circuito · {(selected.length || state.scope.length)}</summary><Button variant="outline" size="sm" className="my-2" disabled={!editable || locked} onClick={()=>setSelected(eligibleProperties.map(p=>p.id))}>Seleccionar todas con lencería</Button><Input aria-label="Buscar propiedad del circuito" placeholder="Buscar por código" value={search} onChange={e=>setSearch(e.target.value)} className="my-2" /><div className="grid max-h-52 gap-2 overflow-auto sm:grid-cols-2">{eligibleProperties.filter(p => normalizeMaterial(p.codigo).includes(normalizeMaterial(search))).map(p => <label key={p.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={selected.includes(p.id)} disabled={!editable || locked} onChange={e=>setSelected(old=>e.target.checked?[...old,p.id]:old.filter(id=>id!==p.id))} />{p.codigo}</label>)}</div></details>}
    {!state.config?.opened_at && <Button disabled={!editable || locked || !collection || !destination || !rejection || !selected.length} onClick={()=>perform('configure_laundry_cycle_checked',{_sede:sedeId,_central:central || centralWarehouse(warehouses)?.id,_properties:selected,_start:start,_collection:collection,_destination:destination,_rejection:rejection,_strict:strict})}>Guardar alcance y operativa</Button>}
    {requirements.length > 0 && <>
     <h3 className="font-semibold">Recuento inicial</h3><p className="text-sm text-muted-foreground">Los campos vacíos quedan pendientes. Escribe cero solo después de comprobar que no hay unidades. La limpia incluye las unidades ya metidas en bolsas.</p>
     <div className="flex flex-wrap gap-2">{(Object.keys(labels) as CountKind[]).map(k => <Button key={k} variant={kind===k?'default':'outline'} size="sm" onClick={()=>{setKind(k);setSearch('');}}>{labels[k]}</Button>)}</div>
     <Input aria-label="Buscar producto o ubicación del recuento" placeholder="Buscar producto o ubicación" value={search} onChange={e=>setSearch(e.target.value)} />
     <div className="max-h-[32rem] space-y-2 overflow-auto">{rows.map(r => <div key={r.key} className="grid grid-cols-[1fr_5rem] items-center gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_7rem_7rem]"><div className="min-w-0"><p className="font-medium">{r.productName}</p><p className="text-xs text-muted-foreground">{r.locationName}</p></div><Input aria-label={`${r.productName} · ${r.locationName} · total`} inputMode="numeric" type="number" min="0" step="1" placeholder="Pendiente" value={values[r.key] ?? ''} disabled={!editable || locked} onChange={e=>setValues(old=>({...old,[r.key]:e.target.value}))} />{r.kind==='clean' && <Input aria-label={`${r.productName} · ${r.locationName} · ya preparada`} inputMode="numeric" type="number" min="0" step="1" placeholder="Preparada" value={prepared[r.key] ?? ''} disabled={!editable || locked} onChange={e=>setPrepared(old=>({...old,[r.key]:e.target.value}))} />}</div>)}</div>
     <p className="text-sm">{requirements.filter(r=>values[r.key]!==undefined && values[r.key]!=='').length} de {requirements.length} cantidades completadas.</p>
     {state.config?.opened_at && state.adoptableBags?.length>0 && <details className="rounded-lg border p-3"><summary className="font-medium">Vincular bolsas que ya estaban preparadas</summary><p className="my-2 text-sm text-muted-foreground">Selecciona solo las bolsas cuyo contenido y ubicación has comprobado físicamente. La reserva saldrá de las unidades preparadas que acabas de contar.</p>{state.adoptableBags.map(b=><label key={b.taskId} className="mb-2 flex items-start gap-2 text-sm"><input type="checkbox" disabled={locked} checked={adopted.includes(b.taskId)} onChange={e=>setAdopted(old=>e.target.checked?[...old,b.taskId]:old.filter(id=>id!==b.taskId))}/><span>{b.propertyCode} · {b.date}<select aria-label={`Dónde espera la bolsa ${b.propertyCode}`} className="my-1 block h-11 w-full rounded-md border bg-background px-2" value={adoptLocations[b.taskId]??'prepared'} disabled={locked} onChange={e=>setAdoptLocations(old=>({...old,[b.taskId]:e.target.value as 'prepared'|'delivered'}))}><option value="prepared">Aún en el almacén central</option><option value="delivered">Ya en el trastero o propiedad</option></select><span className="block text-xs text-muted-foreground">{b.lines.map(l=>`${productName(l.productId)}: ${l.quantity}`).join(' · ')}</span></span></label>)}<Button variant="outline" disabled={locked || !isAdminOrManager || !adopted.length} onClick={()=>perform('laundry_cycle_adopt_checked',{_sede:sedeId,_bags:state.adoptableBags.filter(b=>adopted.includes(b.taskId)).map(b=>({taskId:b.taskId,lines:b.lines,state:adoptLocations[b.taskId]??'prepared'}))})}>Vincular bolsas comprobadas</Button></details>}
     <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={confirmed} disabled={!editable || locked} onChange={e=>setConfirmed(e.target.checked)} />He comprobado las cantidades físicas antes de guardar o activar.</label>
     <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={!editable || locked || !countReady || !confirmed} onClick={()=>{try { perform('open_laundry_cycle_checked',{_sede:sedeId,_counts:buildOpeningCounts(requirements,values,prepared),_measured:new Date().toISOString()}); } catch(e) {setMessage((e as Error).message);}}}>Guardar recuento comprobado</Button><Button disabled={!editable || locked || !state.config?.opened_at || !confirmed} onClick={()=>perform('activate_laundry_cycle_checked',{_sede:sedeId})}>Activar estas propiedades</Button></div>
    </>}
   </>}
   {state?.config?.active && <>
    <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-primary/5 p-3"><p className="text-sm">Propiedades activadas</p><strong>{state.scope.length}</strong></div><div className="rounded-xl bg-primary/5 p-3"><p className="text-sm">Bolsas reservadas o entregadas</p><strong>{state.bags.length}</strong></div><div className="rounded-xl bg-primary/5 p-3"><p className="text-sm">Incidencias pendientes</p><strong>{state.issues.length}</strong></div></div>
    <details className="rounded-lg border p-3"><summary className="font-medium">Ropa recogida y pendiente de recuperar</summary>{state.outside.map(p=><p key={p.product_id} className="mt-2 text-sm">{productName(p.product_id)}: {p.quantity} pendiente en lavandería</p>)}{state.collected.filter(p=>p.quantity>0).map(p=><p key={p.product_id} className="mt-2 text-sm">{productName(p.product_id)}: {p.quantity} recogida, pendiente de enviar</p>)}{state.rejected.filter(p=>p.current_quantity>0).map(p=><p key={'rejected:'+p.product_id} className="mt-2 text-sm">{productName(p.product_id)}: {p.current_quantity} rechazadas apartadas en el almacén</p>)}</details>
    {isAdminOrManager && dispatchRows.length>0 && <><Button variant="outline" disabled={locked} onClick={()=>setDispatch(!dispatch)}>Registrar envío conjunto a lavandería</Button>{dispatch && <div className="space-y-3 rounded-xl border p-3">{dispatchRows.map(p=><label key={p.key} className="grid grid-cols-[1fr_6rem] items-center gap-2 text-sm">{productName(p.productId)} · {p.source==='rejected'?'rechazadas':'recogidas'} {p.quantity}<Input aria-label={`${p.source==='rejected'?'Relavar':'Enviar'} ${productName(p.productId)}`} inputMode="numeric" type="number" min="0" max={p.quantity} value={dispatchValues[p.key]??''} onChange={e=>setDispatchValues(old=>({...old,[p.key]:e.target.value}))}/></label>)}<Input aria-label="Motivo del envío" placeholder="Entrega conjunta a lavandería" value={reason} onChange={e=>setReason(e.target.value)}/><Button disabled={locked || reason.trim().length<3 || !Object.values(dispatchValues).some(v=>Number(v)>0)} onClick={()=>perform('laundry_cycle_send_checked',{_sede:sedeId,_lines:dispatchRows.filter(p=>Number(dispatchValues[p.key])>0).map(p=>({productId:p.productId,quantity:Number(dispatchValues[p.key]),expectedQuantity:p.quantity,source:p.source})),_reason:reason,_operation:crypto.randomUUID()})}>Confirmar cantidades enviadas</Button></div>}</>}
    {state.issues.map(issue=><div key={issue.id} role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm"><p>{issue.detail}</p>{issue.task_key && issue.code==='cleaning_failed' && isAdminOrManager && <Button variant="outline" disabled={locked} onClick={()=>perform('retry_laundry_cycle_checked',{_task:issue.task_key})}>Reintentar el movimiento pendiente</Button>}{issue.code!=='cleaning_failed' && isAdminOrManager && <div className="mt-2 flex flex-wrap gap-2"><Input aria-label={`Cómo se ha resuelto la incidencia ${issue.id}`} placeholder="Explica la comprobación o corrección física" value={reason} onChange={e=>setReason(e.target.value)}/><Button variant="outline" disabled={locked || reason.trim().length<3} onClick={()=>perform('laundry_cycle_resolve_issue_checked',{_issue:issue.id,_reason:reason,_operation:crypto.randomUUID()})}>Confirmar incidencia revisada</Button></div>}</div>)}

    {isAdminOrManager && lossRows.length>0 && <details className="rounded-lg border p-3"><summary className="font-medium">Registrar una pérdida definitiva</summary><p className="my-2 text-sm text-muted-foreground">Utiliza esta baja solo si se ha confirmado que las prendas no volverán. Los rechazos enviados a lavar de nuevo siguen pendientes.</p><label className="text-sm">Tipología<select aria-label="Producto perdido" className="my-2 h-11 w-full rounded-md border bg-background px-3" value={lossProduct} onChange={e=>{setLossProduct(e.target.value);setLossConfirmed(false);}}><option value="">Selecciona el producto</option>{lossRows.map(p=><option key={p.key} value={p.key}>{productName(p.productId)} · {p.source==='rejected'?'rechazada en almacén':'pendiente en lavandería'} {p.quantity}</option>)}</select></label><Input aria-label="Unidades perdidas" inputMode="numeric" type="number" min="1" step="1" value={lossQuantity} onChange={e=>{setLossQuantity(e.target.value);setLossConfirmed(false);}}/><Input aria-label="Motivo de pérdida" className="my-2" value={reason} onChange={e=>setReason(e.target.value)} placeholder="Motivo de la pérdida definitiva"/><label className="my-2 flex items-start gap-2 text-sm"><input type="checkbox" checked={lossConfirmed} onChange={e=>setLossConfirmed(e.target.checked)}/>He comprobado que estas prendas no se recuperarán.</label><Button variant="outline" disabled={locked || !lossConfirmed || !lossProduct || !/^\d+$/.test(lossQuantity) || Number(lossQuantity)<1 || reason.trim().length<3} onClick={()=>perform('laundry_cycle_writeoff_checked',{_sede:sedeId,_product:lossRows.find(p=>p.key===lossProduct)?.productId,_source:lossRows.find(p=>p.key===lossProduct)?.source,_expected:lossRows.find(p=>p.key===lossProduct)?.quantity,_quantity:Number(lossQuantity),_reason:reason,_operation:crypto.randomUUID()})}>Confirmar baja definitiva</Button></details>}
   </>}
    {state && state.bags.length>0 && <details className="rounded-lg border p-3"><summary className="font-medium">Resolver bolsas preparadas o entregadas</summary><p className="my-2 text-sm text-muted-foreground">Deshacer libera una bolsa que has desmontado. Devolver registra una bolsa realmente devuelta al almacén. Las mudas ya utilizadas conservan su historial.</p><Input aria-label="Motivo de resolución física" value={reason} onChange={e=>setReason(e.target.value)} placeholder="Describe lo que se ha hecho físicamente"/>{state.bags.map(b=><div key={b.id} className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm"><span>{b.property_code} · {b.state==='prepared'?'Preparada':'Entregada'}</span>{isAdminOrManager && <Button variant="outline" size="sm" disabled={locked || reason.trim().length<3} onClick={()=>perform('resolve_laundry_cycle_bag_checked',{_bag:b.id,_action:b.state==='prepared'?'unpack':'return',_reason:reason,_operation:crypto.randomUUID()})}>{b.state==='prepared'?'Confirmar bolsa deshecha':'Confirmar devolución'}</Button>}</div>)}</details>}
  </CardContent>
 </Card>;
}
