import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { hasSupabaseConfig } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { applyRateLimit, validateCsrf, validateOrigin } from "@/lib/security";
import { workshopSaveSchema } from "@/lib/workshop";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { isWorkshopViewer } from "@/lib/workshop-access";

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
    return json({...data,canEdit:!isWorkshopViewer(user)});
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
    const {state,version} = parsed.data;
    const user = await requireUser();
    const client = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {auth:{persistSession:false,autoRefreshToken:false}});
    const {data,error} = await client.from("workshop_planning").update({state,version:version+1,updated_at:new Date().toISOString(),updated_by:user!.id}).eq("id",1).eq("version",version).select("version").maybeSingle();
    if (error) return json({message:"Opslaan mislukt. Controleer de database-inrichting en probeer opnieuw."},503);
    if (!data) return json({message:"De planning is intussen door een collega gewijzigd."},409);
    return json({version:data.version});
  } catch {return json({message:"Opslaan mislukt. Je wijzigingen zijn nog niet opgeslagen."},500);}
}
