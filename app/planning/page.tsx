import { NewAgendaWorkspace } from "@/components/new-agenda-workspace";
import { PlanningCalendar } from "@/components/planning-calendar";
import { PlanningCreateForm } from "@/components/planning-create-form";
import { requireUser } from "@/lib/auth";
import {
  getAgendaEvents,
  getCustomerSummaries,
  getMachineSummaries,
  getPlanningItems,
  getRentals
} from "@/lib/inspection-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PlanningPage({
  searchParams
}: {
  searchParams?: Promise<{
    customer?: string;
    error?: string;
    from?: string;
    moved?: string;
    period?: string;
    place?: string;
    q?: string;
    scheduled?: string;
    status?: string;
    to?: string;
  }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const [planningItems, customers, machines, rentals, agendaEvents] = await Promise.all([
    getPlanningItems(),
    getCustomerSummaries({ visibleOnly: true }),
    getMachineSummaries(),
    getRentals(),
    getAgendaEvents(String(user?.id ?? "demo-user"))
  ]);

  return (
    <>
      {params?.scheduled ? (
        <p className="form-message success">Keuring is ingepland.</p>
      ) : null}
      {params?.moved ? (
        <p className="form-message success">Verwachte keuring is verplaatst.</p>
      ) : null}
      {params?.error ? <p className="form-message error">{params.error}</p> : null}
      <NewAgendaWorkspace
        customers={customers}
        machines={machines}
        planningItems={planningItems}
        initialFilters={{
          customerId: params?.customer ?? "",
          from: params?.from ?? "",
          period: params?.period ?? "",
          place: params?.place ?? "",
          query: params?.q ?? "",
          status: params?.status ?? "",
          to: params?.to ?? ""
        }}
      >
        <PlanningCalendar
          items={planningItems}
          rentals={rentals}
          agendaEventItems={agendaEvents}
          customers={customers}
          machines={machines}
        >
          <PlanningCreateForm customers={customers} machines={machines} />
        </PlanningCalendar>
      </NewAgendaWorkspace>
    </>
  );
}
