import {
  getCustomerSummaries,
  getInspectionAttachmentsForInspections,
  getInspectionSummaries,
  getMachineSummaries
} from "@/lib/inspection-service";
import { InspectionsTable } from "@/components/inspections-table";

export default async function InspectionsPage({
  searchParams
}: {
  searchParams?: Promise<{ created?: string; week?: string; period?: string; status?: string }>;
}) {
  const params = await searchParams;
  const allInspections = await getInspectionSummaries();
  let inspections = allInspections;
  let title = "Alle keuringen";

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
    title = "Keuringen deze week";
  }

  if (params?.status === "draft") {
    inspections = inspections.filter((inspection) => inspection.status === "draft");
    title = "Keuringen in behandeling";
  }

  if (params?.period === "month") {
    const monthPrefix = new Date().toISOString().slice(0, 7);
    inspections = inspections.filter((inspection) => inspection.inspectionDate.startsWith(monthPrefix));
    title = "Keuringen deze maand";
  }

  if (params?.period === "day") {
    const today = new Date().toISOString().slice(0, 10);
    inspections = inspections.filter((inspection) => inspection.inspectionDate === today);
    title = "Keuringen van vandaag";
  }

  if (params?.period === "week") {
    const now = new Date();
    const monday = new Date(now);
    const day = (monday.getDay() + 6) % 7;
    monday.setDate(monday.getDate() - day);
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(sunday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    inspections = inspections.filter((inspection) => {
      const inspectionDate = new Date(inspection.inspectionDate);
      return inspectionDate >= monday && inspectionDate <= sunday;
    });
    title = "Keuringen deze week";
  }

  const customerIds = Array.from(new Set(inspections.map((inspection) => inspection.customerId)));
  const machineIds = Array.from(new Set(inspections.map((inspection) => inspection.machineId)));
  const [customers, machines, attachments] = await Promise.all([
    getCustomerSummaries({ ids: customerIds }),
    getMachineSummaries({ ids: machineIds, includeArchived: true }),
    getInspectionAttachmentsForInspections(inspections.map((inspection) => inspection.id))
  ]);

  return (
    <section className="panel">
      <div className="eyebrow">Overzicht keuringen</div>
      <h1>{title}</h1>
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
