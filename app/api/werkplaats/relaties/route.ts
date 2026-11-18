import { NextResponse,type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { requireUser } from "@/lib/auth";
import { hasSupabaseConfig } from "@/lib/env";
import { isWorkshopViewer } from "@/lib/workshop-access";
import { validateOrigin,validateCsrf,applyRateLimit } from "@/lib/security";
import { createCustomer,createMachine,getCustomerById,getCustomerSummaries,getMachinesForCustomer,getMachineSummaries,isMachineHistoryCustomer } from "@/lib/inspection-service";
const reply=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{"Cache-Control":"private, no-store"}});
const text=z.string().trim().max(180),required=text.min(1);
const schema=z.discriminatedUnion("kind",[
 z.object({kind:z.literal("customer"),companyName:required,address:text,city:text,contactName:text,phone:text,email:z.union([z.string().email().max(254),z.literal("")])}).strict(),
 z.object({kind:z.literal("machine"),customerId:required,machineType:z.enum(["heftruck_reachtruck","batterij_lader","graafmachine","hoogwerker","palletwagen_stapelaar","shovel","verreiker","stellingmateriaal"]),brand:required,model:required,serialNumber:text,internalNumber:text,buildYear:z.string().regex(/^(|\d{4})$/)}).strict()
]);
async function denied(req:NextRequest,write=false){const user=await requireUser();if(!user)return reply({message:"Log opnieuw in."},401);if(isWorkshopViewer(user))return reply({message:"Alleen de planner kan klanten en machines beheren."},403);if(write){const error=validateOrigin(req)||validateCsrf(req)||applyRateLimit(req,"workshop-relations",40);if(error)return reply({message:error},403);}return null;}
export async function GET(req:NextRequest){const error=await denied(req);if(error)return error;try{const customerId=req.nextUrl.searchParams.get("customerId");if(customerId)return reply({machines:await getMachinesForCustomer(customerId)});return reply({customers:(await getCustomerSummaries()).filter(c=>!c.archivedAt&&!isMachineHistoryCustomer(c))});}catch{return reply({message:"Klanten en machines laden is niet gelukt."},503);}}
export async function POST(req:NextRequest){const error=await denied(req,true);if(error)return error;try{const raw=await req.text();if(raw.length>6000)return reply({message:"Verzoek is te groot."},413);const parsed=schema.safeParse(JSON.parse(raw));if(!parsed.success)return reply({message:"Controleer de ingevulde gegevens."},400);const input=parsed.data;let id="";
 if(input.kind==="customer"){
  const duplicate=(await getCustomerSummaries()).find(c=>c.companyName.toLocaleLowerCase("nl-NL")===input.companyName.toLocaleLowerCase("nl-NL"));
  if(duplicate)return reply({message:"Deze klant bestaat al. Kies de klant uit de klantenbak."},409);
  if(hasSupabaseConfig()){const client=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!);const result=await client.from("customers").insert({company_name:input.companyName,address_line_1:input.address,city:input.city,contact_name:input.contactName,phone:input.phone,email:input.email}).select("id").single();if(result.error)throw new Error("Klant opslaan is niet gelukt; controleer of deze al bestaat.");id=String(result.data.id);}else id=await createCustomer(input);
 }else{
  if(!await getCustomerById(input.customerId))return reply({message:"Kies een bestaande klant."},400);
  const machineNumber=input.internalNumber||input.serialNumber;if(!machineNumber)return reply({message:"Vul een vlootnummer of serienummer in."},400);
  if((await getMachineSummaries({includeArchived:true})).some(m=>m.machineNumber.toLowerCase()===machineNumber.toLowerCase()||(input.serialNumber&&m.serialNumber.toLowerCase()===input.serialNumber.toLowerCase())))return reply({message:"Deze machine bestaat al. Kies de bestaande machine op de klantkaart."},409);
  if(hasSupabaseConfig()){const client=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!);const result=await client.from("machines").insert({customer_id:input.customerId,machine_number:machineNumber,machine_type:input.machineType,availability_status:"available",brand:input.brand,model:input.model,serial_number:input.serialNumber,internal_number:input.internalNumber,build_year:Number(input.buildYear)||null,configuration:{}}).select("id").single();if(result.error)throw new Error("Machine opslaan is niet gelukt; controleer het vlootnummer.");id=String(result.data.id);}else id=await createMachine(input);
 }
 if(!id)throw new Error("Opslaan is niet gelukt.");return reply({id},201);
 }catch(e){return reply({message:e instanceof Error?e.message:"Opslaan is niet gelukt."},400);}}
