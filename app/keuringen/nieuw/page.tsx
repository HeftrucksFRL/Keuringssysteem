import { InspectionForm } from "@/components/inspection-form";
import {
  getCustomers,
  getInspections,
  getMachines
} from "@/lib/inspection-service";

export default async function NewInspectionPage({
  searchParams
}: {
  searchParams?: Promise<{ customerId?: string; machineId?: string }>;
}) {
  const [customers, machines, inspections] = await Promise.all([
    getCustomers(),
    getMachines(),
    getInspections()
  ]);
  const params = await searchParams;

  return (
    <>
      <section className="hero">
        <div className="eyebrow">Nieuwe keuring</div>
        <h1>Nieuwe keuring</h1>
        <p>Kies klant en machine, controleer de punten en sla de keuring op.</p>
      </section>
      <div style={{ marginTop: "1rem" }}>
        <InspectionForm
          customers={customers}
          machines={machines}
          inspections={inspections}
          defaultCustomerId={params?.customerId}
          defaultMachineId={params?.machineId}
        />
      </div>
    </>
  );
}
