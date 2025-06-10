
import { ScrollArea } from "@/components/ui/scroll-area";
import { Cleaner } from "@/types/calendar";
import { cn } from "@/lib/utils";

interface WorkersColumnProps {
  cleaners: Cleaner[];
}

export const WorkersColumn = ({ cleaners }: WorkersColumnProps) => {
  return (
    <div className="w-48 bg-gray-50 border-r border-gray-200 flex-shrink-0">
      {/* Header */}
      <div className="h-16 bg-white border-b border-gray-200 flex items-center px-4">
        <span className="font-semibold text-gray-700">Trabajadores</span>
      </div>
      
      {/* Workers List */}
      <ScrollArea className="h-[544px]">
        {cleaners.map((cleaner, index) => (
          <div 
            key={cleaner.id} 
            className={cn(
              "h-20 border-b-2 border-gray-300 p-3 flex items-center hover:bg-gray-100 transition-colors",
              index % 2 === 0 ? "bg-white" : "bg-gray-50"
            )}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-medium">
                {cleaner.name.split(' ').map(n => n[0]).join('').toUpperCase()}
              </div>
              <div>
                <div className="font-medium text-gray-900 text-sm">{cleaner.name}</div>
                <div className="flex items-center gap-1">
                  <div className={`w-2 h-2 rounded-full ${cleaner.isActive ? 'bg-green-400' : 'bg-gray-400'}`} />
                  <span className="text-xs text-gray-500">
                    {cleaner.isActive ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </ScrollArea>
    </div>
  );
};
