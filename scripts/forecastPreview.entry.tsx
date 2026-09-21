import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, useParams, useSearchParams, Routes, Route } from 'react-router-dom';
import { ForecastWorkspaceView } from '../src/features/staffing/ForecastWorkspaceView';
import { parseForecastContext, type ForecastScreen } from '../src/features/staffing/forecastContract';
import { visualFixture, context } from './forecastFixture';
import { computeForecastAsync, type ForecastCalculation } from '../src/features/staffing/forecastCompute';
const data = visualFixture();
export function Preview() {
  const { screen = 'forecast' } = useParams();
  const [params] = useSearchParams();
  const current = parseForecastContext(params, context.sedeId, '2026-10-05T09:00');
  const state = params.get('fixture');
  const visible = state === 'empty' ? { ...data, tasks: [], workers: [], centers: [] } : data;
  const [calculation, setCalculation] = useState<ForecastCalculation>({ pending: true });
  const key = params.toString();
  useEffect(() => {
    const abort = new AbortController(); setCalculation({ pending: true });
    computeForecastAsync(visible, current, Number(params.get('refuerzo') ?? 0), abort.signal, () => new Worker('/forecast-worker.js', { type: 'module' })).then(setCalculation).catch(error => { if (!abort.signal.aborted) setCalculation({ error: error.message }); });
    return () => abort.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return <ForecastWorkspaceView screen={screen as ForecastScreen} context={current} dataset={state === 'loading' || state === 'error' ? undefined : visible} calculation={calculation} loading={state === 'loading'} error={state === 'error' ? 'Error sintético de lectura' : undefined} sedeName="Sede de prueba · datos sintéticos" />;
}
createRoot(document.getElementById('root')!).render(<BrowserRouter><Routes><Route path="/staffing-forecast/screens/:screen" element={<Preview />} /><Route path="*" element={<Preview />} /></Routes></BrowserRouter>);
