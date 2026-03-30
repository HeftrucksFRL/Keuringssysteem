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
  searchParams?: Promise<{ created?: string; week?: string }>;
}) {
  const allInspections = await getInspections();
  const customers = await getCustomers();
  const machines = await getMachines();
  const attachments = await getInspectionAttachments();
  const params = await searchParams;
  let inspections = allInspections;

  if (params?.week === "current") {
    const now = new Date();
    const monday = new Date(now);
    const day = (monday.getDay() + 6) % 7;
    monday.setDate(monday.getDate() - day);
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(sunday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    inspections = allInspections.filter((inspection) => {
      const inspectionDate = new Date(inspection.inspectionDate);
      return inspectionDate >= monday && inspectionDate <= sunday;
    });
  }

  return (
    <section className="panel">
      <div className="eyebrow">Overzicht keuringen</div>
      <h1>{params?.week === "current" ? "Keuringen deze week" : "Alle keuringen"}</h1>
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
