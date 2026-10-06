import { build } from 'esbuild';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export async function buildOfflinePlanningFixture({ scenario = 'normal', controls = false, shortTasks = false, delayedQuickRefresh = false } = {}) {
  const fixturePlugin = {
    name: 'planning-offline-fixture',
    setup(plugin) {
      // Exercise the real production acknowledgement hook without changing the TSX demo entry.
      plugin.onLoad({filter:/cleaningPlanningBrowser\.entry\.tsx$/}, ({path}) => {
        let contents = readFileSync(path, 'utf8');
        contents = "import {usePlanningSavedTaskContext} from '../src/hooks/usePlanningSavedTaskContext';\n" + contents;
        const start = contents.indexOf('  const [savedQuickTaskId');
        const end = contents.indexOf('  const showProposal', start);
        if (start < 0 || end < 0) throw new Error('Planning fixture context setup changed; update the offline adapter');
        contents = contents.slice(0, start) + '  const recordSavedTask = usePlanningSavedTaskContext(sourceContext, context, setSourceContext);\n' + contents.slice(end);
        contents = contents.replace('onTaskSaved={setSavedQuickTaskId}', 'onTaskSaved={recordSavedTask}');
        contents = contents.replace('    window.planningExampleSaved =', "    if (window.planningFailNextSave) { window.planningFailNextSave=false; throw new Error('Fallo local simulado'); }\n    window.planningExampleSaved =");
        return {loader:'tsx', contents};
      });
      if (shortTasks) plugin.onLoad({filter:/cleaningPlanningExampleData\.ts$/}, ({path})=>({loader:'ts',contents:readFileSync(path,'utf8')
        .replace("makeTask('existing-1', 'Apartamento Luna', '09:00', scenario === 'shared' ? 120 : 60,", "makeTask('existing-1', 'ADP18.4A', '09:00', 33,")
        .replace("makeTask('proposed-1', 'Apartamento Jardín', '11:00')", "makeTask('proposed-1', 'ADP18.3B', '11:00', 33)")}));
      plugin.onResolve({ filter: /^@\/hooks\/usePlanningCalendarWeek$/ }, () => ({ path: 'week', namespace: 'offline' }));
      plugin.onResolve({ filter: /^@\/components\/ui\/sidebar$/ }, () => ({ path: 'sidebar', namespace: 'offline' }));
      plugin.onResolve({ filter: /^@\/hooks\/useCleaningPlanningActions$/ }, () => ({ path: 'actions', namespace: 'offline' }));
      plugin.onLoad({ filter: /.*/, namespace: 'offline' }, ({ path }) => ({ loader: 'js', contents: {
        week: "export const usePlanningCalendarWeek=()=>({ data:[],startDate:'2026-09-21',endDate:'2026-09-27',isPending:false,isError:false });",
        sidebar: "export const useSidebar=()=>({state:'expanded',isMobile:window.matchMedia('(max-width: 767px)').matches});",
        actions: `const pending=[];
          window.planningExampleRefresh=()=>{for(const detail of pending.splice(0)) window.dispatchEvent(new CustomEvent('planning-example-task-saved',{detail}));};
          const save = async (detail) => {window.planningQuickWrites=(window.planningQuickWrites || 0)+1;if(window.planningExampleDelayedRefresh) pending.push(detail); else window.dispatchEvent(new CustomEvent('planning-example-task-saved', {detail}));};
          export const useCleaningPlanningActions=()=>({isSavingQuickAction:false,
            unassignTaskAsync: task => save({taskId:task.id,unassign:true}),
            updateTaskSchedule: ({task,startTime,endTime}) => save({taskId:task.id,startTime,endTime}),
            reassignTask: ({task,cleaner,startTime,endTime}) => save({taskId:task.id,cleaner,startTime,endTime}),
          });`,
      }[path] }));
    },
  };
  const built = await build({
    entryPoints: ['scripts/cleaningPlanningBrowser.entry.tsx'], bundle: true, write: false, platform: 'browser',
    format: 'iife', jsx: 'automatic', minify: true, metafile: true,
    define: { 'process.env.NODE_ENV': '"production"' }, plugins: [fixturePlugin],
  });
  if (Object.keys(built.metafile.inputs).some(path => path.includes('integrations/supabase'))) {
    throw new Error('The isolated example must not contain the production backend client.');
  }
  const cssSource = readFileSync('src/index.css', 'utf8').replace(/^@import .*$/gm, '');
  const css = await postcss([tailwindcss({ config: resolve('tailwind.config.ts'), content: [
    'src/components/cleaning-planning/**/*.{tsx,ts}', 'src/components/ui/{button,accordion,dropdown-menu,dialog,badge,select}.tsx',
    'scripts/cleaningPlanningBrowser.entry.tsx',
  ] })]).process(cssSource, { from: resolve('src/index.css') });
  const settings = `window.planningExampleDelayedRefresh=${Boolean(delayedQuickRefresh)};window.planningExampleScenario=${JSON.stringify(scenario)};window.planningExampleControls=${Boolean(controls)};`;
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Planificador · Ejemplo local</title><style>${css.css}</style></head><body><div id="root"></div><script>${settings}${built.outputFiles[0].text.replaceAll('</script', '<\\/script')}</script></body></html>`;
}
