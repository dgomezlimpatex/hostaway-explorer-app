import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const result=await build({entryPoints:['src/utils/planningDragGeometry.ts'],bundle:true,write:false,format:'cjs',packages:'external'});
const module={exports:{}};
new Function('require','module','exports',result.outputFiles[0].text)(require,module,module.exports);
const {planningPointerCollision}=module.exports;
const rect=(left,top,width,height)=>({left,top,width,height,right:left+width,bottom:top+height});
let scrollX=0, scrollY=0;
const viewport={getBoundingClientRect:()=>rect(100,100,900,300),querySelector:()=>({getBoundingClientRect:()=>rect(100,100,240,300)})};
const zones=[0,1,2,3].map(i=>({id:`worker-${i}`,node:{current:{getBoundingClientRect:()=>rect(340-scrollX,100+i*80-scrollY,1800,80),closest:()=>viewport}}}));
const args={active:{id:'task'},droppableContainers:zones,droppableRects:new Map(zones.map(c=>[c.id,rect(340,100,1800,80)])),collisionRect:rect(350,110,150,68),pointerCoordinates:{x:400,y:185}};
assert.equal(planningPointerCollision(args)[0]?.id,'worker-1','Choose the row under the pointer, not the dragged rectangle');
scrollX=200;scrollY=80;
assert.equal(planningPointerCollision(args)[0]?.id,'worker-2','Re-measure after horizontal/vertical scroll; ignore stale cached rectangles');
for(const point of [{x:300,y:185},{x:1001,y:185},{x:400,y:401},{x:400,y:99}]) {
 assert.equal(planningPointerCollision({...args,pointerCoordinates:point}).length,0,'Names, outside timeline and clipped rows are not targets');
}
assert.equal(planningPointerCollision({...args,pointerCoordinates:null})[0]?.id,'worker-1','Keyboard retains rectangle collision');
console.log('planning-pointer-drag: OK (live geometry, pointer row, scrolling, viewport clipping, keyboard fallback; offline)');
