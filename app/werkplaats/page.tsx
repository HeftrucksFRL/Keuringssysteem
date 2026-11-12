import { hasSupabaseConfig } from "@/lib/env";
import { getCurrentUser } from "@/lib/auth";
import { isWorkshopViewer, canManageWorkshopTablet } from "@/lib/workshop-access";
import Link from "next/link";
import { WorkshopPlanner } from "@/components/workshop-planner";

export const dynamic = "force-dynamic";
export default async function WorkshopPage() {
  const connected = hasSupabaseConfig();
  const user = await getCurrentUser();
  const viewer = isWorkshopViewer(user);
  return <>
    {(!connected || canManageWorkshopTablet(user)) && <div style={{display:"flex",justifyContent:"flex-end",marginBottom:8}}><Link className="button-secondary" style={{fontSize:12,padding:"8px 12px",minHeight:36}} href="/werkplaats/tablet">Tablet instellen</Link></div>}
    <WorkshopPlanner connected={connected} readOnly={viewer}/>
  </>;
}
