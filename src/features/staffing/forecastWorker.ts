import { buildForecastModel } from './forecastModel';
import type { ForecastContext, ForecastDataset } from './forecastContract';

const workerScope = self as unknown as { onmessage: (event: MessageEvent<{ dataset: ForecastDataset; context: ForecastContext; reinforcement: number }>) => void; postMessage: (message: unknown) => void };
workerScope.onmessage = ({ data }) => {
  try {
    workerScope.postMessage({ model: buildForecastModel(data.dataset, data.context, data.reinforcement), base: data.reinforcement ? buildForecastModel(data.dataset, data.context) : undefined });
  } catch (error) {
    workerScope.postMessage({ error: error instanceof Error ? error.message : 'No se pudo calcular la previsión.' });
  }
};
