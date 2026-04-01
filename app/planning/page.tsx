import { PlanningCreateForm } from "@/components/planning-create-form";
import { PlanningCalendar } from "@/components/planning-calendar";
import { getCustomers, getMachines, getPlanningItems } from "@/lib/inspection-service";

export default async function PlanningPage({
  searchParams
}: {
  searchParams?: Promise<{ month?: string; planned?: string; error?: string }>;
}) {
  const rows = await getPlanningItems();
  const customers = await getCustomers();
  const machines = await getMachines();
  const params = await searchParams;

  return (
    <>
      {params?.planned ? (
        <p className="form-message success">Keuring is toegevoegd aan de agenda.</p>
      ) : null}
      {params?.error ? <p className="form-message error">{params.error}</p> : null}

      <PlanningCreateForm
        customers={customers}
        machines={machines}
        initialMonth={params?.month}
      />

      <PlanningCalendar
        items={rows}
        customers={customers}
        machines={machines}
        initialMonth={params?.month}
      />
    </>
  );
}
