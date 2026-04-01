import { getInspections, getMachines, getVisibleCustomers } from "@/lib/inspection-service";
import { CustomersTable } from "@/components/customers-table";
import Link from "next/link";

export default async function CustomersPage() {
  const customers = await getVisibleCustomers();
  const inspections = await getInspections();
  const machines = await getMachines();

  return (
    <section className="panel">
      <div className="eyebrow">Klantenbestand</div>
      <h1>Klanten</h1>
      <div className="actions" style={{ marginTop: "0.75rem", marginBottom: "1rem" }}>
        <Link className="button" href="/klanten/nieuw">
          Klant toevoegen
        </Link>
      </div>
      <CustomersTable customers={customers} machines={machines} inspections={inspections} />
    </section>
  );
}
