import {PlanningCalendar} from '@/components/planning-calendar';
import {PlanningCreateForm} from '@/components/planning-create-form';
import {requireUser} from '@/lib/auth';
import {getAgendaEvents} from '@/lib/inspection-service';
import {hasSupabaseConfig} from '@/lib/env';
import {canManageWorkshopTablet} from '@/lib/workshop-access';

export const dynamic='force-dynamic';
export default async function AppointmentsPage({searchParams}:{searchParams?:Promise<{month?:string;error?:string;appointment?:string;updated?:string;deleted?:string}>}){
 const user=await requireUser(),params=await searchParams;
 const events=await getAgendaEvents(String(user?.id??'demo-user'));
 return <>
   {params?.error&&<p role="alert" className="form-message error">{params.error}</p>}
   {(params?.appointment||params?.updated||params?.deleted)&&<p role="status" className="form-message success">Afspraak {params?.deleted?'verwijderd':'opgeslagen'}.</p>}
   <PlanningCalendar scope="appointments" items={[]} rentals={[]} agendaEventItems={events} customers={[]} machines={[]}
     initialMonth={params?.month} externalCourses={!hasSupabaseConfig()||canManageWorkshopTablet(user)}>
     <PlanningCreateForm mode="appointment" customers={[]} machines={[]} initialMonth={params?.month}/>
   </PlanningCalendar>
 </>;
}
