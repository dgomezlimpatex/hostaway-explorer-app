import type { CleanerGroupAssignment, PropertyGroup, PropertyGroupAssignment } from '@/types/propertyGroups';

export type BuildingRole = NonNullable<CleanerGroupAssignment['roleType']>;
export const buildingRoles: Record<BuildingRole, string> = { primary: 'Titular', secondary: 'Suplente', backup: 'Apoyo', excluded: 'No apta' };
const priorities: Record<BuildingRole, number> = { primary: 10, secondary: 20, backup: 30, excluded: 99 };
export interface BuildingSnapshot {
  group: PropertyGroup;
  team: CleanerGroupAssignment[];
  properties: PropertyGroupAssignment[];
}
export interface BuildingDraft {
  team: { cleanerId: string; role: BuildingRole }[];
  propertyIds: string[];
  supervisorName: string;
}
export function createBuildingDraft(snapshot: BuildingSnapshot): BuildingDraft {
  return {
    team: snapshot.team.map(member => ({ cleanerId: member.cleanerId, role: member.roleType || 'primary' })),
    propertyIds: snapshot.properties.map(item => item.propertyId),
    supervisorName: snapshot.group.supervisorName || '',
  };
}
export function buildingChangeCount(snapshot: BuildingSnapshot, draft: BuildingDraft) {
  const original = createBuildingDraft(snapshot);
  return original.team.filter(member => !draft.team.some(next => next.cleanerId === member.cleanerId && next.role === member.role)).length
    + draft.team.filter(member => !original.team.some(previous => previous.cleanerId === member.cleanerId)).length
    + original.propertyIds.filter(id => !draft.propertyIds.includes(id)).length
    + draft.propertyIds.filter(id => !original.propertyIds.includes(id)).length
    + Number(original.supervisorName !== draft.supervisorName.trim());
}
export function snapshotSignature(snapshot: BuildingSnapshot) {
  return JSON.stringify({ group: snapshot.group, team: [...snapshot.team].sort((a, b) => a.id.localeCompare(b.id)), properties: [...snapshot.properties].sort((a, b) => a.id.localeCompare(b.id)) });
}
export interface BuildingDraftStorage {
  getPropertyGroups(): Promise<PropertyGroup[]>;
  getCleanerAssignments(id: string): Promise<CleanerGroupAssignment[]>;
  getAllPropertyAssignments(): Promise<PropertyGroupAssignment[]>;
  assignCleanerToGroup(value: Omit<CleanerGroupAssignment, 'id' | 'createdAt' | 'updatedAt'>): Promise<unknown>;
  updateCleanerAssignment(id: string, value: Partial<CleanerGroupAssignment>): Promise<unknown>;
  removeCleanerFromGroup(id: string): Promise<void>;
  assignPropertyToGroup(groupId: string, propertyId: string): Promise<unknown>;
  removePropertyFromGroup(id: string): Promise<void>;
  updatePropertyGroup(id: string, value: Partial<PropertyGroup>): Promise<unknown>;
}

// Uses the existing writes. No transaction is claimed: the caller must reconcile
// after any failure, including an ambiguous network response, before saving again.
export async function saveBuildingDraft(storage: BuildingDraftStorage, snapshot: BuildingSnapshot, draft: BuildingDraft) {
  const id = snapshot.group.id;
  if (new Set(draft.team.map(item => item.cleanerId)).size !== draft.team.length || new Set(draft.propertyIds).size !== draft.propertyIds.length) throw new Error('Hay vínculos duplicados en el borrador.');
  const [groups, team, properties] = await Promise.all([storage.getPropertyGroups(), storage.getCleanerAssignments(id), storage.getAllPropertyAssignments()]);
  const group = groups.find(item => item.id === id);
  if (!group || snapshotSignature({ group, team, properties: properties.filter(item => item.propertyGroupId === id) }) !== snapshotSignature(snapshot)) {
    throw new Error('El edificio ha cambiado desde que lo abriste. Recarga su estado antes de continuar.');
  }
  for (const propertyId of draft.propertyIds) {
    if (properties.some(item => item.propertyId === propertyId && item.propertyGroupId !== id)) throw new Error('Una propiedad seleccionada ya pertenece a otro edificio. Recarga su estado.');
  }
  for (const member of draft.team) {
    const previous = snapshot.team.find(item => item.cleanerId === member.cleanerId);
    if (!previous) {
      await storage.assignCleanerToGroup({ propertyGroupId: id, cleanerId: member.cleanerId, roleType: member.role, priority: priorities[member.role], knowledgeLevel: 3, maxTasksPerDay: 8, estimatedTravelTimeMinutes: 15, maxDailyMinutesOverride: null, notes: null, isActive: true });
    } else if ((previous.roleType || 'primary') !== member.role) {
      await storage.updateCleanerAssignment(previous.id, { roleType: member.role, priority: priorities[member.role], ...(member.role === 'excluded' ? { isActive: true } : {}) });
    }
  }
  for (const propertyId of draft.propertyIds.filter(value => !snapshot.properties.some(item => item.propertyId === value))) await storage.assignPropertyToGroup(id, propertyId);
  for (const member of snapshot.team.filter(value => !draft.team.some(item => item.cleanerId === value.cleanerId))) await storage.removeCleanerFromGroup(member.id);
  for (const property of snapshot.properties.filter(value => !draft.propertyIds.includes(value.propertyId))) await storage.removePropertyFromGroup(property.id);
  if ((snapshot.group.supervisorName || '') !== draft.supervisorName.trim()) await storage.updatePropertyGroup(id, { supervisorName: draft.supervisorName.trim() });
}
