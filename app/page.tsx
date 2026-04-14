import Link from "next/link";
import type { UrlObject } from "node:url";
import {
  addTodoItemAction,
  deleteTodoItemAction,
  updateTodoItemAction
} from "@/app/dashboard-actions";
import { canViewActivityLog, requireUser } from "@/lib/auth";
import {
  getRecentActivityLogs,
  getCustomerDisplayName,
  getDashboardData,
  getCustomers,
  getFailedMailAlerts,
  getMachines,
  getPlanningItems,
  getTodoItems
} from "@/lib/inspection-service";
import { getPlanningDisplayLabel, getPlanningDisplayState } from "@/lib/planning";

function buildTodoNote(title: string, description?: string | null) {
  const trimmedTitle = title.trim();
  const trimmedDescription = description?.trim() ?? "";

  if (!trimmedDescription) {
    return trimmedTitle;
  }

  return `${trimmedTitle} - ${trimmedDescription}`;
}

function formatActivityAction(action: string) {
  const labels: Record<string, string> = {
    "inspection.created": "Keuring aangemaakt",
    "inspection.updated": "Keuring bijgewerkt",
    "inspection.resent": "Keuring opnieuw gemaild",
    "customer.created": "Klant toegevoegd",
    "customer.updated": "Klant bijgewerkt",
    "customer_contact.created": "Contactpersoon toegevoegd",
    "customer_contact.updated": "Contactpersoon bijgewerkt",
    "customer_contact.deleted": "Contactpersoon verwijderd",
    "machine.created": "Machine toegevoegd",
    "machine.updated": "Machine bijgewerkt",
    "machine.assigned": "Machine gekoppeld",
    "machine.stocked": "Machine naar voorraad",
    "machine.archived": "Machine gearchiveerd",
    "machine.unarchived": "Archief ongedaan gemaakt",
    "battery_lader.linked": "Batterij/lader gekoppeld",
    "battery_lader.unlinked": "Batterij/lader losgekoppeld",
    "battery_lader.archived": "Batterij/lader gearchiveerd",
    "rental.created": "Verhuur gestart",
    "rental.updated": "Verhuur bijgewerkt",
    "rental.completed": "Verhuur afgerond",
    "planning.created": "Planning toegevoegd",
    "planning.updated": "Planning bijgewerkt",
    "agenda.created": "Afspraak toegevoegd",
    "agenda.updated": "Afspraak bijgewerkt",
    "agenda.deleted": "Afspraak verwijderd",
    "todo.created": "Notitie toegevoegd",
    "todo.updated": "Notitie bijgewerkt",
    "todo.deleted": "Notitie verwijderd",
    "todo.completed": "Notitie afgerond"
  };

  return labels[action] ?? action;
}

