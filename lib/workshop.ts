import { z } from "zod";

export const workshopStatuses = ["Nieuw", "Ingepland", "Mee bezig", "Wachten op onderdelen", "Wachten op goedkeuring", "Pauze", "Werkbon-controle", "On hold", "Klaar voor transport"] as const;
export const workshopActivitySchema=z.object({requestId:z.string().uuid(),jobId:z.string().min(1).max(80),employeeId:z.string().min(1).max(80),action:z.enum(["start","pause","parts","review","hold","note"]),text:z.string().trim().max(3000)}).strict().refine(v=>v.action!=="note"||v.text.length>0,{message:"Vul een notitie in."});
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
  serial: text, task: text.min(1), notes: text, employee: z.union([id, z.literal("")]),
  date: z.union([date, z.literal("")]), time, duration, status: z.enum(workshopStatuses),
  checks: z.tuple([z.boolean(), z.boolean(), z.boolean()]), transport: transportSchema.nullable()
  ,updates:z.array(z.object({id:z.string().uuid(),employeeId:z.string().max(80),employeeName:z.string().max(180),action:z.enum(["start","pause","parts","review","hold","note"]),text:z.string().max(3000),at:z.string().datetime()}).strict()).max(500).optional()
}).strict();
export type WorkshopJob = z.infer<typeof jobSchema>;
export const workshopStateSchema = z.object({
  employees: z.array(z.object({ id, name, role: z.enum(["mechanic", "driver"]) }).strict()).max(100),
  jobs: z.array(jobSchema).max(5000)
}).strict().superRefine((state, ctx) => {
  const problem = (message: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, message });
  if (new Set(state.employees.map(e => e.id)).size !== state.employees.length) problem("Medewerker-ID komt dubbel voor.");
  if (new Set(state.jobs.map(j => j.id)).size !== state.jobs.length || new Set(state.jobs.map(j => j.number)).size !== state.jobs.length) problem("Dubbele werkbonnen zijn niet toegestaan.");
  const person = (employee: string, role: string) => state.employees.some(e => e.id === employee && e.role === role);
  const minutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
  const slots: Record<string, Array<{ start: number; end: number; number: string }>> = {};
  const addSlot = (key: string, start: number, length: number, number: string) => {
    (slots[key] ??= []).push({ start, end: start + length, number });
    if (start + length > 1440) problem(`${number}: de opdracht moet binnen één dag vallen.`);
  };
  for (const j of state.jobs) {
    if (Boolean(j.employee) !== Boolean(j.date) || (j.status !== "Nieuw" && (!j.date || !j.employee))) problem(`${j.number}: kies een monteur en datum.`);
    if (j.employee && !person(j.employee, "mechanic")) problem(`${j.number}: onbekende monteur.`);
    if (j.employee && j.date) addSlot(`m:${j.employee}:${j.date}`, minutes(j.time), j.duration, j.number);
    if (j.status === "Klaar voor transport" && !j.checks.every(Boolean)) problem(`${j.number}: de werkplaatscontroles zijn nog niet afgerond.`);
    if (j.transport) {
      const t = j.transport;
      if (j.status !== "Klaar voor transport") problem(`${j.number}: transport kan pas na gereedmelding.`);
      if (!person(t.driver, "driver")) problem(`${j.number}: onbekende chauffeur.`);
      if (t.state === "Afgeleverd" && !t.confirmation.trim()) problem(`${j.number}: vul de afleverbevestiging in.`);
      if (minutes(t.time) + t.duration > 1440) problem(`${j.number}: de rit moet binnen één dag vallen.`);
      if (t.state !== "Afgeleverd") addSlot(`d:${t.driver}:${t.date}`, minutes(t.time), t.duration, j.number);
    }
  }
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
  if(job.updates?.some(u=>u.id===input.requestId))return state;
  if((job.updates?.length||0)>=500)throw new Error("Deze bon heeft het maximale aantal updates. Vraag Age of Renze om hulp.");
  if(input.action!=="note"&&(job.transport||job.status==="Klaar voor transport"))throw new Error("Deze bon is vrijgegeven voor transport. Vraag Age of Renze om de status aan te passen.");
  if(input.action!=="note"&&(!job.employee||!job.date))throw new Error("Deze bon is nog niet ingepland. Je kunt wel een notitie toevoegen.");
  const statuses={start:"Mee bezig",pause:"Pauze",parts:"Wachten op onderdelen",review:"Werkbon-controle",hold:"On hold"} as const;
  const changed={...job,status:input.action==="note"?job.status:statuses[input.action],updates:[...(job.updates||[]),{id:input.requestId,employeeId:employee.id,employeeName:employee.name,action:input.action,text:input.text,at}]};
  return {...state,jobs:state.jobs.map(j=>j.id===job.id?changed:j)};
}
