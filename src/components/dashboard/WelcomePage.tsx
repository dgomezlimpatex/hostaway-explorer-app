import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Calendar, Users, TrendingUp, ListChecks } from 'lucide-react';

const FEATURES = [
  { icon: Calendar, title: 'Calendario y reparto', detail: 'Las limpiezas del día, con quién las hace y a qué hora.' },
  { icon: Users, title: 'Equipo y disponibilidad', detail: 'Fichas, horarios, ausencias y carga de cada trabajadora.' },
  { icon: TrendingUp, title: 'Planificación y previsión', detail: 'Reparto del día y personal necesario a medio plazo.' },
];

export const WelcomePage = () => (
  <div className="min-h-screen bg-paper text-ink">
    <div className="mx-auto max-w-4xl px-4 py-16 md:py-24">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-3">Limpatex</p>
      <h1 className="mt-3 text-4xl font-semibold leading-tight tracking-tight md:text-5xl">
        Gestión de limpiezas, <span className="text-brand">sin papeleo</span>
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-7 text-ink-3 md:text-lg">
        Calendario del día, reparto entre el equipo, partes de trabajo y control de lo que falta por cubrir.
      </p>

      <div className="mt-10 grid gap-4 md:grid-cols-3">
        {FEATURES.map(({ icon: Icon, title, detail }) => (
          <article key={title} className="rounded-lg border border-line bg-surface p-5 shadow-sober">
            <span className="grid h-10 w-10 place-items-center rounded-md border border-line bg-paper">
              <Icon className="h-5 w-5 text-ink-3" />
            </span>
            <h2 className="mt-4 text-[15px] font-semibold">{title}</h2>
            <p className="mt-1 text-sm leading-6 text-ink-3">{detail}</p>
          </article>
        ))}
      </div>

      <div className="mt-10 flex flex-wrap items-center gap-4">
        <Button asChild size="lg" className="min-h-[48px] bg-brand px-8 text-base font-semibold text-white hover:bg-ink">
          <Link to="/auth">
            <ListChecks className="mr-2 h-5 w-5" /> Iniciar sesión
          </Link>
        </Button>
        <p className="text-sm text-ink-3">Acceso restringido al personal de Limpatex.</p>
      </div>
    </div>
  </div>
);
