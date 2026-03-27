import { getCustomers, getInspections, getMachines } from "@/lib/inspection-service";
import { titleCase } from "@/lib/utils";
import Link from "next/link";
import type { Route } from "next";

export default async function MachinesPage() {
  const machines = await getMachines();
  const customers = await getCustomers();
  const inspections = await getInspections();

  return (
    <section className="panel">
      <div className="eyebrow">Machinebestand</div>
      <h1>Machines</h1>
      <p className="muted">
        Elke machine krijgt een uniek intern nummer en houdt zijn volledige keuringshistorie.
      </p>
      <div className="table-like">
        <div className="table-row table-head">
          <span>Nummer</span>
          <span>Klant</span>
          <span>Type</span>
          <span>Laatste keuring</span>
        </div>
        {machines.map((machine) => (
          <div className="table-row" key={machine.id}>
            <span>
              <Link href={`/machines/${machine.id}` as Route}>{machine.machineNumber}</Link>
            </span>
            <span>
              {customers.find((customer) => customer.id === machine.customerId)?.companyName ?? "-"}
            </span>
            <span>{titleCase(machine.machineType)}</span>
            <span>
              {inspections.find((inspection) => inspection.machineId === machine.id)
                ?.inspectionDate ?? "-"}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
