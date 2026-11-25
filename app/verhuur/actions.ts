"use server";
import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {requireActivityActor} from '@/lib/auth';
import {addActivityLog,completeRental,createRental,updateRental} from '@/lib/inspection-service';
import {rentalTransportSchema} from '@/lib/rental';
function returnPath(form:FormData){const path=String(form.get('returnTo')||'/verhuur');return path==='/verhuur'||/^\/machines\/[a-zA-Z0-9-]+$/.test(path)?path:'/verhuur';}
function go(path:string,key:string,value:string){redirect((path+'?'+new URLSearchParams({[key]:value})) as never);}
function transport(form:FormData){return rentalTransportSchema.parse({delivery:form.has('transportDelivery'),collection:form.has('transportCollection'),address:String(form.get('transportAddress')||''),contact:String(form.get('transportContact')||''),instructions:String(form.get('transportInstructions')||'')});}
function refresh(machineId:string){for(const path of ['/','/verhuur','/machines','/planning/transport','/planning/werkplaats',`/machines/${machineId}`])revalidatePath(path);}
export async function createRentalAction(form:FormData){
 const actor=await requireActivityActor(),path=returnPath(form),machineId=String(form.get('machineId')||''),customerId=String(form.get('customerId')||''),startDate=String(form.get('startDate')||''),endDate=form.has('openPeriod')?'':String(form.get('endDate')||'');
 try{
  if(!machineId||!customerId)throw new Error('Kies een voorraadmachine en een klant.');
  const rental=await createRental({id:String(form.get('requestId')||'')||undefined,machineId,customerId,startDate,endDate,price:String(form.get('price')||''),transport:transport(form)});
  await addActivityLog({actorId:actor.id,actorName:actor.name,actorEmail:actor.email,action:'rental.created',entityType:'rental',entityId:rental.id,targetLabel: 'Verhuur '+startDate+' - '+(endDate||'open'),details:{machineId,customerId}});
 }catch(e){go(path,'error',e instanceof Error?e.message:'Verhuur opslaan mislukt.');}
 refresh(machineId);go(path,'rented','1');
}
export async function completeRentalAction(form:FormData){
 const actor=await requireActivityActor(),path=returnPath(form),rentalId=String(form.get('rentalId')||''),machineId=String(form.get('machineId')||''),endDate=String(form.get('endDate')||'');
 try{
  if(!rentalId||!endDate)throw new Error('Vul de werkelijke einddatum in.');
  await completeRental(rentalId,endDate,Number(form.get('version'))||undefined);
  await addActivityLog({actorId:actor.id,actorName:actor.name,actorEmail:actor.email,action:'rental.completed',entityType:'rental',entityId:rentalId,targetLabel:'Verhuur afgesloten op '+endDate,details:{machineId,endDate}});
 }catch(e){go(path,'error',e instanceof Error?e.message:'Verhuur afsluiten mislukt.');}
 refresh(machineId);go(path,'returned','1');
}
export async function updateRentalDetailsAction(form:FormData){
 await requireActivityActor();
 try{await updateRental({rentalId:String(form.get('rentalId')||''),version:Number(form.get('version')),customerId:String(form.get('customerId')||''),startDate:String(form.get('startDate')||''),endDate:form.has('openPeriod')?'':String(form.get('endDate')||''),price:String(form.get('price')||''),transport:transport(form)});
 }catch(e){go('/verhuur','error',e instanceof Error?e.message:'Verhuur wijzigen mislukt.');}
 refresh('');go('/verhuur','updated','1');
}
