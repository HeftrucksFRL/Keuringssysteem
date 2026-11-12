import { NextResponse,type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireUser } from "@/lib/auth";
import { hasSupabaseConfig } from "@/lib/env";
import { canManageWorkshopTablet } from "@/lib/workshop-access";
import { applyRateLimit,validateCsrf,validateOrigin } from "@/lib/security";
import { orderSubmissionSchema,normalizeOrderRequest,orderUpdateSchema } from "@/lib/workshop-orders";

export const dynamic="force-dynamic";
const columns="id,details,status,version,manager_note,supplier,reference,created_at,updated_at";
const columnsWithCreator="id,details,status,version,manager_note,supplier,reference,created_at,updated_at,created_by";
const json=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{"Cache-Control":"private, no-store"}});
const admin=()=>createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false}});
async function access(request:NextRequest,write=false) {
  if(!hasSupabaseConfig())return {denied:json({message:"Gedeelde bestellijst is niet ingesteld."},503)};
  const user=await requireUser();if(!user)return {denied:json({message:"Log opnieuw in."},401)};
  if(write){const error=validateOrigin(request)||validateCsrf(request)||applyRateLimit(request,"workshop-orders",60);if(error)return {denied:json({message:error},403)};}
  return {user};
}
async function body(request:NextRequest){const raw=await request.text();if(raw.length>12000)throw new Error("Ongeldig verzoek.");return JSON.parse(raw);}
export async function GET(request:NextRequest){
  try{const gate=await access(request);if(gate.denied)return gate.denied;
    const {data,error}=await admin().from("workshop_orders").select(columns).order("created_at",{ascending:false}).limit(5000);
    if(error)return json({message:"Bestellijst is nog niet beschikbaar. Installeer de bestellijstmigratie."},503);
    return json({orders:data,canManage:canManageWorkshopTablet(gate.user),limited:data.length===5000});
  }catch{return json({message:"De bestellijst kon niet worden geladen."},500);}
}
export async function POST(request:NextRequest){
  try{const gate=await access(request,true);if(gate.denied)return gate.denied;
    let raw:unknown;try{raw=await body(request);}catch{return json({message:"Ongeldig verzoek."},400);}
    const submission=orderSubmissionSchema.safeParse(raw);if(!submission.success)return json({message:"Vul je naam en de bestelling in (maximaal 3.000 tekens)."},400);
    const parsed={data:normalizeOrderRequest(submission.data)};
    const client=admin();
    // A retry with the same ID returns the original request; it never creates a duplicate.
    const existing=await client.from("workshop_orders").select(columnsWithCreator).eq("id",parsed.data.id).maybeSingle();
    if(existing.error)return json({message:"De bestellijstopslag is nog niet beschikbaar."},503);
    if(existing.data){if(existing.data.created_by!==gate.user!.id)return json({message:"Aanvraag-ID is al in gebruik."},409);const {created_by,...order}=existing.data;void created_by;return json({order});}
    const planning=await client.from("workshop_planning").select("state").eq("id",1).single();
    if(planning.error)return json({message:"Medewerkers konden niet worden geladen."},503);
    const employee=planning.data.state.employees.find((e:{id:string;name:string})=>e.id===parsed.data.employeeId);
    const job=planning.data.state.jobs.find((j:{id:string;number:string})=>parsed.data.jobId?j.id===parsed.data.jobId:parsed.data.context?.toLowerCase()===j.number.toLowerCase());
    if(!employee)return json({message:"Kies een bestaande medewerker."},400);
    if(parsed.data.jobId&&!job)return json({message:"De gekozen werkbon bestaat niet meer."},400);
    const details={...parsed.data,employeeName:employee.name,jobNumber:job?.number||"",machine:job?.machine||""};
    const {data,error}=await client.from("workshop_orders").insert({id:parsed.data.id,details,created_by:gate.user!.id}).select(columns).single();
    if(error?.code==="23505"){const retry=await client.from("workshop_orders").select(columnsWithCreator).eq("id",parsed.data.id).single();if(retry.data?.created_by===gate.user!.id){const {created_by,...order}=retry.data;void created_by;return json({order});}return json({message:"Aanvraag-ID is al in gebruik."},409);}
    if(error)return json({message:"Aanvraag kon niet worden opgeslagen. Probeer opnieuw."},503);
    return json({order:data},201);
  }catch{return json({message:"Aanvragen is niet gelukt. Probeer opnieuw."},500);}
}
export async function PATCH(request:NextRequest){
  try{const gate=await access(request,true);if(gate.denied)return gate.denied;
    if(!canManageWorkshopTablet(gate.user))return json({message:"Alleen Age en Renze kunnen aanvragen afhandelen."},403);
    let raw:unknown;try{raw=await body(request);}catch{return json({message:"Ongeldig verzoek."},400);}
    const parsed=orderUpdateSchema.safeParse(raw);if(!parsed.success)return json({message:"Controleer status en toelichting."},400);
    const {id,version,status,managerNote,supplier,reference}=parsed.data;
    const {data,error}=await admin().from("workshop_orders").update({status,manager_note:managerNote,supplier,reference,version:version+1,updated_at:new Date().toISOString(),updated_by:gate.user!.id}).eq("id",id).eq("version",version).select(columns).maybeSingle();
    if(error)return json({message:"Wijzigen is niet gelukt."},503);
    if(!data)return json({message:"Deze aanvraag is intussen gewijzigd. Vernieuw de lijst en open hem opnieuw."},409);
    return json({order:data});
  }catch{return json({message:"Wijzigen is niet gelukt."},500);}
}
