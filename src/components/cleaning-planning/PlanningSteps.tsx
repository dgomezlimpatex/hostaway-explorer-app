import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export type PlanningStep = 1 | 2 | 3;

const STEPS: Array<{ number: PlanningStep; title: string; detail: string }> = [
  { number: 1, title: 'Elige el día', detail: 'Y la sede, si llevas varias.' },
  { number: 2, title: 'Revisa la propuesta', detail: 'La app reparte; tú cambias lo que haga falta.' },
  { number: 3, title: 'Guarda y avisa', detail: 'Nada se guarda hasta que pulses Guardar reparto.' },
];

interface PlanningStepsProps {
  current: PlanningStep;
  className?: string;
}

/** Tira de tres pasos para que quien entra por primera vez sepa en qué punto está y qué viene después. */
export const PlanningSteps = ({ current, className }: PlanningStepsProps) => (
  <ol aria-label="Pasos para preparar el reparto" className={cn('grid gap-2 sm:grid-cols-3', className)}>
    {STEPS.map((step) => {
      const done = step.number < current;
      const active = step.number === current;
      return (
        <li
          key={step.number}
          aria-current={active ? 'step' : undefined}
          className={cn(
            'flex items-start gap-3 rounded-2xl border p-3',
            active ? 'border-[#310984]/25 bg-[#f3effc]' : 'border-[#310984]/10 bg-white',
          )}
        >
          <span
            aria-hidden="true"
            className={cn(
              'grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm font-bold',
              done
                ? 'bg-emerald-100 text-emerald-700'
                : active
                  ? 'bg-[#310984] text-white'
                  : 'bg-muted text-[#6b627a]',
            )}
          >
            {done ? <Check className="h-4 w-4" /> : step.number}
          </span>
          <span className="min-w-0">
            <span className={cn('block text-sm font-semibold', active ? 'text-[#171321]' : 'text-[#6b627a]')}>
              {step.title}
            </span>
            <span className="mt-0.5 block text-xs leading-5 text-[#6b627a]">{step.detail}</span>
          </span>
        </li>
      );
    })}
  </ol>
);
