"""Finite, authenticated read API for minimized history packages."""
import json
import urllib.request
import urllib.error


def fetch(client, mode='manifest', **filters):
    allowed = {'to', 'since', 'recent_from', 'after', 'ids'}
    if set(filters) - allowed:
        raise ValueError('Filtro no permitido.')
    payload = {'p_token': client.token, 'p_mode': mode, **{'p_'+k: v for k, v in filters.items()}}
    request = urllib.request.Request(client.config['url']+'/rest/v1/rpc/limpatex_assistant_history',
        data=json.dumps(payload).encode(), headers={'apikey': client.config['anon_key'], 'Content-Type': 'application/json'}, method='POST')
    try:
        with urllib.request.urlopen(request, timeout=45) as response:
            result = json.load(response)
    except (OSError, urllib.error.HTTPError):
        raise RuntimeError('Lectura del historico no confirmada. Conservar la ultima captura.') from None
    if result.get('read_only') is not True or result.get('profile') != client.profile or result.get('mode') != mode:
        raise ValueError('Respuesta inesperada.')
    return result


def manifest(client, **filters):
    rows, after, server_time = {}, None, None
    while True:
        result = fetch(client, 'manifest', after=after, **filters)
        server_time = server_time or result['server_time']
        page = result['rows']
        for row in page:
            if row['id'] in rows or (after and row['id'] <= after):
                raise ValueError('Manifest duplicado o desordenado.')
            rows[row['id']] = row
        if len(page) < 500:
            return rows, server_time
        after = page[-1]['id']


def synchronize(client, previous, today, force_weekly=False):
    """No write to the server. Weekly manifests detect deletes/untracked old edits."""
    from datetime import date, timedelta
    from history_core import START
    end = today + timedelta(days=14)
    initial = not previous or previous.get('version') != 2
    weekly = initial or force_weekly or (today-date.fromisoformat(previous['weekly_checked'])).days >= 7
    filters = {'to': end.isoformat()}
    if not weekly:
        # Overlap catches transactions committing after their timestamp watermark.
        from datetime import datetime
        filters.update(since=(datetime.fromisoformat(previous['watermark'])-timedelta(days=1)).isoformat(),
                       recent_from=(today-timedelta(days=7)).isoformat())
    before, server_time = manifest(client, **filters)
    valid = {k:v for k,v in before.items() if START.isoformat() <= v['fecha'] <= end.isoformat()}
    old = {} if initial else previous['packages']
    packages = {k:v for k,v in old.items() if START.isoformat() <= v['contenido']['fecha'] <= end.isoformat()}
    removed = set(packages)-set(valid) if weekly else set(before)-set(valid)
    for key in removed:
        packages.pop(key, None)
    needed = sorted(k for k,v in valid.items() if k not in packages or packages[k]['version'] != v['version'])
    for start in range(0, len(needed), 100):
        ids = needed[start:start+100]
        received = fetch(client, 'rows', to=end.isoformat(), ids=ids)['rows']
        if len(received) != len(ids) or {r['id'] for r in received} != set(ids):
            raise ValueError('Paquetes incompletos.')
        for row in received:
            if row['version'] != valid[row['id']]['version'] or row['contenido']['id'] != row['id']:
                raise ValueError('Paquete cambiado durante la captura.')
            packages[row['id']] = row
    after, _ = manifest(client, **filters)
    if before != after:
        raise ValueError('Manifest cambiado durante la captura.')
    cache = {'version': 2, 'packages': packages, 'watermark': server_time,
             'weekly_checked': today.isoformat() if weekly else previous['weekly_checked']}
    stats = {'modo': 'inicial' if initial else 'semanal' if weekly else 'incremental',
             'versiones_comprobadas': len(before), 'tareas_descargadas': len(needed),
             'retiradas_de_cache': len(removed & set(old)), 'tareas_conservadas': len(packages),
             'comprobacion_semanal': cache['weekly_checked']}
    return cache, stats
