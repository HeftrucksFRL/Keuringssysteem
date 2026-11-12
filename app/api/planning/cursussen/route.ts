import {NextResponse,type NextRequest} from "next/server";
import {requireUser} from "@/lib/auth";
import {canManageWorkshopTablet} from "@/lib/workshop-access";
import {courseAgendaRangeSchema,validateCourseFeed} from "@/lib/course-agenda";

export const dynamic="force-dynamic";
const json=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{"Cache-Control":"private, no-store"}});
export async function GET(request:NextRequest){
  const user=await requireUser();if(!user)return json({message:"Log opnieuw in."},401);
  if(process.env.LOCAL_TEST_MODE!=="1"&&!canManageWorkshopTablet(user))return json({message:"Deze cursusagenda is alleen beschikbaar voor Age en Renze."},403);
  const range=courseAgendaRangeSchema.safeParse({from:request.nextUrl.searchParams.get("from"),to:request.nextUrl.searchParams.get("to")});
  if(!range.success)return json({message:"Ongeldige agendaperiode."},400);
  if(process.env.LOCAL_TEST_MODE==="1")return json({instructorId:7,courses:[{id:"1",title:"Voorbeeldcursus · Age",startsAt:range.data.from+"T08:00:00Z",endsAt:range.data.from+"T15:00:00Z",location:"Voorbeeldlocatie Sneek",instructorId:7,instructorName:"Age"}],fetchedAt:new Date().toISOString()});
  const token=process.env.HEFTRUCK_COURSE_AGENDA_TOKEN?.trim(),instructorId=Number(process.env.HEFTRUCK_COURSE_INSTRUCTOR_ID);
  if(!token||!Number.isSafeInteger(instructorId)||instructorId<=0)return json({message:"De cursusagenda is nog niet gekoppeld. Installeer de agendakoppeling op de opleidingswebsite en stel de sleutel en Ages instructeur-ID in bij de hosting van deze app."},503);
  try{
    const url=new URL("https://heftruckopleiding.frl/wp-json/heftruckopleiding-keuring/v1/courses");url.search=new URLSearchParams(range.data).toString();
    const response=await fetch(url,{headers:{Authorization:`Bearer ${token}`,Accept:"application/json"},cache:"no-store",redirect:"error",signal:AbortSignal.timeout(8000)});
    if(!response.ok)return json({message:response.status===401||response.status===403?"De cursusagenda weigert de sleutel. Controleer de koppeling.":"De cursusagenda is tijdelijk niet beschikbaar. Probeer opnieuw."},502);
    // Bound the upstream response before parsing; never pass through source errors or secrets.
    const reader=response.body?.getReader();if(!reader)throw new Error("empty");
    const chunks:Uint8Array[]=[];let size=0;
    while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>2_000_000){await reader.cancel();throw new Error("size");}chunks.push(value);}
    const data=validateCourseFeed(JSON.parse(Buffer.concat(chunks).toString("utf8")),instructorId);
    return json(data);
  }catch{return json({message:"De cursusagenda kon niet worden opgehaald. Er kunnen cursusafspraken ontbreken. Probeer opnieuw."},502);}
}
