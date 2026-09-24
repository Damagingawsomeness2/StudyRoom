import type{Material,Parsed}from'./study-types';
import type{LectureJob}from'./lecture-checkpoint';
import type{LectureReporter}from'./lecture-progress';
export async function uploadLecture(file:File,data:{parsed:Parsed;duration:number},progress:(text:string)=>void,signal:AbortSignal,job:LectureJob,report?:LectureReporter):Promise<Material>{
 const request=async<T>(url:string,options?:RequestInit):Promise<T>=>{const response=await fetch(url,{...options,signal}),value=await response.json()as T&{error?:string};if(!response.ok)throw new Error(value.error||'Your video could not be saved. Retry to resume.');return value;};
 const json=(value:unknown)=>({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(value)});
 progress('Opening your saved upload progress…');
 let state:{id:string;partBytes:number}|undefined,parts=job.data.upload?.parts||[];
 if(job.data.upload){
  const response=await fetch('/api/lectures/'+job.data.upload.id,{signal});
  if(response.status===404||response.status===410){await fetch('/api/lectures/'+job.data.upload.id,{method:'DELETE',signal});parts=[];}
  else{const found=await response.json()as{material?:Material;id:string;partBytes:number;error?:string};if(!response.ok)throw new Error(found.error||'Your upload progress could not be opened. Retry.');if(found.material){report?.({stage:'upload',status:'done'});report?.({stage:'save',status:'done'});return found.material;}state=found;}
 }
 if(!state){state=await request('/api/lectures',json({name:file.name,size:file.size}));await job.save({upload:{id:state!.id,parts:[]}});}
 const{id,partBytes}=state!;report?.({stage:'upload',completed:Math.min(parts.length*partBytes,file.size),total:file.size});
 for(let offset=parts.length*partBytes;offset<file.size;offset+=partBytes){
  const partNumber=parts.length+1,blob=file.slice(offset,offset+partBytes);progress(`Uploading lecture… ${Math.round(100*offset/file.size)}% · completed parts saved`);
  let saved:typeof parts[number]|undefined;
  for(let attempt=0;attempt<3;attempt++){try{saved=await request('/api/lectures/'+id+'/parts/'+partNumber,{method:'PUT',body:blob});break;}catch(e){if(signal.aborted||attempt===2)throw e;}}
  parts=[...parts,saved!];await job.save({upload:{id,parts}});report?.({stage:'upload',completed:Math.min(offset+partBytes,file.size),total:file.size});
 }
 progress('Saving your lecture and timestamps…');report?.({stage:'upload',status:'done'});report?.({stage:'save'});
 for(let attempt=0;attempt<3;attempt++){try{const material=await request<Material>('/api/lectures/'+id,json({...data,parts}));report?.({stage:'save',status:'done'});return material;}catch(e){if(signal.aborted||attempt===2)throw e;}}
 throw new Error('Your lecture could not be saved. Retry to resume.');
}
