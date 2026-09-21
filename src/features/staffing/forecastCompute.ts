import type { ForecastContext, ForecastDataset, ForecastModel } from './forecastContract';

export interface ForecastCalculation { model?: ForecastModel; base?: ForecastModel; error?: string; pending?: boolean }
/** Keep the UI responsive for a six-month horizon; abort discards the entire private worker. */
export function computeForecastAsync(dataset: ForecastDataset, context: ForecastContext, reinforcement: number, signal: AbortSignal, createWorker = () => new Worker(new URL('./forecastWorker.ts', import.meta.url), { type: 'module' })): Promise<ForecastCalculation> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(new Error('Cálculo cancelado')); return; }
    const worker = createWorker();
    const finish = () => { worker.terminate(); signal.removeEventListener('abort', abort); };
    const abort = () => { finish(); reject(new Error('Cálculo cancelado')); };
    signal.addEventListener('abort', abort, { once: true });
    worker.onmessage = (event: MessageEvent<ForecastCalculation>) => { finish(); if (event.data.error) reject(new Error(event.data.error)); else resolve(event.data); };
    worker.onerror = () => { finish(); reject(new Error('No se pudo calcular la previsión. Reintenta la consulta.')); };
    worker.postMessage({ dataset, context, reinforcement });
  });
}
