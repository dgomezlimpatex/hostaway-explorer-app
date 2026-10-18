"""Daily, local, read-only collector. No arbitrary SQL and no business mutations."""
import argparse
import contextlib
from datetime import datetime, timedelta, timezone
import json
import os
import subprocess
from pathlib import Path
import sys
from zoneinfo import ZoneInfo

HERE = Path(__file__).resolve().parent
for sibling in ('limpatex-readonly', 'hermes-readonly'):
    candidate = HERE.parent / sibling
    if (candidate / 'read_access.py').is_file():
        sys.path.insert(0, str(candidate))
        break
from read_access import Client, ROOT, protect
from history_core import START, VERSION, digest, learn, query
sys.path.insert(0, str(ROOT / 'hermes-agent'))
import hermes_bootstrap  # Current Hermes environment supplies tzdata on Windows.

STORE = ROOT / 'integrations/limpatex-history/state'
RESOURCES = ('tareas', 'equipo', 'propiedades', 'edificios', 'vinculos_edificios', 'equipos_edificios')
MADRID = ZoneInfo('Europe/Madrid')


def atomic(path, content):
    temp = path.with_name(path.name + '.tmp-' + str(os.getpid()))
    try:
        temp.write_bytes(content)
        os.replace(temp, path)
    finally:
        temp.unlink(missing_ok=True)


@contextlib.contextmanager
def lock(store):
    store.mkdir(parents=True, exist_ok=True)
    with (store / 'refresh.lock').open('a+b') as handle:
        if handle.tell() == 0:
            handle.write(b'0'); handle.flush()
        handle.seek(0)
        import msvcrt
        try:
            msvcrt.locking(handle.fileno(), msvcrt.LK_NBLCK, 1)
        except OSError:
            raise RuntimeError('Ya hay una actualizacion en curso.') from None
        try:
            yield
        finally:
            handle.seek(0)
            msvcrt.locking(handle.fileno(), msvcrt.LK_UNLCK, 1)


def all_pages(client, resource, start=None, end=None):
    offset, total, rows, seen = 0, None, [], set()
    while True:
        value = client.read(resource, from_date=start, to_date=end, limit=100, offset=offset)
        if value.get('resource') != resource or value.get('read_only') is not True:
            raise ValueError('Respuesta de consulta inesperada.')
        if total is None:
            total = value['total']
        if value['total'] != total:
            raise ValueError('El conjunto cambio durante la lectura.')
        page = value['rows']
        if any(not r.get('id') or r['id'] in seen for r in page) or len({r['id'] for r in page}) != len(page):
            raise ValueError('Identidades duplicadas o ausentes en la paginacion.')
        rows.extend(page); seen.update(r['id'] for r in page)
        if not value['has_more']:
            if len(rows) != total:
                raise ValueError('Cobertura incompleta.')
            return sorted(rows, key=lambda r: r['id'])
        if not page:
            raise ValueError('Pagina vacia antes del final.')
        offset += len(page)


def capture(client, end):
    # Fixed start never slides; split at <=365 days for future years.
    tasks, current = [], START
    while current <= end:
        stop = min(end, current + timedelta(days=364))
        tasks.extend(all_pages(client, 'tareas', current.isoformat(), stop.isoformat()))
        current = stop + timedelta(days=1)
    result = {'tareas': sorted(tasks, key=lambda r: r['id'])}
    for resource in RESOURCES[1:]:
        result[resource] = all_pages(client, resource)
    return result


def read_status(store=STORE):
    path = store / 'status.json'
    return json.loads(path.read_text(encoding='utf-8')) if path.is_file() else {}


def due(status, now):
    return now.hour >= 6 and status.get('attempt_day') != now.date().isoformat()


