import { ArrowRight, Building2, CalendarDays, Settings, ShieldAlert, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { PlanningBuildingCrmProfile } from '@/types/operationalPlanning';
import { formatCrmHours, getCrmStatusCopy } from './buildingCrmFormatters';

interface BuildingCrmHeaderProps {
  profile: PlanningBuildingCrmProfile;
}

export const BuildingCrmHeader = ({ profile }: BuildingCrmHeaderProps) => {
  const status = getCrmStatusCopy(profile.summary.status);
  const title = profile.building.displayName || profile.building.name;
  const code = profile.building.internalCode || profile.building.name;

  return (
    <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(244,211,94,0.22),_transparent_32%),linear-gradient(135deg,#10051f_0%,#1b0b34_48%,#310984_100%)] text-white shadow-2xl shadow-[#310984]/20">
      <div className="grid gap-6 p-5 md:p-7 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="border-white/15 bg-white/10 text-white">{code}</Badge>
            {profile.building.zone && <Badge variant="outline" className="border-white/15 bg-white/10 text-white">{profile.building.zone}</Badge>}
            {profile.building.clientName && <Badge variant="outline" className="border-white/15 bg-white/10 text-white">{profile.building.clientName}</Badge>}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-white/55">Estado operativo</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight md:text-5xl">{title}</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/72">
              {profile.building.propertyCount} propiedades · {formatCrmHours(profile.summary.serviceMinutes)} servicio · {formatCrmHours(profile.summary.personMinutes)} h-persona en el rango.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild className="bg-white text-[#310984] hover:bg-[#f0eaff]">
              <Link to={`/planning?building=${profile.building.id}&copilot=open`}>
                Planificar este edificio
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white">
              <Link to="/planning-settings">
                <Settings className="mr-2 h-4 w-4" />
                Editar configuración
              </Link>
            </Button>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.08] p-4 backdrop-blur-xl">
          <div className={`w-fit rounded-2xl border px-3 py-1 text-sm font-semibold ${status.className}`}>
            {status.label}
          </div>
          <p className="mt-3 text-sm leading-6 text-white/70">{status.description}</p>
          <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-2xl bg-black/20 p-3">
              <CalendarDays className="mb-2 h-4 w-4 text-[#f4d35e]" />
              <p className="text-white/50">Limpiezas</p>
              <p className="text-lg font-semibold">{profile.summary.confirmedCleanings + profile.summary.forecastCleanings}</p>
            </div>
            <div className="rounded-2xl bg-black/20 p-3">
              <Users className="mb-2 h-4 w-4 text-[#f4d35e]" />
              <p className="text-white/50">Equipo</p>
              <p className="text-lg font-semibold">{profile.summary.assignedPrimaryCount + profile.summary.assignedSecondaryCount + profile.summary.assignedBackupCount}</p>
            </div>
            <div className="rounded-2xl bg-black/20 p-3">
              <ShieldAlert className="mb-2 h-4 w-4 text-[#f4d35e]" />
              <p className="text-white/50">Decisiones</p>
              <p className="text-lg font-semibold">{profile.decisions.length}</p>
            </div>
            <div className="rounded-2xl bg-black/20 p-3">
              <Building2 className="mb-2 h-4 w-4 text-[#f4d35e]" />
              <p className="text-white/50">Propiedades</p>
              <p className="text-lg font-semibold">{profile.building.propertyCount}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
