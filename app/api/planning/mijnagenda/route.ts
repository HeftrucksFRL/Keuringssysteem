import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { agendaKeyAllowed,calendarDate,inspectionAgenda } from "@/lib/mijnagenda-export";

export const runtime="nodejs";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store","X-Robots-Tag":"noindex","Referrer-Policy":"no-referrer"};
const failure=(status:number)=>NextResponse.json({error:"Keuringsagenda niet beschikbaar."},{status,headers});

export async function GET(request:Request){
  const key=process.env.MIJNAGENDA_EXPORT_KEY;
  if(!key || !/^[a-f0-9]{64}$/.test(key))return failure(503);
  if(!agendaKeyAllowed(request.headers.get("authorization"),key))return failure(401);
  if(process.env.LOCAL_TEST_MODE==="1"||!process.env.NEXT_PUBLIC_SUPABASE_URL||!process.env.SUPABASE_SERVICE_ROLE_KEY)return failure(503);
  let from:string,to:string;
  try{const url=new URL(request.url);from=calendarDate(url.searchParams.get("from"));to=calendarDate(url.searchParams.get("to"));const span=(Date.parse(to)-Date.parse(from))/86400000;if(span<=0||span>1100)return failure(400);}catch{return failure(400);}
  try{
    const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
    // A truncated query is an error, never an empty authoritative calendar.
    async function pages(query:(offset:number)=>PromiseLike<{data:unknown[]|null;error:unknown}>){const rows:Record<string,unknown>[]=[];for(let offset=0;offset<=10000;offset+=1000){const {data,error}=await query(offset);if(error||!data)throw Error("Read failed");rows.push(...data as Record<string,unknown>[]);if(rows.length>10000)throw Error("Too many rows");if(data.length<1000)return rows;}throw Error("Too many rows");}
    const planning=await pages(offset=>db.from("planning_items").select("id,customer_id,machine_id,due_date,state,notes,customers(company_name,address_line_1,city)").gte("due_date",from).lt("due_date",to).order("id").range(offset,offset+999));
    const rentals=await pages(offset=>db.from("rentals").select("id,start_date,end_date,customers(company_name,address_line_1,city)").lte("start_date",to).gte("end_date",from).order("id").range(offset,offset+999));
    // Personal native entries are opt-in by owner ID; no broad service-role export of private calendars.
    const owners=(process.env.MIJNAGENDA_AGENDA_OWNER_IDS??"").split(",").map(s=>s.trim()).filter(Boolean);
    if(owners.some(s=>!/^[a-f0-9-]{36}$/i.test(s)))throw Error("Invalid owner configuration");
    const manual=owners.length?await pages(offset=>db.from("agenda_events").select("id,title,event_date").in("owner_id",owners).gte("event_date",from).lt("event_date",to).order("id").range(offset,offset+999)):[];
    const events=inspectionAgenda(planning,rentals,manual).filter(e=>e.start>=from&&e.start<to);
    if(events.length>10000)throw Error("Too many events");
    return NextResponse.json({source:"inspection",from,to,events},{headers});
  }catch{return failure(503);}
}
