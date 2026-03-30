import { getCustomers, getInspections, getMachines } from "@/lib/inspection-service";
import { CustomersTable } from "@/components/customers-table";

export default async function CustomersPage() {
  const customers = await getCustomers();
  const inspections = await getInspections();
  const machines = await getMachines();

  return (
    <section className="panel">
      <div className="eyebrow">Klantenbestand</div>
      <h1>Klanten</h1>
      <CustomersTable customers={customers} machines={machines} inspections={inspections} />
    </section>
  );
}
