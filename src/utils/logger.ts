/**
 * Sistema de logging condicional
 * Solo muestra logs en desarrollo, no en producción
 * Esto mejora el rendimiento de la aplicación
 */

const isDev = import.meta.env.DEV;

export const logger = {
  log: (...args: any[]) => isDev && console.log(...args),
  info: (...args: any[]) => isDev && console.info(...args),
  warn: (...args: any[]) => isDev && console.warn(...args),
  debug: (...args: any[]) => isDev && console.debug(...args),
  // Los errores siempre se muestran, incluso en producción
  error: (...args: any[]) => console.error(...args),
};

// Helper para logs con prefijo de componente/módulo
export const createLogger = (module: string) => ({
  log: (...args: any[]) => isDev && console.log(`[${module}]`, ...args),
  info: (...args: any[]) => isDev && console.info(`[${module}]`, ...args),
  warn: (...args: any[]) => isDev && console.warn(`[${module}]`, ...args),
  debug: (...args: any[]) => isDev && console.debug(`[${module}]`, ...args),
  error: (...args: any[]) => console.error(`[${module}]`, ...args),
});

export default logger;
