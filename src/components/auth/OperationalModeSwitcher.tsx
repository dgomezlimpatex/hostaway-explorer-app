import { ClipboardCheck, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import type { OperationalMode } from '@/auth/operationalMode';

const modes: Array<{ value: OperationalMode; label: string; icon: typeof ClipboardCheck }> = [
  { value: 'supervision', label: 'Supervisión', icon: ClipboardCheck },
  { value: 'cleaning', label: 'Limpieza', icon: Sparkles },
];

export const OperationalModeSwitcher = () => {
  const { operationalMode, canSwitchOperationalMode, setOperationalMode } = useAuth();

  if (!canSwitchOperationalMode) return null;

  return (
    <div
      className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white/80 p-2 shadow-sm"
      role="group"
      aria-label="Modo operativo"
    >
      <span className="px-1 text-xs font-medium text-slate-600">Modo operativo</span>
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
            onClick={() => setOperationalMode(value)}
            className="min-h-9 gap-1.5"
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {label}
          </Button>
        );
      })}
    </div>
  );
};