def refresh(force=False, store=STORE, client=None, now=None):
    now = now or datetime.now(MADRID)
    with lock(store):
        old_status = read_status(store)
        if not force and not due(old_status, now):
            return {'ok': old_status.get('ok', True), 'estado': 'ya_comprobado_hoy' if now.hour >= 6 else 'antes_de_las_06', 'ultimo_resultado': old_status}
        started = {'ok': False, 'estado': 'en_curso', 'attempt_day': now.date().isoformat(), 'attempt_at': now.isoformat()}
        atomic(store / 'status.json', json.dumps(started).encode())
        try:
            client = client or Client('limpatexoperaciones')
            end = now.date() - timedelta(days=1)
            # Two equal complete reads detect edits and shifting pagination. No
            # database snapshot is claimed; the two observed versions must agree.
            first = capture(client, end)
            second = capture(client, end)
            if digest(first) != digest(second):
                raise ValueError('Las fuentes cambiaron durante la captura. Se conserva la version anterior.')
            snapshot = learn(second, end)
            snapshot['actualizado'] = datetime.now(timezone.utc).isoformat()
            snapshot['captura'] = 'dos_lecturas_completas_coincidentes_no_transaccion_sql'
            atomic(store / 'history.dpapi', protect(json.dumps(snapshot, ensure_ascii=False).encode()))
            status = {**started, 'ok': True, 'estado': 'actualizado', 'hasta': end.isoformat(), 'source_digest': snapshot['fuentes_huella'], 'version': VERSION, 'resumen': snapshot['resumen'], 'actualizado': snapshot['actualizado']}
            atomic(store / 'status.json', json.dumps(status, ensure_ascii=False).encode())
            return status
        except Exception as exc:
            # Exception types only: network/DB errors could contain sensitive data.
            failed = {**started, 'estado': 'fallo', 'error_type': type(exc).__name__, 'mensaje': 'No se publico una captura nueva. Se conserva la anterior; revisar el colector antes de reintentar.'}
            atomic(store / 'status.json', json.dumps(failed).encode())
            return failed


def consult(profile, kind='resumen', identifier='', search='', limit=20, offset=0, store=STORE, now=None):
    if profile not in ('limpatexconsultor', 'limpatexoperaciones', 'limpatexrentabilidad'):
        raise PermissionError('Perfil sin acceso.')
    if profile == 'limpatexrentabilidad' and kind != 'resumen':
        raise PermissionError('Solo resumen agregado.')
    path = store / 'history.dpapi'
    if not path.is_file():
        return {'ok': False, 'estado': 'sin_captura', 'salud': read_status(store)}
    snapshot = json.loads(protect(path.read_bytes(), True).decode())
    result = query(snapshot, profile, kind, identifier, search, limit, offset)
    now = now or datetime.now(MADRID)
    updated = datetime.fromisoformat(snapshot['actualizado'])
    health = read_status(store)
    stale = (now - updated).total_seconds() > 36 * 3600 or snapshot['hasta'] < (now.date()-timedelta(days=1)).isoformat() or not health.get('ok', False)
    result.update({'ok': True, 'desactualizado': stale, 'salud': health, 'aviso': 'Historico: no representa la asignacion ni disponibilidad actual. Consultarlas en directo.'})
    return result


