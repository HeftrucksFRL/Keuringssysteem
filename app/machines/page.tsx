import { getCustomers, getMachines } from "@/lib/inspection-service";
import { MachinesTable } from "@/components/machines-table";

export default async function MachinesPage() {
  const machines = await getMachines();
  const customers = await getCustomers();

  return (
    <section className="panel">
      <div className="eyebrow">Machinebestand</div>
      <h1>Machines</h1>
      <MachinesTable machines={machines} customers={customers} />
    </section>
  );
}
