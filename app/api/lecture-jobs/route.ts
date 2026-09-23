import{storage,origin,fail,RequestError}from'@/lib/server';
import{isLecture,MAX_VIDEO_BYTES}from'@/lib/lecture';
export async function POST(request:Request){try{
 origin(request);if(Number(request.headers.get('content-length')||0)>2300000)throw new RequestError('The video fingerprint is too large.',413);
 const form=await request.formData(),name=form.get('name'),size=Number(form.get('size')),modified=Number(form.get('modified')),head=form.get('head'),tail=form.get('tail'),captions=form.get('captions'),screen=form.get('screen')==='true';
 if(typeof name!=='string'||name.length>255||!isLecture(name)||!Number.isSafeInteger(size)||size<=0||size>MAX_VIDEO_BYTES||!Number.isSafeInteger(modified)||!(head instanceof File)||!(tail instanceof File)||head.size>65536||tail.size>65536||(captions!==null&&(!(captions instanceof File)||captions.size>2000000)))throw new RequestError('Choose a valid lecture video and captions.');
 const bytes=await new Blob([name+'\n'+size+'\n'+modified+'\n'+screen+'\nv1\n',head,tail,captions||'auto']).arrayBuffer();
 const id=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join(''),object=await storage().bucket.get('lecture-jobs/'+id);
 return Response.json({id,...(object?{data:await object.json(),revision:object.etag}:{})},{headers:{'Cache-Control':'no-store'}});
}catch(e){return fail(e);}}
