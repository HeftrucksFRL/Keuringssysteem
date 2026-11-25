import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { hasSupabaseConfig } from "@/lib/env";
import { applyRateLimit, validateCsrf, validateOrigin } from "@/lib/security";
import { getMachineById,getCustomerById } from "@/lib/inspection-service";
import {workshopMachineSnapshot,workshopHourReadingChange} from '@/lib/workshop-machine';
import type { WorkshopState } from "@/lib/workshop";
import { prepareWorkshopSave,workshopSaveSchema } from "@/lib/workshop";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { normalizeWorkshopTransports } from "@/lib/workshop-transport";
import { isWorkshopViewer,canManageWorkshopTablet } from "@/lib/workshop-access";
import { mergeWorkshopChanges, readWorkshopState, saveWorkshopState, sameRecord, WorkshopConflict } from "@/lib/workshop-storage";

import {isRentalStockCustomer} from "@/lib/stock-customer";
export const dynamic = "force-dynamic";
const json = (value: unknown, status = 200) => NextResponse.json(value, { status, headers: { "Cache-Control": "private, no-store" } });
const admin = () => createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {auth:{persistSession:false,autoRefreshToken:false}});
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
    const client = admin();
    const customerId=request.nextUrl.searchParams.get('customerId'),machineId=request.nextUrl.searchParams.get('machineId');
    if(customerId||machineId){
      const field=machineId?'machine_id':'data->>customerId';
      const records:WorkshopState['jobs']=[];
      for(let offset=0;;offset+=1000){
        const {data,error}=await client.from('workshop_jobs').select('data').eq(field,machineId||customerId!).order('id').range(offset,offset+999);
        if(error||!data)return json({message:'Werkbonhistorie kon niet worden geladen.'},503);
        records.push(...data.map(row=>row.data as WorkshopState['jobs'][number]));
        if(data.length<1000)break;
      }
      const jobs=records.map(({id,number,machine,task,status,date,completedAt,actualMinutes,deletedAt})=>({id,number,machine,task,status,date,completedAt,actualMinutes,deletedAt}));
      return json({jobs});
    }
    const since=request.nextUrl.searchParams.get('since');
    let query=client.from('workshop_state').select('state,version').eq('id',1);
    if(since&&/^\d+$/.test(since))query=query.neq('version',Number(since));
    const {data,error}=await query.maybeSingle();
    if(!error&&!data&&since&&/^\d+$/.test(since))return json({unchanged:true,version:Number(since)});
    if (error || !data) return json({message:"Werkplaatsopslag is nog niet beschikbaar. Installeer supabase/workshop-relational.sql."},503);
    const user = await requireUser();
    const state=normalizeWorkshopTransports(data.state);
    return json({...data,state:normalizeWorkshopTransports(state),canEdit:!isWorkshopViewer(user),canApprove:canManageWorkshopTablet(user)});
  } catch { return json({message:"De planning kon niet worden geladen. Probeer opnieuw."},500); }
}
export async function PUT(request: NextRequest) {
  try {
    const denied = await check(request,true); if (denied) return denied;
    const raw = await request.text();
    if (Buffer.byteLength(raw,"utf8") > 10_000_000) return json({message:"De planning is te groot om op te slaan."},413);
    let body: unknown;
    try {body=JSON.parse(raw);} catch {return json({message:"Ongeldig verzoek."},400);}
    const parsed = workshopSaveSchema.safeParse(body);
    if (!parsed.success) return json({message:parsed.error.issues[0]?.message || "Controleer de gegevens."},400);
    const {version,baseState} = parsed.data;
    let state=parsed.data.state;
    const user = await requireUser();
    const client = admin();
    const current=await readWorkshopState(client);
    if(current.version!==version&&!baseState)return json({message:"De planning is intussen gewijzigd. Vernieuw de pagina."},409);
    const previous=current.state;
    if(baseState)state=mergeWorkshopChanges(baseState,state,previous);
    try{state=prepareWorkshopSave(previous,state,new Date().toISOString(),{canApprove:canManageWorkshopTablet(user),approvedBy:user?.email||"Kantoor"});}catch(e){return json({message:e instanceof Error?e.message:"Controleer de werkbonnen."},400);}
    const hourChanges=new Map<string,string>(),previousById=new Map(previous.jobs.map(j=>[j.id,j]));
    const machineChanges=new Map<string,{machineId:string;expectedCustomerId:string;customerId?:string;hourReading?:string;expectedHourReading?:string}>();
    for(const job of state.jobs){
      const old=previousById.get(job.id);
      if(sameRecord(old,job))continue;
      if(!old&&!job.customerId)return json({message:"Koppel de nieuwe werkbon aan een klant en machine."},400);
      if(job.customerId&&(!old||old.customerId!==job.customerId||old.machineId!==job.machineId||old.hourReading!==job.hourReading)){
        const [customer,machine]=await Promise.all([getCustomerById(job.customerId),getMachineById(job.machineId!)]);
        const transferring=job.stockInvoiced&&!old?.stockInvoiced;
        if(transferring){
          const source=await getCustomerById(old?.customerId||'');
          if(!source||!isRentalStockCustomer(source)||!customer||isRentalStockCustomer(customer)||customer.archivedAt)return json({message:"Kies een actieve klant buiten de voorraad."},400);
          if(machine&&machine.customerId!==customer.id){if(machine.customerId!==source.id)return json({message:"De machine is intussen aan een andere klant gekoppeld."},409);const existing=machineChanges.get(machine.id);if(existing?.customerId&&existing.customerId!==customer.id)return json({message:"Een machine kan maar aan een koper tegelijk worden overgezet."},400);machineChanges.set(machine.id,{...existing,machineId:machine.id,expectedCustomerId:machine.customerId,customerId:customer.id});}
        }
        if(!customer||!machine||(!transferring&&machine.customerId!==customer.id))return json({message:"De machine hoort niet bij de gekozen klant."},400);
        if(customer.archivedAt||machine.configuration.__archivedAt)return json({message:'Kies een actieve klant en machine.'},400);
        if(!machineChanges.has(machine.id))machineChanges.set(machine.id,{machineId:machine.id,expectedCustomerId:machine.customerId});
        const reading=job.hourReading||machine.configuration.hour_reading||'';
        job.customer=customer.companyName;Object.assign(job,workshopMachineSnapshot(machine),{hourReading:reading});
      }
      const change=workshopHourReadingChange(old,job);
      if(change){if(hourChanges.has(change.machineId)&&hourChanges.get(change.machineId)!==change.hourReading)return json({message:'Verschillende nieuwe urenstanden voor dezelfde machine. Sla de bonnen afzonderlijk op.'},400);hourChanges.set(change.machineId,change.hourReading);}
    }
    state=normalizeWorkshopTransports(state);
    for(const [machineId,reading] of hourChanges){
      const machine=await getMachineById(machineId);if(!machine)return json({message:'Machine niet gevonden.'},400);
      machineChanges.set(machineId,{...machineChanges.get(machineId),machineId,expectedCustomerId:machine.customerId,hourReading:reading,expectedHourReading:machine.configuration.hour_reading||''});
    }
    return json(await saveWorkshopState(client,previous,state,user!.id,[...machineChanges.values()]));
  } catch(e) {return json({message:e instanceof Error?e.message:"Werkbon opslaan mislukt. Er zijn geen gedeeltelijke wijzigingen opgeslagen."},e instanceof WorkshopConflict?409:400);}
}
