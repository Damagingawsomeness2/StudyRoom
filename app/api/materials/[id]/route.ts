import{storage,fail,validId,RequestError}from '@/lib/server';
import{VIDEO_EXTENSIONS,videoMime}from '@/lib/lecture';
import{byteRange}from '@/lib/video-range';
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){try{
 const{db,bucket}=storage(),id=validId((await params).id),row=await db.prepare('SELECT name,kind,size FROM materials WHERE id = ?').bind(id).first<{name:string;kind:string;size:number}>();if(!row)throw new RequestError('This source was not found.',404);
 const range=byteRange(request.headers.get('Range'),row.size);if(range===false)return new Response(null,{status:416,headers:{'Content-Range':'bytes */'+row.size}});
 const object=await bucket.get('originals/'+id,range?{range}:undefined);if(!object)throw new RequestError('The original file is unavailable.',404);
 const play=VIDEO_EXTENSIONS.includes(row.kind)&&new URL(request.url).searchParams.get('play')==='1';
 return new Response(object.body,{status:range?206:200,headers:{'Content-Type':play?videoMime(row.kind):'application/octet-stream','Content-Disposition':`${play?'inline':'attachment'}; filename*=UTF-8''${encodeURIComponent(row.name).replace(/'/g,'%27')}`,'Content-Length':String(range?.length??row.size),'Accept-Ranges':'bytes',...(range?{'Content-Range':`bytes ${range.offset}-${range.offset+range.length-1}/${row.size}`} :{}),'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
 }catch(e){return fail(e);}}
