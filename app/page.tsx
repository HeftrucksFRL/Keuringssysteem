import Link from "next/link";
import { previewNextInspectionNumber } from "@/lib/inspection-number";
import { formDefinitions } from "@/lib/form-definitions";
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
        <div className="eyebrow">Mobile-first keuringsapp</div>
        <h1>Digitale keuringen voor intern transportmaterieel</h1>
        <p>
          Deze basis is opgezet voor Next.js op Vercel en Supabase als database,
          storage en workflow-backend. De structuur volgt de aangeleverde formulieren
          en ondersteunt PDF, Word, mail, planning en historie.
        </p>
        <div className="actions">
          <Link className="button" href="/keuringen/nieuw">
            Nieuwe keuring starten
          </Link>
          <Link className="button-secondary" href="/architectuur">
            Architectuur bekijken
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
          <div className="eyebrow">Keurnummerlogica</div>
          <h2>Oplopend per jaar, ongeacht type</h2>
          <p className="muted">
            Voorbeeld voor 2026: <strong>{previewNextInspectionNumber(2026, 26041)}</strong>.
            Voor 2027 start de reeks automatisch op <strong>{previewNextInspectionNumber(2027)}</strong>.
          </p>
        </article>
        <article className="panel">
          <div className="eyebrow">Ondersteunde keuringssoorten</div>
          <div className="list">
            {formDefinitions.map((form) => (
              <div className="list-item" key={form.type}>
                <span>{form.title}</span>
                <span className="badge blue">{form.sections.length} secties</span>
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
