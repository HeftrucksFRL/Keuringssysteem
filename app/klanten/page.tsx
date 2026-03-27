import { getCustomers, getInspections, getMachines } from "@/lib/inspection-service";

export default async function CustomersPage() {
  const customers = await getCustomers();
  const inspections = await getInspections();
  const machines = await getMachines();

  return (
    <section className="panel">
      <div className="eyebrow">Klantenbestand</div>
      <h1>Klanten</h1>
      <div className="table-like">
        <div className="table-row table-head">
          <span>Naam</span>
          <span>Contact</span>
          <span>Machines</span>
          <span>Laatste keuring</span>
        </div>
        {customers.map((customer) => (
          <div className="table-row" key={customer.id}>
            <span>{customer.companyName}</span>
            <span>{customer.contactName}</span>
            <span>{machines.filter((machine) => machine.customerId === customer.id).length}</span>
            <span>
              {inspections.find((inspection) => inspection.customerId === customer.id)
                ?.inspectionDate ?? "-"}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
