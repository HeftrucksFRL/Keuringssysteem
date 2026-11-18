import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { hasSupabaseConfig } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { applyRateLimit, validateCsrf, validateOrigin } from "@/lib/security";
import { getMachineById,getCustomerById } from "@/lib/inspection-service";
import type { WorkshopState } from "@/lib/workshop";
import { prepareWorkshopSave,workshopSaveSchema } from "@/lib/workshop";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { normalizeWorkshopTransports } from "@/lib/workshop-transport";
import { isWorkshopViewer,canManageWorkshopTablet } from "@/lib/workshop-access";

export const dynamic = "force-dynamic";
const json = (value: unknown, status = 200) => NextResponse.json(value, { status, headers: { "Cache-Control": "private, no-store" } });
async function check(request: NextRequest, writing: boolean) {
  if (!hasSupabaseConfig()) return json({message:"Gedeelde opslag is niet ingesteld. Gebruik de proefweergave."},503);
  const user = await requireUser();
  if (!user) return json({message:"Log opnieuw in om de werkplaatsplanning te openen."},401);
  if (writing) {
    if (isWorkshopViewer(user)) return json({message:"Het werkplaatsaccount heeft alleen kijkrechten."},403);
    const error = validateOrigin(request) || validateCsrf(request);
    if (error) return json({message:error},403);
    const limited = applyRateLimit(request,"workshop-save",120);
    if (limited) return json({message:limited},429);
  }
  return null;
}
export async function GET(request: NextRequest) {
  try {
    const denied = await check(request,false); if (denied) return denied;
    const client = await createClient();
    const {data,error} = await client.from("workshop_planning").select("state,version").eq("id",1).single();
    if (error || !data) return json({message:"Werkplaatsopslag is nog niet beschikbaar. Voer eerst supabase/workshop-module.sql uit."},503);
    const user = await requireUser();
    return json({...data,state:normalizeWorkshopTransports(data.state),canEdit:!isWorkshopViewer(user),canApprove:canManageWorkshopTablet(user)});
  } catch { return json({message:"De planning kon niet worden geladen. Probeer opnieuw."},500); }
}
export async function PUT(request: NextRequest) {
  try {
    const denied = await check(request,true); if (denied) return denied;
    const raw = await request.text();
    if (Buffer.byteLength(raw,"utf8") > 5_000_000) return json({message:"De planning is te groot om op te slaan."},413);
    let body: unknown;
    try {body=JSON.parse(raw);} catch {return json({message:"Ongeldig verzoek."},400);}
    const parsed = workshopSaveSchema.safeParse(body);
    if (!parsed.success) return json({message:parsed.error.issues[0]?.message || "Controleer de gegevens."},400);
    const {version} = parsed.data;
    let state=parsed.data.state;
    const user = await requireUser();
    const client = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {auth:{persistSession:false,autoRefreshToken:false}});
    const current=await client.from("workshop_planning").select("state,version").eq("id",1).single();
    if(current.error)return json({message:"De bestaande werkbonnen konden niet worden geladen."},503);
    if(current.data.version!==version)return json({message:"De planning is intussen door een collega gewijzigd."},409);
    const previous=current.data.state as WorkshopState;
    try{state=prepareWorkshopSave(previous,state,new Date().toISOString(),{canApprove:canManageWorkshopTablet(user),approvedBy:user?.email||"Kantoor"});}catch(e){return json({message:e instanceof Error?e.message:"Controleer de werkbonnen."},400);}
    for(const job of state.jobs){
      const old=previous.jobs.find(j=>j.id===job.id);
      if(!old&&!job.customerId)return json({message:"Koppel de nieuwe werkbon aan een klant en machine."},400);
      if(job.customerId&&(!old||old.customerId!==job.customerId||old.machineId!==job.machineId)){
        const [customer,machine]=await Promise.all([getCustomerById(job.customerId),getMachineById(job.machineId!)]);
        if(!customer||!machine||machine.customerId!==customer.id)return json({message:"De machine hoort niet bij de gekozen klant."},400);
        job.customer=customer.companyName;job.machine=[machine.brand,machine.model,machine.internalNumber||machine.machineNumber].filter(Boolean).join(" · ");job.serial=machine.serialNumber;
      }

    }
    state=normalizeWorkshopTransports(state);
    const {data,error} = await client.from("workshop_planning").update({state,version:version+1,updated_at:new Date().toISOString(),updated_by:user!.id}).eq("id",1).eq("version",version).select("version").maybeSingle();
    if (error) return json({message:"Opslaan mislukt. Controleer de database-inrichting en probeer opnieuw."},503);
    if (!data) return json({message:"De planning is intussen door een collega gewijzigd."},409);
    return json({version:data.version,state});
  } catch {return json({message:"Opslaan mislukt. Je wijzigingen zijn nog niet opgeslagen."},500);}
}
