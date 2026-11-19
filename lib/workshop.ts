import { z } from "zod";
import {transportTicketSchema,normalizeWorkshopTransports,validateTransportPlanning,canDrive} from "@/lib/workshop-transport";

export const workshopStatuses = ["Nieuw", "Ingepland", "Mee bezig", "Wachten op onderdelen", "Wachten op goedkeuring", "Pauze", "Werkbon-controle", "On hold", "Klaar voor transport", "Afgerond"] as const;
export const workshopCheckLabels = ["Werkzaamheden uitgevoerd", "Remmen en parkeerrem", "Stuurinrichting", "Mast en hefkettingen", "Vorken en vorkenbord", "Hydrauliek en lekkages", "Banden en wielen", "Verlichting en signalering", "Batterij / motor en vloeistoffen", "Veiligheid en eindcontrole"] as const;
const checklistSchema=z.array(z.boolean()).length(10);
export const workshopActivitySchema=z.object({requestId:z.string().uuid(),jobId:z.string().min(1).max(80),employeeId:z.string().min(1).max(80),action:z.enum(["start","pause","parts","review","hold","note","time","check","claim"]),text:z.string().trim().max(3000),checkedPoints:checklistSchema.optional(),actualMinutes:z.number().int().min(0).max(600000).optional()}).strict().refine(v=>v.action!=="note"||v.text.length>0,{message:"Vul een notitie in."}).refine(v=>v.action!=="time"||v.actualMinutes!==undefined,{message:"Vul de werkelijk bestede tijd in."});
export type WorkshopActivityInput=z.infer<typeof workshopActivitySchema>;
const text = z.string().trim().max(6000);
const name = z.string().trim().min(1).max(180);
const id = z.string().min(1).max(80).regex(/^[a-zA-Z0-9-]+$/);
const date = z.string().refine(value => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(value + "T12:00:00Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}, "Ongeldige datum");
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const duration = z.number().int().min(15).max(1440).multipleOf(15);
const transportSchema = z.object({
  driver: id, date, time, duration, pickup: name, address: name, contact: name,
  instructions: text, state: z.enum(["Gepland", "Onderweg", "Afgeleverd"]), confirmation: text
}).strict();
const jobSchema = z.object({
  id, number: z.string().regex(/^WB-\d{4,}$/), customer: name, machine: name,
  customerId:z.string().max(80).optional(),machineId:z.string().max(80).optional(),internalNumber:z.string().max(180).optional(),deliveryAddress:text.optional(),
  officeApprovedAt:z.string().datetime().optional(),officeApprovedBy:z.string().max(180).optional(),invoiceReference:z.string().max(180).optional(),invoiceSentAt:z.string().datetime().optional(),invoicePaidAt:z.string().datetime().optional(),hourReading:z.string().max(180).optional(),usedParts:z.string().max(6000).optional(),
  kind:z.enum(["Klantreparatie","Verkooptruck","Voorraadtruck"]).optional(),urgent:z.boolean().optional(),
  estimatedMinutes:z.number().int().min(15).max(1440).multipleOf(15).optional(),
  requiredChecks:checklistSchema.optional(),checkedPoints:checklistSchema.optional(),completedAt:z.string().datetime().optional(),createdAt:z.string().datetime().optional(),
  serial: text, task: text.min(1), notes: text, employee: z.union([id, z.literal("")]),
  date: z.union([date, z.literal("")]), time, duration, status: z.enum(workshopStatuses),
  checks: z.tuple([z.boolean(), z.boolean(), z.boolean()]), transport: transportSchema.nullable(), actualMinutes:z.number().int().min(0).max(600000).optional(),
  updates:z.array(z.object({id:z.string().uuid(),employeeId:z.string().max(80),employeeName:z.string().max(180),action:z.enum(["start","pause","parts","review","hold","note","time","check","claim"]),text:z.string().max(3000),at:z.string().datetime(),actualMinutes:z.number().int().min(0).max(600000).optional()}).strict()).max(500).optional()
}).strict();
export type WorkshopJob = z.infer<typeof jobSchema>;
export const workshopStateSchema = z.object({
  employees: z.array(z.object({ id, name, role: z.enum(["mechanic", "driver"]),canDrive:z.boolean().optional() }).strict()).max(100),
  jobs: z.array(jobSchema).max(5000),
  taskSuggestions:z.array(z.string().trim().min(1).max(500)).max(2000).optional(),
  nextJobNumber:z.number().int().positive().optional(),
  transports:z.array(transportTicketSchema).max(10000).optional()
}).strict().superRefine((state, ctx) => {
  const problem = (message: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, message });
  if (new Set(state.employees.map(e => e.id)).size !== state.employees.length) problem("Medewerker-ID komt dubbel voor.");
  if (new Set(state.jobs.map(j => j.id)).size !== state.jobs.length || new Set(state.jobs.map(j => j.number)).size !== state.jobs.length) problem("Dubbele werkbonnen zijn niet toegestaan.");
  const person = (employee: string, role: string) => state.employees.some(e => e.id === employee && (role==="driver"?canDrive(e):e.role===role));
  const minutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
  const slots: Record<string, Array<{ start: number; end: number; number: string }>> = {};
  const addSlot = (key: string, start: number, length: number, number: string) => {
    (slots[key] ??= []).push({ start, end: start + length, number });
    if (start + length > 1440) problem(`${number}: de opdracht moet binnen één dag vallen.`);
  };
  for (const j of state.jobs) {
    if (Boolean(j.employee) !== Boolean(j.date) || (j.status !== "Nieuw" && (!j.date || !j.employee))) problem(`${j.number}: kies een monteur en datum.`);
    if (j.employee && !person(j.employee, "mechanic")) problem(`${j.number}: onbekende monteur.`);
    if (j.status!=="Afgerond" && j.employee && j.date) addSlot(`m:${j.employee}:${j.date}`, minutes(j.time), j.duration, j.number);
    if ((j.customerId&&!j.machineId)||(!j.customerId&&j.machineId)) problem(j.number+": kies zowel een klant als een machine.");
    if (["Werkbon-controle","Klaar voor transport","Afgerond"].includes(j.status) && j.requiredChecks?.some((required,i)=>required&&!j.checkedPoints?.[i])) problem(j.number+": vink eerst alle geselecteerde controlepunten af.");
    if (j.status === "Klaar voor transport" && !j.checks.every(Boolean)) problem(`${j.number}: de werkplaatscontroles zijn nog niet afgerond.`);
    if (j.transport) {
      const t = j.transport;
      if (!["Klaar voor transport","Afgerond"].includes(j.status)) problem(`${j.number}: transport kan pas na gereedmelding.`);
      if (!person(t.driver, "driver")) problem(`${j.number}: onbekende chauffeur.`);
      if (t.state === "Afgeleverd" && !t.confirmation.trim()) problem(`${j.number}: vul de afleverbevestiging in.`);
      if (minutes(t.time) + t.duration > 1440) problem(`${j.number}: de rit moet binnen één dag vallen.`);
      if (j.status!=="Afgerond" && t.state !== "Afgeleverd") addSlot(`d:${t.driver}:${t.date}`, minutes(t.time), t.duration, j.number);
    }
  }
  if(state.transports){try{validateTransportPlanning(state,state);}catch(e){problem(e instanceof Error?e.message:"Controleer transport.");}}
  for (const list of Object.values(slots)) {
    list.sort((a, b) => a.start - b.start);
    for (let i = 1; i < list.length; i++) if (list[i].start < list[i - 1].end) problem(`${list[i].number} overlapt met ${list[i - 1].number}. Kies een andere tijd of medewerker.`);
  }
});
export const workshopSaveSchema = z.object({version:z.number().int().min(0),state:workshopStateSchema}).strict();
export type WorkshopState=z.infer<typeof workshopStateSchema>;
export function applyWorkshopActivity(state:WorkshopState,input:WorkshopActivityInput,at=new Date().toISOString()):WorkshopState{
  const job=state.jobs.find(j=>j.id===input.jobId),employee=state.employees.find(e=>e.id===input.employeeId);
  if(!job)throw new Error("Deze werkbon bestaat niet meer.");
  if(!employee)throw new Error("Kies je naam uit de medewerkerslijst.");
  if(job.status==="Afgerond")throw new Error("Deze werkbon is afgerond. Laat de planner hem eerst heropenen.");
  if(job.updates?.some(u=>u.id===input.requestId))return state;
  if((job.updates?.length||0)>=500)throw new Error("Deze bon heeft het maximale aantal updates. Vraag Age of Renze om hulp.");
  if(!["note","time","check","claim"].includes(input.action)&&(job.transport||job.status==="Klaar voor transport"))throw new Error("Deze bon is vrijgegeven voor transport. Vraag Age of Renze om de status aan te passen.");
  if(!["note","time","check","claim"].includes(input.action)&&(!job.employee||!job.date))throw new Error("Deze bon is nog niet ingepland. Je kunt wel een notitie toevoegen.");
  if(input.action==="check"&&!input.checkedPoints)throw new Error("Vink de gecontroleerde punten aan.");
  let claim:Partial<WorkshopJob>={};
  if(input.action==="claim"){
    if(job.kind!=="Voorraadtruck"||job.employee||job.date||job.status!=="Nieuw"||employee.role!=="mechanic")throw new Error("Deze voorraadbon kan niet meer worden opgepakt. Vernieuw de planning.");
    const day=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Amsterdam",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(at));
    const nowParts=new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/Amsterdam",hour:"2-digit",minute:"2-digit",hour12:false}).format(new Date(at)).split(":").map(Number);
    const occupied=state.jobs.filter(j=>j.status!=="Afgerond"&&j.employee===employee.id&&j.date===day);
    const mins=(t:string)=>Number(t.slice(0,2))*60+Number(t.slice(3));
    let start=Math.max(480,Math.ceil((nowParts[0]*60+nowParts[1])/15)*15);
    for(;start+job.duration<=1440;start+=15)if(!occupied.some(j=>start<mins(j.time)+j.duration&&mins(j.time)<start+job.duration))break;
    if(start+job.duration>1440)throw new Error("Vandaag is er geen ruimte meer voor deze klus. Vraag de planner om een plek.");
    claim={employee:employee.id,date:day,time:String(Math.floor(start/60)).padStart(2,"0")+":"+String(start%60).padStart(2,"0")};
  }
  const checkedPoints=input.checkedPoints??job.checkedPoints;
  if(input.action==="review"&&job.requiredChecks?.some((required,i)=>required&&!checkedPoints?.[i]))throw new Error("Vink eerst alle geselecteerde controlepunten af.");
  if(["Werkbon-controle","Klaar voor transport"].includes(job.status)&&["note","time","check"].includes(input.action)&&job.requiredChecks?.some((required,i)=>required&&!checkedPoints?.[i]))throw new Error("Deze bon kan niet gereed blijven met onvolledige controlepunten.");
  const statuses={start:"Mee bezig",pause:"Pauze",parts:"Wachten op onderdelen",review:"Werkbon-controle",hold:"On hold"} as const;
  const changed={...job,...claim,...(input.checkedPoints?{checkedPoints:input.checkedPoints}:{}),status:["note","time","check"].includes(input.action)?job.status:input.action==="claim"?"Mee bezig":statuses[input.action as keyof typeof statuses],...(input.actualMinutes!==undefined?{actualMinutes:input.actualMinutes}:{}),updates:[...(job.updates||[]),{id:input.requestId,employeeId:employee.id,employeeName:employee.name,action:input.action,text:input.text,at,...(input.actualMinutes!==undefined?{actualMinutes:input.actualMinutes}:{})}]};
  return {...state,jobs:state.jobs.map(j=>j.id===job.id?changed:j)};
}

export function prepareWorkshopSave(previous:WorkshopState,next:WorkshopState,at=new Date().toISOString(),permissions={canApprove:true,approvedBy:"Kantoor"}):WorkshopState{
 const before=normalizeWorkshopTransports(previous);
 const nextIds=new Set(next.jobs.map(j=>j.id)),previousById=new Map(previous.jobs.map(j=>[j.id,j]));
 if(previous.jobs.some(old=>old.status==="Afgerond"&&!nextIds.has(old.id)))throw new Error("Afgeronde werkbonnen blijven bewaard in het archief.");
 const jobs=next.jobs.map(job=>{const old=previousById.get(job.id),copy={...job};copy.createdAt=old?.createdAt||(!old?at:undefined);
  const closed=["Afgerond","Klaar voor transport"].includes(copy.status),wasClosed=old&&["Afgerond","Klaar voor transport"].includes(old.status);
  if(closed&&!wasClosed){if(!permissions.canApprove)throw new Error("Alleen Renze/Age mogen de laatste controle goedkeuren.");if(old?.status!=="Werkbon-controle")throw new Error("De monteur moet de werkbon eerst op Afronden / te controleren zetten.");if(copy.requiredChecks?.some((needed,i)=>needed&&!copy.checkedPoints?.[i]))throw new Error("De geselecteerde check-up is nog niet compleet.");copy.officeApprovedAt=at;copy.officeApprovedBy=permissions.approvedBy;}
  else {copy.officeApprovedAt=old?.officeApprovedAt;copy.officeApprovedBy=old?.officeApprovedBy;}
  if(!closed){delete copy.officeApprovedAt;delete copy.officeApprovedBy;delete copy.invoicePaidAt;delete copy.completedAt;}
  else if(copy.status==="Afgerond")copy.completedAt=old?.completedAt||at;
  if((copy.invoicePaidAt||"")!==(old?.invoicePaidAt||"")||(copy.invoiceSentAt||"")!==(old?.invoiceSentAt||"")||(copy.invoiceReference||"")!==(old?.invoiceReference||"")){
    if(!permissions.canApprove)throw new Error("Alleen kantoor mag facturatie en betaling vastleggen.");
    if(copy.invoicePaidAt&&(!closed||!copy.invoiceReference?.trim()))throw new Error("Sluit eerst de gecontroleerde werkbon af en vul een factuurnummer in.");
    if(copy.invoicePaidAt)copy.invoicePaidAt=old?.invoicePaidAt||at;
    if(copy.invoiceSentAt)copy.invoiceSentAt=old?.invoiceSentAt||at;
  }
  return copy;
 });
 let result=normalizeWorkshopTransports({...next,jobs,transports:next.transports||before.transports});
 // Removing an open work order also removes its linked, unscheduled preparation ticket.
 result={...result,transports:result.transports!.filter(t=>!t.jobId||jobs.some(j=>j.id===t.jobId))};
 for(const old of before.transports||[]){if(old.jobId&&!jobs.some(j=>j.id===old.jobId)&&old.driver)throw new Error("Haal de gekoppelde transportbon eerst uit de planning.");if(!result.transports!.some(t=>t.id===old.id)&&(!old.jobId||jobs.some(j=>j.id===old.jobId)))throw new Error("Transportbonnen blijven bewaard in hun bak.");}
 validateTransportPlanning(result,before);
 return {...result,taskSuggestions:Array.from(new Set([...(previous.taskSuggestions||[]),...jobs.flatMap(j=>j.task.split(/[\n.!?]+/).map(sentence=>sentence.trim()).filter(sentence=>sentence.length>=3&&sentence.length<=500))])).slice(-2000),nextJobNumber:Math.max(previous.nextJobNumber||1,...[...previous.jobs,...jobs].map(j=>Number(j.number.slice(3))+1))};
}

export function workshopDocumentDate(job:WorkshopJob){const timestamp=job.completedAt||(!job.date?job.createdAt:"");return timestamp?new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Amsterdam",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(timestamp)):job.date||"";}
export type WorkshopDocumentFilter={year?:string;month?:string;date?:string;status?:string;query?:string};
export function filterWorkshopDocuments(jobs:WorkshopJob[],filter:WorkshopDocumentFilter){const query=filter.query?.trim().toLocaleLowerCase("nl-NL")||"";return jobs.filter(job=>{const date=workshopDocumentDate(job);if(filter.year&&date.slice(0,4)!==filter.year)return false;if(filter.month&&date.slice(5,7)!==filter.month)return false;if(filter.date&&date!==filter.date)return false;if(filter.status==="completed"&&job.status!=="Afgerond")return false;if(filter.status==="open"&&job.status==="Afgerond")return false;if(filter.status==="review"&&job.status!=="Werkbon-controle")return false;return !query||[job.number,job.customer,job.machine,job.serial,job.task,job.notes,job.invoiceReference].join(" ").toLocaleLowerCase("nl-NL").includes(query);}).sort((a,b)=>workshopDocumentDate(b).localeCompare(workshopDocumentDate(a))||b.number.localeCompare(a.number,"nl",{numeric:true}));}
