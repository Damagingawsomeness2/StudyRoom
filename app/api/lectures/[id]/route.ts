import{storage,fail,origin,json,validId,RequestError}from '@/lib/server';
import type{Material}from '@/lib/study-types';
import{lectureUpload}from '@/lib/lecture-server';
import{lectureSummary,validatedLecture,VIDEO_PART_BYTES}from '@/lib/lecture';
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){try{
 const id=validId((await params).id),existing=await storage().db.prepare('SELECT id,name,kind,size,units,warnings,ocr,lecture FROM materials WHERE id = ?').bind(id).first<Material&{warnings:string;ocr:string;lecture:string}>();
 if(existing)return Response.json({material:{...existing,warnings:JSON.parse(existing.warnings),ocr:JSON.parse(existing.ocr),lecture:JSON.parse(existing.lecture)}},{headers:{'Cache-Control':'no-store'}});
 await lectureUpload(id);return Response.json({id,partBytes:VIDEO_PART_BYTES},{headers:{'Cache-Control':'no-store'}});
}catch(e){return fail(e);}}
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){try{
 origin(request);const id=validId((await params).id),x=await json(request);
 const existing=await storage().db.prepare('SELECT id,name,kind,size,units,warnings,ocr,lecture FROM materials WHERE id = ?').bind(id).first<Material&{warnings:string;ocr:string;lecture:string}>();
 if(existing)return Response.json({...existing,warnings:JSON.parse(existing.warnings),ocr:JSON.parse(existing.ocr),lecture:JSON.parse(existing.lecture)},{headers:{'Cache-Control':'no-store'}});
 const{db,bucket,row,upload}=await lectureUpload(id);
 let parsed;try{parsed=validatedLecture(x?.parsed,x?.duration);}catch(e){throw new RequestError(e instanceof Error?e.message:'The transcript could not be saved.');}
 const count=Math.ceil(row.size/VIDEO_PART_BYTES);
 if(!Array.isArray(x.parts)||x.parts.length!==count||x.parts.some((p:unknown,i:number)=>{const part=p as R2UploadedPart;return !part||part.partNumber!==i+1||typeof part.etag!=='string'||part.etag.length>200;}))throw new RequestError('The video upload is incomplete. Please retry.');
 // A retried final request may find that R2 has already completed the upload.
 let object=await bucket.head('originals/'+id);if(!object)object=await upload.complete(x.parts);
 if(object.size!==row.size)throw new RequestError('The video upload is incomplete. Please retry.');
 const lecture=lectureSummary(parsed.units,x.duration),material={id,name:row.name,kind:row.kind,size:row.size,units:parsed.units.length,warnings:parsed.warnings,lecture};
 await bucket.put('parsed/'+id,JSON.stringify(parsed));
 await db.batch([db.prepare('INSERT INTO materials (id,name,kind,size,units,warnings,ocr,lecture,created_at) VALUES (?,?,?,?,?,?,?,?,?)').bind(id,row.name,row.kind,row.size,parsed.units.length,JSON.stringify(parsed.warnings),'{}',JSON.stringify(lecture),Date.now()),db.prepare('DELETE FROM lecture_uploads WHERE id = ?').bind(id)]);
 return Response.json(material,{headers:{'Cache-Control':'no-store'}});
 }catch(e){return fail(e);}}
export async function DELETE(request:Request,{params}:{params:Promise<{id:string}>}){try{
 origin(request);const id=validId((await params).id),{db,bucket}=storage();
 // Never remove a video once it is a saved material, even if a response was lost.
 if(await db.prepare('SELECT id FROM materials WHERE id = ?').bind(id).first())return new Response(null,{status:204});
 const row=await db.prepare('SELECT upload_id FROM lecture_uploads WHERE id = ?').bind(id).first<{upload_id:string}>();
 if(row){await bucket.resumeMultipartUpload('originals/'+id,row.upload_id).abort().catch(()=>{});await bucket.delete(['originals/'+id,'parsed/'+id]);await db.prepare('DELETE FROM lecture_uploads WHERE id = ?').bind(id).run();}
 return new Response(null,{status:204});
 }catch(e){return fail(e);}}
