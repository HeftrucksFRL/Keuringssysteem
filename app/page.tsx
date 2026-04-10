import Link from "next/link";
import type { UrlObject } from "node:url";
import {
  addTodoItemAction,
  deleteTodoItemAction,
  updateTodoItemAction
} from "@/app/dashboard-actions";
import { requireUser } from "@/lib/auth";
import {
  getCustomerDisplayName,
  getDashboardData,
  getCustomers,
  getFailedMailAlerts,
  getMachines,
  getPlanningItems,
  getTodoItems
} from "@/lib/inspection-service";

export default async function HomePage({
  searchParams
}: {
  searchParams?: Promise<{ saved?: string; todo?: string }>;
}) {
  const user = await requireUser();
  const dashboard = await getDashboardData();
  const params = await searchParams;
  const [planningRows, machines, customers, failedMailAlerts, todoItems] = await Promise.all([
    getPlanningItems(),
    getMachines(),
    getCustomers(),
    getFailedMailAlerts(),
    getTodoItems(String(user?.id ?? "demo-user"))
  ]);
  const planning = planningRows.slice(0, 3);
  const todoMessage = {
    added: "Taak toegevoegd.",
    updated: "Taak bijgewerkt.",
    deleted: "Taak verwijderd.",
    error: "Taak kon niet worden opgeslagen. Controleer de invoer."
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

      <section className="panel" style={{ marginTop: "1rem" }}>
        <div className="eyebrow">Takenlijst</div>
        <h2>Wat wil je nog doen?</h2>
        <form action={addTodoItemAction} className="todo-add-form">
          <div className="field">
            <label htmlFor="todo-title">Taak</label>
            <input id="todo-title" name="title" placeholder="Bijv. klant nabellen of nieuwe machine invoeren" required />
          </div>
          <div className="field">
            <label htmlFor="todo-description">Beschrijving</label>
            <input id="todo-description" name="description" placeholder="Optioneel" />
          </div>
          <div className="field">
            <label htmlFor="todo-due-date">Datum</label>
            <input id="todo-due-date" name="dueDate" type="date" />
          </div>
          <div className="actions" style={{ marginTop: 0 }}>
            <button className="button" type="submit">Taak toevoegen</button>
          </div>
        </form>

        <div className="list todo-list">
          {todoItems.length === 0 ? (
            <div className="list-item static-list-item">
              <span>Nog geen taken toegevoegd.</span>
              <strong>Rustig begin</strong>
            </div>
          ) : (
            todoItems.map((item) => (
              <form action={updateTodoItemAction} className={`todo-item ${item.completed ? "todo-item-done" : ""}`} key={item.id}>
                <input type="hidden" name="id" value={item.id} />
                <div className="todo-item-grid">
                  <div className="field">
                    <label htmlFor={`todo-title-${item.id}`}>Taak</label>
                    <input id={`todo-title-${item.id}`} name="title" defaultValue={item.title} />
                  </div>
                  <div className="field">
                    <label htmlFor={`todo-description-${item.id}`}>Beschrijving</label>
                    <input id={`todo-description-${item.id}`} name="description" defaultValue={item.description} />
                  </div>
                  <div className="field">
                    <label htmlFor={`todo-date-${item.id}`}>Datum</label>
                    <input id={`todo-date-${item.id}`} name="dueDate" type="date" defaultValue={item.dueDate || ""} />
                  </div>
                  <label className="todo-checkbox">
                    <input name="completed" type="checkbox" defaultChecked={item.completed} />
                    <span>{item.completed ? "Gedaan" : "Nog te doen"}</span>
                  </label>
                </div>
                <div className="actions" style={{ marginTop: "0.75rem" }}>
                  <button className="button" type="submit">Bijwerken</button>
                  <button className="button-secondary" formAction={deleteTodoItemAction} type="submit">
                    Verwijderen
                  </button>
                </div>
              </form>
            ))
          )}
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
