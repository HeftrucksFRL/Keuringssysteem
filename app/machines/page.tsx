import { getCustomers, getMachines } from "@/lib/inspection-service";
import { MachinesTable } from "@/components/machines-table";
import Link from "next/link";

export default async function MachinesPage() {
  const machines = await getMachines();
  const customers = await getCustomers();

  return (
    <section className="panel">
      <div className="eyebrow">Machinebestand</div>
      <h1>Machines</h1>
      <div className="actions" style={{ marginTop: "0.75rem", marginBottom: "1rem" }}>
        <Link className="button" href="/machines/nieuw">
          Machine toevoegen
        </Link>
      </div>
      <MachinesTable machines={machines} customers={customers} />
    </section>
  );
}
