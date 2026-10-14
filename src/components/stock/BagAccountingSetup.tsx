import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useSede } from '@/contexts/SedeContext';
import { useRolePermissions } from '@/hooks/useRolePermissions';
import { useStockWarehouses } from '@/hooks/useStock';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { centralWarehouse, quantity } from '@/features/inventory/inventoryDomain';
import { formatMadridDate } from '@/utils/date';
import { cycleRpc } from '@/services/laundryCycleService';
import { readBagAccounting, readPendingBagOperation, runBagOperation, type BagAccountingPreview, type PendingBagOperation } from '@/services/stockBagAccounting';

export default function BagAccountingSetup() {
 const { activeSede }=useSede(); const {user}=useAuth();
 return activeSede&&user?<Setup key={`${activeSede.id}:${user.id}`} sede={activeSede.id} user={user.id}/>:null;
}
function Setup({sede,user}:{sede:string;user:string}) {
 const {isAdminOrManager}=useRolePermissions(); const editable=isAdminOrManager();
 const client=useQueryClient(); const [params]=useSearchParams();
 const {data:warehouses=[]}=useStockWarehouses();
 const scope=`setup:${sede}:${user}`; const query=useQuery({queryKey:['stock-bag-accounting',sede,user],queryFn:()=>readBagAccounting(sede),retry:1});
 const [start,setStart]=useState(params.get('seguimientoDesde')||'');
 const [central,setCentral]=useState('');const warehouse=central||centralWarehouse(warehouses)?.id||'';
 const [preview,setPreview]=useState<BagAccountingPreview|null>(null);
 const [pending,setPending]=useState<PendingBagOperation|null>(()=>readPendingBagOperation(scope));
 const [busy,setBusy]=useState(false);const inFlight=useRef(false);
 const [confirmed,setConfirmed]=useState(false);const [reason,setReason]=useState('');const [physical,setPhysical]=useState(false);const [message,setMessage]=useState('');
 const refresh=()=>Promise.all([client.invalidateQueries({queryKey:['stock-bag-accounting',sede]}),client.invalidateQueries({queryKey:['stock-levels',sede]}),client.invalidateQueries({queryKey:['stock-movements',sede]}),client.invalidateQueries({queryKey:['stock-sede-settings',sede]})]);
 async function calculate() {
  if(inFlight.current)return;inFlight.current=true;setBusy(true);setMessage('');
  try{setPreview(await cycleRpc<BagAccountingPreview>('preview_stock_bag_accounting_checked',{_sede:sede,_central:warehouse,_start:start}));}
  catch(error){setPreview(null);setMessage((error as Error).message);}finally{setBusy(false);inFlight.current=false;}
 }
 async function perform(operation:PendingBagOperation) {
  if(inFlight.current)return;inFlight.current=true;setBusy(true);setMessage('');setPending(operation);
  try{await runBagOperation(scope,operation);setPending(null);setPreview(null);setConfirmed(false);setPhysical(false);setReason('');setMessage('Operación guardada.');await refresh();}
  catch(error){setPending(readPendingBagOperation(scope));setMessage((error as Error).message);if(String((error as {code?:string}).code)==='40001')setPreview(null);}
  finally{setBusy(false);inFlight.current=false;}
 }
 const locked=busy||!!pending||!editable;
 return <Card><CardHeader><CardTitle>Arranque diario con los registros disponibles</CardTitle></CardHeader><CardContent className="space-y-4">
  <p className="text-sm text-muted-foreground">Entradas de ropa, amenities y consumibles menos lo confirmado en bolsas. El stock anterior queda pendiente. Los negativos son saldos parciales y no bloquean la preparación; un producto contado sí conserva su límite real.</p>
  {query.isError&&<p role="alert">No se pudo comprobar el modo de inventario. <Button variant="link" onClick={()=>query.refetch()}>Reintentar consulta</Button></p>}
  {message&&<p role="status" className="rounded-lg bg-muted p-3 text-sm">{message}</p>}
  {pending&&<div role="alert" className="rounded-lg border border-amber-300 p-3 text-sm"><p>Esta operación está pendiente de confirmar. Reintentar conserva las cantidades y la identidad originales.</p><Button disabled={busy||!editable} onClick={()=>perform(pending)}>Reintentar operación pendiente</Button></div>}
  {query.data?.active ? <>
   <p className="rounded-lg bg-primary/5 p-4 text-sm font-medium">Descuento por bolsas activo desde {query.data.config?.start_date}. El consumo estimado por hora de limpieza está desactivado.</p>
   <Link className="inline-block text-sm font-semibold text-primary underline" to="/inventory/stock">Consultar saldos y contar material suelto</Link>
   {query.data.bags.length>0&&<details className="rounded-lg border p-3"><summary className="cursor-pointer text-sm font-medium">Resolver una bolsa deshecha o devuelta</summary><p className="my-3 text-xs text-muted-foreground">Solo confirma material realmente devuelto y sacado de la bolsa. Una incidencia o cancelación no lo devuelve al almacén.</p><Input aria-label="Motivo de resolución de bolsa" value={reason} disabled={locked} onChange={e=>setReason(e.target.value)} placeholder="Qué se ha hecho físicamente"/><label className="my-3 flex gap-2 text-sm"><input type="checkbox" checked={physical} disabled={locked} onChange={e=>setPhysical(e.target.checked)}/>He comprobado que este material limpio vuelve a estar suelto en el almacén.</label><div className="max-h-72 divide-y overflow-auto">{query.data.bags.map(bag=><div key={bag.task_key} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"><span>{bag.property_code}{bag.taskDate?' · '+bag.taskDate:''}{bag.taskStatus==='cancelled'?' · cancelada':''}{bag.taskStatus===null?' · tarea retirada':''}</span><Button variant="outline" size="sm" disabled={locked||!physical||reason.trim().length<3||bag.taskStatus===null} onClick={()=>perform({name:'resolve_stock_bag_checked',args:{_task:bag.task_key,_expected:bag.lines,_action:bag.delivered?'return':'unpack',_reason:reason,_confirmed:physical,_operation:crypto.randomUUID()}})}>{bag.delivered?'Confirmar devolución y desmontaje':'Confirmar bolsa deshecha'}</Button></div>)}</div></details>}
   {editable&&<details className="rounded-lg border p-3"><summary className="cursor-pointer text-sm font-medium">Cerrar este modo tras el recuento</summary><p className="my-3 text-sm text-muted-foreground">Primero cuenta cada producto en el almacén central. Después podrás preparar la apertura del circuito físico completo con limpia, instalada, sucia y pendiente de lavandería.</p><Button variant="outline" disabled={locked} onClick={()=>perform({name:'close_stock_bag_accounting_checked',args:{_sede:sede,_operation:crypto.randomUUID()}})}>Cerrar arranque provisional</Button></details>}
  </> : query.data?.config ? <p className="text-sm">Arranque provisional cerrado. Su historial se conserva; prepara el circuito físico con los recuentos comprobados.</p> : query.isSuccess&&<>
   <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">Almacén central<select aria-label="Almacén del descuento por bolsas" value={warehouse} disabled={locked} onChange={e=>{setCentral(e.target.value);setPreview(null);}} className="mt-1 h-11 w-full rounded-md border bg-background px-3">{warehouses.filter(w=>w.location_type==='central').map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select></label><label className="text-sm">Primer día de los registros<Input aria-label="Primer día del descuento por bolsas" type="date" max={formatMadridDate(new Date())} value={start} disabled={locked} onChange={e=>{setStart(e.target.value);setPreview(null);}}/></label></div>
   <Button variant="outline" disabled={locked||!warehouse||!start} onClick={calculate}>Calcular vista previa</Button>
   {preview&&<><p className="text-sm">{preview.rows.length} productos · {preview.bags.length} bolsas registradas. La puesta en marcha hará una conciliación; no volverá a sumar las recepciones ni mantendrá el descuento por limpieza. Los detalles antiguos que faltan se excluyen del cálculo y se indican por producto.</p><div className="overflow-x-auto"><table className="w-full text-sm"><caption className="sr-only">Vista previa del saldo parcial</caption><thead><tr><th className="p-2 text-left">Producto</th><th className="p-2 text-right">Introducido</th><th className="p-2 text-right">En bolsas</th><th className="p-2 text-right">Saldo parcial</th></tr></thead><tbody>{preview.rows.map(row=><tr key={row.productId} className="border-t"><th className="p-2 text-left font-medium">{row.name}</th><td className="p-2 text-right">{quantity(row.introduced)}</td><td className="p-2 text-right">{quantity(row.prepared)}{row.untrackedBags>0&&<span className="block text-xs font-normal text-amber-700">{row.untrackedBags} sin detalle completo</span>}</td><td className="p-2 text-right font-semibold">{quantity(row.proposed)}</td></tr>)}</tbody></table></div><label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={confirmed} disabled={locked} onChange={e=>setConfirmed(e.target.checked)}/>He revisado estas cantidades. El stock anterior no está incluido y los saldos seguirán siendo parciales hasta contar.</label><Button disabled={locked||!confirmed||preview.rows.some(row=>row.registered===null)} onClick={()=>perform({name:'activate_stock_bag_accounting_checked',args:{_sede:sede,_central:preview.centralId,_start:preview.startDate,_fingerprint:preview.fingerprint,_operation:crypto.randomUUID()}})}>Activar descuento por bolsas con estos saldos</Button></>}
  </>}
 </CardContent></Card>;
}
