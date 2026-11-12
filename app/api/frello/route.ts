import { NextResponse,type NextRequest } from "next/server";
import { requireUser,getUserDisplayName } from "@/lib/auth";
import { hasSupabaseConfig } from "@/lib/env";
import { canManageWorkshopTablet } from "@/lib/workshop-access";
import { createClient } from "@/lib/supabase/server";
import { validateOrigin,validateCsrf,applyRateLimit } from "@/lib/security";
import { frelloCreateSchema,frelloSaveSchema,initialFrelloState,type FrelloState } from "@/lib/frello";
export const dynamic="force-dynamic";
const cols="id,title,visibility,owner_id,version,updated_at";
const json=(v:unknown,status=200)=>NextResponse.json(v,{status,headers:{"Cache-Control":"private, no-store"}});
async function access(req:NextRequest,write=false){
  if(!hasSupabaseConfig())return {denied:json({message:"Gebruik lokaal de proefversie."},503)};
  const user=await requireUser();if(!user)return {denied:json({message:"Log opnieuw in."},401)};
  if(!canManageWorkshopTablet(user))return {denied:json({message:"Frellobord is alleen voor Age en Renze."},403)};
  if(write){const error=validateOrigin(req)||validateCsrf(req)||applyRateLimit(req,"frello",120);if(error)return {denied:json({message:error},403)};}
  return {user};
}
export async function GET(req:NextRequest){try{
  const gate=await access(req);if(gate.denied)return gate.denied;const client=await createClient(),id=req.nextUrl.searchParams.get("id");
  if(id){if(!/^[0-9a-f-]{36}$/i.test(id))return json({message:"Ongeldig bord."},400);
    const {data,error}=await client.from("frello_boards").select("id,title,visibility,owner_id,version,updated_at,state").eq("id",id).maybeSingle();
    if(error)return json({message:"Bord laden is niet gelukt."},503);if(!data)return json({message:"Dit bord bestaat niet of is privé."},404);
    const files=await client.from("frello_files").select("id,board_id,card_id,name,size,created_at").eq("board_id",id).order("created_at");
    if(files.error)return json({message:"Bijlagen laden is niet gelukt."},503);
    return json({board:data,files:files.data});
  }
  const {data,error}=await client.from("frello_boards").select(cols).order("created_at").limit(100);
  return error?json({message:"Frellobord is nog niet beschikbaar. Controleer de database-installatie."},503):json({boards:data});
}catch{return json({message:"Borden laden is niet gelukt."},500);}}
async function read(req:NextRequest){const raw=await req.text();if(Buffer.byteLength(raw)>5000000)throw new Error();return JSON.parse(raw);}
export async function POST(req:NextRequest){try{
  const gate=await access(req,true);if(gate.denied)return gate.denied;const parsed=frelloCreateSchema.safeParse(await read(req));if(!parsed.success)return json({message:"Vul een bordnaam en zichtbaarheid in."},400);
  const client=await createClient();const {data,error}=await client.from("frello_boards").insert({...parsed.data,owner_id:gate.user!.id,state:initialFrelloState()}).select("id,title,visibility,owner_id,version,updated_at,state").single();
  return error?json({message:"Bord aanmaken is niet gelukt."},503):json({board:data},201);
}catch{return json({message:"Ongeldig verzoek of opslaan mislukt."},400);}}
export async function PUT(req:NextRequest){try{
  const gate=await access(req,true);if(gate.denied)return gate.denied;const parsed=frelloSaveSchema.safeParse(await read(req));if(!parsed.success)return json({message:parsed.error.issues[0]?.message||"Controleer de kaartgegevens."},400);
  const client=await createClient(),{id,version,title,state}=parsed.data;
  const prior=await client.from("frello_boards").select("state,version").eq("id",id).maybeSingle();if(prior.error||!prior.data)return json({message:"Bord niet gevonden of privé."},404);
  if(prior.data.version!==version)return json({message:"Een collega heeft dit bord gewijzigd. Je concept blijft open. Sluit het, vernieuw en pas je wijziging opnieuw toe."},409);
  const old=prior.data.state as FrelloState;
  // Keep the authorship of existing comments; new comments get the current author.
  const oldComments=new Map(old.cards.flatMap(c=>c.comments.map(m=>[m.id,m] as const)));
  for(const card of state.cards)card.comments=card.comments.map(m=>oldComments.get(m.id)||{...m,author:getUserDisplayName(gate.user),createdAt:new Date().toISOString()});
  const {data,error}=await client.from("frello_boards").update({state,title,version:version+1,updated_at:new Date().toISOString()}).eq("id",id).eq("version",version).select("id,title,visibility,owner_id,version,updated_at,state").maybeSingle();
  if(error)return json({message:"Opslaan is niet gelukt."},503);if(!data)return json({message:"Bord is intussen gewijzigd. Vernieuw en probeer opnieuw."},409);return json({board:data});
}catch{return json({message:"Ongeldig verzoek of opslaan mislukt."},400);}}
