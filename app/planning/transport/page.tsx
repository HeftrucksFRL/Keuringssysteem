import {hasSupabaseConfig} from '@/lib/env';
import {getCurrentUser} from '@/lib/auth';
import {isWorkshopViewer} from '@/lib/workshop-access';
import {WorkshopPlanner} from '@/components/workshop-planner';

export const dynamic='force-dynamic';
export default async function TransportPlanningPage(){
  const user=await getCurrentUser();
  return <WorkshopPlanner connected={hasSupabaseConfig()} readOnly={isWorkshopViewer(user)} initialMode="driver"/>;
}
