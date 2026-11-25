import {NextResponse,type NextRequest} from "next/server";
import {createClient} from "@supabase/supabase-js";
import {requireUser} from "@/lib/auth";
import {hasSupabaseConfig} from "@/lib/env";
import {validateCsrf,validateOrigin,applyRateLimit} from "@/lib/security";
import {normalizeWorkshopTransports} from "@/lib/workshop-transport";
import {workshopActivitySchema,applyWorkshopActivity,type WorkshopState} from "@/lib/workshop";
import {readWorkshopState,saveWorkshopState,WorkshopConflict} from '@/lib/workshop-storage';
const json=(message:string,status:number)=>NextResponse.json({message},{status,headers:{"Cache-Control":"no-store"}});
export async function POST(req:NextRequest){
  if(!hasSupabaseConfig())return json("Gedeelde opslag is niet ingesteld.",503);
  const user=await requireUser();if(!user)return json("Log opnieuw in.",401);
  const denied=validateOrigin(req)||validateCsrf(req)||applyRateLimit(req,"workshop-activity",90);if(denied)return json(denied,403);
  try{const raw=await req.text();if(raw.length>12000)return json("Notitie is te groot.",413);let data:unknown;try{data=JSON.parse(raw);}catch{return json("Ongeldig verzoek.",400);}
    const parsed=workshopActivitySchema.safeParse(data);if(!parsed.success)return json(parsed.error.issues[0]?.message||"Controleer je naam en notitie.",400);
    const client=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false}});
    const current=await readWorkshopState(client);
    const original=normalizeWorkshopTransports(current.state);
    let state:WorkshopState;try{state=applyWorkshopActivity(original,parsed.data);}catch(e){return json(e instanceof Error?e.message:"Bijwerken is niet gelukt.",400);}
    if(state===original)return NextResponse.json({state,version:current.version},{headers:{"Cache-Control":"no-store"}});
    if(Buffer.byteLength(JSON.stringify(state),"utf8")>5_000_000)return json("De planning is te groot. Vraag Age of Renze om hulp.",413);
    return NextResponse.json(await saveWorkshopState(client,original,state,user.id),{headers:{"Cache-Control":"no-store"}});
  }catch(e){return json(e instanceof Error?e.message:"Werkbon bijwerken is niet gelukt.",e instanceof WorkshopConflict?409:400);}
}
