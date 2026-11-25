import type { WorkshopJob } from './workshop';

const day=86400000;
export function followUpRole(email?:string){
 const value=email?.trim().toLowerCase();
 if(['info@heftruckopleiding.frl','info@terpstratrading.frl'].includes(value||''))return 'office';
 if(value==='info@heftrucks.frl')return 'planner';
 return null;
}
export function followUpStart(job:WorkshopJob){
 // Older orders did not always store their creation time. Preserve their original planning date as fallback.
 return job.followUp?.startedAt||job.createdAt||job.updates?.map(u=>u.at).sort()[0]||(job.date?job.date+'T12:00:00Z':undefined);
}
export function pendingReplanning(job:WorkshopJob){return Boolean(job.followUp?.requestAt&&!job.followUp.resolvedAt&&!job.deletedAt&&job.status!=='Geannuleerd');}
export function followUpDue(job:WorkshopJob,now=new Date()){
 if(job.deletedAt||job.status==='Geannuleerd'||job.invoiceSentAt)return false;
 const start=followUpStart(job);if(!start)return !job.followUp?.snoozedUntil||Date.parse(job.followUp.snoozedUntil)<=now.getTime();
 const calendarDay=(v:Date)=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Amsterdam',year:'numeric',month:'2-digit',day:'2-digit'}).format(v);
 return Date.parse(calendarDay(now))-Date.parse(calendarDay(new Date(start)))>=21*day&&(!job.followUp?.snoozedUntil||Date.parse(job.followUp.snoozedUntil)<=now.getTime());
}
export function updateFollowUp(job:WorkshopJob,action:'snooze'|'request'|'planned',by:string,now=new Date(),days=7,note=''):WorkshopJob{
 if(job.deletedAt||job.status==='Geannuleerd')throw new Error('Deze werkbon is niet actief.');
 const previous=job.followUp||{history:[]},at=now.toISOString();
 const next={...previous,startedAt:followUpStart(job)||new Date(now.getTime()-21*day).toISOString(),history:[...previous.history,{action,at,by,note}]};
 if(action==='snooze'){
  if(!Number.isInteger(days)||days<1||days>365)throw new Error('Kies 1 tot en met 365 dagen.');
  next.snoozedUntil=new Date(now.getTime()+days*day).toISOString();
  next.history[next.history.length-1]={...next.history.at(-1)!,until:next.snoozedUntil};
 }
 if(action==='request'){
  if(pendingReplanning(job))throw new Error('Deze werkbon staat al bij Renze.');
  next.requestAt=at;next.resolvedAt=undefined;next.requestedSlot=JSON.stringify([job.employee,job.date,job.time,job.duration]);
 }
 if(action==='planned'){
  if(!pendingReplanning(job))throw new Error('Er staat geen verzoek open.');
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Amsterdam',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
  if(next.requestedSlot===JSON.stringify([job.employee,job.date,job.time,job.duration]))throw new Error('Pas eerst de oorspronkelijke planning aan.');
  if(!job.employee||!job.date||job.date<today||['Afgerond','Klaar voor transport'].includes(job.status))throw new Error('Plan de werkbon eerst opnieuw in met een monteur en een huidige of toekomstige datum.');
  next.resolvedAt=at;
 }
 return {...job,followUp:next};
}
