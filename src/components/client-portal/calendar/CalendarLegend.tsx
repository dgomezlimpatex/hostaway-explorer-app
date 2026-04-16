import { ArrowRightToLine, ArrowLeftFromLine } from 'lucide-react';
import { PropertyColor } from './propertyColors';

interface CalendarLegendProps {
  properties: { id: string; codigo: string }[];
  colorMap: Map<string, PropertyColor>;
}

export const CalendarLegend = ({ properties, colorMap }: CalendarLegendProps) => (
  <div className="flex flex-wrap items-center gap-3 sm:gap-5 mt-4 sm:mt-6 pt-3 sm:pt-4 border-t text-xs sm:text-sm">
    <div className="flex items-center gap-1.5">
      <div className="flex items-center justify-center bg-emerald-500 text-white rounded-full w-4 h-4 sm:w-5 sm:h-5">
        <ArrowRightToLine className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
      </div>
      <span className="font-medium text-emerald-700">Entrada</span>
    </div>
    <div className="flex items-center gap-1.5">
      <div className="flex items-center justify-center bg-rose-500 text-white rounded-full w-4 h-4 sm:w-5 sm:h-5">
        <ArrowLeftFromLine className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
      </div>
      <span className="font-medium text-rose-700">Salida</span>
    </div>
    <div className="flex items-center gap-1.5">
      <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-lg border-2 border-primary bg-primary/10" />
      <span className="font-medium text-muted-foreground">Hoy</span>
    </div>
    {properties.length > 0 && (
      <div className="flex items-center gap-2 sm:gap-3 sm:ml-auto flex-wrap">
        {properties.map(prop => {
          const color = colorMap.get(prop.id);
          if (!color) return null;
          return (
            <div key={prop.id} className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full" style={{ backgroundColor: color.text }} />
              <span className="text-[10px] sm:text-xs font-medium text-muted-foreground">{prop.codigo}</span>
            </div>
          );
        })}
      </div>
    )}
  </div>
);
