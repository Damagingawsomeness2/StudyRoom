import{storage,origin,json,fail,RequestError}from'@/lib/server';
import{MAX_LECTURE_SECONDS,validatedTranscript,validatedLecture}from'@/lib/lecture';
import type{LectureCheckpoint}from'@/lib/lecture-checkpoint';
const key=(id:string)=>{if(!/^[a-f0-9]{64}$/.test(id))throw new RequestError('Invalid lecture checkpoint.');return'lecture-jobs/'+id;};
const headers={'Cache-Control':'no-store'};
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){try{const object=await storage().bucket.get(key((await params).id));return Response.json(object?{data:await object.json(),revision:object.etag}:{},{headers});}catch(e){return fail(e);}}
export async function PUT(request:Request,{params}:{params:Promise<{id:string}>}){try{
 origin(request);const path=key((await params).id),x=await json(request),d=x?.data as LectureCheckpoint;
 const number=(v:unknown,max:number)=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=max;
 if(!d||d.version!==1||!number(d.duration,MAX_LECTURE_SECONDS)||!number(d.nextSecond,MAX_LECTURE_SECONDS+60)||!number(d.screenNext,MAX_LECTURE_SECONDS+30)||!number(d.screenAttempts,480)||typeof d.screen!=='boolean'||typeof d.speechDone!=='boolean'||typeof d.screenDone!=='boolean')throw new RequestError('This video checkpoint could not be saved.');
 if(!Array.isArray(d.segments)||d.segments.length>15000||d.segments.some(s=>!validatedTranscript(s,d.duration)||typeof s.text!=='string'||s.text.length>10000)||!Array.isArray(d.unreadable)||d.unreadable.length>1000||d.unreadable.some(s=>typeof s.label!=='string'||s.label.length>200||typeof s.reason!=='string'||s.reason.length>500))throw new RequestError('This video checkpoint is too large or invalid.');
 if(!Array.isArray(d.screenUnits)||d.screenUnits.length>480||d.screenUnits.some(u=>!validatedTranscript(u.transcript,d.duration)||typeof u.text!=='string'||u.text.length>20000||typeof u.label!=='string'||u.label.length>200))throw new RequestError('The saved on-screen text could not be read.');
 if(d.parsed)try{d.parsed=validatedLecture(d.parsed,d.duration);}catch{throw new RequestError('The saved lecture text is invalid.');}
 if(d.upload&&(!/^[a-zA-Z0-9-]{1,80}$/.test(d.upload.id)||!Array.isArray(d.upload.parts)||d.upload.parts.length>128||d.upload.parts.some((p,i)=>p.partNumber!==i+1||typeof p.etag!=='string'||p.etag.length>200)))throw new RequestError('The upload checkpoint is invalid.');
 if(x.revision!==null&&(typeof x.revision!=='string'||x.revision.length>200))throw new RequestError('Invalid checkpoint revision.');
 const object=await storage().bucket.put(path,JSON.stringify(d),{onlyIf:x.revision?{etagMatches:x.revision}:{etagDoesNotMatch:'*'},httpMetadata:{contentType:'application/json'}});
 if(!object)throw new RequestError('This lecture is being processed in another tab. Close the other tab, then retry here to load its saved progress.',409);
 return Response.json({revision:object.etag},{headers});
}catch(e){return fail(e);}}
