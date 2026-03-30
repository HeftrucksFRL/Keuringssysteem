import Link from "next/link";
import {
  getDashboardData,
  getMachines,
  getPlanningItems,
  getCustomers
} from "@/lib/inspection-service";

export default async function HomePage() {
  const dashboard = await getDashboardData();
  const planning = (await getPlanningItems()).slice(0, 3);
  const machines = await getMachines();
  const customers = await getCustomers();

  const kpis = [
    {
      label: "Openstaande concepten",
      value: String(dashboard.drafts),
      helper: "Autosave en later afronden"
    },
    {
      label: "Keuringen deze maand",
      value: String(dashboard.inspectionsThisMonth),
      helper: "Alle types in één workflow"
    },
    {
      label: "Komende vervolgkeuringen",
      value: String(dashboard.upcoming),
      helper: "Automatisch 12 maanden vooruit"
    }
  ];

  return (
    <>
      <section className="hero">
        <div className="eyebrow">Dashboard</div>
        <h1>Welkom terug</h1>
        <p>Kies hieronder wat je vandaag wilt doen.</p>
        <div className="actions">
          <Link className="button" href="/keuringen/nieuw">
            Nieuwe keuring starten
          </Link>
          <Link className="button-secondary" href="/planning">
            Planning openen
          </Link>
        </div>
      </section>

      <section className="grid-3" style={{ marginTop: "1rem" }}>
        {kpis.map((kpi) => (
          <article className="stat" key={kpi.label}>
            <span className="eyebrow">{kpi.label}</span>
            <strong>{kpi.value}</strong>
            <p className="muted">{kpi.helper}</p>
          </article>
        ))}
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
            <Link className="list-item" href="/klanten">
              <span>Klanten</span>
              <strong>Open klantbestand</strong>
            </Link>
            <Link className="list-item" href="/keuringen">
              <span>Recente keuringen</span>
              <strong>Open overzicht</strong>
            </Link>
          </div>
        </article>
        <article className="panel">
          <div className="eyebrow">Machines</div>
          <h2>Recent actief</h2>
          <div className="list">
            {machines.slice(0, 4).map((machine) => (
              <div className="list-item" key={machine.id}>
                <span>
                  <strong>{machine.internalNumber || machine.machineNumber}</strong>
                  <br />
                  {machine.brand} {machine.model}
                </span>
                <span className="badge blue">
                  {customers.find((customer) => customer.id === machine.customerId)?.companyName ??
                    "-"}
                </span>
              </div>
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
          {planning.map((item) => (
            <div className="table-row" key={item.id}>
              <span>
                <strong>
                  {customers.find((customer) => customer.id === item.customerId)?.companyName ??
                    "Onbekende klant"}
                </strong>
                <br />
                {machines.find((machine) => machine.id === item.machineId)?.brand ?? "Machine"}{" "}
                {machines.find((machine) => machine.id === item.machineId)?.model ?? ""}
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
              <span>Open dossier</span>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
