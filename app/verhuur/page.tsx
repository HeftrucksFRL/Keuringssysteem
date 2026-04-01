import Link from "next/link";
import { completeRentalAction } from "@/app/verhuur/actions";
import { getCustomers, getMachines, getRentals } from "@/lib/inspection-service";

function rentalPhase(rental: { startDate: string; endDate: string; status: "active" | "completed" }) {
  const today = new Date().toISOString().slice(0, 10);
  if (rental.status === "completed" || rental.endDate < today) {
    return "completed" as const;
  }
  if (rental.startDate > today) {
    return "upcoming" as const;
  }
  return "active" as const;
}

function phaseLabel(phase: ReturnType<typeof rentalPhase>) {
  if (phase === "active") {
    return "Actief";
  }
  if (phase === "upcoming") {
    return "Komend";
  }
  return "Afgerond";
}

export default async function RentalsPage() {
  const [rentals, customers, machines] = await Promise.all([
    getRentals(),
    getCustomers(),
    getMachines()
  ]);

  const groups = {
    active: rentals.filter((rental) => rentalPhase(rental) === "active"),
    upcoming: rentals.filter((rental) => rentalPhase(rental) === "upcoming"),
    completed: rentals.filter((rental) => rentalPhase(rental) === "completed")
  };

  return (
    <section className="panel">
      <div className="eyebrow">Verhuur</div>
      <h1>Verhuur</h1>
      <p className="muted">
        Bekijk hier welke machines verhuurd zijn, bij welke klant ze staan en van wanneer tot wanneer.
      </p>

      <div className="grid-3" style={{ marginTop: "1rem", marginBottom: "1rem" }}>
        <article className="stat">
          <span>Actief</span>
          <strong>{groups.active.length}</strong>
        </article>
        <article className="stat">
          <span>Komend</span>
          <strong>{groups.upcoming.length}</strong>
        </article>
        <article className="stat">
          <span>Afgerond</span>
          <strong>{groups.completed.length}</strong>
        </article>
      </div>

      {[
        { key: "active", title: "Actieve verhuur", rows: groups.active },
        { key: "upcoming", title: "Komende verhuur", rows: groups.upcoming },
        { key: "completed", title: "Afgeronde verhuur", rows: groups.completed }
      ].map((group) => (
        <section key={group.key} style={{ marginTop: "1rem" }}>
          <div className="eyebrow">{group.title}</div>
          <div className="dataset-list" style={{ marginTop: "0.75rem" }}>
            {group.rows.length === 0 ? (
              <div className="dataset-row">
                <strong>Geen verhuur in deze lijst</strong>
                <span>Hier verschijnen straks de relevante verhuurregels.</span>
              </div>
            ) : (
              group.rows.map((rental) => {
                const machine = machines.find((item) => item.id === rental.machineId);
                const customer = customers.find((item) => item.id === rental.customerId);
                const phase = rentalPhase(rental);
                const machineLabel =
                  [machine?.brand, machine?.model].filter(Boolean).join(" ") ||
                  machine?.machineNumber ||
                  "Machine";
                const customerLabel = customer?.companyName ?? "Onbekende klant";
                const machineNumber = machine?.internalNumber || machine?.machineNumber || "-";
                const periodLabel = `${rental.startDate} t/m ${rental.endDate}`;

                return (
                  <div className="dataset-row" key={rental.id}>
                    <strong>{machineLabel}</strong>
                    <span>
                      {customerLabel} · {machineNumber} · {periodLabel}
                      {rental.price ? ` · ${rental.price}` : ""}
                    </span>
                    <span className="inline-meta">
                      <span className="status-pill">{phaseLabel(phase)}</span>
                      <Link className="button-secondary" href={`/machines/${rental.machineId}`}>
                        Open machine
                      </Link>
                      <Link className="button-secondary" href={`/klanten/${rental.customerId}`}>
                        Open klant
                      </Link>
                      {phase !== "completed" ? (
                        <form action={completeRentalAction}>
                          <input type="hidden" name="rentalId" value={rental.id} />
                          <input type="hidden" name="machineId" value={rental.machineId} />
                          <button className="button-secondary" type="submit">
                            Verhuur afronden
                          </button>
                        </form>
                      ) : null}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </section>
      ))}
    </section>
  );
}
