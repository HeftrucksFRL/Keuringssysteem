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

function formatMonthLabel(monthKey: string) {
  const [year, month] = monthKey.split("-");
  const parsedYear = Number(year);
  const parsedMonth = Number(month);

  if (!parsedYear || !parsedMonth) {
    return monthKey;
  }

  return new Intl.DateTimeFormat("nl-NL", {
    month: "long",
    year: "numeric"
  }).format(new Date(parsedYear, parsedMonth - 1, 1));
}

function rentalMonthKey(rental: { startDate: string; endDate: string; status: "active" | "completed" }) {
  const phase = rentalPhase(rental);
  const anchor = phase === "completed" ? rental.endDate : rental.startDate;
  return anchor?.slice(0, 7) || "Onbekend";
}

function groupRentalsByYearAndMonth<
  TRental extends { startDate: string; endDate: string; status: "active" | "completed" }
>(rentals: TRental[]) {
  const yearMap = new Map<string, Map<string, TRental[]>>();

  rentals.forEach((rental) => {
    const monthKey = rentalMonthKey(rental);
    const yearKey = monthKey.slice(0, 4) || "Onbekend";

    if (!yearMap.has(yearKey)) {
      yearMap.set(yearKey, new Map<string, TRental[]>());
    }

    const monthMap = yearMap.get(yearKey)!;
    const rows = monthMap.get(monthKey) ?? [];
    rows.push(rental);
    monthMap.set(monthKey, rows);
  });

  return Array.from(yearMap.entries())
    .sort(([left], [right]) => right.localeCompare(left, "nl"))
    .map(([year, monthMap]) => ({
      year,
      months: Array.from(monthMap.entries())
        .sort(([left], [right]) => right.localeCompare(left, "nl"))
        .map(([monthKey, rows]) => ({
          monthKey,
          monthLabel: formatMonthLabel(monthKey),
          rows
        }))
    }));
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

  const machineById = new Map(stockMachines.map((machine) => [machine.id, machine]));
  const customerById = new Map(customers.map((customer) => [customer.id, customer]));

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
                <input
                  id="startDate"
                  name="startDate"
                  type="date"
                  defaultValue={new Date().toISOString().slice(0, 10)}
                />
              </div>
              <div className="field">
                <label htmlFor="endDate">Einddatum</label>
                <input
                  id="endDate"
                  name="endDate"
                  type="date"
                  defaultValue={new Date().toISOString().slice(0, 10)}
                />
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

      {visibleGroups.map((group, groupIndex) => {
        const archiveGroups = groupRentalsByYearAndMonth(group.rows);

        return (
          <section key={group.key} style={{ marginTop: "1rem" }}>
            <div className="eyebrow">{group.title}</div>
            {group.rows.length === 0 ? (
              <div className="dataset-list" style={{ marginTop: "0.75rem" }}>
                <div className="dataset-row compact-overview-row">
                  <strong>Geen verhuur</strong>
                  <span className="compact-overview-detail">
                    Hier verschijnen straks de relevante verhuurregels.
                  </span>
                  <span />
                </div>
              </div>
            ) : (
              <div className="archive-stack" style={{ marginTop: "0.75rem" }}>
                {archiveGroups.map((yearGroup, yearIndex) => (
                  <details
                    className="archive-folder archive-year-folder"
                    key={`${group.key}-${yearGroup.year}`}
                    open={groupIndex === 0 || query?.phase !== undefined || yearIndex === 0}
                  >
                    <summary className="archive-summary">
                      <span className="archive-summary-main">
                        <strong>{yearGroup.year}</strong>
                        <span className="archive-summary-meta">
                          {yearGroup.months.reduce((count, month) => count + month.rows.length, 0)}{" "}
                          verhuurregels
                        </span>
                      </span>
                      <span className="archive-summary-meta">
                        {yearGroup.months.length} maanden
                      </span>
                    </summary>
                    <div className="archive-folder-content">
                      {yearGroup.months.map((monthGroup, monthIndex) => (
                        <details
                          className="archive-folder archive-month-folder"
                          key={monthGroup.monthKey}
                          open={yearIndex === 0 && monthIndex === 0}
                        >
                          <summary className="archive-summary">
                            <span className="archive-summary-main">
                              <strong>{monthGroup.monthLabel}</strong>
                              <span className="archive-summary-meta">
                                {monthGroup.rows.length} verhuurregels
                              </span>
                            </span>
                          </summary>
                          <div className="archive-folder-content">
                            <div className="dataset-list">
                              {monthGroup.rows.map((rental) => {
                                const machine = machineById.get(rental.machineId);
                                const customer = customerById.get(rental.customerId) ?? null;
                                const phase = rentalPhase(rental);
                                const machineLabel =
                                  [machine?.brand, machine?.model].filter(Boolean).join(" ") ||
                                  machine?.machineNumber ||
                                  "Machine";
                                const machineNumber =
                                  machine?.internalNumber || machine?.machineNumber || "-";
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
                                    style={
                                      phase === "active"
                                        ? { background: "#ecfdf3", borderColor: "#abefc6" }
                                        : undefined
                                    }
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
                              })}
                            </div>
                          </div>
                        </details>
                      ))}
                    </div>
                  </details>
                ))}
              </div>
            )}
          </section>
        );
      })}
    </section>
  );
}
