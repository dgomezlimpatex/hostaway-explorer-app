import { Link } from 'react-router-dom';
import { Activity, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PmsHealthPanel } from '@/features/pmsHealth/PmsHealthPanel';

/**
 * Panel de salud de las integraciones con PMS. Solo lectura: reúne lo que ya
 * registran Smoobu y Little Hotelier y dice qué requiere intervención.
 */
export default function PmsHealth() {
  return (
    <div className="container mx-auto max-w-7xl space-y-6 px-4 py-5 sm:px-6 sm:py-8">
      <header className="flex items-start gap-3 border-b pb-5">
        <Button variant="ghost" size="icon" className="mt-0.5 shrink-0 rounded-full" aria-label="Volver al inicio" asChild>
          <Link to="/">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Activity className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-muted-foreground">Sincronizaciones</p>
          <h1 className="mt-0.5 text-2xl font-semibold tracking-tight sm:text-3xl">Estado de los PMS</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Si llegan datos recientes de Smoobu y Little Hotelier, y qué requiere intervención.
          </p>
        </div>
      </header>
      <PmsHealthPanel />
    </div>
  );
}