def record_memory(store=STORE):
    """One idempotent evidence note per successful daily capture, no proposals."""
    with lock(store):
        status = read_status(store)
        if not status.get('ok') or status.get('estado') != 'actualizado':
            return {'ok': True, 'estado': 'sin_captura_nueva_para_memoria'}
        if status.get('memoria_registrada'):
            return {'ok': True, 'estado': 'memoria_ya_registrada'}
        stats = status['resumen']
        request = {
            'accion': 'registrar', 'clave': 'historico-reparto:' + status['attempt_day'] + ':' + status['source_digest'],
            'titulo': 'Historico del reparto actualizado hasta ' + status['hasta'],
            'contenido': 'Captura de lectura desde 01/06/2026 hasta ' + status['hasta'] + '. Dos lecturas completas coincidentes. Resumen: ' + json.dumps(stats, ensure_ascii=False) + '. La base estructurada conserva fichas de trabajador, propiedad y edificio. No se han escrito asignaciones. Consultar historial_equipo en Hermes o run.ps1 -Action query antes de sacar conclusiones sobre patrones.',
            'fuente': 'Colector determinista de APP GESTION LIMPATEX. Huella ' + status['source_digest'] + '. Actualizado ' + status['actualizado'] + '. Peticion directa de Dani: desde junio de 2026 y una actualizacion diaria.',
            'autor': 'Colector de historico (sin modelo)', 'marca': 'Limpatex', 'tipo': 'hecho',
            'analisis': {
                'problemas': 'La captura tecnica no acredita mejoras operativas. Hay que distinguir tareas completadas con asignacion de pendientes, ejecucion individual y disponibilidad actual. Las incidencias de cobertura se consultan en calidad.',
                'relaciones': 'Fuente compartida de Operaciones y consultor. Complementa el equipo configurado de cada edificio; no modifica titularidades ni exclusiones. Rentabilidad recibe un resumen agregado.',
                'mejoras': 'No se ha inferido una propuesta de negocio automaticamente. El revisor puede contrastar las fichas actuales con antecedentes y proponer mejoras solo con evidencia material, conservando la deduplicacion existente.',
                'siguiente_paso': 'El consultor debe revisar esta evidencia con GPT-6 Astra/high dentro del circuito existente. Consultar las fichas si necesita evaluar dependencias o cambios de patron; no asignar tareas.',
                'incertidumbres': 'Los vinculos propiedad-edificio son actuales, no un archivo historico de cambios. Los recuentos no miden calidad ni rendimiento individual. La base no sustituye disponibilidad y asignaciones en directo.'
            }
        }
        path = store / 'memory-request.json'
        atomic(path, json.dumps(request, ensure_ascii=False).encode())
        result = subprocess.run([sys.executable, str(ROOT / 'integrations/obsidian/obsidian_memory.py'), '--perfil', 'limpatexconsultor', '--archivo', str(path)], capture_output=True, text=True, encoding='utf-8', timeout=45)
        try:
            receipt = json.loads(result.stdout)
        except (ValueError, TypeError):
            return {'ok': False, 'estado': 'memoria_pendiente', 'mensaje': 'Respuesta no confirmada. Conservar la misma clave al reintentar.'}
        if result.returncode != 0 or receipt.get('ok') is not True:
            return {'ok': False, 'estado': 'memoria_pendiente', 'mensaje': 'No se confirmo el registro. Conservar solicitud y captura.'}
        status['memoria_registrada'] = receipt['ruta']
        atomic(store / 'status.json', json.dumps(status, ensure_ascii=False).encode())
        return {'ok': True, 'estado': 'memoria_registrada', 'ruta': receipt['ruta']}


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('command', choices=('refresh', 'status', 'record', 'query'))
    parser.add_argument('--force', action='store_true', help='Reintento manual explicito, no usar en la programacion normal.')
    parser.add_argument('--profile', default='limpatexconsultor', choices=('limpatexconsultor', 'limpatexoperaciones', 'limpatexrentabilidad'))
    parser.add_argument('--query', default='resumen', choices=('resumen', 'trabajador', 'edificio', 'propiedad'))
    parser.add_argument('--id', default='')
    parser.add_argument('--search', default='')
    parser.add_argument('--limit', type=int, default=20)
    parser.add_argument('--offset', type=int, default=0)
    args = parser.parse_args()
    if args.command == 'refresh': result = refresh(args.force)
    elif args.command == 'record': result = record_memory()
    elif args.command == 'query':
        Client(args.profile).read()  # Also honor current credential revocation.
        result = consult(args.profile, args.query, args.id, args.search, args.limit, args.offset)
    else: result = read_status()
    print(json.dumps(result, ensure_ascii=True))
    raise SystemExit(0 if result.get('ok', False) else 1)
