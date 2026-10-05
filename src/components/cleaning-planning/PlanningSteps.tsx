import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export type PlanningStep = 1 | 2 | 3;

const STEPS: Array<{ number: PlanningStep; title: string; detail: string }> = [
  { number: 1, title: 'Elige el día', detail: 'Selecciona fecha y sede.' },
  { number: 2, title: 'Revisa el reparto', detail: 'Ajusta tareas y responsables.' },
  { number: 3, title: 'Guarda y avisa', detail: 'Confirma el reparto para iniciar los avisos.' },
];

interface PlanningStepsProps {
  current: PlanningStep;
  className?: string;
  compact?: boolean;
}

/** Tira de tres pasos para que quien entra por primera vez sepa en qué punto está y qué viene después. */
export const PlanningSteps = ({ current, className, compact = false }: PlanningStepsProps) => (
  <ol
    aria-label="Pasos para preparar el reparto"
    className={cn('grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-4', compact && 'grid-cols-3 gap-2', className)}
  >
    {STEPS.map((step) => {
      const done = step.number < current;
      const active = step.number === current;
      return (
        <li
          key={step.number}
          aria-current={active ? 'step' : undefined}
          className={cn(
            'flex min-w-0 items-center gap-3 border-t-2 pt-2.5 sm:pt-3',
            !compact && 'border-l-2 border-t-0 pl-3 sm:border-l-0 sm:border-t-2 sm:pl-0',
            done || active ? 'border-brand' : 'border-line',
          )}
        >
          <span
            aria-hidden="true"
            className={cn(
              'grid h-6 w-6 shrink-0 place-items-center rounded-full border text-xs font-semibold',
              done
                ? 'border-success/20 bg-tint-success text-success'
                : active
                  ? 'border-brand bg-brand text-white'
                  : 'border-line bg-white text-ink-3',
            )}
          >
            {done ? <Check className="h-4 w-4" /> : step.number}
          </span>
          <span className="min-w-0 flex-1">
            <span className={cn('block text-sm font-semibold leading-tight', compact && 'text-xs sm:text-sm', done ? 'text-brand' : active ? 'text-ink' : 'text-ink-3')}>
              {step.title}
            </span>
            <span className={cn('mt-1 block text-xs leading-5 text-ink-3', compact && 'sr-only')}>{step.detail}</span>
          </span>
        </li>
      );
    })}
  </ol>
);
