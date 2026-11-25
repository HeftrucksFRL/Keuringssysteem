import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { hasSupabaseConfig } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { applyRateLimit, validateCsrf, validateOrigin } from "@/lib/security";
import { getMachineById,getCustomerById,getMachineSummaries,updateWorkshopMachineHours,assignMachineToCustomer } from "@/lib/inspection-service";
import {workshopMachineSnapshot,workshopHourReadingChange} from '@/lib/workshop-machine';
import type { WorkshopState } from "@/lib/workshop";
import { prepareWorkshopSave,workshopSaveSchema } from "@/lib/workshop";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { normalizeWorkshopTransports } from "@/lib/workshop-transport";
import { isWorkshopViewer,canManageWorkshopTablet } from "@/lib/workshop-access";

import {isRentalStockCustomer} from "@/lib/stock-customer";
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
    const customerId=request.nextUrl.searchParams.get('customerId'),machineId=request.nextUrl.searchParams.get('machineId');
    if(customerId||machineId){
      const {data,error}=await client.from('workshop_planning').select('jobs:state->jobs').eq('id',1).single();
      if(error||!data)return json({message:'Werkbonhistorie kon niet worden geladen.'},503);
      const jobs=(data.jobs as unknown as WorkshopState['jobs']).filter(j=>machineId?j.machineId===machineId:j.customerId===customerId).map(({id,number,machine,task,status,date,completedAt,actualMinutes})=>({id,number,machine,task,status,date,completedAt,actualMinutes}));
      return json({jobs});
    }
    const since=request.nextUrl.searchParams.get('since');
    let query=client.from('workshop_planning').select('state,version').eq('id',1);
    if(since&&/^\d+$/.test(since))query=query.neq('version',Number(since));
    const {data,error}=await query.maybeSingle();
    if(!error&&!data&&since&&/^\d+$/.test(since))return json({unchanged:true,version:Number(since)});
    if (error || !data) return json({message:"Werkplaatsopslag is nog niet beschikbaar. Voer eerst supabase/workshop-module.sql uit."},503);
    const user = await requireUser();
    const state=normalizeWorkshopTransports(data.state);
    const machines=await getMachineSummaries({ids:[...new Set(state.jobs.flatMap(j=>j.machineId?[j.machineId]:[]))],includeArchived:true});
    const byId=new Map(machines.map(m=>[m.id,m]));
    state.jobs=state.jobs.map(job=>{const machine=byId.get(job.machineId||'');if(!machine)return job;const snapshot=workshopMachineSnapshot(machine);return {...job,...snapshot,hourReading:job.hourReading||snapshot.hourReading};});
    return json({...data,state:normalizeWorkshopTransports(state),canEdit:!isWorkshopViewer(user),canApprove:canManageWorkshopTablet(user)});
  } catch { return json({message:"De planning kon niet worden geladen. Probeer opnieuw."},500); }
}
export async function PUT(request: NextRequest) {
  let machineHoursSaved=false,machineTransferred=false;
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
    const hourChanges=new Map<string,string>(),previousById=new Map(previous.jobs.map(j=>[j.id,j]));
    const transfers:{machineId:string;customerId:string}[]=[];
    for(const job of state.jobs){
      const old=previousById.get(job.id);
      if(!old&&!job.customerId)return json({message:"Koppel de nieuwe werkbon aan een klant en machine."},400);
      if(job.customerId&&(!old||old.customerId!==job.customerId||old.machineId!==job.machineId||old.hourReading!==job.hourReading)){
        const [customer,machine]=await Promise.all([getCustomerById(job.customerId),getMachineById(job.machineId!)]);
        const transferring=job.stockInvoiced&&!old?.stockInvoiced;
        if(transferring){
          const source=await getCustomerById(old?.customerId||'');
          if(!source||!isRentalStockCustomer(source)||!customer||isRentalStockCustomer(customer)||customer.archivedAt)return json({message:"Kies een actieve klant buiten de voorraad."},400);
          if(machine&&machine.customerId!==customer.id){if(machine.customerId!==source.id)return json({message:"De machine is intussen aan een andere klant gekoppeld."},409);if(transfers.some(t=>t.machineId===machine.id&&t.customerId!==customer.id))return json({message:"Een machine kan maar aan een koper tegelijk worden overgezet."},400);transfers.push({machineId:machine.id,customerId:customer.id});}
        }
        if(!customer||!machine||(!transferring&&machine.customerId!==customer.id))return json({message:"De machine hoort niet bij de gekozen klant."},400);
        const reading=job.hourReading||machine.configuration.hour_reading||'';
        job.customer=customer.companyName;Object.assign(job,workshopMachineSnapshot(machine),{hourReading:reading});
      }
      const change=workshopHourReadingChange(old,job);
      if(change){if(hourChanges.has(change.machineId)&&hourChanges.get(change.machineId)!==change.hourReading)return json({message:'Verschillende nieuwe urenstanden voor dezelfde machine. Sla de bonnen afzonderlijk op.'},400);hourChanges.set(change.machineId,change.hourReading);}
    }
    state=normalizeWorkshopTransports(state);
    for(const transfer of transfers){await assignMachineToCustomer(transfer);machineTransferred=true;const machine=await getMachineById(transfer.machineId);if(machine?.customerId!==transfer.customerId)throw new Error('Machine overzetten mislukt.');}
    for(const [machineId,reading] of hourChanges){await updateWorkshopMachineHours(machineId,reading);machineHoursSaved=true;}
    const {data,error} = await client.from("workshop_planning").update({state,version:version+1,updated_at:new Date().toISOString(),updated_by:user!.id}).eq("id",1).eq("version",version).select("version").maybeSingle();
    const machineNotice=(hourChanges.size?' De urenstand is wel op de machine bewaard.':'')+(machineTransferred?' De machine is al naar de klant overgezet; sla de werkbon opnieuw op.':'');
    if (error) return json({message:"Werkbon opslaan mislukt. Probeer opnieuw."+machineNotice},503);
    if (!data) return json({message:"De planning is intussen door een collega gewijzigd."+machineNotice},409);
    return json({version:data.version,state});
  } catch {return json({message:"Werkbon opslaan mislukt. Probeer opnieuw."+(machineTransferred?' De machine is al naar de klant overgezet; sla de werkbon opnieuw op.':'')+(machineHoursSaved?' Eén of meer urenstanden zijn wel op de machine bewaard.':'')},500);}
}
