import { ClipboardCheck, Plus, Trash2, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAssignSupervisorToBuilding, useRemoveSupervisorFromBuilding, useSupervisionBuildingAssignments, useSupervisionUsers } from '@/hooks/useSupervisionAssignments';

interface SupervisionBuildingAssignmentEditorProps {
  propertyGroupId: string;
}

const roleLabels = { primary: 'Titular', secondary: 'Suplente', backup: 'Refuerzo' } as const;

export const SupervisionBuildingAssignmentEditor = ({ propertyGroupId }: SupervisionBuildingAssignmentEditorProps) => {
  const assignmentsQuery = useSupervisionBuildingAssignments(propertyGroupId);
  const usersQuery = useSupervisionUsers();
  const assign = useAssignSupervisorToBuilding();
  const remove = useRemoveSupervisorFromBuilding();
  const [selectedUserId, setSelectedUserId] = useState('');
  const [roleType, setRoleType] = useState<'primary' | 'secondary' | 'backup'>('primary');

  const usersById = useMemo(() => new Map((usersQuery.data || []).map((user) => [user.id, user])), [usersQuery.data]);
  const assignedIds = new Set((assignmentsQuery.data || []).map((assignment) => assignment.supervisor_user_id));
  const availableUsers = (usersQuery.data || []).filter((user) => !assignedIds.has(user.id));

  const handleAssign = async () => {
    if (!selectedUserId) return;
    await assign.mutateAsync({ propertyGroupId, supervisorUserId: selectedUserId, roleType });
    setSelectedUserId('');
  };

  return (
    <Card className="border-[#310984]/10 bg-white shadow-sm shadow-[#310984]/5">
      <CardHeader className="space-y-2 pb-3"><div className="flex items-start justify-between gap-3"><div><CardTitle className="flex items-center gap-2 text-[#171321]"><ClipboardCheck className="h-5 w-5 text-[#310984]" />Supervisoras del edificio</CardTitle><p className="mt-1 text-sm text-[#6b627a]">Asigna quién verá automáticamente las propiedades y comprobaciones de este edificio.</p></div><Badge variant="outline" className="border-[#310984]/15 text-[#310984]"><Users className="mr-1 h-3.5 w-3.5" />{assignmentsQuery.data?.length || 0}</Badge></div></CardHeader>
      <CardContent className="space-y-3">
        {(assignmentsQuery.data || []).map((assignment) => {
          const user = usersById.get(assignment.supervisor_user_id);
          return <div key={assignment.id} className="flex flex-col gap-2 rounded-xl border border-[#310984]/10 bg-[#faf8ff] p-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold text-[#171321]">{user?.full_name || user?.email || 'Supervisora'}</p><p className="text-xs text-[#6b627a]">{user?.email || 'Sin email visible'} · {roleLabels[assignment.role_type]}</p></div><Button size="sm" variant="outline" className="w-fit border-red-200 text-red-700" onClick={() => void remove.mutateAsync({ assignmentId: assignment.id, propertyGroupId })} disabled={remove.isPending}><Trash2 className="mr-1.5 h-3.5 w-3.5" />Quitar</Button></div>;
        })}
        <div className="grid gap-2 sm:grid-cols-[1fr_150px_auto]"><Select value={selectedUserId} onValueChange={setSelectedUserId}><SelectTrigger><SelectValue placeholder={usersQuery.isLoading ? 'Cargando supervisoras…' : 'Selecciona supervisora'} /></SelectTrigger><SelectContent>{availableUsers.length === 0 ? <SelectItem value="none" disabled>No hay supervisoras disponibles</SelectItem> : availableUsers.map((user) => <SelectItem key={user.id} value={user.id}>{user.full_name || user.email || 'Supervisora'}</SelectItem>)}</SelectContent></Select><Select value={roleType} onValueChange={(value) => setRoleType(value as typeof roleType)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(roleLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select><Button onClick={() => void handleAssign()} disabled={!selectedUserId || assign.isPending}><Plus className="mr-2 h-4 w-4" />Asignar</Button></div>
      </CardContent>
    </Card>
  );
};
