import Link from "next/link";
import type { UrlObject } from "node:url";
import {
  addTodoItemAction,
  deleteTodoItemAction,
  updateTodoItemAction
} from "@/app/dashboard-actions";
import { canViewActivityLog, requireUser } from "@/lib/auth";
import {
  getCustomerSummaries,
  getRecentActivityLogs,
  getCustomerDisplayName,
  getDashboardData,
  getFailedMailAlerts,
  getPlanningPreview,
  getRecentMachineSummaries,
  getTodoItems
} from "@/lib/inspection-service";
import { formatMachineKindBrandType } from "@/lib/machine-presentation";
import { formatDisplayDate, formatDisplayDateTime } from "@/lib/utils";

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
    "inspection.customer_corrected": "Klantkoppeling keuring gecorrigeerd",
    "customer.created": "Klant toegevoegd",
    "customer.updated": "Klant bijgewerkt",
    "customer.archived": "Klant gearchiveerd",
    "customer.restored": "Klant teruggezet uit archief",
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
    "planning.deleted": "Planning verwijderd",
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

  return formatDisplayDateTime(value);
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
  const [planningRows, recentMachines, failedMailAlerts, todoItems, activityLogs] = await Promise.all([
    getPlanningPreview(100),
    getRecentMachineSummaries(4),
    getFailedMailAlerts(),
    getTodoItems(String(user?.id ?? "demo-user")),
    showActivityLog ? getRecentActivityLogs(8) : Promise.resolve([])
  ]);
  const customerIds = Array.from(
    new Set([...planningRows.map((item) => item.customerId), ...recentMachines.map((item) => item.customerId)])
  );
  const customers = await getCustomerSummaries({ ids: customerIds });
  const customerById = new Map(customers.map((customer) => [customer.id, customer]));
  const routeRows = Array.from(
    planningRows.reduce((groups, item) => {
      const routeTitle = item.notes?.startsWith("Route: ")
        ? item.notes.replace(/^Route:\s*/, "").trim()
        : "";

      if (!routeTitle) {
        return groups;
      }

      const key = `${item.dueDate}|${routeTitle}`;
      const current = groups.get(key) ?? {
        date: item.dueDate,
        title: routeTitle,
        items: [] as typeof planningRows
      };
      current.items.push(item);
      groups.set(key, current);
      return groups;
    }, new Map<string, { date: string; title: string; items: typeof planningRows }>())
  )
    .map(([, route]) => route)
    .sort((left, right) => left.date.localeCompare(right.date) || left.title.localeCompare(right.title, "nl"))
    .slice(0, 3);
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
            {recentMachines.map((machine) => (
              <Link className="list-item" key={machine.id} href={`/machines/${machine.id}`}>
                <span>
                  <strong>
                    {machine.machineType === "batterij_lader" || machine.machineType === "stellingmateriaal"
                      ? formatMachineKindBrandType(machine)
                      : machine.internalNumber || machine.machineNumber}
                  </strong>
                  <br />
                  {machine.machineType === "batterij_lader" || machine.machineType === "stellingmateriaal"
                    ? ""
                    : `${machine.brand} ${machine.model}`}
                </span>
                <span className="badge blue">
                  {getCustomerDisplayName(customerById.get(machine.customerId) ?? null)}
                </span>
              </Link>
            ))}
          </div>
        </article>
      </section>

      <section className="panel" style={{ marginTop: "1rem" }}>
        <div className="eyebrow">Routes</div>
        <h2>Geplande routes</h2>
        <div className="table-like">
          <div className="table-row table-head">
            <span>Route</span>
            <span>Datum</span>
            <span>Stops</span>
            <span>Actie</span>
          </div>
          {routeRows.map((route) => {
            const places = Array.from(
              new Set(
                route.items
                  .map((item) => customerById.get(item.customerId)?.city || customerById.get(item.customerId)?.companyName)
                  .filter(Boolean)
              )
            );
            return (
              <Link
                className="table-row"
                href={{ pathname: "/planning", query: { month: route.date.slice(0, 7) } }}
                key={`${route.date}-${route.title}`}
              >
                <span>
                  <strong>{route.title}</strong>
                  <br />
                  {places.slice(0, 3).join(" | ") || "Route"}
                </span>
                <span>{formatDisplayDate(route.date)}</span>
                <span className="badge blue">{route.items.length} stops</span>
                <span>Open planning</span>
              </Link>
            );
          })}
          {routeRows.length === 0 ? (
            <div className="table-row">
              <span>Geen geplande routes</span>
              <span>-</span>
              <span>-</span>
              <span>-</span>
            </div>
          ) : null}
        </div>
      </section>
    </>
  );
}
