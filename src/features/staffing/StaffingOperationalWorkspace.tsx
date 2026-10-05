import { BarChart3, Building2, CalendarDays, Clock3, Home, Settings2, UsersRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  OperationalCentersScreen,
  OperationalForecastScreen,
  OperationalHomeScreen,
  OperationalReportsScreen,
  OperationalSettingsScreen,
  OperationalShiftsScreen,
  OperationalTeamScreen,
} from './StaffingOperationalScreens';

export type StaffingOperationalScreen = 'home' | 'forecast' | 'team' | 'shifts' | 'centers' | 'reports' | 'settings';

type NavigationItem = {
  key: StaffingOperationalScreen;
  label: string;
  icon: typeof Home;
};

const navigationItems: NavigationItem[] = [
  { key: 'home', label: 'Inicio', icon: Home },
  { key: 'forecast', label: 'Previsión de personal', icon: CalendarDays },
  { key: 'team', label: 'Equipo', icon: UsersRound },
  { key: 'shifts', label: 'Turnos', icon: Clock3 },
  { key: 'centers', label: 'Centros', icon: Building2 },
  { key: 'reports', label: 'Informes', icon: BarChart3 },
  { key: 'settings', label: 'Configuración', icon: Settings2 },
];

function screenPath(screen: StaffingOperationalScreen) {
  return `/staffing-forecast/screens/${screen}`;
}

function ScreenBody({ screen }: { screen: StaffingOperationalScreen }) {
  switch (screen) {
    case 'home': return <OperationalHomeScreen />;
    case 'forecast': return <OperationalForecastScreen />;
    case 'team': return <OperationalTeamScreen />;
    case 'shifts': return <OperationalShiftsScreen />;
    case 'centers': return <OperationalCentersScreen />;
    case 'reports': return <OperationalReportsScreen />;
    case 'settings': return <OperationalSettingsScreen />;
  }
}

function Navigation({ current, mobile = false }: { current: StaffingOperationalScreen; mobile?: boolean }) {
  return (
    <nav aria-label="Navegación del previsor" className={mobile ? 'flex gap-2 overflow-x-auto p-3' : 'space-y-2 px-2 py-7'}>
      {navigationItems.map(({ key, label, icon: Icon }) => {
        const active = key === current;
        return (
          <Link
            key={key}
            to={screenPath(key)}
            aria-current={active ? 'page' : undefined}
            className={mobile
              ? `flex min-h-10 shrink-0 items-center gap-2 rounded-lg px-3 text-xs font-semibold ${active ? 'bg-[#285da4] text-white' : 'text-[#c3d2dd]'}`
              : `relative flex min-h-12 items-center gap-3 rounded-lg px-3 text-sm transition ${active ? 'bg-[#285da4] text-white shadow-sm' : 'text-[#c3d2dd] hover:bg-[#21465e] hover:text-white'}`}
          >
            {active && !mobile && <span aria-hidden="true" className="absolute left-0 top-2 h-8 w-1 rounded-r bg-[#5fc2cf]" />}
            <Icon className="h-5 w-5 shrink-0" />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function StaffingOperationalWorkspace({ screen }: { screen: StaffingOperationalScreen }) {
  return (
    <div className="min-h-screen bg-[#f5f9fc] text-[#10223f]">
      <div className="flex min-h-screen">
        <aside className="hidden min-h-screen w-[210px] shrink-0 border-r border-[#234760] bg-[#173246] md:block">
          <div className="border-b border-[#234760] px-4 py-5">
            <span className="text-sm font-bold tracking-[0.18em] text-white">LIMPATEX</span>
            <p className="mt-2 text-xs text-[#a9bfcc]">Previsor de personal</p>
          </div>
          <Navigation current={screen} />
        </aside>
        <main className="min-w-0 flex-1">
          <div className="border-b border-[#234760] bg-[#173246] md:hidden">
            <div className="px-4 py-3 text-sm font-bold tracking-[0.14em] text-white">LIMPATEX · PREVISOR</div>
            <Navigation current={screen} mobile />
          </div>
          <ScreenBody screen={screen} />
        </main>
      </div>
    </div>
  );
}
