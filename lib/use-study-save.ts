'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
type Entry={body:string;saved?:string;timer?:ReturnType<typeof setTimeout>;running?:Promise<void>};
export function useStudySave(){
 const entries=useRef(new Map<string,Entry>());
 const [states,setStates]=useState<Record<string,'saving'|'saved'|'error'>>({});
 const run=useCallback((url:string):Promise<void>=>{
  const e=entries.current.get(url);if(!e)return Promise.resolve();if(e.timer){clearTimeout(e.timer);e.timer=undefined;}if(e.running)return e.running;
  e.running=(async()=>{
   while(e.saved!==e.body){const snapshot=e.body;try{const res=await fetch(url,{method:'PUT',headers:{'Content-Type':'application/json'},body:snapshot});if(!res.ok)throw new Error('Save failed');e.saved=snapshot;}catch{setStates(s=>({...s,[url]:'error'}));return;}}
   setStates(s=>({...s,[url]:'saved'}));
  })().finally(()=>{e.running=undefined;});return e.running;
 },[]);
 const enqueue=useCallback((url:string,value:unknown)=>{
  const snapshot=JSON.stringify(value),e=entries.current.get(url)||{body:snapshot};e.body=snapshot;entries.current.set(url,e);
  if(e.saved===snapshot&&!e.running){setStates(s=>s[url]==='saved'?s:{...s,[url]:'saved'});return;}
  setStates(s=>s[url]==='saving'?s:{...s,[url]:'saving'});if(e.timer)clearTimeout(e.timer);e.timer=setTimeout(()=>void run(url),400);
 },[run]);
 const flush=useCallback(async()=>{await Promise.all([...entries.current.keys()].map(run));return [...entries.current.values()].every(e=>e.saved===e.body);},[run]);
 const retry=useCallback((url:string)=>{setStates(s=>({...s,[url]:'saving'}));void run(url);},[run]);
 useEffect(()=>{const unload=(event:BeforeUnloadEvent)=>{if([...entries.current.values()].some(e=>e.body!==e.saved)){void flush();event.preventDefault();event.returnValue='';}};const hidden=()=>{if(document.visibilityState==='hidden')void flush();};window.addEventListener('beforeunload',unload);document.addEventListener('visibilitychange',hidden);return()=>{window.removeEventListener('beforeunload',unload);document.removeEventListener('visibilitychange',hidden);void flush();};},[flush]);
 return {enqueue,flush,retry,states};
}
