
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface StatusIndicatorProps {
  status: 'pending' | 'in-progress' | 'completed' | 'cancelled';
  size?: 'sm' | 'md' | 'lg';
  showTooltip?: boolean;
  className?: string;
}

const statusConfig = {
  'pending': {
    color: 'bg-yellow-400',
    darkColor: 'dark:bg-yellow-500',
    label: 'Pendiente',
    pulse: true
  },
  'in-progress': {
    color: 'bg-blue-500',
    darkColor: 'dark:bg-blue-400',
    label: 'En progreso',
    pulse: true
  },
  'completed': {
    color: 'bg-green-500',
    darkColor: 'dark:bg-green-400',
    label: 'Completada',
    pulse: false
  },
  'cancelled': {
    color: 'bg-red-500',
    darkColor: 'dark:bg-red-400',
    label: 'Cancelada',
    pulse: false
  }
};

const sizeConfig = {
  sm: 'w-2 h-2',
  md: 'w-3 h-3',
  lg: 'w-4 h-4'
};

export const StatusIndicator = ({ 
  status, 
  size = 'md', 
  showTooltip = true,
  className 
}: StatusIndicatorProps) => {
  const config = statusConfig[status];
  const sizeClass = sizeConfig[size];
  
  const indicator = (
    <div 
      className={cn(
        "rounded-full transition-all duration-300",
        config.color,
        config.darkColor,
        sizeClass,
        config.pulse && "animate-pulse",
        "shadow-sm",
        className
      )}
    />
  );

  if (!showTooltip) return indicator;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {indicator}
        </TooltipTrigger>
        <TooltipContent>
          <p>{config.label}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
