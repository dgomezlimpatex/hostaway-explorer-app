import copy
from datetime import date, datetime, timedelta, timezone
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'automation/hermes-history'))
from history_core import START, learn, query
import history_runtime as runtime


def fixture():
    return {'equipo': [{'id': 'w1', 'nombre': 'Uno', 'activo': True}, {'id': 'w2', 'nombre': 'Dos', 'activo': False}],
            'propiedades': [{'id': 'p1', 'nombre': 'P1'}, {'id': 'p2', 'nombre': 'P2'}],
            'edificios': [{'id': 'b1', 'nombre': 'B1'}],
            'vinculos_edificios': [{'id': 'l1', 'propiedad_id': 'p1', 'edificio_id': 'b1'}, {'id': 'l2', 'propiedad_id': 'p2', 'edificio_id': 'b1'}],
            'equipos_edificios': [{'id': 'r1', 'edificio_id': 'b1', 'cleaner_id': 'w1', 'rol': 'excluded', 'activo': False}],
            'tareas': [{'id': 't1', 'fecha': '2026-06-01', 'estado': 'completed', 'propiedad_id': 'p1', 'cleaner_id': 'w1', 'asignaciones': [{'id': 'w1'}, {'id': 'w1'}, {'id': 'w2'}]},
                       {'id': 't2', 'fecha': '2026-10-17', 'estado': 'completed', 'propiedad_id': 'p2', 'cleaner_id': 'w1', 'asignaciones': []},
                       {'id': 't3', 'fecha': '2026-10-17', 'estado': 'pending', 'propiedad_id': 'p1', 'cleaner_id': 'w1', 'asignaciones': []}]}


