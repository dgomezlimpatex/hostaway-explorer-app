
export const StatusLegend = () => {
  return (
    <div className="flex items-center gap-6 text-sm bg-white p-4 rounded-lg shadow-sm">
      <span className="text-gray-600 font-medium">Estado:</span>
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 bg-red-500 rounded-full"></div>
        <span>Pendiente</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
        <span>En Progreso</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
        <span>Completado</span>
      </div>
    </div>
  );
};
