import Link from "next/link";
import type { UrlObject } from "node:url";
import {
  getDashboardData,
  getMachines,
  getPlanningItems,
  getVisibleCustomers
} from "@/lib/inspection-service";

export default async function HomePage({
  searchParams
}: {
  searchParams?: Promise<{ saved?: string }>;
}) {
  const dashboard = await getDashboardData();
  const params = await searchParams;
  const planning = (await getPlanningItems()).slice(0, 3);
  const machines = await getMachines();
  const customers = await getVisibleCustomers();

  const kpis: { label: string; value: string; helper: string; href: UrlObject }[] = [
    {
      label: "Keuringen in behandeling",
      value: String(dashboard.drafts),
      helper: "Open alleen de lopende keuringen",
      href: { pathname: "/keuringen", query: { status: "draft" } }
    },
    {
      label: "Aantal keuringen deze maand",
      value: String(dashboard.inspectionsThisMonth),
      helper: `${dashboard.inspectionsToday} vandaag · ${dashboard.inspectionsThisWeek} deze week`,
      href: { pathname: "/keuringen", query: { period: "month" } }
    },
    {
      label: "Aantal machines in verhuur",
      value: String(dashboard.activeRentals),
      helper: "Open actieve verhuur",
      href: { pathname: "/verhuur", query: { phase: "active" } }
    }
  ];

  return (
    <>
      <section className="hero">
        <div className="eyebrow">Dashboard</div>
        <h1>Welkom terug</h1>
        <p>Kies hieronder wat je vandaag wilt doen.</p>
        {params?.saved ? (
          <p className="form-message success">Keuring {params.saved} is opgeslagen.</p>
        ) : null}
        <div className="actions">
          <Link className="button" href="/keuringen/nieuw">
            Nieuwe keuring starten
          </Link>
          <Link className="button-secondary" href="/planning">
            Planning openen
          </Link>
        </div>
      </section>

      <section className="panel" style={{ marginTop: "1rem" }}>
        <div className="eyebrow">Overzicht</div>
        <h2>Stand van zaken</h2>
        <div className="list">
          {kpis.map((kpi) => (
            <Link className="list-item" href={kpi.href} key={kpi.label}>
              <span>
                <strong>{kpi.label}</strong>
                <br />
                {kpi.helper}
              </span>
              <strong>{kpi.value}</strong>
            </Link>
          ))}
        </div>
      </section>

      <section className="grid-2" style={{ marginTop: "1rem" }}>
        <article className="panel">
          <div className="eyebrow">Vandaag</div>
          <h2>Snel naar je werk</h2>
          <div className="list">
            <Link className="list-item" href="/keuringen/nieuw">
              <span>Nieuwe keuring</span>
              <strong>Open formulier</strong>
            </Link>
            <Link className="list-item" href={{ pathname: "/keuringen", query: { status: "draft" } }}>
              <span>Keuringen in behandeling</span>
              <strong>{dashboard.drafts}</strong>
            </Link>
            <Link className="list-item" href="/klanten">
              <span>Klanten</span>
              <strong>Open klantbestand</strong>
            </Link>
            <Link className="list-item" href={{ pathname: "/verhuur", query: { phase: "active" } }}>
              <span>Machines in verhuur</span>
              <strong>{dashboard.activeRentals}</strong>
            </Link>
          </div>
        </article>

        <article className="panel">
          <div className="eyebrow">Machines</div>
          <h2>Recent actieve machines</h2>
          <div className="list">
            {machines.slice(0, 4).map((machine) => (
              <Link className="list-item" key={machine.id} href={`/machines/${machine.id}`}>
                <span>
                  <strong>{machine.internalNumber || machine.machineNumber}</strong>
                  <br />
                  {machine.brand} {machine.model}
                </span>
                <span className="badge blue">
                  {customers.find((customer) => customer.id === machine.customerId)?.companyName ?? "-"}
                </span>
              </Link>
            ))}
          </div>
        </article>
      </section>

      <section className="panel" style={{ marginTop: "1rem" }}>
        <div className="eyebrow">Planning</div>
        <h2>Vervolgkeuringen</h2>
        <div className="table-like">
          <div className="table-row table-head">
            <span>Klant / machine</span>
            <span>Deadline</span>
            <span>Status</span>
            <span>Actie</span>
          </div>
          {planning.map((item) => {
            const customer = customers.find((entry) => entry.id === item.customerId);
            const machine = machines.find((entry) => entry.id === item.machineId);

            const planningHref = item.inspectionId
              ? { pathname: `/keuringen/${item.inspectionId}` }
              : { pathname: "/planning", query: { month: item.dueDate.slice(0, 7) } };

            return (
              <Link className="table-row" href={planningHref} key={item.id}>
                <span>
                  <strong>{customer?.companyName ?? "Onbekende klant"}</strong>
                  <br />
                  {machine?.brand ?? "Machine"} {machine?.model ?? ""}
                </span>
                <span>{item.dueDate}</span>
                <span
                  className={`badge ${
                    item.state === "overdue"
                      ? "orange"
                      : item.state === "scheduled"
                        ? "blue"
                        : "green"
                  }`}
                >
                  {item.state === "overdue"
                    ? "Verlopen"
                    : item.state === "scheduled"
                      ? "Gepland"
                      : "Aankomend"}
                </span>
                <span>{item.inspectionId ? "Open keuring" : "Open planning"}</span>
              </Link>
            );
          })}
        </div>
      </section>
    </>
  );
}
