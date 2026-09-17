/**
 * Explicit local business configuration, not name inference or a database writer.
 * Hotel property and sede IDs verified by a scoped metadata read. Dani confirmed
 * recurring hotel shifts, habitual collaborator availability and which workers
 * stay outside the general cleaning forecast.
 * The reader must still validate configured IDs against authorized rows.
 * No credentials belong here. Other sedes keep conservative defaults.
 */
export function staffingRulesForSede(sedeId: string) {
  if (sedeId === '1e0759ec-5e63-4edd-9dad-e493c715bbba') {
    return {
      shiftPropertyIds: ['e0c82e3d-f702-4842-8c34-c987a6fd9c2e'],
      // Confirmado por Dani: la disponibilidad registrada ya no genera capacidad.
      // Solo cuentan horas de contrato o ficha (regla registrada en dataWorkers).
      allowCrossCenterMobility: true,
      // Confirmado por Dani: quedan fuera de la previsión como personas, porque no
      // hacen limpieza general (dirección; Azzeddine y Vicente solo urgencias o un
      // apartamento concreto). Sus horas no cuentan; su trabajo sí suma como carga.
      excludedWorkerIds: [
        '3da6d3e9-9e0b-4863-aab2-d371a20d2bb7', // DANIEL GOMEZ HERMIDA
        'acffe4d5-05c2-4ff7-82b9-c6c4db85ee34', // AZZEDDINE CHAMSSI
        'fed80a4e-1c18-4f8e-a85d-4ff94d119064', // VICENTE MORENO LOUREDA
      ],
    };
  }
  return { shiftPropertyIds: [] as string[], useHabitualCollaborators: false, allowCrossCenterMobility: false, excludedWorkerIds: [] as string[] };
}
