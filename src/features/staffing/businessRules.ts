/**
 * Explicit local business configuration, not name inference or a database writer.
 * Hotel property and sede IDs verified by a scoped metadata read. Dani confirmed
 * recurring hotel shifts and habitual collaborator availability as forecast inputs.
 * The reader must still validate configured property IDs against authorized rows.
 * No personal IDs or credentials belong here. Other sedes keep conservative defaults.
 */
export function staffingRulesForSede(sedeId: string) {
  if (sedeId === '1e0759ec-5e63-4edd-9dad-e493c715bbba') {
    return {
      shiftPropertyIds: ['e0c82e3d-f702-4842-8c34-c987a6fd9c2e'],
      useHabitualCollaborators: true,
      allowCrossCenterMobility: true,
    };
  }
  return { shiftPropertyIds: [] as string[], useHabitualCollaborators: false, allowCrossCenterMobility: false };
}
