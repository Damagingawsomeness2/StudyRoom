import{fail,json,origin}from '@/lib/server';import{modelId,verifyModel}from '@/lib/model';
export async function POST(request:Request){try{origin(request);const x=await json(request),model=modelId(x.model);await verifyModel(model);return Response.json({available:true,generationVerified:true,model},{headers:{'Cache-Control':'private, no-store'}});}catch(e){return fail(e);}}
