import assert from 'node:assert/strict';
import vm from 'node:vm';
import {build} from 'esbuild';

// Run the actual hook with a minimal React lifecycle and local browser events.
const result = await build({entryPoints:['src/hooks/usePlanningScrollChrome.ts'],bundle:true,write:false,format:'cjs',plugins:[{
  name:'local-react-hooks', setup(plugin) {
    plugin.onResolve({filter:/^react$/},()=>({path:'react',namespace:'fixture'}));
    plugin.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:`
      export const useCallback = fn => fn;
      export const useRef = value => ({current:value});
      export const useState = value => [value, next => globalThis.fixture.states.push(next)];
      export const useEffect = fn => globalThis.fixture.effects.push(fn);
    `}));
  }
}]});
let now = 0, desktop = true;
const states = [], effects = [], listeners = {};
const context = vm.createContext({module:{exports:{}},fixture:{states,effects},performance:{now:()=>now},window:{
  scrollY:0,matchMedia:()=>({get matches(){return desktop;},addEventListener:(name,fn)=>listeners[name]=fn,removeEventListener:()=>{}}),
  addEventListener:(name,fn)=>listeners[name]=fn,removeEventListener:()=>{},
}});
vm.runInContext(result.outputFiles[0].text,context);
const {onScroll} = context.module.exports.usePlanningScrollChrome('2026-10-11');
effects.forEach(fn=>fn());
assert.equal(states.at(-1),false);
onScroll(12,'timeline'); assert.equal(states.at(-1),false);
onScroll(180,'timeline'); assert.equal(states.at(-1),true);
now=100; onScroll(90,'timeline'); assert.equal(states.at(-1),true,'Layout adjustment during the animation must not flash the header');
now=500; onScroll(120,'timeline'); onScroll(70,'timeline'); assert.equal(states.at(-1),false,'Reverse vertical scrolling restores it before reaching the top');
now=1000; onScroll(300,'timeline'); assert.equal(states.at(-1),true);
now=1500; onScroll(0,'timeline'); assert.equal(states.at(-1),false);
now=2000; onScroll(300,'timeline'); desktop=false; listeners.change(); assert.equal(states.at(-1),false,'Mobile always shows the header');
onScroll(500,'timeline'); assert.equal(states.at(-1),false);
desktop=true; effects[0](); assert.equal(states.at(-1),false,'A new day restores the header');
console.log('planning-scroll-chrome-hook: OK (thresholds, direction, animation guard, top, mobile, day reset; no network)');
