// Public project key only. Assistant secrets never enter source or build output.
const endpoint = 'https://qyipyygojlfhdghnraus.supabase.co/rest/v1/rpc/limpatex_assistant_read';
const publishableKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF5aXB5eWdvamxmaGRnaG5yYXVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk1NTUyNTYsImV4cCI6MjA2NTEzMTI1Nn0.8L48rM_j_95tM37KRB6pBo4PgsLcHWoMMMO-OkPGw2Q';
export const labels: Record<string,string> = {
 clientes:'Clientes',propiedades:'Propiedades',tareas:'Planificación y tareas',equipo:'Equipo y disponibilidad',
 ausencias:'Ausencias',inventario:'Inventario por ubicación',lavanderia:'Recepciones de lavandería',incidencias:'Incidencias',
 tarifas:'Tarifas por propiedad',importes_servicios:'Importes por servicio',costes_personal:'Costes de personal',
 ajustes_financieros:'Configuración financiera',sede_id:'Sede',propiedad_id:'Propiedad (referencia)',cliente_id:'Cliente (referencia)',
 importe_servicio_registrado:'Importe del servicio registrado',importe_registrado:'Importe registrado',
 duracion_registrada:'Duración registrada',minutos_servicio:'Minutos por servicio',base_cantidad:'Base del stock',recuento_fisico:'Último recuento físico'
};
export interface ReadResult {
 profile:string;read_only:true;resources?:string[];resource?:string;as_of:string;
 rows?:Record<string,unknown>[];total?:number;offset?:number;has_more?:boolean;notice?:string;
}
export const madridToday = () => new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export async function readAssistant(token:string,resource:string,filters:{from?:string;to?:string;search?:string;offset?:number}={}):Promise<ReadResult> {
 if(!token || !resource)throw new Error('Falta el acceso o la consulta.');
 const abort=new AbortController();const timer=setTimeout(()=>abort.abort(),15000);
 try {
  const response=await fetch(endpoint,{method:'POST',headers:{apikey:publishableKey,'Content-Type':'application/json'},
   credentials:'omit',referrerPolicy:'no-referrer',cache:'no-store',signal:abort.signal,
   body:JSON.stringify({p_token:token,p_resource:resource,p_from:filters.from||null,p_to:filters.to||null,p_search:filters.search||'',p_offset:filters.offset||0,p_limit:50})});
  if(!response.ok)throw new Error(response.status===401||response.status===403?'Consulta no autorizada o acceso caducado.':'No se pudo consultar. Revisa las fechas (máximo 366 días) o vuelve a intentarlo.');
  const result=await response.json() as ReadResult;
  if(result.read_only!==true || !result.profile)throw new Error('Respuesta de consulta no válida.');
  return result;
 } finally {clearTimeout(timer);}
}
