import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { PlanningBuildingCrmTeamMember } from '@/types/operationalPlanning';
import { formatCrmHours } from './buildingCrmFormatters';

interface BuildingTeamPanelProps {
  team: PlanningBuildingCrmTeamMember[];
}

const roleConfig = {
  primary: { title: 'Titulares', badge: 'Titular', className: 'border-emerald-200 bg-emerald-50 text-emerald-800' },
  secondary: { title: 'Suplentes', badge: 'Suplente', className: 'border-blue-200 bg-blue-50 text-blue-800' },
  backup: { title: 'Backups', badge: 'Backup', className: 'border-purple-200 bg-purple-50 text-purple-800' },
  excluded: { title: 'No aptas', badge: 'No apta', className: 'border-red-200 bg-red-50 text-red-800' },
} satisfies Record<PlanningBuildingCrmTeamMember['roleType'], { title: string; badge: string; className: string }>;

export const BuildingTeamPanel = ({ team }: BuildingTeamPanelProps) => {
  return (
    <Card className="border-[#310984]/10 bg-white shadow-sm shadow-[#310984]/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-[#171321]">Equipo del edificio</CardTitle>
        <p className="text-sm text-[#6b627a]">Roles operativos, disponibilidad futura y carga ya asignada.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {(Object.keys(roleConfig) as PlanningBuildingCrmTeamMember['roleType'][]).map((role) => {
          const members = team.filter((member) => member.roleType === role);
          const config = roleConfig[role];
          return (
            <section key={role} className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-[#171321]">{config.title}</h3>
                <Badge variant="outline" className={config.className}>{members.length}</Badge>
              </div>
              {members.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-[#310984]/15 p-3 text-sm text-[#6b627a]">Sin trabajadoras en este rol.</p>
              ) : (
                <div className="space-y-2">
                  {members.map((member) => (
                    <article key={`${role}-${member.cleanerId}`} className="rounded-2xl border border-[#310984]/10 bg-[#faf8ff] p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-[#171321]">{member.cleanerName}</p>
                          <p className="text-xs text-[#6b627a]">{member.availableDaysInRange} días disponible · {formatCrmHours(member.futureAssignedMinutes)} asignadas</p>
                        </div>
                        <Badge variant="outline" className={config.className}>{config.badge}</Badge>
                      </div>
                      {member.notes && <p className="mt-2 text-xs text-[#6b627a]">{member.notes}</p>}
                    </article>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </CardContent>
    </Card>
  );
};
