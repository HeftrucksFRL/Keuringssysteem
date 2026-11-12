import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { hasSupabaseConfig } from "@/lib/env";
import { canManageWorkshopTablet } from "@/lib/workshop-access";
import { WorkshopTabletSetup } from "@/components/workshop-tablet-setup";

export default async function TabletSetupPage() {
  if (hasSupabaseConfig() && !canManageWorkshopTablet(await getCurrentUser())) redirect("/werkplaats");
  return <section className="panel" style={{maxWidth:650,margin:"0 auto"}}>
    <Link href="/werkplaats">← Werkplaatsagenda</Link>
    <h1>Werkplaatstablet instellen</h1>
    <p>Een gedeeld account voor de tablet. De gebruikersnaam is <strong>werkplaats</strong>. Een e-mailadres of mailbox is niet nodig.</p>
    <p>Dit account ziet alleen de werkplaatsagenda en chauffeursplanning. Bonnen openen en lezen kan; aanpassen en medewerkers beheren kan alleen met een eigen beheerdersaccount.</p>
    <WorkshopTabletSetup demo={!hasSupabaseConfig()} />
  </section>;
}
