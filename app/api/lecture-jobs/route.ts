import{storage,origin,fail,RequestError}from'@/lib/server';
import{isLecture,MAX_VIDEO_BYTES}from'@/lib/lecture';
export async function POST(request:Request){try{
 origin(request);if(Number(request.headers.get('content-length')||0)>2300000)throw new RequestError('The video fingerprint is too large.',413);
 const form=await request.formData(),name=form.get('name'),size=Number(form.get('size')),modified=Number(form.get('modified')),head=form.get('head'),tail=form.get('tail'),captions=form.get('captions'),screen=form.get('screen')==='true';
 if(typeof name!=='string'||name.length>255||!isLecture(name)||!Number.isSafeInteger(size)||size<=0||size>MAX_VIDEO_BYTES||!Number.isSafeInteger(modified)||!(head instanceof File)||!(tail instanceof File)||head.size>65536||tail.size>65536||(captions!==null&&(!(captions instanceof File)||captions.size>2000000)))throw new RequestError('Choose a valid lecture video and captions.');
 const quality=form.get('quality'),region=form.get('region');
 if(quality!==null&&!['balanced','accurate'].includes(String(quality))||region!==null&&!['full','left','right','center'].includes(String(region)))throw new RequestError('Choose valid lecture processing options.');
 const variant=quality===null?'v1':'v2\n'+quality+'\n'+(screen?region||'full':'full');
 const fingerprint=async(version:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await new Blob([name+'\n'+size+'\n'+modified+'\n'+screen+'\n'+version+'\n',head,tail,captions||'auto']).arrayBuffer())),b=>b.toString(16).padStart(2,'0')).join('');
 let id=await fingerprint(variant),object=await storage().bucket.get('lecture-jobs/'+id);
 // Preserve unfinished jobs made before processing options were introduced.
 if(!object&&quality==='balanced'&&(!region||region==='full')){
  const legacyId=await fingerprint('v1'),legacy=await storage().bucket.get('lecture-jobs/'+legacyId);
  if(legacy){const data=await legacy.json()as{parsed?:unknown};if(!data.parsed)return Response.json({id:legacyId,data,revision:legacy.etag},{headers:{'Cache-Control':'no-store'}});}
 }
 return Response.json({id,...(object?{data:await object.json(),revision:object.etag}:{})},{headers:{'Cache-Control':'no-store'}});
}catch(e){return fail(e);}}
