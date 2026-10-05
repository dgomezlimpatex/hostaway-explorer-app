import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const page = await readFile(new URL('../src/pages/SmoobuAdmin.tsx', import.meta.url), 'utf8');
const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8');
const sidebar = await readFile(new URL('../src/components/dashboard/DashboardSidebar.tsx', import.meta.url), 'utf8');
const mobile = await readFile(new URL('../src/components/dashboard/MobileDashboardSidebar.tsx', import.meta.url), 'utf8');

const checks = [
  ['la pantalla tiene las cinco pestanas',
    ['>Estado<', '>Reservas<', '>Historial<', '>Mapeo<', '>Ajustes<'].every((t) => page.includes(t))],
  ['lee las tablas del canal Smoobu',
    /smoobu_reservations/.test(page) && /smoobu_reservation_tasks/.test(page) &&
    /smoobu_sync_runs/.test(page) && /smoobu_sync_requests/.test(page) &&
    /smoobu_property_mappings/.test(page)],
  ['el boton manual deja una peticion en vez de llamar a Smoobu',
    /smoobu_sync_requests"\)[\s\S]{0,60}\.insert/.test(page) && /Sincronizar ahora/.test(page) &&
    !/fetch\(|axios|smoobu\.com/.test(page)],
  ['las consultas al canal pasan por un unico ayudante documentado',
    /const dbSmoobu = supabase as any;/.test(page) &&
    /eslint-disable-next-line @typescript-eslint\/no-explicit-any/.test(page)],
  ['avisa de los alojamientos sin mapear',
    /sin mapear/i.test(page) && /sinMapear/.test(page)],
  ['el historial se puede desplegar y dice si hubo correo',
    /detalleAbierto/.test(page) && /email_enviado/.test(page) && /no hacía falta/.test(page)],
  ['el mapeo se puede pausar y reactivar',
    /is_active: activo/.test(page) && /Pausar/.test(page) && /Reactivar/.test(page)],
  ['avisa de las limpiezas ajustadas a mano',
    /manually_adjusted/.test(page) && /ajustada a mano/.test(page)],
  ['muestra estado de la ultima pasada y avisa si se queda vieja',
    /horasSinLeer/.test(page) && /HORAS_AVISO/.test(page) && /Última lectura de Smoobu/.test(page)],
  ['la ruta esta protegida y carga en diferido',
    /const SmoobuAdmin = React\.lazy/.test(app) &&
    /path="\/smoobu"[\s\S]{0,140}requiredModule="admin"/.test(app)],
  ['aparece en los dos menus',
    /title: 'Smoobu'[\s\S]{0,40}href: '\/smoobu'/.test(sidebar) &&
    /title: 'Smoobu', href: '\/smoobu'/.test(mobile)],
  ['la ventana de importacion y las pasadas estan declaradas',
    /MESES_VENTANA = 3/.test(page) && /PASADAS = \["08:00", "15:00", "19:00"\]/.test(page)],
];

for (const [name, passed] of checks) {
  assert.equal(passed, true, name);
  console.log(`PASS ${name}`);
}
console.log(`Smoobu admin UI contract: ${checks.length} checks passed`);
