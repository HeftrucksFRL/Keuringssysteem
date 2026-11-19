import {NextResponse,type NextRequest} from 'next/server';
import {requireUser} from '@/lib/auth';
import {validateOrigin,validateCsrf,applyRateLimit} from '@/lib/security';
import {createWorkshopPdf,workshopPrintSchema} from '@/lib/workshop-print';
export const runtime='nodejs';
const headers={'Content-Type':'application/pdf','Content-Disposition':'inline; filename="werkplaats.pdf"','Cache-Control':'private, no-store'};
export async function GET(){
  if(!await requireUser())return new NextResponse('Log opnieuw in.',{status:401});
  return new NextResponse(Buffer.from(await createWorkshopPdf({type:'workshop'})),{headers});
}
export async function POST(req:NextRequest){
  if(!await requireUser())return new NextResponse('Log opnieuw in.',{status:401});
  const denied=validateOrigin(req)||validateCsrf(req)||applyRateLimit(req,'workshop-print',60);if(denied)return NextResponse.json({message:denied},{status:403});
  const raw=await req.text();if(raw.length>2_000_000)return NextResponse.json({message:'De afdruk is te groot.'},{status:413});
  let value:unknown;try{value=JSON.parse(raw);}catch{return NextResponse.json({message:'Ongeldig verzoek.'},{status:400});}
  const parsed=workshopPrintSchema.safeParse(value);if(!parsed.success)return NextResponse.json({message:'Controleer de afdrukgegevens.'},{status:400});
  try{return new NextResponse(Buffer.from(await createWorkshopPdf(parsed.data)),{headers});}
  catch{return NextResponse.json({message:'Afdruk maken is niet gelukt. Probeer opnieuw.'},{status:500});}
}
