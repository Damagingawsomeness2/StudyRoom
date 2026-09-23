import{modelConfigured}from '@/lib/model';
export async function GET(){return Response.json({configured:modelConfigured(),provider:'OpenAI'},{headers:{'Cache-Control':'private, no-store'}});}
