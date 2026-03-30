import { getCustomers, getInspections, getMachines } from "@/lib/inspection-service";
import { MachinesTable } from "@/components/machines-table";

export default async function MachinesPage() {
  const machines = await getMachines();
  const customers = await getCustomers();
  const inspections = await getInspections();

  return (
    <section className="panel">
      <div className="eyebrow">Machinebestand</div>
      <h1>Machines</h1>
      <MachinesTable machines={machines} customers={customers} inspections={inspections} />
    </section>
  );
}
