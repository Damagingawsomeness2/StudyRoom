import type{Material,Parsed}from'./study-types';
import type{LectureJob}from'./lecture-checkpoint';
export async function uploadLecture(file:File,data:{parsed:Parsed;duration:number},progress:(text:string)=>void,signal:AbortSignal,job:LectureJob):Promise<Material>{
 const request=async<T>(url:string,options?:RequestInit):Promise<T>=>{const response=await fetch(url,{...options,signal}),value=await response.json()as T&{error?:string};if(!response.ok)throw new Error(value.error||'Your video could not be saved. Retry to resume.');return value;};
 const json=(value:unknown)=>({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(value)});
 progress('Opening your saved upload progress…');
 let state:{id:string;partBytes:number}|undefined,parts=job.data.upload?.parts||[];
 if(job.data.upload){
  const response=await fetch('/api/lectures/'+job.data.upload.id,{signal});
  if(response.status===404||response.status===410){await fetch('/api/lectures/'+job.data.upload.id,{method:'DELETE',signal});parts=[];}
  else{const found=await response.json()as{material?:Material;id:string;partBytes:number;error?:string};if(!response.ok)throw new Error(found.error||'Your upload progress could not be opened. Retry.');if(found.material)return found.material;state=found;}
 }
 if(!state){state=await request('/api/lectures',json({name:file.name,size:file.size}));await job.save({upload:{id:state!.id,parts:[]}});}
 const{id,partBytes}=state!;
 for(let offset=parts.length*partBytes;offset<file.size;offset+=partBytes){
  const partNumber=parts.length+1,blob=file.slice(offset,offset+partBytes);progress(`Uploading lecture… ${Math.round(100*offset/file.size)}% · completed parts saved`);
  let saved:typeof parts[number]|undefined;
  for(let attempt=0;attempt<3;attempt++){try{saved=await request('/api/lectures/'+id+'/parts/'+partNumber,{method:'PUT',body:blob});break;}catch(e){if(signal.aborted||attempt===2)throw e;}}
  parts=[...parts,saved!];await job.save({upload:{id,parts}});
 }
 progress('Saving your lecture and timestamps…');
 for(let attempt=0;attempt<3;attempt++){try{return await request<Material>('/api/lectures/'+id,json({...data,parts}));}catch(e){if(signal.aborted||attempt===2)throw e;}}
 throw new Error('Your lecture could not be saved. Retry to resume.');
}
