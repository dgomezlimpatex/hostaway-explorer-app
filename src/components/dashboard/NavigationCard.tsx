import { Link } from 'react-router-dom';
import { LucideIcon } from 'lucide-react';

interface NavigationCardProps {
  to: string;
  title: string;
  description: string;
  icon: LucideIcon;
  /**
   * Props heredadas de la etapa de tarjetas con degradado. Se mantienen en la interfaz
   * para no romper las llamadas existentes, pero el diseño sobrio ya no las usa: el color
   * se reserva para el acento y el estado.
   */
  gradientFrom?: string;
  gradientTo?: string;
  iconColor?: string;
  hoverBorderColor?: string;
}

export const NavigationCard = ({ to, title, description, icon: Icon }: NavigationCardProps) => (
  <Link
    to={to}
    className="group block rounded-lg border border-line bg-surface p-5 shadow-sober transition-colors hover:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
  >
    <span className="grid h-11 w-11 place-items-center rounded-md border border-line bg-paper">
      <Icon className="h-5 w-5 text-brand" />
    </span>
    <span className="mt-4 block text-[15px] font-semibold text-ink">{title}</span>
    <span className="mt-1 block text-sm leading-6 text-ink-3">{description}</span>
  </Link>
);
