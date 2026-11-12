import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { hasSupabaseConfig } from "@/lib/env";
import { canManageWorkshopTablet, workshopLoginEmail, isWorkshopViewer } from "@/lib/workshop-access";
import { validateCsrf,validateOrigin,applyRateLimit } from "@/lib/security";

const schema=z.object({password:z.string().min(12).max(128),operation:z.enum(["create","reset"])}).strict();
const json=(message:string,status=200)=>NextResponse.json({message},{status,headers:{"Cache-Control":"no-store"}});
export async function POST(request:NextRequest) {
  if(!hasSupabaseConfig())return json("Instellen kan alleen in de echte app met gedeelde opslag.",503);
  const user=await requireUser();
  if(!user)return json("Log opnieuw in.",401);
  if(!canManageWorkshopTablet(user))return json("Alleen Age en Renze kunnen het werkplaatsaccount instellen.",403);
  const invalid=validateOrigin(request)||validateCsrf(request);
  if(invalid)return json(invalid,403);
  const limit=applyRateLimit(request,"workshop-account",5);
  if(limit)return json(limit,429);
  try {
    const raw=await request.text();if(raw.length>2000)return json("Ongeldig verzoek.",400);
    let value:unknown;try{value=JSON.parse(raw);}catch{return json("Ongeldig verzoek.",400);}
    const body=schema.safeParse(value);if(!body.success)return json("Kies een wachtwoord van 12 tot 128 tekens.",400);
    const admin=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false}});
    // Do not create even a read-only auth user before database isolation is installed.
    const guard=await admin.from("workshop_access_config").select("version").eq("id",1).single();
    if(guard.error||guard.data?.version!==1)return json("Voer eerst supabase/workshop-tablet-access.sql uit voordat je het tabletaccount aanmaakt.",503);
    if(body.data.operation==="create"){
      const {error}=await admin.auth.admin.createUser({email:workshopLoginEmail,password:body.data.password,email_confirm:true,app_metadata:{app_role:"workshop_viewer"},user_metadata:{full_name:"Werkplaats"}});
      if(error)return json("Het account kon niet worden aangemaakt. Bestaat het al? Kies dan ‘Wachtwoord vervangen’.",400);
      return json("Werkplaatsaccount aangemaakt. Log op de tablet in met gebruikersnaam werkplaats en het gekozen wachtwoord.");
    }
    let account=null;
    for(let page=1;page<=100;page++){
      const {data,error}=await admin.auth.admin.listUsers({page,perPage:100});
      if(error)return json("Het account kon niet worden opgezocht.",503);
      account=data.users.find(u=>u.email===workshopLoginEmail)||null;
      if(account||data.users.length<100)break;
    }
    if(!account||!isWorkshopViewer(account))return json("Er is geen bestaand werkplaatsaccount. Kies ‘Werkplaatsaccount aanmaken’.",400);
    const {error}=await admin.auth.admin.updateUserById(account.id,{password:body.data.password});
    if(error)return json("Wachtwoord vervangen is niet gelukt.",503);
    return json("Wachtwoord vervangen. Log op de tablet opnieuw in met werkplaats en het nieuwe wachtwoord.");
  }catch{return json("Het account kon niet worden ingesteld. Probeer opnieuw.",500);}
}
