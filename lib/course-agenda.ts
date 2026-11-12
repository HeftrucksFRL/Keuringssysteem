import {z} from "zod";

export const courseAgendaItemSchema=z.object({
  id:z.string().regex(/^\d+$/),title:z.string().min(1).max(500),
  startsAt:z.string().datetime(),endsAt:z.string().datetime(),location:z.string().max(1000),
  instructorId:z.number().int().positive(),instructorName:z.string().min(1).max(180)
}).strict().refine(c=>Date.parse(c.endsAt)>Date.parse(c.startsAt),"Ongeldige cursustijden");
export const courseAgendaResponseSchema=z.object({instructorId:z.number().int().positive(),courses:z.array(courseAgendaItemSchema).max(1000),fetchedAt:z.string().datetime()}).strict();
export type CourseAgendaItem=z.infer<typeof courseAgendaItemSchema>;
export const courseAgendaRangeSchema=z.object({from:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),to:z.string().regex(/^\d{4}-\d{2}-\d{2}$/)}).refine(({from,to})=>{
  const start=Date.parse(from+"T00:00:00Z"),end=Date.parse(to+"T00:00:00Z");
  return Number.isFinite(start)&&Number.isFinite(end)&&new Date(start).toISOString().slice(0,10)===from&&new Date(end).toISOString().slice(0,10)===to&&end>=start&&end-start<=62*86400000;
},"Kies een periode van maximaal 63 dagen.");
export function validateCourseFeed(data:unknown,instructorId:number){
  const parsed=courseAgendaResponseSchema.parse(data);
  if(parsed.instructorId!==instructorId||parsed.courses.some(c=>c.instructorId!==instructorId))throw new Error("De cursusagenda hoort niet bij de ingestelde instructeur.");
  if(new Set(parsed.courses.map(c=>c.id)).size!==parsed.courses.length)throw new Error("Dubbele cursussen in agenda.");
  return parsed;
}
export function courseLocalDate(value:string){
  const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Amsterdam",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date(value));
  const part=(name:string)=>parts.find(p=>p.type===name)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
export function courseDescription(course:CourseAgendaItem){
  const fmt=new Intl.DateTimeFormat("nl-NL",{timeZone:"Europe/Amsterdam",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"});
  return `${fmt.format(new Date(course.startsAt))} – ${fmt.format(new Date(course.endsAt))} · ${course.location||"Locatie nog niet bekend"} · ${course.instructorName}`;
}
export function courseOccurrences(courses:CourseAgendaItem[],from:string,to:string){
  return courses.flatMap(course=>{
    const first=courseLocalDate(course.startsAt),last=courseLocalDate(new Date(Date.parse(course.endsAt)-1).toISOString());
    const days=[];let day=first<from?from:first;
    // Bound expansion to the requested calendar range, including multi-day courses.
    while(day<=last&&day<=to&&days.length<63){days.push({id:`course-${course.id}-${day}`,ownerId:"external-course",title:course.title,description:courseDescription(course),eventDate:day,createdAt:course.startsAt,updatedAt:course.startsAt,course});day=new Date(Date.parse(day+"T12:00:00Z")+86400000).toISOString().slice(0,10);}
    return days;
  });
}
