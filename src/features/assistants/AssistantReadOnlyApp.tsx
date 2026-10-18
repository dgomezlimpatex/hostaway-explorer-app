import { useEffect, useState } from 'react';
import { readAssistant, type ReadResult, labels, madridToday } from './readClient';
import './assistantReadOnly.css';

const sessionKey = 'limpatex-assistant-readonly-v1';
const names: Record<string,string> = {limpatexconsultor:'Consultor',limpatexoperaciones:'Operaciones',limpatexrentabilidad:'Rentabilidad',limpatexcomercial:'Comercial'};
function valueText(value: unknown): string {
  if (value === null || value === undefined) return 'Sin dato';
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  return typeof value === 'object' ? JSON.stringify(value,null,2) : String(value);
}
export default function AssistantReadOnlyApp() {
  const [token,setToken] = useState(() => sessionStorage.getItem(sessionKey) || '');
  const [entry,setEntry] = useState('');
  const [identity,setIdentity] = useState<ReadResult | null>(null);
  const [resource,setResource] = useState('');
  const [from,setFrom] = useState(madridToday);
  const [to,setTo] = useState(madridToday);
  const [search,setSearch] = useState('');
  const [query,setQuery] = useState('');
  const [offset,setOffset] = useState(0);
  const [revision,setRevision] = useState(0);
  const [result,setResult] = useState<ReadResult | null>(null);
  const [loading,setLoading] = useState(false);
  const [error,setError] = useState('');
  useEffect(() => {
    let cancelled=false;
    if (!token) {setIdentity(null);setResult(null);return;}
    setLoading(true);setError('');
    readAssistant(token,'permisos').then(data => {
      if(cancelled)return;
      setIdentity(data);setResource(data.resources?.[0] || '');setOffset(0);
      sessionStorage.setItem(sessionKey,token);setEntry('');
    }).catch(() => {if(!cancelled){setError('No se pudo validar el acceso. Comprueba la conexión o la credencial del asistente.');sessionStorage.removeItem(sessionKey);setIdentity(null);setResult(null);}})
      .finally(()=>{if(!cancelled)setLoading(false);});
    return ()=>{cancelled=true;};
  },[token]);
  useEffect(() => {
    let cancelled=false;
    if(!identity || !resource)return;
    setLoading(true);setError('');setResult(null);
    readAssistant(token,resource,{from,to,search:query,offset}).then(data=>{if(!cancelled)setResult(data);})
      .catch(e=>{if(!cancelled)setError(e instanceof Error?e.message:'No se pudo consultar.');})
      .finally(()=>{if(!cancelled)setLoading(false);});
    return ()=>{cancelled=true;};
  },[token,identity,resource,from,to,query,offset,revision]);
  const columns=result?.rows?.length ? Object.keys(result.rows[0]) : [];
  return <main className="assistant-reader">
    <header><div><p className="reader-eyebrow">APP GESTIÓN LIMPATEX</p><h1>Consulta de asistentes</h1><p>Información actual para preparar decisiones.</p></div><span className="reader-badge">Solo lectura</span></header>
    {!identity ? <section className="reader-login"><h2>Acceso del asistente</h2><p>Utiliza la credencial dedicada del bot. Esta vista permite consultar; no permite modificar datos.</p>
      <form onSubmit={e=>{e.preventDefault();setToken(entry.trim());}}><label htmlFor="assistant-key">Credencial de consulta</label><input id="assistant-key" type="password" autoComplete="off" value={entry} onChange={e=>setEntry(e.target.value)} required/><button disabled={loading || !entry.trim()}>Entrar en consulta</button></form>
      {loading && <p role="status">Comprobando acceso…</p>}{error && <p role="alert">{error}</p>}
    </section> : <>
      <div className="reader-identity"><strong data-profile={identity.profile}>{names[identity.profile] || identity.profile}</strong><span>Permisos propios · sin edición</span><button onClick={()=>{sessionStorage.removeItem(sessionKey);setToken('');setEntry('');setResource('');setError('');}}>Cerrar acceso</button></div>
      <nav aria-label="Secciones de consulta">{identity.resources?.map(name=><button key={name} aria-pressed={resource===name} onClick={()=>{setResource(name);setOffset(0);}}>{labels[name] || name}</button>)}</nav>
      <section className="reader-panel"><div className="reader-heading"><div><h2>{labels[resource] || resource}</h2><p>Consulta en directo. Los filtros solo cambian lo que ves.</p></div><button onClick={()=>setRevision(v=>v+1)} disabled={loading}>Actualizar consulta</button></div>
        <form className="reader-filters" onSubmit={e=>{e.preventDefault();setQuery(search);setOffset(0);}}>
          <label>Desde<input type="date" value={from} onChange={e=>{setFrom(e.target.value);setOffset(0);}} required/></label>
          <label>Hasta<input type="date" value={to} onChange={e=>{setTo(e.target.value);setOffset(0);}} required/></label>
          <label className="reader-search">Buscar por nombre, código o propiedad<input value={search} maxLength={120} onChange={e=>setSearch(e.target.value)} placeholder="Escribe una referencia"/></label><button disabled={loading}>Buscar</button>
        </form><p className="reader-help">Las fechas se aplican a tareas, incidencias, recepciones y ausencias. Los directorios muestran sus datos actuales.</p>
        {loading && <p role="status">Consultando datos…</p>}{error && <p role="alert" className="reader-error">{error}</p>}
        {result && <><div className="reader-summary"><strong>{result.total} registros coinciden</strong><span>Consultado: {new Date(result.as_of).toLocaleString('es-ES',{timeZone:'Europe/Madrid'})} · Madrid</span></div>
          {!result.rows?.length ? <p className="reader-empty">No hay registros para estos filtros.</p> : <div className="reader-table"><table><thead><tr>{columns.map(c=><th key={c}>{labels[c] || c.replace(/_/g,' ')}</th>)}</tr></thead><tbody>{result.rows.map((row,index)=><tr key={String(row.id ?? index)}>{columns.map(c=><td key={c}>{typeof row[c]==='object' && row[c]!==null ? <details><summary>Ver detalle</summary><pre>{valueText(row[c])}</pre></details> : valueText(row[c])}</td>)}</tr>)}</tbody></table></div>}
          <div className="reader-pages"><button disabled={!offset || loading} onClick={()=>setOffset(v=>Math.max(0,v-50))}>Anterior</button><span>Desde el registro {result.total ? offset+1 : 0} · {result.rows?.length || 0} en esta página</span><button disabled={!result.has_more || loading} onClick={()=>setOffset(v=>v+50)}>Siguiente</button></div>
          <p className="reader-help">{result.notice}</p></>}
      </section></>}
      <footer>Vista de consulta de Limpatex. Los cambios operativos se realizan por los procedimientos autorizados.</footer>
  </main>;
}
