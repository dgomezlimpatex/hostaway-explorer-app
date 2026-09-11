// Local visual fixture. No authentication or production data is used or modified.
import { build } from "esbuild";
import fs from "node:fs";
import path from "node:path";
const dest = path.join(process.env.TEMP || "/tmp", "personnel-preview");
fs.mkdirSync(dest, { recursive: true });
fs.writeFileSync(
  path.join(dest, "index.html"),
  '<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"><body><div id="root"></div><script src="/app.js"></script></body></html>',
);
fs.writeFileSync(
  path.join(dest, "server.cjs"),
  "const http=require('http'),fs=require('fs'),path=require('path');http.createServer((req,res)=>{let f=req.url.split('?')[0];if(!['/app.js','/app.css'].includes(f))f='/index.html';try{res.setHeader('Content-Type',f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(path.join(__dirname,f)));}catch{res.statusCode=404;res.end();}}).listen(8095,'127.0.0.1');",
);
const people = [
  ["mary", "María Ramírez", 20],
  ["helena", "Helena Martín", 20],
  ["bernardo", "Bernardo Rodríguez", 0],
  ["ana", "Ana García", 40],
  ["carlos", "Carlos Venegas", 30],
  ["karina", "Karina Salazar", 20],
  ["az", "Azzeddine Chamssi", 40],
].map(([id, name, h], i) => ({
  id,
  name,
  contractHoursPerWeek: h,
  isActive: true,
  category: "Operario de limpieza",
  externalId: "registro-" + i,
  user_id: i ? "user-" + i : null,
  email: i ? "equipo@example.com" : null,
  telefono: "",
  sortOrder: i,
}));
const fixture = {
  people,
  tasks: [],
  schedules: [],
  contracts: people.map((p, i) => ({
    id: i + 1,
    cleaner_id: p.id,
    hours_per_week: p.contractHoursPerWeek,
    effective_date: "2026-09-11",
    is_baseline: true,
  })),
  adjustments: [],
};
for (const [i, p] of people.entries())
  for (let d = 1; d <= 25; d++)
    fixture.tasks.push({
      id: `${p.id}-${d}`,
      cleaner_id: p.id,
      property:
        d % 3 ? "MD18 · Main Street Deluxe" : "Hotel SC · Servicio diario",
      date: `2026-09-${String(d).padStart(2, "0")}`,
      start_time: "09:30",
      end_time: i % 2 ? "14:00" : "12:00",
      duracion: i % 2 ? 270 : 150,
      status: d < 10 ? "completed" : "pending",
    });
