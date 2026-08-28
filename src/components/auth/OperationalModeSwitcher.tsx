import { ClipboardCheck, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import type { OperationalMode } from '@/auth/operationalMode';

const modes: Array<{ value: OperationalMode; label: string; icon: typeof ClipboardCheck }> = [
  { value: 'supervision', label: 'Supervisión', icon: ClipboardCheck },
  { value: 'cleaning', label: 'Limpieza', icon: Sparkles },
];

interface OperationalModeSwitcherProps {
  compact?: boolean;
}

export const OperationalModeSwitcher = ({ compact = false }: OperationalModeSwitcherProps) => {
  const { operationalMode, canSwitchOperationalMode, setOperationalMode } = useAuth();

  if (!canSwitchOperationalMode) return null;

  return (
    <div
      className={`flex items-center gap-1.5 rounded-2xl border border-slate-200/80 bg-white/80 shadow-sm ${compact ? 'p-1' : 'flex-wrap p-2'}`}
      role="group"
      aria-label="Modo operativo"
    >
      <span className={compact ? 'sr-only' : 'px-1 text-xs font-medium text-slate-600'}>Modo operativo</span>
      {modes.map(({ value, label, icon: Icon }) => {
        const isActive = operationalMode === value;
        return (
          <Button
            key={value}
            type="button"
            size="sm"
            variant={isActive ? 'default' : 'outline'}
            aria-pressed={isActive}
            aria-label={`Cambiar a modo ${label}`}
            title={`Cambiar a modo ${label}`}
            onClick={() => setOperationalMode(value)}
            className={`min-h-9 gap-1.5 ${compact ? 'px-2 sm:px-3' : ''}`}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            <span className={compact ? 'sr-only sm:not-sr-only' : undefined}>{label}</span>
          </Button>
        );
      })}
    </div>
  );
};
