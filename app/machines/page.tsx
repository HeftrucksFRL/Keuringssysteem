import { getCustomers, getMachines, getRentals } from "@/lib/inspection-service";
import { MachinesTable } from "@/components/machines-table";
import Link from "next/link";

export default async function MachinesPage({
  searchParams
}: {
  searchParams?: Promise<{ archived?: string }>;
}) {
  const machines = await getMachines({ includeArchived: true });
  const customers = await getCustomers();
  const rentals = await getRentals();
  const query = await searchParams;

  return (
    <section className="panel">
      <div className="eyebrow">Machinebestand</div>
      <h1>Machines</h1>
      {query?.archived ? <p className="form-message success">Machine is gearchiveerd.</p> : null}
      <div className="actions" style={{ marginTop: "0.75rem", marginBottom: "1rem" }}>
        <Link className="button" href="/machines/nieuw">
          Machine toevoegen
        </Link>
        <Link className="button-secondary" href="/verhuur">
          Verhuur openen
        </Link>
      </div>
      <MachinesTable machines={machines} customers={customers} rentals={rentals} />
    </section>
  );
}
