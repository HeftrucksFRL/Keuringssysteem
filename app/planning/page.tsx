import { PlanningCreateForm } from "@/components/planning-create-form";
import { PlanningCalendar } from "@/components/planning-calendar";
import { requireUser } from "@/lib/auth";
import {
  getAgendaEvents,
  getCustomers,
  getMachines,
  getPlanningItems,
  getRentals
} from "@/lib/inspection-service";

export default async function PlanningPage({
  searchParams
}: {
  searchParams?: Promise<{
    month?: string;
    planned?: string;
    appointment?: string;
    updated?: string;
    deleted?: string;
    error?: string;
  }>;
}) {
  const user = await requireUser();
  const [rows, customers, machines, rentals, agendaEvents] = await Promise.all([
    getPlanningItems(),
    getCustomers(),
    getMachines(),
    getRentals(),
    getAgendaEvents(String(user?.id ?? "demo-user"))
  ]);
  const params = await searchParams;

  return (
    <>
      {params?.planned ? (
        <p className="form-message success">Keuring is toegevoegd aan de agenda.</p>
      ) : null}
      {params?.appointment ? (
        <p className="form-message success">Afspraak is toegevoegd aan de agenda.</p>
      ) : null}
      {params?.updated ? (
        <p className="form-message success">Planning is bijgewerkt.</p>
      ) : null}
      {params?.deleted ? (
        <p className="form-message success">Afspraak of planning is verwijderd.</p>
      ) : null}
      {params?.error ? <p className="form-message error">{params.error}</p> : null}

      <PlanningCalendar
        items={rows}
        rentals={rentals}
        agendaEventItems={agendaEvents}
        customers={customers}
        machines={machines}
        initialMonth={params?.month}
      >
        <PlanningCreateForm
          customers={customers}
          machines={machines}
          initialMonth={params?.month}
        />
      </PlanningCalendar>
    </>
  );
}
