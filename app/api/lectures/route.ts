import{storage,fail,origin,json,RequestError}from '@/lib/server';
import{isLecture,videoMime,MAX_VIDEO_BYTES,VIDEO_PART_BYTES}from '@/lib/lecture';
export async function POST(request:Request){try{
 origin(request);const x=await json(request);
 if(typeof x?.name!=='string'||!isLecture(x.name)||!Number.isInteger(x.size)||x.size<=0||x.size>MAX_VIDEO_BYTES)throw new RequestError('Choose an MP4, MOV, M4V, or WebM lecture up to 1 GB.');
 const{db,bucket}=storage(),id=crypto.randomUUID(),name=x.name.slice(0,250),kind=x.name.split('.').pop().toLowerCase();
 const upload=await bucket.createMultipartUpload('originals/'+id,{httpMetadata:{contentType:videoMime(kind)}});
 try{await db.prepare('INSERT INTO lecture_uploads (id,name,kind,size,upload_id,created_at) VALUES (?,?,?,?,?,?)').bind(id,name,kind,x.size,upload.uploadId,Date.now()).run();}catch(e){await upload.abort().catch(()=>{});throw e;}
 return Response.json({id,partBytes:VIDEO_PART_BYTES},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return fail(e);}}
