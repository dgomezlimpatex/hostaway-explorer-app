
export function getMadridTime() {
  const now = new Date();
  // Ajustar para zona horaria española (UTC+1/UTC+2)
  return new Date(now.getTime() + (2 * 60 * 60 * 1000)); // UTC+2 para horario de verano
}

export function getDateRange() {
  const madridTime = getMadridTime();
  const today = madridTime.toISOString().split('T')[0];
  
  const tomorrow = new Date(madridTime);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  const endDate = new Date(madridTime);
  endDate.setDate(endDate.getDate() + 14);
  const endDateStr = endDate.toISOString().split('T')[0];
  
  return {
    today,
    tomorrow: tomorrowStr,
    endDate: endDateStr,
    madridTime
  };
}

export function logDateInfo(today: string, tomorrow: string, madridTime: Date) {
  console.log(`📅 Fecha actual (Madrid): ${today}`);
  console.log(`📅 Mañana será: ${tomorrow}`);
  console.log(`📅 Hora actual: ${madridTime.toLocaleString('es-ES')}`);
}
