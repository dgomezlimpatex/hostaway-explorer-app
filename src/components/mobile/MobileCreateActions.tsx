import type { ReactNode } from 'react';
import { CalendarPlus, Layers, Plus, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface MobileCreateActionsProps {
  onNewTask?: () => void;
  onNewBatchTask?: () => void;
  onNewExtraordinaryService?: () => void;
  trigger?: ReactNode;
  align?: 'start' | 'center' | 'end';
}

export function MobileCreateActions({
  onNewTask,
  onNewBatchTask,
  onNewExtraordinaryService,
  trigger,
  align = 'center',
}: MobileCreateActionsProps) {
  const hasAnyAction = !!onNewTask || !!onNewBatchTask || !!onNewExtraordinaryService;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={!hasAnyAction}>
        {trigger || (
          <Button size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            Crear
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} side="top" sideOffset={12} className="w-64">
        <DropdownMenuLabel>Crear</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={!onNewTask} onSelect={onNewTask}>
          <CalendarPlus className="mr-2 h-4 w-4 text-blue-600" />
          Nueva tarea
        </DropdownMenuItem>
        <DropdownMenuItem disabled={!onNewBatchTask} onSelect={onNewBatchTask}>
          <Layers className="mr-2 h-4 w-4 text-indigo-600" />
          Tareas multiples
        </DropdownMenuItem>
        <DropdownMenuItem disabled={!onNewExtraordinaryService} onSelect={onNewExtraordinaryService}>
          <Sparkles className="mr-2 h-4 w-4 text-emerald-600" />
          Tarea extraordinaria
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
