
export function getMadridTime() {
  const now = new Date();
  // Convertir a hora de Madrid (UTC+1 en invierno, UTC+2 en verano)
  const madridTime = new Date(now.toLocaleString("en-US", {timeZone: "Europe/Madrid"}));
  return madridTime;
}

export function getDateRange() {
  const madridTime = getMadridTime();
  const today = madridTime.toISOString().split('T')[0];
  
  // Calcular mañana correctamente
  const tomorrow = new Date(madridTime);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  // Calcular fecha de fin (desde hoy + 14 días)
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
  console.log(`📅 Hora actual: ${madridTime.toLocaleString('es-ES', {timeZone: 'Europe/Madrid'})}`);
}
