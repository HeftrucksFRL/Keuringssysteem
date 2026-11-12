import { NextResponse,type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { hasSupabaseConfig } from "@/lib/env";
import { canManageWorkshopTablet } from "@/lib/workshop-access";
import { createClient } from "@/lib/supabase/server";
import { validateOrigin,validateCsrf,applyRateLimit } from "@/lib/security";
import { validateFrelloUpload,type FrelloState } from "@/lib/frello";
const bucket="frello-attachments";
const json=(message:string,status:number)=>NextResponse.json({message},{status,headers:{"Cache-Control":"no-store"}});
async function allowed(){if(!hasSupabaseConfig())return false;return canManageWorkshopTablet(await requireUser());}
export async function POST(req:NextRequest){try{
  if(!await allowed())return json("Geen toegang.",403);const error=validateOrigin(req)||validateCsrf(req)||applyRateLimit(req,"frello-file",30);if(error)return json(error,403);
  if(Number(req.headers.get("content-length")||0)>4.5*1024*1024)return json("Maximaal 4 MB per bijlage.",413);
  const form=await req.formData(),file=form.get("file"),boardId=String(form.get("boardId")||""),cardId=String(form.get("cardId")||"");
  if(!(file instanceof File)||!validateFrelloUpload(file.name,file.size))return json("Kies een ondersteund bestand van maximaal 4 MB (PDF, afbeelding, Office, tekst of ZIP).",400);
  const client=await createClient();const board=await client.from("frello_boards").select("state").eq("id",boardId).maybeSingle();
  if(board.error||!board.data)return json("Bord niet gevonden of privé.",404);
  if(!(board.data.state as FrelloState).cards.some(c=>c.id===cardId&&!c.archived))return json("Sla de kaart eerst op.",400);
  const id=crypto.randomUUID(),path=`${boardId}/${cardId}/${id}.${file.name.split('.').pop()!.toLowerCase()}`;
  const uploaded=await client.storage.from(bucket).upload(path,file,{contentType:"application/octet-stream",upsert:false});
  if(uploaded.error)return json("Upload is niet gelukt. Bestand blijft ongewijzigd.",503);
  const result=await client.from("frello_files").insert({id,board_id:boardId,card_id:cardId,path,name:file.name.slice(0,200),size:file.size}).select("id,board_id,card_id,name,size,created_at").single();
  if(result.error){await client.storage.from(bucket).remove([path]);return json("Bijlage registreren is niet gelukt.",503);}
  return NextResponse.json({file:result.data},{headers:{"Cache-Control":"no-store"}});
}catch{return json("Upload is niet gelukt.",500);}}
export async function GET(req:NextRequest){try{
  if(!await allowed())return json("Geen toegang.",403);const client=await createClient(),id=req.nextUrl.searchParams.get("id");
  const file=await client.from("frello_files").select("path,name").eq("id",id||"").maybeSingle();if(file.error||!file.data)return json("Bijlage niet gevonden of privé.",404);
  const signed=await client.storage.from(bucket).createSignedUrl(file.data.path,60,{download:file.data.name});
  if(signed.error)return json("Download is niet gelukt.",503);
  return new NextResponse(null,{status:302,headers:{Location:signed.data.signedUrl,"Cache-Control":"private, no-store","Referrer-Policy":"no-referrer"}});
}catch{return json("Download is niet gelukt.",500);}}
