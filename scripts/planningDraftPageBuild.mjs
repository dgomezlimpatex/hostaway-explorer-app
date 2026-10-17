import { build } from 'esbuild';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Compila la página REAL del planificador con el backend sustituido por `planningDraftPageMocks.mjs`.
 * El resultado no contiene el cliente de producción y no hace ninguna petición de red.
 */
export async function buildDraftPageFixture({ scenario = 'normal' } = {}) {
  const mocks = resolve('scripts/planningDraftPageMocks.mjs');
  const aliased = [
    /^@\/hooks\/useCleaningPlanning$/, /^@\/hooks\/useCleaningPlanningActions$/, /^@\/hooks\/useCleaningPlanningBuildingData$/,
    /^@\/hooks\/useCleaners$/, /^@\/hooks\/useAuth$/, /^@\/contexts\/SedeContext$/, /^@\/services\/laundryScheduleService$/,
    /^@\/hooks\/usePlanningCalendarWeek$/, /^@\/components\/ui\/sidebar$/,
  ];
  const plugin = {
    name: 'planning-draft-page-mocks',
    setup(pluginBuild) {
      aliased.forEach((filter) => pluginBuild.onResolve({ filter }, () => ({ path: mocks })));
    },
  };
  const built = await build({
    entryPoints: ['scripts/planningDraftPage.entry.mjs'], bundle: true, write: false, platform: 'browser',
    format: 'iife', jsx: 'automatic', minify: true, metafile: true, logLevel: 'error',
    define: { 'process.env.NODE_ENV': '"production"' }, plugins: [plugin],
  });
  const inputs = Object.keys(built.metafile.inputs);
  if (inputs.some((path) => /integrations[\\/]supabase|services[\\/]taskStorage|multipleTaskAssignment/.test(path))) {
    throw new Error('La prueba aislada no debe contener el backend de producción.');
  }
  const cssSource = readFileSync('src/index.css', 'utf8').replace(/^@import .*$/gm, '');
  const css = await postcss([tailwindcss({ config: resolve('tailwind.config.ts'), content: [
    'src/components/cleaning-planning/**/*.{tsx,ts}', 'src/components/ui/{button,accordion,dropdown-menu,dialog,badge,select}.tsx',
  ] })]).process(cssSource, { from: resolve('src/index.css') });
  const settings = `window.planningScenario=${JSON.stringify(scenario)};`;
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Planificador · Recuperación de borradores</title><style>${css.css}</style></head><body><div id="root"></div><script>${settings}${built.outputFiles[0].text.replaceAll('</script', '<\\/script')}</script></body></html>`;
}
