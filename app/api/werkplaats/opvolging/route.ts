import {NextResponse,type NextRequest} from 'next/server';
import {createClient} from '@supabase/supabase-js';
import {z} from 'zod';
import {getCurrentUser,requireUser} from '@/lib/auth';
import {isWorkshopViewer} from '@/lib/workshop-access';
import {validateOrigin,validateCsrf,applyRateLimit} from '@/lib/security';
import {readWorkshopState,saveWorkshopState,WorkshopConflict} from '@/lib/workshop-storage';
import {followUpRole,followUpDue,pendingReplanning,updateFollowUp} from '@/lib/workshop-follow-up';
import {workshopStateSchema} from '@/lib/workshop';
export const dynamic='force-dynamic';
const json=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
const client=()=>createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false}});
const input=z.object({jobId:z.string().min(1).max(80),action:z.enum(['snooze','request','planned']),days:z.number().int().min(1).max(365).optional(),note:z.string().trim().max(1000).optional()}).strict();
export async function GET(){
 try{
  const user=await getCurrentUser(),role=!isWorkshopViewer(user)&&followUpRole(user?.email);
  if(!role)return json({role:null,jobs:[],count:0});
  const {state}=await readWorkshopState(client());
  const jobs=state.jobs.filter(j=>role==='planner'?pendingReplanning(j):followUpDue(j));
  return json({role,jobs,count:jobs.length});
 }catch{return json({message:'Werkbonopvolging kon niet worden geladen.'},503);}
}
export async function POST(request:NextRequest){
 try{
  const user=await requireUser(),role=!isWorkshopViewer(user)&&followUpRole(user?.email);
  if(!user||!role)return json({message:'Geen toegang tot werkbonopvolging.'},403);
  const denied=validateOrigin(request)||validateCsrf(request)||applyRateLimit(request,'workshop-follow-up',60);
  if(denied)return json({message:denied},403);
  const body=input.safeParse(await request.json());if(!body.success)return json({message:'Controleer de actie en het aantal dagen.'},400);
  const {action,jobId,days,note}=body.data;
  if((action==='planned'&&role!=='planner')||(action!=='planned'&&role!=='office'))return json({message:'Age/Jolanda volgen facturatie op; Renze verzorgt opnieuw inplannen.'},403);
  const db=client(),{state}=await readWorkshopState(db),job=state.jobs.find(j=>j.id===jobId);
  if(!job)return json({message:'Werkbon niet gevonden.'},404);
  const changed=updateFollowUp(job,action,user.email||'',new Date(),days,note);
  const next=workshopStateSchema.parse({...state,jobs:state.jobs.map(j=>j.id===jobId?changed:j)});
  await saveWorkshopState(db,state,next,user.id);
  return json({saved:true});
 }catch(e){return json({message:e instanceof Error?e.message:'Opvolging opslaan mislukt.'},e instanceof WorkshopConflict?409:400);}
}
