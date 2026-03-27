import { getCustomers, getMachines, getPlanningItems } from "@/lib/inspection-service";

export default async function PlanningPage() {
  const rows = await getPlanningItems();
  const customers = await getCustomers();
  const machines = await getMachines();

  return (
    <section className="panel">
      <div className="eyebrow">Planning</div>
      <h1>Vervolgkeuringen</h1>
      <div className="list">
        {rows.map((row) => (
          <div className="list-item" key={row.id}>
            <div>
              <strong>
                {machines.find((machine) => machine.id === row.machineId)?.brand ?? "Machine"}{" "}
                {machines.find((machine) => machine.id === row.machineId)?.model ?? ""}
              </strong>
              <div className="muted">
                {customers.find((customer) => customer.id === row.customerId)?.companyName ?? "-"}
              </div>
            </div>
            <div className="inline-meta">
              <span className="badge blue">{row.dueDate}</span>
              <span className={`badge ${row.state === "overdue" ? "orange" : "blue"}`}>
                {row.state === "overdue"
                  ? "Verlopen"
                  : row.state === "scheduled"
                    ? "Gepland"
                    : "Aankomend"}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
