import { NewAgendaWorkspace } from "@/components/new-agenda-workspace";
import { PlanningCalendar } from "@/components/planning-calendar";
import { PlanningCreateForm } from "@/components/planning-create-form";
import { requireUser } from "@/lib/auth";
import {
  getCustomerSummaries,
  getMachineSummaries,
  getPlanningItems
} from "@/lib/inspection-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PlanningPage({
  searchParams
}: {
  searchParams?: Promise<{
    month?: string;
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
  await requireUser();
  const params = await searchParams;
  const [planningItems, customers, machines] = await Promise.all([
    getPlanningItems(),
    getCustomerSummaries({ visibleOnly: true }),
    getMachineSummaries()
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
          initialMonth={params?.month}
          scope="inspections"
          items={planningItems}
          rentals={[]}
          agendaEventItems={[]}
          customers={customers}
          machines={machines}
        >
          <PlanningCreateForm mode="inspection" customers={customers} machines={machines} initialMonth={params?.month} />
        </PlanningCalendar>
      </NewAgendaWorkspace>
    </>
  );
}
