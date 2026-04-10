import Link from "next/link";
import { completeRentalAction, createRentalAction } from "@/app/verhuur/actions";
import { CustomerPicker } from "@/components/customer-picker";
import { RentalStockList } from "@/components/rental-stock-list";
import {
  getCustomerDisplayName,
  getRentalStockMachines,
  getRentals,
  getVisibleCustomers,
  stockOwnerLabel
} from "@/lib/inspection-service";

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
  if (phase === "active") return "Actief";
  if (phase === "upcoming") return "Komend";
  return "Afgerond";
}

function statusBadgeStyle(phase: ReturnType<typeof rentalPhase>) {
  if (phase === "active") {
    return { background: "#dff6ec", color: "#0d8d59" };
  }
  if (phase === "upcoming") {
    return { background: "#e6f0ff", color: "#175cd3" };
  }
  return { background: "#f2f4f7", color: "#344054" };
}

export default async function RentalsPage({
  searchParams
}: {
  searchParams?: Promise<{ rented?: string; returned?: string; error?: string; phase?: string }>;
}) {
  const query = await searchParams;
  const [rentals, customers, stockMachines] = await Promise.all([
    getRentals(),
    getVisibleCustomers(),
    getRentalStockMachines()
  ]);

  const groups = {
    active: rentals.filter((rental) => rentalPhase(rental) === "active"),
    upcoming: rentals.filter((rental) => rentalPhase(rental) === "upcoming"),
    completed: rentals.filter((rental) => rentalPhase(rental) === "completed")
  };

  const visibleGroups =
    query?.phase === "active"
      ? [{ key: "active", title: "Actieve verhuur", rows: groups.active }]
      : query?.phase === "upcoming"
        ? [{ key: "upcoming", title: "Komende verhuur", rows: groups.upcoming }]
        : query?.phase === "completed"
          ? [{ key: "completed", title: "Afgeronde verhuur", rows: groups.completed }]
          : [
              { key: "active", title: "Actieve verhuur", rows: groups.active },
              { key: "upcoming", title: "Komende verhuur", rows: groups.upcoming },
              { key: "completed", title: "Afgeronde verhuur", rows: groups.completed }
            ];

  return (
    <section className="panel">
      <div className="eyebrow">Verhuur</div>
      <h1>Verhuur</h1>
      <p className="muted">
        Beheer hier de voorraadmachines van Heftrucks Friesland en zet ze direct in verhuur.
      </p>
      {query?.rented ? <p className="form-message success">Verhuur gestart.</p> : null}
      {query?.returned ? <p className="form-message success">Verhuur afgerond.</p> : null}
      {query?.error ? <p className="form-message error">{decodeURIComponent(query.error)}</p> : null}

      <section className="panel" style={{ marginTop: "1rem" }}>
        <div className="eyebrow">Nieuwe verhuur</div>
        <div className="form-block">
          <form action={createRentalAction}>
            <input type="hidden" name="returnTo" value="/verhuur" />
            <div className="form-grid-wide">
              <div className="field">
                <label htmlFor="rental-machine">Voorraadmachine</label>
                <select id="rental-machine" name="machineId" defaultValue="">
                  <option value="" disabled>
                    Kies een machine uit de voorraad
                  </option>
                  {stockMachines.map((machine) => {
                    const activeRental = groups.active.find((rental) => rental.machineId === machine.id);
                    return (
                      <option key={machine.id} value={machine.id}>
                        {(machine.internalNumber || machine.machineNumber) +
                          " | " +
                          [machine.brand, machine.model].filter(Boolean).join(" ") +
                          (activeRental ? " | al in verhuur" : "")}
                      </option>
                    );
                  })}
                </select>
              </div>
              <CustomerPicker customers={customers} label="Verhuren aan klant" required />
              <div className="field">
                <label htmlFor="startDate">Startdatum</label>
                <input id="startDate" name="startDate" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
              </div>
              <div className="field">
                <label htmlFor="endDate">Einddatum</label>
                <input id="endDate" name="endDate" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
              </div>
              <div className="field">
                <label htmlFor="price">Prijs</label>
                <input id="price" name="price" placeholder="Bijv. EUR 350 totaal" />
              </div>
            </div>
            <div className="actions" style={{ marginTop: "0.75rem" }}>
              <button className="button" type="submit">
                Start verhuur
              </button>
            </div>
          </form>
        </div>
      </section>

      <section style={{ marginTop: "1rem" }}>
        <div className="eyebrow">Voorraad</div>
        <RentalStockList
          customers={customers}
          rentals={rentals}
          stockMachines={stockMachines}
          stockOwnerLabel={stockOwnerLabel()}
        />
      </section>

      {visibleGroups.map((group) => (
        <section key={group.key} style={{ marginTop: "1rem" }}>
          <div className="eyebrow">{group.title}</div>
          <div className="dataset-list" style={{ marginTop: "0.75rem" }}>
            {group.rows.length === 0 ? (
              <div className="dataset-row compact-overview-row">
                <strong>Geen verhuur</strong>
                <span className="compact-overview-detail">
                  Hier verschijnen straks de relevante verhuurregels.
                </span>
                <span />
              </div>
            ) : (
              group.rows.map((rental) => {
                const machine = stockMachines.find((item) => item.id === rental.machineId);
                const customer = customers.find((item) => item.id === rental.customerId) ?? null;
                const phase = rentalPhase(rental);
                const machineLabel =
                  [machine?.brand, machine?.model].filter(Boolean).join(" ") ||
                  machine?.machineNumber ||
                  "Machine";
                const machineNumber = machine?.internalNumber || machine?.machineNumber || "-";
                const detailLine = [
                  getCustomerDisplayName(customer),
                  machineNumber,
                  `${rental.startDate} t/m ${rental.endDate}`,
                  rental.price || ""
                ]
                  .filter(Boolean)
                  .join(" | ");

                return (
                  <div
                    className="dataset-row compact-overview-row"
                    key={rental.id}
                    style={phase === "active" ? { background: "#ecfdf3", borderColor: "#abefc6" } : undefined}
                  >
                    <strong>{machineLabel}</strong>
                    <span className="compact-overview-detail">{detailLine}</span>
                    <span className="compact-overview-actions">
                      <span className="badge" style={statusBadgeStyle(phase)}>
                        {phaseLabel(phase)}
                      </span>
                      <Link className="button-secondary" href={`/machines/${rental.machineId}`}>
                        Machine
                      </Link>
                      <Link className="button-secondary" href={`/klanten/${rental.customerId}`}>
                        Klant
                      </Link>
                      {phase !== "completed" ? (
                        <form action={completeRentalAction}>
                          <input type="hidden" name="rentalId" value={rental.id} />
                          <input type="hidden" name="machineId" value={rental.machineId} />
                          <button className="button-secondary" type="submit">
                            Afronden
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
