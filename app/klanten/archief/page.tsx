import Link from "next/link";
import { CustomersTable } from "@/components/customers-table";
import {
  getArchivedCustomers,
  getInspectionSummaries,
  getMachineSummaries
} from "@/lib/inspection-service";

export default async function CustomerArchivePage({
  searchParams
}: {
  searchParams?: Promise<{ archived?: string }>;
}) {
  const query = await searchParams;
  const [customers, inspections, machines] = await Promise.all([
    getArchivedCustomers(),
    getInspectionSummaries(),
    getMachineSummaries({ includeArchived: true })
  ]);

  return (
    <section className="panel">
      <div className="eyebrow">Klantenbestand</div>
      <h1>Archiefbak klanten</h1>
      <p className="muted">
        Gearchiveerde klanten blijven met alle machines en keuringshistorie bewaard.
      </p>
      {query?.archived ? <p className="form-message success">Klant gearchiveerd.</p> : null}
      <div className="actions" style={{ marginTop: "0.75rem", marginBottom: "1rem" }}>
        <Link className="button-secondary" href="/klanten">
          Terug naar actieve klanten
        </Link>
      </div>
      <CustomersTable
        customers={customers}
        machines={machines}
        inspections={inspections}
        emptyTitle="De archiefbak is leeg"
        emptyDescription="Gearchiveerde klanten verschijnen hier."
      />
    </section>
  );
}
