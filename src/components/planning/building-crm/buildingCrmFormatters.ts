export const formatCrmHours = (minutes: number): string => {
  const hours = minutes / 60;
  if (!Number.isFinite(hours)) return '0 h';
  return `${hours.toFixed(minutes % 60 === 0 ? 0 : 1)} h`;
};

export const formatCrmPercent = (value: number): string => `${Math.round(value)}%`;

export const formatCrmDateLabel = (date: string): string => new Date(`${date}T12:00:00`).toLocaleDateString('es-ES', {
  weekday: 'short',
  day: '2-digit',
  month: 'short',
});

export const getCrmStatusCopy = (status: 'empty' | 'covered' | 'watch' | 'critical') => {
  switch (status) {
    case 'covered':
      return { label: 'Cubierto', description: 'El edificio no muestra presión crítica en el rango.', className: 'border-emerald-300/30 bg-emerald-400/15 text-emerald-50' };
    case 'watch':
      return { label: 'Vigilar', description: 'Hay previsión, backups o decisiones menores que conviene revisar.', className: 'border-amber-300/30 bg-amber-400/15 text-amber-50' };
    case 'critical':
      return { label: 'Refuerzo necesario', description: 'Hay falta de capacidad, datos esenciales o No apta asignada.', className: 'border-red-300/30 bg-red-400/15 text-red-50' };
    case 'empty':
    default:
      return { label: 'Sin carga', description: 'No hay limpiezas confirmadas o previstas en este rango.', className: 'border-slate-300/30 bg-white/10 text-slate-50' };
  }
};
