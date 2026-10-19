import copy
from datetime import date
import json
from pathlib import Path
import sys
import unittest
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'automation/hermes-history'))
sys.path.insert(0,str(Path(__file__).resolve().parent))
import history_feed as feed
from history_core import digest, query
from history_reports import classify, enrich, metrics
from assistantHistoryTest import fixture

TODAY=date(2026,10,18)
def report(worker='w1'):
    return {'id':'r1','trabajador_id':worker,'estado':'completed','inicio':'2026-10-17T08:00:00+02:00',
        'fin':'2026-10-17T09:00:00+02:00','creado':'2026-10-17T08:00:00+02:00',
        'plantilla_valida':True,'checklist_valido':True,'plantilla_actualizada':'2026-05-01T00:00:00Z',
        'requisitos':[{'clave':'c.i','obligatorio':True,'foto':True}],
        'puntos':{'c.i':{'completado':True,'adjuntos':1}}}

class ReportTests(unittest.TestCase):
    def setUp(self):
        self.task={**fixture()['tareas'][2], 'reportes':[report()], 'adicionales':[], 'adicionales_validos':True}
    def result(self):return classify(self.task,'w1',TODAY)
    def test_pending_task_can_have_complete_individual_report(self):
        self.assertEqual(self.result()['estado_reporte'],'completo')
    def test_missing_attachment_is_incomplete(self):
        self.task['reportes'][0]['puntos']['c.i']['adjuntos']=0
        self.assertEqual(self.result()['estado_reporte'],'finalizado_incompleto')
    def test_required_unchecked(self):
        self.task['reportes'][0]['puntos']['c.i']['completado']=False
        self.assertEqual(self.result()['puntos_faltantes'],['c.i'])
    def test_optional_does_not_prevent_valid_report_but_not_100(self):
        self.task['reportes'][0]['requisitos'].append({'clave':'c.o','obligatorio':False,'foto':False})
        self.assertEqual(self.result()['estado_reporte'],'completo')
        self.assertFalse(self.result()['checklist_100'])
    def test_changed_template_not_retroactive_fault(self):
        self.task['reportes'][0]['plantilla_actualizada']='2026-10-18T01:00:00Z'
        self.assertEqual(self.result()['estado_reporte'],'no_evaluable')
    def test_missing_template_unknown(self):
        self.task['reportes'][0]['plantilla_valida']=False
        self.assertEqual(self.result()['estado_reporte'],'no_evaluable')
    def test_invalid_times_unknown(self):
        self.task['reportes'][0]['fin']=None
        self.assertEqual(self.result()['estado_reporte'],'no_evaluable')
    def test_no_report_may_be_offline(self):
        self.task['reportes']=[]
        self.assertEqual(self.result()['estado_reporte'],'sin_reporte_registrado')
        self.assertIn('sin sincronizar',self.result()['motivo'])
    def test_other_worker_does_not_get_credit(self):
        self.assertEqual(classify(self.task,'w2',TODAY)['estado_reporte'],'sin_reporte_registrado')
    def test_duplicate_unknown(self):
        self.task['reportes'].append(report())
        self.assertEqual(self.result()['estado_reporte'],'no_evaluable')
    def test_unattributed_unknown(self):
        self.task['reportes'][0]['trabajador_id']=None
        self.assertEqual(self.result()['estado_reporte'],'no_evaluable')
    def test_today_and_future_not_overdue(self):
        for day in ('2026-10-18','2026-11-01'):
            self.task['fecha']=day
            self.assertEqual(self.result()['estado_reporte'],'no_exigible_aun')
    def test_shared_extra_does_not_prove_personal_completion(self):
        self.task['adicionales']=[{'clave':'additional.x','completado':True,'foto':False}]
        self.assertEqual(self.result()['estado_reporte'],'no_evaluable')
    def test_no_employee_quality_score(self):
        value=metrics([{'estado_reporte':'completo'},{'estado_reporte':'no_evaluable'},{'estado_reporte':'no_exigible_aun'}])
        self.assertEqual(value['casos_evaluables'],1)
        self.assertEqual(value['completos_pct'],100)
    def test_pending_counts_assignment_not_experience(self):
        data=fixture();data['tareas']=[self.task]
        snap=enrich(data,TODAY)
        self.assertEqual(snap['resumen']['completadas_utilizables'],0)
        self.assertEqual(snap['asignaciones_habituales'][0]['asignaciones_pasadas'],1)
        self.assertEqual(snap['reportes_resumen']['estados']['completo'],1)
    def test_future_assignment_and_scope(self):
        data=fixture(); data['tareas'].append({**self.task,'id':'future','fecha':'2026-10-20'})
        snap=enrich(data,TODAY);snap.update(actualizado='2026-10-18T06:00:00Z',sincronizacion={})
        self.assertTrue(any(r['previstas_hoy_y_14_dias'] for r in snap['asignaciones_habituales']))
        summary=query(snap,'limpatexrentabilidad')
        self.assertNotIn('reportes_individuales',summary)
        self.assertNotIn('_cache',summary)
        with self.assertRaises(PermissionError):query(snap,'limpatexrentabilidad','trabajador','w1')
        detail=query(snap,'limpatexconsultor','trabajador','w1',limit=1)
        self.assertTrue(detail['hay_mas']);self.assertIn('cumplimentacion_reportes',detail)
    def test_cancelled_excluded(self):
        data=fixture();data['tareas']=[{**self.task,'estado':'cancelled'}]
        self.assertEqual(enrich(data,TODAY)['reportes_individuales'],[])

