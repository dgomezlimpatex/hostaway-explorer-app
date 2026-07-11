import { ArrowLeft, CalendarClock, MoreHorizontal, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { PlanningBuildingCrmProfile } from '@/types/operationalPlanning';

interface BuildingCrmHeaderProps {
  profile: PlanningBuildingCrmProfile;
  onRefresh: () => void;
  isRefreshing?: boolean;
}

export const BuildingCrmHeader = ({ profile, onRefresh, isRefreshing = false }: BuildingCrmHeaderProps) => {
  const title = profile.building.displayName || profile.building.name;
  const code = profile.building.internalCode || profile.building.name;

  return (
    <header className="rounded-3xl border border-[#310984]/10 bg-white p-4 shadow-sm shadow-[#310984]/5 sm:p-5 md:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <Button asChild variant="ghost" size="sm" className="-ml-3 mb-2 text-[#6b627a] hover:bg-[#f0eaff] hover:text-[#310984]">
            <Link to="/planning/buildings">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Todos los edificios
            </Link>
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="border-[#310984]/15 bg-[#faf8ff] text-[#310984]">{code}</Badge>
            {profile.building.zone && <span className="text-sm text-[#6b627a]">{profile.building.zone}</span>}
          </div>
          <h1 className="mt-2 break-words text-2xl font-bold tracking-tight text-[#171321] sm:text-3xl">{title}</h1>
          <p className="mt-1 text-sm text-[#6b627a]">
            {profile.building.propertyCount} {profile.building.propertyCount === 1 ? 'propiedad' : 'propiedades'} · {profile.team.filter((member) => member.roleType !== 'excluded').length} personas asignadas
          </p>
        </div>

        <div className="flex w-full items-center gap-2 sm:w-auto">
          <Button type="button" disabled className="min-h-11 flex-1 bg-[#310984] text-white disabled:cursor-not-allowed disabled:opacity-70 sm:flex-none">
            <CalendarClock className="mr-2 h-4 w-4" />
            Planificación
            <span className="ml-2 text-xs opacity-75">Próximamente</span>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" size="icon" className="h-11 w-11 shrink-0 border-[#310984]/15" aria-label="Más acciones">
                <MoreHorizontal className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={onRefresh} disabled={isRefreshing}>
                <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                Actualizar datos
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
};
