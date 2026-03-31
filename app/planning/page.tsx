import { PlanningCalendar } from "@/components/planning-calendar";
import { getCustomers, getMachines, getPlanningItems } from "@/lib/inspection-service";

export default async function PlanningPage({
  searchParams
}: {
  searchParams?: Promise<{ month?: string }>;
}) {
  const rows = await getPlanningItems();
  const customers = await getCustomers();
  const machines = await getMachines();
  const params = await searchParams;

  return (
    <PlanningCalendar
      items={rows}
      customers={customers}
      machines={machines}
      initialMonth={params?.month}
    />
  );
}
