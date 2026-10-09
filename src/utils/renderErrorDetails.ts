/** Local diagnostic only: retain asset positions and component names, never URLs or props. */
export function renderErrorDetails(error: Error, componentStack = ''): string {
  const positions = [...(error.stack || '').matchAll(/\/assets\/([\w.-]+\.js:\d+:\d+)/g)]
    .slice(0, 12).map(match => match[1]);
  const components = componentStack.split('\n').map(line =>
    line.trim().match(/^at ([\w.$-]+)/)?.[1],
  ).filter(Boolean).slice(0, 16);
  return [error.message,
    positions.length ? `Código: ${[...new Set(positions)].join('\n')}` : '',
    components.length ? `Componentes: ${components.join(' > ')}` : '',
  ].filter(Boolean).join('\n\n');
}
