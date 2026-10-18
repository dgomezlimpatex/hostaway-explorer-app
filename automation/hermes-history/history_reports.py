"""Assignment habits and attributable reporting evidence; no employee score."""
from collections import Counter, defaultdict
from datetime import date, datetime, timedelta
from history_core import START, learn, digest


def classify(task, worker, today):
    reports = task.get('reportes', [])
    own = [r for r in reports if r.get('trabajador_id') == worker]
    base = {'tarea_id': task['id'], 'fecha': task['fecha'], 'propiedad_id': task.get('propiedad_id'),
            'trabajador_id': worker, 'estado_tarea': task.get('estado'), 'reporte_id': own[0]['id'] if len(own) == 1 else None}
    def outcome(state, reason, **extra):
        return {**base, 'estado_reporte': state, 'motivo': reason, **extra}
    if task['fecha'] >= today.isoformat():
        return outcome('no_exigible_aun', 'Hoy o futuro: no computa como falta de reporte.')
    if len(own) > 1 or any(not r.get('trabajador_id') for r in reports):
        return outcome('no_evaluable', 'Reportes duplicados o con autoria sin identificar.')
    if not own:
        return outcome('sin_reporte_registrado', 'No consta en el servidor; no descarta trabajo sin sincronizar.')
    r = own[0]
    if r.get('estado') != 'completed':
        return outcome('iniciado_sin_finalizar' if r.get('inicio') or r.get('puntos') else 'sin_iniciar', 'Reporte registrado sin cierre confirmado.')
    try:
        start, end = (datetime.fromisoformat(r[k].replace('Z', '+00:00')) for k in ('inicio', 'fin'))
        if not start.tzinfo or not end.tzinfo or end <= start:
            raise ValueError()
        template_changed = r.get('plantilla_actualizada') and datetime.fromisoformat(r['plantilla_actualizada'].replace('Z','+00:00')) > datetime.fromisoformat(r['creado'].replace('Z','+00:00'))
    except (KeyError, TypeError, ValueError, AttributeError):
        return outcome('no_evaluable', 'No constan tiempos completos y validos.')
    if not r.get('plantilla_valida') or not r.get('checklist_valido') or not task.get('adicionales_validos', True) or template_changed:
        return outcome('no_evaluable', 'Plantilla ausente, cambiada despues de iniciar el reporte o estructura no verificable.')
    requirements = r.get('requisitos', [])
    extras = task.get('adicionales', [])
    keys = [x.get('clave') for x in requirements+extras]
    if not keys or any(not k or k.endswith('.') for k in keys) or len(set(keys)) != len(keys):
        return outcome('no_evaluable', 'No hay requisitos identificables y unicos para evaluar.')
    missing, missing_photos, done = [], [], 0
    for item in requirements+extras:
        key = item['clave']; point = r.get('puntos', {}).get(key, {})
        # Additional completion is shared on tasks; require this worker's own mark
        # to attribute individual checklist completion, otherwise unknown.
        if item in extras and 'completado' not in point:
            return outcome('no_evaluable', 'La tarea adicional tiene un estado compartido sin confirmacion individual verificable.')
        complete = point.get('completado') is True
        photo = not item.get('foto') or point.get('adjuntos', 0) > 0
        if (item.get('obligatorio') or item in extras) and not complete:
            missing.append(key)
        if not photo:
            missing_photos.append(key)
        if complete and photo:
            done += 1
    return outcome('finalizado_incompleto' if missing or missing_photos else 'completo',
                   'Comprobacion contra requisitos disponibles y evidencias registradas; no mide calidad de limpieza.',
                   puntos_faltantes=missing, evidencias_faltantes=missing_photos,
                   checklist_total=len(keys), checklist_completados=done, checklist_100=done==len(keys))


def metrics(rows):
    counts = Counter(r['estado_reporte'] for r in rows)
    applicable = len(rows)-counts['no_exigible_aun']-counts['no_evaluable']
    return {'estados': dict(counts), 'casos_evaluables': applicable,
            'completos_pct': round(100*counts['completo']/applicable,1) if applicable else None,
            'checklist_100': sum(r.get('checklist_100', False) for r in rows),
            'advertencia': 'Porcentaje de reportes completos sobre casos evaluables; no es productividad ni calidad.'}