class FeedTests(unittest.TestCase):
    def setUp(self):
        self.rows={t['id']:t for t in fixture()['tareas']};self.calls=[]
        self.selected=None
    def fake(self,client,mode='manifest',**filters):
        self.calls.append((mode,filters))
        ids=sorted(self.rows if self.selected is None else self.selected)
        if mode=='manifest':
            rows=[{'id':i,'fecha':self.rows[i]['fecha'],'version':digest(self.rows[i])} for i in ids if not filters.get('after') or i>filters['after']][:500]
        else:rows=[{'id':i,'version':digest(self.rows[i]),'contenido':copy.deepcopy(self.rows[i])} for i in filters['ids'] if i in self.rows]
        return {'rows':rows,'server_time':'2026-10-18T06:00:00+02:00'}
    def sync(self,old=None,today=TODAY,weekly=False):
        with patch.object(feed,'fetch',side_effect=self.fake):return feed.synchronize(object(),old,today,weekly)
    def test_initial_then_incremental_no_download(self):
        first,stats=self.sync();self.assertEqual(stats['tareas_descargadas'],3)
        self.calls=[];second,stats=self.sync(first)
        self.assertEqual(stats['modo'],'incremental');self.assertEqual(stats['tareas_descargadas'],0)
        self.assertFalse(any(m=='rows' for m,_ in self.calls));self.assertEqual(first,second)
    def test_only_changed_report_downloaded(self):
        first,_=self.sync();self.rows['t1']['reportes']=[report()]
        second,stats=self.sync(first)
        self.assertEqual(stats['tareas_descargadas'],1)
        self.assertEqual(len(second['packages']),3)
    def test_changed_assignment_downloaded(self):
        first,_=self.sync();self.rows['t2']['asignaciones']=[{'id':'w2'}]
        self.assertEqual(self.sync(first)[1]['tareas_descargadas'],1)
    def test_weekly_deleted_task_removed(self):
        first,_=self.sync();del self.rows['t2']
        second,stats=self.sync(first,date(2026,10,25))
        self.assertEqual(stats['modo'],'semanal');self.assertNotIn('t2',second['packages'])
        self.assertEqual(stats['retiradas_de_cache'],1)
    def test_partial_delta_preserves_untouched_history(self):
        first,_=self.sync();self.selected=['t2']
        second,stats=self.sync(first)
        self.assertEqual(len(second['packages']),3)
    def test_task_moved_outside_scope_removed(self):
        first,_=self.sync();self.rows['t2']['fecha']='2026-05-01'
        second,stats=self.sync(first)
        self.assertNotIn('t2',second['packages'])
    def test_weekly_finds_old_untracked_edit(self):
        first,_=self.sync();self.rows['t1']['estado']='cancelled'
        self.assertEqual(self.sync(first,weekly=True)[1]['tareas_descargadas'],1)
    def test_changed_during_fetch_rejected(self):
        real=self.fake
        def drift(c,mode='manifest',**f):
            if mode=='rows':self.rows['t1']['estado']='cancelled'
            return real(c,mode,**f)
        with patch.object(feed,'fetch',side_effect=drift),self.assertRaises(ValueError):feed.synchronize(object(),None,TODAY)
    def test_incomplete_rows_rejected(self):
        real=self.fake
        def missing(c,mode='manifest',**f):
            r=real(c,mode,**f)
            if mode=='rows':r['rows']=r['rows'][:-1]
            return r
        with patch.object(feed,'fetch',side_effect=missing),self.assertRaises(ValueError):feed.synchronize(object(),None,TODAY)
    def test_pagination_uses_cursor(self):
        self.rows={str(i).zfill(4):{**fixture()['tareas'][0],'id':str(i).zfill(4)} for i in range(501)}
        cache,stats=self.sync();self.assertEqual(len(cache['packages']),501)
        self.assertTrue(any(f.get('after') for m,f in self.calls if m=='manifest'))

if __name__=='__main__':unittest.main(verbosity=2)
