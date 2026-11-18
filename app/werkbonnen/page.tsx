import { requireUser } from "@/lib/auth";
import { hasSupabaseConfig } from "@/lib/env";
import { isWorkshopViewer } from "@/lib/workshop-access";
import { WorkshopPlanner } from "@/components/workshop-planner";
export const dynamic="force-dynamic";
export default async function Page(){const user=await requireUser();return <WorkshopPlanner connected={hasSupabaseConfig()} readOnly={isWorkshopViewer(user)} initialMode="archive"/>;}