class HistoryTests(unittest.TestCase):
    def setUp(self):
        self.data = fixture()
        self.end = date(2026, 10, 17)

    def snapshot(self):
        value = learn(self.data, self.end)
        value['actualizado'] = datetime.now(timezone.utc).isoformat()
        return value

    def relation(self, snap, scope='edificio', worker='w1'):
        return next(r for r in snap['relaciones'] if r['ambito'] == scope and r['trabajador_id'] == worker)

    def test_start_and_future_excluded(self):
        for day in ['2026-05-31', '2026-10-18']:
            self.data['tareas'].append({**self.data['tareas'][0], 'id': day, 'fecha': day})
        value = self.snapshot()
        self.assertEqual(value['resumen']['tareas_del_periodo'], 3)
        self.assertEqual(value['calidad']['fuera_de_periodo'], 2)

    def test_multi_person_no_duplicate_and_legacy_fallback(self):
        value = self.snapshot()
        self.assertEqual(self.relation(value)['tareas_completadas_con_asignacion'], 2)
        self.assertEqual(self.relation(value, worker='w2')['tareas_completadas_con_asignacion'], 1)
        self.assertEqual(value['resumen']['completadas_utilizables'], 2)

    def test_pending_is_not_experience(self):
        r = self.relation(self.snapshot())
        self.assertEqual(r['asignadas_pendientes_pasadas'], 1)
        self.assertEqual(r['dias_distintos'], 2)

    def test_distinct_building_days(self):
        self.data['tareas'][1]['fecha'] = '2026-06-01'
        r = self.relation(self.snapshot())
        self.assertEqual(r['dias_distintos'], 1)
        self.assertEqual(r['tareas_completadas_con_asignacion'], 2)

    def test_exclusions_and_inactive_preserved(self):
        value = query(self.snapshot(), 'limpatexoperaciones', 'trabajador', 'w1')
        self.assertEqual(value['equipos_configurados_actuales'][0]['rol'], 'excluded')
        self.assertFalse(value['equipos_configurados_actuales'][0]['activo'])
        self.assertFalse(query(self.snapshot(), 'limpatexoperaciones', 'trabajador', 'w2')['ficha']['activo'])

    def test_cancel_and_corrections_rebuild(self):
        before = self.snapshot()
        self.data['tareas'][0]['estado'] = 'cancelled'
        after = self.snapshot()
        self.assertNotEqual(before['fuentes_huella'], after['fuentes_huella'])
        self.assertEqual(after['resumen']['completadas_utilizables'], 1)
        self.assertEqual(learn(self.data, self.end), learn(copy.deepcopy(self.data), self.end))

    def test_duplicate_task_is_error(self):
        self.data['tareas'].append(self.data['tareas'][0])
        with self.assertRaises(ValueError): self.snapshot()

    def test_unknown_workers_never_matched_by_name(self):
        self.data['tareas'][0]['asignaciones'] = [{'id': 'unknown', 'nombre': 'Uno'}]
        self.data['tareas'][0]['cleaner_id'] = None
        self.assertEqual(self.snapshot()['resumen']['completadas_utilizables'], 1)

    def test_conflicting_legacy_not_merged(self):
        self.data['tareas'][0]['cleaner_id'] = 'other'
        value = self.snapshot()
        self.assertEqual(value['calidad']['responsables_en_conflicto'], 1)
        self.assertEqual(value['resumen']['completadas_utilizables'], 1)

    def test_ambiguous_building_not_guessed(self):
        self.data['vinculos_edificios'].append({'id': 'l3', 'propiedad_id': 'p1', 'edificio_id': 'other'})
        value = self.snapshot()
        self.assertEqual(self.relation(value)['tareas_completadas_con_asignacion'], 1)
        self.assertGreater(value['calidad']['sin_edificio_inequivoco'], 0)

    def test_shared_participation_not_exclusive(self):
        value = self.snapshot()
        shares = [r['participacion_no_exclusiva_pct'] for r in value['relaciones'] if r['ambito'] == 'propiedad' and r['lugar_id'] == 'p1']
        self.assertEqual(sum(shares), 200)

    def test_recency_fixed_start(self):
        r = self.relation(self.snapshot())
        self.assertEqual(r['tareas_ultimos_30_dias'], 1)
        self.assertEqual(r['primera_fecha'], '2026-06-01')

    def test_profile_boundaries(self):
        snap = self.snapshot()
        with self.assertRaises(PermissionError): query(snap, 'limpatexcomercial')
        with self.assertRaises(PermissionError): query(snap, 'limpatexrentabilidad', 'trabajador', 'w1')
        summary = query(snap, 'limpatexrentabilidad')
        self.assertNotIn('trabajadores', summary)
        self.assertNotIn('relaciones', summary)
        self.assertNotIn('Uno', json.dumps(summary))

    def test_property_keeps_building_exclusions(self):
        result = query(self.snapshot(), 'limpatexconsultor', 'propiedad', 'p1')
        self.assertEqual(result['edificios_relacionados_actuales'], ['b1'])
        self.assertEqual(result['equipos_configurados_actuales'][0]['rol'], 'excluded')

    def test_query_pagination_and_no_silent_match(self):
        snap = self.snapshot()
        q = query(snap, 'limpatexconsultor', 'trabajador', limit=1)
        self.assertTrue(q['hay_mas'])
        self.assertEqual(len(q['seleccionar']), 1)
        q = query(snap, 'limpatexconsultor', 'trabajador', 'w1', limit=1)
        self.assertTrue(q['hay_mas'])

    def test_once_daily_after_six_madrid(self):
        now = datetime(2026, 10, 18, 6, tzinfo=runtime.MADRID)
        self.assertTrue(runtime.due({}, now))
        self.assertFalse(runtime.due({'attempt_day': '2026-10-18'}, now))
        self.assertFalse(runtime.due({}, now - timedelta(hours=1)))
        self.assertTrue(runtime.due({'attempt_day': '2026-10-17'}, now))

    def test_failed_refresh_keeps_last_good_and_marks_stale(self):
        with tempfile.TemporaryDirectory() as temp:
            store = Path(temp)
            with patch.object(runtime, 'capture', return_value=self.data):
                result = runtime.refresh(force=True, store=store, client=object())
            self.assertTrue(result['ok'])
            original = (store/'history.dpapi').read_bytes()
            with patch.object(runtime, 'capture', side_effect=ValueError('private detail')):
                result = runtime.refresh(force=True, store=store, client=object())
            self.assertFalse(result['ok'])
            self.assertNotIn('private detail', json.dumps(result))
            self.assertEqual(original, (store/'history.dpapi').read_bytes())
            self.assertTrue(runtime.consult('limpatexconsultor', store=store)['desactualizado'])

    def test_inconsistent_captures_not_published(self):
        second = copy.deepcopy(self.data); second['tareas'][0]['estado'] = 'pending'
        with tempfile.TemporaryDirectory() as temp, patch.object(runtime, 'capture', side_effect=[self.data, second]):
            result = runtime.refresh(force=True, store=Path(temp), client=object())
            self.assertFalse(result['ok'])
            self.assertFalse((Path(temp)/'history.dpapi').exists())

    def test_empty_page_cannot_appear_complete(self):
        class Fake:
            def read(self, *args, **kwargs):
                return {'resource': 'tareas', 'read_only': True, 'total': 1, 'rows': [], 'has_more': False}
        with self.assertRaises(ValueError): runtime.all_pages(Fake(), 'tareas')


if __name__ == '__main__': unittest.main(verbosity=2)
