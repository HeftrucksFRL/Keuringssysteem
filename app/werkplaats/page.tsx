import { hasSupabaseConfig } from "@/lib/env";
import { getCurrentUser } from "@/lib/auth";
import { isWorkshopViewer, canManageWorkshopTablet } from "@/lib/workshop-access";
import Link from "next/link";

export const dynamic = "force-dynamic";
export default async function WorkshopPage() {
  const connected = hasSupabaseConfig();
  const user = await getCurrentUser();
  const viewer = isWorkshopViewer(user);
  return <>
    {(!connected || canManageWorkshopTablet(user)) && <div style={{display:"flex",justifyContent:"flex-end",marginBottom:12}}><Link className="button-secondary" href="/werkplaats/tablet">Werkplaatstablet instellen</Link></div>}
    <iframe title="Werkplaatsagenda en chauffeursplanning"
    src={`/werkplaats-preview/index.html${connected ? `?connected=1${viewer ? "&tablet=1" : ""}` : ""}`}
    style={{width:"100%",height:"calc(100vh - 150px)",minHeight:650,border:0,borderRadius:12,background:"#f1f6fa"}} />
  </>;
}