def enrich(data, today):
    past = {**data, 'tareas': [t for t in data['tareas'] if t['fecha'] < today.isoformat()]}
    snap = learn(past, today-timedelta(days=1))
    snap['version'] = 2
    snap['planificacion_hasta'] = (today+timedelta(days=14)).isoformat()
    snap['fuentes_huella'] = digest({k:sorted(v,key=lambda r:r['id']) for k,v in data.items()})
    habits, reports, quality = defaultdict(list), [], Counter()
    validworkers = snap['trabajadores']; links = snap['vinculos_actuales']
    for task in data['tareas']:
        if not START.isoformat() <= task['fecha'] <= snap['planificacion_hasta'] or task.get('estado') not in ('pending','in-progress','completed'):
            continue
        ids = {a['id'] for a in task.get('asignaciones',[]) if a.get('id')}
        legacy = task.get('cleaner_id')
        conflict = bool(ids and legacy and legacy not in ids)
        if not ids and legacy:
            ids = {legacy}
        if conflict:
            quality['asignaciones_conflictivas'] += 1
        scopes = []
        prop = task.get('propiedad_id')
        if prop in snap['propiedades']:
            scopes.append(('propiedad',prop))
            buildings = links.get(prop,[])
            if len(buildings)==1 and buildings[0] in snap['edificios']:
                scopes.append(('edificio',buildings[0]))
        for worker in ids & validworkers.keys():
            sede = validworkers[worker].get('sede_id')
            if conflict or (sede and task.get('sede_id') and sede != task['sede_id']):
                continue
            for scope,place in scopes:
                habits[(worker,scope,place)].append(task)
        authors = {r['trabajador_id'] for r in task.get('reportes',[]) if r.get('trabajador_id')}
        for worker in (ids|authors) & validworkers.keys():
            entry = classify(task,worker,today)
            entry['asignado_actualmente'] = worker in ids and not conflict
            if conflict and worker not in authors:
                entry.update(estado_reporte='no_evaluable',motivo='Asignacion contradictoria: no atribuir ausencia de reporte.')
            reports.append(entry)
    assignment_rows = []
    for (worker,scope,place), tasks in sorted(habits.items()):
        past_tasks = [t for t in tasks if t['fecha'] < today.isoformat()]
        assignment_rows.append({'trabajador_id':worker,'ambito':scope,'lugar_id':place,
            'asignaciones_pasadas':len(past_tasks),'dias_distintos_asignado':len({t['fecha'] for t in past_tasks}),
            'pendientes_pasadas':sum(t['estado']=='pending' for t in past_tasks),
            'asignaciones_ultimos_30_dias':sum(t['fecha'] >= (today-timedelta(days=30)).isoformat() for t in past_tasks),
            'previstas_hoy_y_14_dias':sum(t['fecha']>=today.isoformat() and t['estado']!='completed' for t in tasks),
            'primera_asignacion':min(t['fecha'] for t in tasks),'ultima_asignacion':max(t['fecha'] for t in tasks),
            'ejemplos_tarea_ids':[t['id'] for t in sorted(tasks,key=lambda t:(t['fecha'],t['id']),reverse=True)[:5]],
            'regla_confirmada':False})
    reports.sort(key=lambda r:(r['fecha'],r['tarea_id'],r['trabajador_id']), reverse=True)
    snap['asignaciones_habituales'] = assignment_rows
    snap['reportes_individuales'] = reports
    snap['reportes_resumen'] = metrics(reports)
    snap['reportes_por_trabajador'] = {worker:{'historico':metrics([r for r in reports if r['trabajador_id']==worker]),
        'ultimos_30_dias':metrics([r for r in reports if r['trabajador_id']==worker and r['fecha'] >= (today-timedelta(days=30)).isoformat()]),
        'anteriores_30_dias':metrics([r for r in reports if r['trabajador_id']==worker and (today-timedelta(days=60)).isoformat() <= r['fecha'] < (today-timedelta(days=30)).isoformat()])}
        for worker in {r['trabajador_id'] for r in reports}}
    snap['resumen']['tareas_hoy_y_proximos_14_dias'] = sum(t['fecha']>=today.isoformat() for t in data['tareas'])
    snap['calidad'].update(quality)
    snap['limites'].extend(['Asignaciones pendientes describen reparto, no ejecucion confirmada.',
        'Los reportes se atribuyen a cleaner_id registrado; no certifican quien pulso enviar ni la calidad del trabajo.',
        'Sin reporte registrado puede significar envio offline pendiente. Hoy y futuro no computan como incumplimiento.',
        'Las plantillas modificadas despues de iniciar el reporte y los adicionales sin autoria individual se marcan no evaluables.',
        'La comprobacion semanal detecta eliminaciones y cambios antiguos no reflejados en las fechas de actualizacion.'])
    return snap
