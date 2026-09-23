import type{Parsed,Unit,ReadingIssue}from'./study-types';
import type{SpeechSegment}from'./transcript';
export type LectureCheckpoint={version:1;duration:number;nextSecond:number;segments:SpeechSegment[];unreadable:ReadingIssue[];screen:boolean;screenNext:number;screenUnits:Unit[];screenAttempts:number;speechDone:boolean;screenDone:boolean;parsed?:Parsed;upload?:{id:string;parts:{partNumber:number;etag:string}[]}};
export type LectureJob={data:LectureCheckpoint;save:(patch:Partial<LectureCheckpoint>)=>Promise<void>};
export async function openLectureJob(file:File,screen:boolean,captions:File|undefined,signal:AbortSignal):Promise<LectureJob>{
 // Hash bounded file samples on the server, including caption content and options.
 const form=new FormData();form.set('name',file.name);form.set('size',String(file.size));form.set('modified',String(file.lastModified));form.set('screen',String(screen));form.set('head',file.slice(0,65536));form.set('tail',file.slice(Math.max(0,file.size-65536)));if(captions)form.set('captions',captions);
 const response=await fetch('/api/lecture-jobs',{method:'POST',body:form,signal}),loaded=await response.json()as{id:string;data?:LectureCheckpoint;revision?:string;error?:string};
 if(!response.ok)throw new Error(loaded.error||'Your saved video progress could not be opened. Try again.');
 const url='/api/lecture-jobs/'+loaded.id;
 let revision=loaded.revision||null;
 const job:LectureJob={data:loaded.data||{version:1,duration:0,nextSecond:0,segments:[],unreadable:[],screen,screenNext:0,screenUnits:[],screenAttempts:0,speechDone:false,screenDone:!screen},async save(patch){
  const data={...job.data,...patch};
  const saved=await fetch(url,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({data,revision}),signal}),value=await saved.json()as{revision:string;error?:string};
  if(!saved.ok)throw new Error(value.error||'Your latest video progress could not be saved. Retry to resume from the last checkpoint.');
  revision=value.revision;job.data=data;
 }};
 if(!loaded.data)await job.save({});return job;
}
