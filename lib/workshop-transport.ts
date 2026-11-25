import { z } from "zod";
import type { WorkshopJob,WorkshopState } from "@/lib/workshop";
const date=z.union([z.literal(""),z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s=>{const d=new Date(s+"T00:00:00Z");return !isNaN(d.getTime())&&d.toISOString().slice(0,10)===s;})]);
export const transportTicketSchema=z.object({id:z.string().min(1).max(100),jobId:z.string().max(80).optional(),rentalId:z.string().uuid().optional(),rentalLeg:z.enum(["delivery","collection"]).optional(),kind:z.enum(["Werkbon","Inkoop ophalen","Overig","Verhuur brengen","Verhuur ophalen"]),title:z.string().trim().min(1).max(300),customer:z.string().max(180),machine:z.string().max(300),pickup:z.string().max(6000),address:z.string().max(6000),contact:z.string().max(6000),instructions:z.string().max(6000),driver:z.string().max(80),date,appointmentTime:z.union([z.literal(""),z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)]),position:z.number().int().min(0).max(1000000),state:z.enum(["Nieuw","Gepland","Onderweg","Afgeleverd"]),confirmation:z.string().max(6000),legacyReleased:z.boolean().optional(),deletedAt:z.string().datetime().optional()}).strict();
export type TransportTicket=z.infer<typeof transportTicketSchema>;
export const canDrive=(person:{role:string;canDrive?:boolean})=>person.role==="driver"||person.canDrive===true;
export function transportRelease(ticket:TransportTicket,jobs:WorkshopJob[]){if(ticket.deletedAt)return {allowed:false,label:"Transportbon verwijderd"};if(!ticket.jobId)return {allowed:true,label:"Planbaar"};const job=jobs.find(j=>j.id===ticket.jobId);if(!job)return {allowed:false,label:"Werkbon ontbreekt"};if(job.deletedAt)return {allowed:false,label:'Werkbon in archiefbak'};if(job.status==='Geannuleerd')return {allowed:false,label:'Werkbon geannuleerd'};if(ticket.legacyReleased)return {allowed:true,label:"Bestaand vrijgegeven transport"};if(!["Afgerond","Klaar voor transport"].includes(job.status))return {allowed:false,label:job.status==="Werkbon-controle"?"Wacht op kantoorcontrole":"Voorbereiden · werkplaats bezig"};return {allowed:true,label:"Gecontroleerd · planbaar"};}
export function normalizeWorkshopTransports(state:WorkshopState):WorkshopState{
 const transports=[...(state.transports||[])].map(t=>({...t}));
 const byJob=new Map<string,TransportTicket>();for(const ticket of transports)if(ticket.jobId&&!byJob.has(ticket.jobId))byJob.set(ticket.jobId,ticket);
 for(const job of state.jobs){const legacy=job.transport;let ticket=byJob.get(job.id);if(!ticket&&!job.deletedAt&&(job.transportRequired===true||legacy)){ticket={id:"transport-"+job.id,jobId:job.id,kind:"Werkbon",title:job.number+" · "+job.machine,customer:job.customer,machine:job.machine,pickup:legacy?.pickup||"Eigen werkplaats",address:legacy?.address||job.deliveryAddress||"",contact:legacy?.contact||"",instructions:legacy?.instructions||"",driver:legacy?.driver||"",date:legacy?.date||"",appointmentTime:legacy?.time||"",position:transports.length,state:legacy?.state||"Nieuw",confirmation:legacy?.confirmation||"",...(legacy?{legacyReleased:true}:{})};transports.push(ticket);byJob.set(job.id,ticket);}else if(ticket){ticket.title=job.number+" · "+job.machine;ticket.customer=job.customer;ticket.machine=job.machine;}}
 return {...state,transports,jobs:state.jobs.map(job=>({...job,...(job.status==='Klaar voor transport'?{status:'Afgerond' as const,...(!job.completedAt&&job.officeApprovedAt?{completedAt:job.officeApprovedAt}:{})}:{}),transport:null}))};
}
export function validateTransportPlanning(state:WorkshopState,previous?:WorkshopState){
 const transports=state.transports||[];if(new Set(transports.map(t=>t.id)).size!==transports.length)throw new Error("Dubbele transportbonnen zijn niet toegestaan.");
 const linked=transports.filter(t=>t.jobId).map(t=>t.jobId);if(new Set(linked).size!==linked.length)throw new Error("Een werkbon mag maar één gekoppelde transportbon hebben.");
 for(const ticket of transports){const old=previous?.transports?.find(t=>t.id===ticket.id);
  if((ticket.kind==="Werkbon")!==Boolean(ticket.jobId))throw new Error("Koppel werkbontransport aan een werkbon; gebruik voor losse ritten Inkoop of Overig.");
  if(ticket.jobId&&!state.jobs.some(j=>j.id===ticket.jobId))throw new Error("Deze transportbon verwijst naar een ontbrekende werkbon.");
  if(ticket.legacyReleased&&!old?.legacyReleased)throw new Error("Bestaande vrijgave kan niet handmatig worden toegevoegd.");
  if(old&&(old.jobId!==ticket.jobId||old.kind!==ticket.kind))throw new Error("De koppeling en transportbak van een bestaande bon kunnen niet worden gewijzigd.");
  if(Boolean(ticket.rentalId)!==Boolean(ticket.rentalLeg)||Boolean(ticket.rentalId)!==ticket.kind.startsWith('Verhuur ')||ticket.rentalId&&ticket.jobId)throw new Error('Ongeldige verhuurtransportkoppeling.');
  if(old&&(old.rentalId!==ticket.rentalId||old.rentalLeg!==ticket.rentalLeg))throw new Error('De verhuurkoppeling mag niet worden gewijzigd.');
  if(ticket.rentalId&&!old)throw new Error('Maak verhuurtransport aan vanuit Verhuur.');
  if(ticket.deletedAt)continue;
  if(Boolean(ticket.driver)!==Boolean(ticket.date))throw new Error("Kies zowel een chauffeur als een datum, of zet de bon terug in de bak.");
  if(ticket.driver){if(!state.employees.some(e=>e.id===ticket.driver&&canDrive(e)))throw new Error("Kies een medewerker die ook chauffeur is.");if(!transportRelease(ticket,state.jobs).allowed)throw new Error("Transport kan pas worden ingepland na kantoorcontrole.");if(!ticket.pickup.trim()||!ticket.address.trim())throw new Error("Vul het ophaal- en afleveradres in voordat je transport inplant.");if(ticket.state==="Nieuw")throw new Error("Een ingeplande transportbon moet de status Gepland hebben.");}
  else if(ticket.state!=="Nieuw")throw new Error("Zet ongepland transport op Nieuw.");
  if(ticket.state==="Afgeleverd"&&!ticket.confirmation.trim())throw new Error("Vul de afleverbevestiging in.");
 }
}
export function returnWorkshopJob(state:WorkshopState,id:string,pool:"general"|"stock"){const job=state.jobs.find(j=>j.id===id);if(!job)throw new Error("Werkbon niet gevonden.");if((job.kind==="Voorraadtruck")!==(pool==="stock"))throw new Error("Voorraadbonnen horen uitsluitend in voorraad; overige bonnen uitsluitend in algemeen.");if(job.deletedAt||["Afgerond","Klaar voor transport","Geannuleerd"].includes(job.status))throw new Error("Een afgesloten werkbon kan niet terug naar de werkplaatsbak.");return {...state,jobs:state.jobs.map(j=>j.id===id?{...j,employee:"",date:"",status:"Nieuw" as const}:j)};}
export function moveTransportTicket(state:WorkshopState,id:string,destination:{driver:string;date:string;position:number}){const normalized=normalizeWorkshopTransports(state),ticket=normalized.transports!.find(t=>t.id===id);if(!ticket)throw new Error("Transportbon niet gevonden.");if(ticket.deletedAt)throw new Error("Deze transportbon is verwijderd.");const changed={...ticket,...destination,state:destination.driver?"Gepland" as const:"Nieuw" as const};if(!destination.driver)delete changed.legacyReleased;const next={...normalized,transports:normalized.transports!.map(t=>t.id===id?changed:t)};validateTransportPlanning(next,normalized);return next;}

export function deleteTransportTicket(state:WorkshopState,id:string,at=new Date().toISOString()):WorkshopState{
 const ticket=state.transports?.find(t=>t.id===id);if(!ticket||ticket.deletedAt)return state;
 return {...state,transports:state.transports!.map(t=>t.id===id?{...t,deletedAt:at}:t)};
}
