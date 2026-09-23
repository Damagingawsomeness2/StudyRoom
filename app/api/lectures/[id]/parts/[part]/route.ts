import{fail,origin,validId,RequestError}from '@/lib/server';
import{lectureUpload}from '@/lib/lecture-server';
import{VIDEO_PART_BYTES}from '@/lib/lecture';
export async function PUT(request:Request,{params}:{params:Promise<{id:string;part:string}>}){try{
 origin(request);const p=await params,{row,upload}=await lectureUpload(validId(p.id)),part=Number(p.part),count=Math.ceil(row.size/VIDEO_PART_BYTES);
 if(!Number.isInteger(part)||part<1||part>count)throw new RequestError('Invalid video upload part.');
 const expected=Math.min(VIDEO_PART_BYTES,row.size-(part-1)*VIDEO_PART_BYTES),declared=Number(request.headers.get('content-length'));
 if(!request.body||declared!==expected)throw new RequestError('The video upload part is incomplete. Please retry.');
 const bytes=await request.arrayBuffer();if(bytes.byteLength!==expected)throw new RequestError('The video upload part is incomplete.');
 return Response.json(await upload.uploadPart(part,bytes),{headers:{'Cache-Control':'no-store'}});
 }catch(e){return fail(e);}}
