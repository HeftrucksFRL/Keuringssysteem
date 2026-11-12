import {
  getCustomers,
  isCustomerArchived,
  isRentalStockCustomer,
  isMachineHistoryCustomer,
  getInspectionCustomerDates,
  getMachineSummaries
} from "@/lib/inspection-service";
import { CustomersTable } from "@/components/customers-table";
import Link from "next/link";

export default async function CustomersPage({
  searchParams
}: {
  searchParams?: Promise<{ deleted?: string }>;
}) {
  const query = await searchParams;
  const [allCustomers, inspections, machines] = await Promise.all([
    getCustomers(),
    getInspectionCustomerDates(),
    getMachineSummaries()
  ]);

  const visibleCustomers=allCustomers.filter(customer=>!isRentalStockCustomer(customer)&&!isMachineHistoryCustomer(customer));
  const customers=visibleCustomers.filter(customer=>!isCustomerArchived(customer));
  const archivedCustomers=visibleCustomers.filter(isCustomerArchived);

  return (
    <section className="panel">
      <div className="eyebrow">Klantenbestand</div>
      <h1>Klanten</h1>
      {query?.deleted ? <p className="form-message success">Dubbele klant verwijderd.</p> : null}
      <div className="actions" style={{ marginTop: "0.75rem", marginBottom: "1rem" }}>
        <Link className="button" href="/klanten/nieuw">
          Klant toevoegen
        </Link>
        <Link className="button-secondary" href="/klanten/archief">
          Archiefbak ({archivedCustomers.length})
        </Link>
      </div>
      <CustomersTable customers={customers} machines={machines.map(({customerId})=>({customerId}))} inspections={inspections} />
    </section>
  );
}
