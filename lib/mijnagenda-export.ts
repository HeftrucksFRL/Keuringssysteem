import { createHash, timingSafeEqual } from "node:crypto";

export function agendaKeyAllowed(header: string | null, expected: string | undefined) {
  if (!expected || !/^[a-f0-9]{64}$/.test(expected) || !header || !/^Bearer [a-f0-9]{64}$/.test(header)) return false;
  return timingSafeEqual(Buffer.from(header.slice(7)), Buffer.from(expected));
}
export function calendarDate(value: unknown): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Invalid date");
  const d = new Date(value + "T00:00:00Z");
  if (!Number.isFinite(+d) || d.toISOString().slice(0,10) !== value) throw new Error("Invalid date");
  return value;
}
const nextDay=(day:string)=>new Date(Date.parse(calendarDate(day)+"T00:00:00Z")+86400000).toISOString().slice(0,10);
type Row=Record<string,unknown>;
type Event={id:string;title:string;start:string;end:string;allDay:true;location:string;host:string;category:"reminder"|"appointment"};
const text=(s:unknown)=>String(s??"").replace(/<[^>]*>/g,"").slice(0,500);
const object=(value:unknown):Row => value && typeof value === "object" && !Array.isArray(value) ? value as Row : {};
const id=(kind:string,key:string)=>createHash("sha256").update(kind+":"+key).digest("hex");

// Only native planning tables enter this function. Imported Age courses are never fetched.
export function inspectionAgenda(planning:Row[],rentals:Row[],manual:Row[]):Event[] {
  const groups=new Map<string,Row[]>();
  for(const row of planning){
    const day=calendarDate(row.due_date);
    const route=String(row.notes??"").trim().match(/^Route:\s*(.+)$/)?.[1]??"";
    const key=day+":"+(route?"route:"+route:"customer:"+row.customer_id);
    groups.set(key,[...(groups.get(key)??[]),row]);
  }
  const result:Event[]=[];
  for(const rows of groups.values()){
    const first=rows[0],customer=object(first.customers),day=calendarDate(first.due_date);
    const route=String(first.notes??"").trim().match(/^Route:\s*(.+)$/)?.[1];
    const count=new Set(rows.map(r=>String(r.machine_id))).size;
    // due_date is an expiry/reminder date, never proof of a booked customer visit.
    result.push({id:id("inspection",rows.map(r=>String(r.id)).sort().join(",")),title:`Keuringsreminder · ${text(route||customer.company_name||"Klant")} · ${count} machine${count===1?"":"s"}`,start:day,end:nextDay(day),allDay:true,location:route?"":text([customer.address_line_1,customer.city].filter(Boolean).join(", ")),host:"",category:"reminder"});
  }
  for(const row of rentals){
    const customer=object(row.customers);
    for(const [field,label] of [["start_date","Start verhuur"],["end_date","Einde verhuur"]] as const){
      const day=calendarDate(row[field]);
      result.push({id:id("rental",String(row.id)+":"+field),title:`${label} · ${text(customer.company_name||"Klant")}`,start:day,end:nextDay(day),allDay:true,location:text([customer.address_line_1,customer.city].filter(Boolean).join(", ")),host:"",category:"reminder"});
    }
  }
  for(const row of manual){const day=calendarDate(row.event_date);result.push({id:id("manual",String(row.id)),title:text(row.title),start:day,end:nextDay(day),allDay:true,location:"",host:"",category:"appointment"});}
  return result.sort((a,b)=>a.start.localeCompare(b.start)||a.id.localeCompare(b.id));
}