fixture.schedules = people.slice(0, 2).map((p, i) => ({
  id: i + 1,
  cleaner_id: p.id,
  source_type: "maintenance",
  source_id: p.id + "external",
  effective_date: "2026-09-11",
  is_baseline: true,
  payload: {
    id: p.id + "external",
    cleaner_id: p.id,
    is_active: true,
    schedule_type: "unavailability",
    location_name: "Trabajo externo",
    days_of_week: [1, 2, 3, 4, 5],
    start_time: "14:45",
    end_time: "23:00",
  },
}));
const mutation = `const m=()=>({isPending:false,mutate:(_v,o)=>o?.onSuccess?.(),mutateAsync:async v=>v});`;
const result = { data: [], isLoading: false, error: null, refetch: () => {} };
const mocks = {
  "useCleaners.ts": `${mutation} export const useCleaners=()=>({cleaners:${JSON.stringify(people)},isLoading:false});export const useCleaner=()=>({data:${JSON.stringify(people[0])}});export const useUpdateCleaner=m;export const useUpdateCleanersOrder=m;export const useCreateCleaner=m;export const useDeleteCleaner=m;`,
  "useAuth.ts": `export const useAuth=()=>({userRole:'admin',user:{id:'admin'},isLoading:false});`,
  "SedeContext.tsx": `export const useSede=()=>({activeSede:{id:'sede',name:'A Coruña'},sedes:[{id:'sede',name:'A Coruña'}],availableSedes:[{id:'sede',name:'A Coruña'}],isInitialized:true,loading:false});`,
  "usePersonnelHours.ts": `const fixture=${JSON.stringify(fixture)};export const usePersonnelData=(_p,id)=>({data:{...fixture,executions:new Set()},people:id?fixture.people.filter(p=>p.id===id):fixture.people,canManage:true,isLoading:false,error:null,refetch:()=>{}});export const useAdjustmentAudit=()=>(${JSON.stringify(result)});`,
  "useWorkerHourAdjustments.ts": `${mutation}export const useCreateWorkerHourAdjustment=m;export const useUpdateWorkerHourAdjustment=m;export const useDeleteWorkerHourAdjustment=m;`,
  "useWorkerMaintenanceCleanings.ts": `${mutation}const schedules=${JSON.stringify(fixture.schedules.map((v) => ({ id: v.source_id, cleanerId: v.cleaner_id, scheduleType: "unavailability", locationName: "Trabajo externo", daysOfWeek: [1, 2, 3, 4, 5], startTime: "14:45", endTime: "23:00", isActive: true })))};export const useAllWorkerMaintenanceCleanings=()=>({data:schedules});export const useWorkerMaintenanceCleanings=id=>({data:schedules.filter(s=>s.cleanerId===id)});export const useCreateWorkerMaintenanceCleaning=m;export const useUpdateWorkerMaintenanceCleaning=m;export const useDeleteWorkerMaintenanceCleaning=m;export const useSaveIndividualAvailability=m;`,
  "useWorkerAbsences.ts": `${mutation}export const useWorkerAbsences=()=>(${JSON.stringify(result)});export const useAllWorkerAbsences=()=>(${JSON.stringify(result)});export const useCreateWorkerAbsence=m;export const useUpdateWorkerAbsence=m;export const useDeleteWorkerAbsence=m;`,
};
await build({
  stdin: {
    contents: `import React from 'react';import {createRoot} from 'react-dom/client';import{BrowserRouter,Routes,Route}from'react-router-dom';import{QueryClientProvider,QueryClient}from'@tanstack/react-query';import Directory from './src/features/personnel/PersonnelDirectory';import Hours from './src/features/personnel/HoursControl';import Profile from './src/features/personnel/PersonnelProfile';import './src/index.css';createRoot(document.getElementById('root')).render(<QueryClientProvider client={new QueryClient()}><BrowserRouter><Routes><Route path="/workers" element={<Directory/>}/><Route path="/workers/hours" element={<Hours/>}/><Route path="/workers/:workerId/hours" element={<Hours/>}/><Route path="/workers/:workerId" element={<Profile/>}/></Routes></BrowserRouter></QueryClientProvider>);`,
    resolveDir: process.cwd(),
    loader: "tsx",
  },
  outfile: path.join(dest, "app.js"),
  bundle: true,
  platform: "browser",
  format: "iife",
  jsx: "automatic",
  define: { "process.env.NODE_ENV": '"development"', "import.meta.env": "{}" },
  loader: { ".woff2": "dataurl", ".woff": "dataurl" },
  plugins: [
    {
      name: "fixture",
      setup(b) {
        b.onLoad({ filter: /\.(tsx?|jsx?)$/ }, (args) => {
          const name = path.basename(args.path);
          if (mocks[name]) return { contents: mocks[name], loader: "tsx" };
          if (
            args.path
              .replaceAll("\\", "/")
              .endsWith("integrations/supabase/client.ts")
          )
            return {
              contents: `const chain=new Proxy(()=>chain,{get:(_t,p)=>p==='then'?((resolve)=>resolve({data:[],error:null})):()=>chain,apply:()=>chain});export const supabase={from:()=>chain,rpc:()=>chain,functions:{invoke:async()=>({data:null,error:null})},auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})}};`,
              loader: "ts",
            };
        });
      },
    },
  ],
});
// Use Vite/Tailwind's generated styles, then append the local font URLs embedded by esbuild.
const cssFiles = fs
  .readdirSync("dist/assets")
  .filter((n) => n.endsWith(".css"));
const generated = fs.readFileSync(path.join(dest, "app.css"), "utf8");
fs.writeFileSync(
  path.join(dest, "app.css"),
  cssFiles.map((n) => fs.readFileSync("dist/assets/" + n, "utf8")).join("\n") +
    "\n" +
    generated,
);
console.log("Visual fixture built in " + dest);
