import { PlanningCalendar } from "@/components/planning-calendar";
import { getCustomers, getMachines, getPlanningItems } from "@/lib/inspection-service";

export default async function PlanningPage() {
  const rows = await getPlanningItems();
  const customers = await getCustomers();
  const machines = await getMachines();

  return (
    <PlanningCalendar items={rows} customers={customers} machines={machines} />
  );
}
