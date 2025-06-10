
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/hooks/useTheme";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export const ThemeToggle = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            onClick={toggleTheme}
            className="relative overflow-hidden transition-all duration-300 hover:scale-105"
          >
            <Sun 
              className={`h-4 w-4 transition-all duration-500 ${
                theme === 'dark' ? 'rotate-90 scale-0' : 'rotate-0 scale-100'
              }`} 
            />
            <Moon 
              className={`absolute h-4 w-4 transition-all duration-500 ${
                theme === 'dark' ? 'rotate-0 scale-100' : '-rotate-90 scale-0'
              }`} 
            />
            <span className="sr-only">Cambiar tema</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{theme === 'light' ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro'}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
