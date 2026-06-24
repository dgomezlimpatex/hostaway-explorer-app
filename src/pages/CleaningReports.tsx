import React, { Suspense, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, RefreshCw, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { LazyCleaningReportsIncidents } from '@/components/cleaning-reports/LazyCleaningReportsComponents';

export default function CleaningReports() {
  const LoadingComponent = useCallback(() => (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Skeleton className="h-10 flex-1" />
        <Skeleton className="h-10 w-full sm:w-64" />
      </div>
      {[...Array(4)].map((_, i) => (
        <div key={i} className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between gap-4">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-6 w-24" />
          </div>
          <Skeleton className="mb-2 h-4 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      ))}
    </div>
  ), []);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="border-b border-gray-200 bg-white px-4 py-4 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Link to="/">
              <Button variant="outline" size="sm">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Volver
              </Button>
            </Link>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                <TriangleAlert className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-950">Incidencias</h1>
                <p className="text-sm text-gray-600">
                  Revisa, aprueba y controla las incidencias reportadas en las tareas.
                </p>
              </div>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => window.location.reload()}
            className="w-full sm:w-auto"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Actualizar
          </Button>
        </div>
      </div>

      <main className="p-4 sm:p-6">
        <Suspense fallback={<LoadingComponent />}>
          <LazyCleaningReportsIncidents />
        </Suspense>
      </main>
    </div>
  );
}