function formatActivityMoment(value: string) {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat("nl-NL", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export default async function HomePage({
  searchParams
}: {
  searchParams?: Promise<{ saved?: string; todo?: string }>;
}) {
  const user = await requireUser();
  const showActivityLog = canViewActivityLog(user);
  const dashboard = await getDashboardData();
  const params = await searchParams;
  const [planningRows, machines, customers, failedMailAlerts, todoItems, activityLogs] = await Promise.all([
    getPlanningItems(),
    getMachines(),
    getCustomers(),
    getFailedMailAlerts(),
    getTodoItems(String(user?.id ?? "demo-user")),
    showActivityLog ? getRecentActivityLogs(8) : Promise.resolve([])
  ]);
  const planning = planningRows.slice(0, 3);
  const todoMessage = {
    added: "Notitie toegevoegd.",
    updated: "Notitie bijgewerkt.",
    deleted: "Notitie verwijderd.",
    error: "Notitie kon niet worden opgeslagen. Controleer de invoer."
  }[params?.todo ?? ""];

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
      helper: `${dashboard.inspectionsToday} vandaag | ${dashboard.inspectionsThisWeek} deze week`,
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
        {todoMessage ? (
          <p className={`form-message ${params?.todo === "error" ? "error" : "success"}`}>{todoMessage}</p>
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

      <section className="grid-2 dashboard-summary-grid" style={{ marginTop: "1rem" }}>
        <article className="panel">
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
        </article>

        <article className="panel todo-panel">
          <div className="eyebrow">Things-To-Do</div>
          <form action={addTodoItemAction} className="todo-inline-form">
            <input
              aria-label="Nieuwe notitie"
              id="todo-title"
              name="title"
              placeholder="Nieuwe notitie toevoegen"
              required
            />
            <button className="button todo-inline-button" type="submit">
              Toevoegen
            </button>
          </form>

          <div className="list todo-list compact-list">
            {todoItems.length === 0 ? (
              <div className="list-item static-list-item">
                <span>Nog niets toegevoegd.</span>
                <strong>Leeg</strong>
              </div>
            ) : (
              todoItems.map((item) => (
                <form
                  action={updateTodoItemAction}
                  className={`todo-item-inline ${item.completed ? "todo-item-inline-done" : ""}`}
                  key={item.id}
                >
                  <input type="hidden" name="id" value={item.id} />
                  <input type="hidden" name="completed" value={String(item.completed)} />
                  <input
                    aria-label={`Notitie ${item.id}`}
                    className="todo-inline-input"
                    name="title"
                    defaultValue={buildTodoNote(item.title, item.description)}
                    title="Druk op Enter om de notitie bij te werken"
                    required
                  />
                  <button
                    className="button-secondary todo-inline-button"
                    formAction={deleteTodoItemAction}
                    type="submit"
                  >
                    Verwijderen
                  </button>
                </form>
              ))
            )}
          </div>
        </article>
      </section>

      {failedMailAlerts.length > 0 ? (
        <section className="panel" style={{ marginTop: "1rem" }}>
          <div className="eyebrow">Mailcontrole</div>
          <h2>Mislukte mailverzoeken</h2>
          <div className="list">
            {failedMailAlerts.map((alert) => (
              <Link className="list-item" href={`/keuringen/${alert.inspectionId}`} key={alert.id}>
                <span>
                  <strong>Keuring {alert.inspectionNumber}</strong>
                  <br />
                  {alert.channel === "internal" ? "Interne mail" : "Klantmail"} naar {alert.recipient}
                </span>
                <strong>Controleren</strong>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {showActivityLog ? (
        <section className="panel" style={{ marginTop: "1rem" }}>
        <div className="eyebrow">Audittrail</div>
        <h2>Recente activiteiten</h2>
        <div className="list">
          {activityLogs.length === 0 ? (
            <div className="list-item static-list-item">
              <span>Nog geen activiteiten zichtbaar.</span>
              <strong>Leeg</strong>
            </div>
          ) : (
            activityLogs.map((activity) => (
              <div className="list-item static-list-item" key={activity.id}>
                <span>
                  <strong>{formatActivityAction(activity.action)}</strong>
                  <br />
                  {activity.targetLabel} | {activity.actorName || activity.actorEmail || "Onbekend"}
                </span>
                <strong>{formatActivityMoment(activity.createdAt)}</strong>
              </div>
            ))
          )}
        </div>
        </section>
      ) : null}

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
                  {getCustomerDisplayName(customers.find((customer) => customer.id === machine.customerId) ?? null)}
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
                  <strong>{customer ? getCustomerDisplayName(customer) : "Onbekende klant"}</strong>
                  <br />
                  {machine?.brand ?? "Machine"} {machine?.model ?? ""}
                </span>
                <span>{item.dueDate}</span>
                <span
                  className={`badge ${
                    getPlanningDisplayState(item) === "overdue"
                      ? "orange"
                      : getPlanningDisplayState(item) === "scheduled"
                        ? "blue"
                        : "green"
                  }`}
                >
                  {getPlanningDisplayLabel(item)}
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
