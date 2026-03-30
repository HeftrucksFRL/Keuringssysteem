import {
  getCustomers,
  getInspectionAttachments,
  getInspections,
  getMachines
} from "@/lib/inspection-service";
import { InspectionsTable } from "@/components/inspections-table";

export default async function InspectionsPage({
  searchParams
}: {
  searchParams?: Promise<{ created?: string }>;
}) {
  const inspections = await getInspections();
  const customers = await getCustomers();
  const machines = await getMachines();
  const attachments = await getInspectionAttachments();
  const params = await searchParams;

  return (
    <section className="panel">
      <div className="eyebrow">Overzicht keuringen</div>
      <h1>Alle keuringen</h1>
      {params?.created ? (
        <p className="form-message success">
          Keuring {params.created} is opgeslagen.
        </p>
      ) : null}
      <InspectionsTable
        inspections={inspections}
        customers={customers}
        machines={machines}
        attachments={attachments}
      />
    </section>
  );
}
