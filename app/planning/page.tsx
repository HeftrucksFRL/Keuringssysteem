import { PlanningCreateForm } from "@/components/planning-create-form";
import { PlanningCalendar } from "@/components/planning-calendar";
import { getMachines, getPlanningItems, getRentals, getVisibleCustomers } from "@/lib/inspection-service";

export default async function PlanningPage({
  searchParams
}: {
  searchParams?: Promise<{ month?: string; planned?: string; updated?: string; error?: string }>;
}) {
  const [rows, customers, machines, rentals] = await Promise.all([
    getPlanningItems(),
    getVisibleCustomers(),
    getMachines(),
    getRentals()
  ]);
  const params = await searchParams;

  return (
    <>
      {params?.planned ? (
        <p className="form-message success">Keuring is toegevoegd aan de agenda.</p>
      ) : null}
      {params?.updated ? (
        <p className="form-message success">Planning is bijgewerkt.</p>
      ) : null}
      {params?.error ? <p className="form-message error">{params.error}</p> : null}

      <PlanningCreateForm
        customers={customers}
        machines={machines}
        initialMonth={params?.month}
      />

      <PlanningCalendar
        items={rows}
        rentals={rentals}
        customers={customers}
        machines={machines}
        initialMonth={params?.month}
      />
    </>
  );
}
