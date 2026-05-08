"use client";

import Link from "next/link";
import { CalendarRange, ExternalLink, Search } from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";
import type { Route } from "next";
import { usePathname, useSearchParams } from "next/navigation";
import {
  createNewAgendaRouteAction,
  updateNewAgendaPlanningItemAction
} from "@/app/planning/nieuwe-agenda/actions";
import type {
  CustomerRecord,
  MachineRecord,
  PlanningRecord
} from "@/lib/domain";
import {
  formatMachineBrandTypeSerial,
  formatMachineKindBrandType
} from "@/lib/machine-presentation";
import {
  getPlanningDisplayLabel,
  getPlanningDisplayState,
  type PlanningDisplayState
} from "@/lib/planning";
import { formatDisplayDate, formatLocalDateInput, todayLocalIso } from "@/lib/utils";

type PeriodFilter = "30" | "60" | "90" | "year" | "custom";
type StatusFilter = "open" | "upcoming" | "scheduled" | "overdue" | "completed" | "all";

interface NewAgendaWorkspaceProps {
  customers: CustomerRecord[];
  children?: ReactNode;
  machines: MachineRecord[];
  planningItems: PlanningRecord[];
  initialFilters: {
    customerId: string;
    from: string;
    period: string;
    place: string;
    query: string;
    status: string;
    to: string;
  };
}

interface EnrichedPlanningItem {
  item: PlanningRecord;
  customer?: CustomerRecord;
  machine?: MachineRecord;
  place: string;
  state: PlanningDisplayState;
  machineLabel: string;
}

function addDaysIso(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return formatLocalDateInput(date);
}

function endOfYearIso() {
  const date = new Date();
  return `${date.getFullYear()}-12-31`;
}

function normalizePeriod(value: string): PeriodFilter {
  return ["30", "60", "90", "year", "custom"].includes(value)
    ? (value as PeriodFilter)
    : "30";
}

function normalizeStatus(value: string): StatusFilter {
  return ["open", "upcoming", "scheduled", "overdue", "completed", "all"].includes(value)
    ? (value as StatusFilter)
    : "all";
}

function machineLabel(machine?: MachineRecord) {
  if (!machine) {
    return "Machine onbekend";
  }

  if (machine.machineType === "batterij_lader" || machine.machineType === "stellingmateriaal") {
    return formatMachineKindBrandType(machine);
  }

  return formatMachineBrandTypeSerial(machine);
}

function isBatteryAccessoryMachine(machine?: MachineRecord) {
  return machine?.machineType === "batterij_lader";
}

function placeLabel(customer?: CustomerRecord) {
  return customer?.city?.trim() || customer?.address?.trim() || "Onbekende plaats";
}

function statusMatches(state: PlanningDisplayState, filter: StatusFilter) {
  if (filter === "all") return true;
  if (filter === "open") return state !== "completed";
  return state === filter;
}

export function NewAgendaWorkspace({
  customers,
  children,
  machines,
  planningItems,
  initialFilters
}: NewAgendaWorkspaceProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [period, setPeriod] = useState<PeriodFilter>(normalizePeriod(initialFilters.period));
  const [from, setFrom] = useState(initialFilters.from || todayLocalIso());
  const [to, setTo] = useState(
    initialFilters.to ||
      (normalizePeriod(initialFilters.period) === "year" ? endOfYearIso() : addDaysIso(30))
  );
  const [place, setPlace] = useState(initialFilters.place);
  const [customerId, setCustomerId] = useState(initialFilters.customerId);
  const [status, setStatus] = useState<StatusFilter>(normalizeStatus(initialFilters.status));
  const [query, setQuery] = useState(initialFilters.query);
  const [selectedId, setSelectedId] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const [routeModalOpen, setRouteModalOpen] = useState(false);
  const [routeSelectionMode, setRouteSelectionMode] = useState<"selected" | "all">("selected");
  const [selectedRouteIds, setSelectedRouteIds] = useState<string[]>([]);
  const [routeTitle, setRouteTitle] = useState("");
  const [routeDate, setRouteDate] = useState(todayLocalIso());
  const [routePreviewOpen, setRoutePreviewOpen] = useState(false);

  const customerById = useMemo(
    () => new Map(customers.map((customer) => [customer.id, customer])),
    [customers]
  );
  const machineById = useMemo(
    () => new Map(machines.map((machine) => [machine.id, machine])),
    [machines]
  );

  const enrichedItems = useMemo<EnrichedPlanningItem[]>(
    () =>
      planningItems.map((item) => {
        const customer = customerById.get(item.customerId);
        const machine = machineById.get(item.machineId);
        return {
          item,
          customer,
          machine,
          place: placeLabel(customer),
          state: getPlanningDisplayState(item),
          machineLabel: machineLabel(machine)
        };
      }),
    [customerById, machineById, planningItems]
  );

  const filteredItems = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const placeNeedle = place.trim().toLowerCase();

    return enrichedItems
      .filter((entry) => entry.item.dueDate >= from && entry.item.dueDate <= to)
      .filter((entry) => !customerId || entry.item.customerId === customerId)
      .filter((entry) => statusMatches(entry.state, status))
      .filter((entry) => !placeNeedle || entry.place.toLowerCase().includes(placeNeedle))
      .filter((entry) => {
        if (!needle) return true;
        return [
          entry.customer?.companyName,
          entry.customer?.contactName,
          entry.customer?.address,
          entry.customer?.city,
          entry.machineLabel,
          entry.machine?.internalNumber,
          entry.machine?.machineNumber,
          entry.machine?.serialNumber,
          entry.machine?.brand,
          entry.machine?.model,
          entry.item.notes
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(needle);
      })
      .sort((left, right) => {
        if (left.item.dueDate !== right.item.dueDate) {
          return left.item.dueDate.localeCompare(right.item.dueDate);
        }
        if (left.place !== right.place) {
          return left.place.localeCompare(right.place, "nl");
        }
        return (left.customer?.companyName ?? "").localeCompare(
          right.customer?.companyName ?? "",
          "nl"
        );
      });
  }, [customerId, enrichedItems, from, place, query, status, to]);

  const selectedItem = selectedId
    ? filteredItems.find((entry) => entry.item.id === selectedId) ??
      enrichedItems.find((entry) => entry.item.id === selectedId) ??
      null
    : null;
  const currentReturnTo = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
  const activeRouteIds =
    routeSelectionMode === "all" ? filteredItems.map((entry) => entry.item.id) : selectedRouteIds;
  const routePreviewItems = activeRouteIds
    .map((id) => enrichedItems.find((entry) => entry.item.id === id))
    .filter(Boolean) as EnrichedPlanningItem[];
  const routeGroups = useMemo(() => {
    const map = new Map<string, EnrichedPlanningItem[]>();

    for (const entry of enrichedItems) {
      const routeName = entry.item.notes?.startsWith("Route: ")
        ? entry.item.notes.replace(/^Route:\s*/, "").trim()
        : "";
      if (!routeName || entry.state !== "scheduled") {
        continue;
      }

      const key = `${entry.item.dueDate}|${routeName}`;
      const current = map.get(key) ?? [];
      current.push(entry);
      map.set(key, current);
    }

    return Array.from(map.entries())
      .map(([key, entries]) => {
        const [date, title] = key.split("|");
        return { key, date, title, entries };
      })
      .sort((left, right) => left.date.localeCompare(right.date) || left.title.localeCompare(right.title, "nl"));
  }, [enrichedItems]);

  function applyPeriod(nextPeriod: PeriodFilter) {
    setPeriod(nextPeriod);
    const start = todayLocalIso();

    if (nextPeriod === "custom") {
      return;
    }

    setFrom(start);
    if (nextPeriod === "year") {
      setTo(endOfYearIso());
      return;
    }

    setTo(addDaysIso(Number(nextPeriod)));
  }

  function toggleRouteSelection(id: string) {
    setSelectedRouteIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  }

  function openRouteModal(mode: "selected" | "all") {
    const routeIds = mode === "all" ? filteredItems.map((entry) => entry.item.id) : selectedRouteIds;
    if (routeIds.length === 0) {
      return;
    }

    const placePart = place.trim() || "Route";
    setRouteSelectionMode(mode);
    setRouteDate(from || todayLocalIso());
    setRouteTitle(`${placePart} ${formatDisplayDate(from || todayLocalIso())}`);
    setRouteModalOpen(true);
  }

  return (
    <section className="new-agenda-workspace">
      <div className="new-agenda-head">
        <div>
          <div className="eyebrow">Planning</div>
          <h1>Agenda</h1>
          <p className="muted">
            Filter verwachte keuringen, plan routes en werk met de bestaande planning.
          </p>
        </div>
        <Link className="button-secondary" href="/planning/oude-agenda">
          Oude planning
        </Link>
      </div>

      <section className="panel new-agenda-search-panel">
        <div className="new-agenda-results-head">
          <div>
            <div className="eyebrow">Filter</div>
            <h2>Agenda doorzoeken</h2>
          </div>
          <CalendarRange size={20} />
        </div>
        <form
          className="new-agenda-filters"
          onSubmit={(event) => {
            event.preventDefault();
            setHasSearched(true);
            setSelectedId("");
          }}
        >
          <div className="field">
            <label htmlFor="new-agenda-period">Periode</label>
            <select
              id="new-agenda-period"
              value={period}
              onChange={(event) => applyPeriod(event.target.value as PeriodFilter)}
            >
              <option value="30">Komende maand</option>
              <option value="60">Komende 2 maanden</option>
              <option value="90">Komende 3 maanden</option>
              <option value="year">Dit jaar</option>
              <option value="custom">Eigen periode</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="new-agenda-from">Van</label>
            <input
              id="new-agenda-from"
              type="date"
              value={from}
              onChange={(event) => {
                setPeriod("custom");
                setFrom(event.target.value);
              }}
            />
          </div>
          <div className="field">
            <label htmlFor="new-agenda-to">Tot</label>
            <input
              id="new-agenda-to"
              type="date"
              value={to}
              onChange={(event) => {
                setPeriod("custom");
                setTo(event.target.value);
              }}
            />
          </div>
          <div className="field">
            <label htmlFor="new-agenda-place">Plaats</label>
            <input
              id="new-agenda-place"
              value={place}
              onChange={(event) => setPlace(event.target.value)}
              placeholder="Bijv. Leeuwarden"
            />
          </div>
          <div className="field">
            <label htmlFor="new-agenda-customer">Klant</label>
            <select
              id="new-agenda-customer"
              value={customerId}
              onChange={(event) => setCustomerId(event.target.value)}
            >
              <option value="">Alle klanten</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.companyName}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="new-agenda-status">Status</label>
            <select
              id="new-agenda-status"
              value={status}
              onChange={(event) => setStatus(event.target.value as StatusFilter)}
            >
              <option value="open">Open resultaten</option>
              <option value="overdue">Verlopen</option>
              <option value="upcoming">Niet ingepland</option>
              <option value="scheduled">Gepland</option>
              <option value="completed">Afgerond</option>
              <option value="all">Alles</option>
            </select>
          </div>
          <div className="field new-agenda-search-field">
            <label htmlFor="new-agenda-query">Zoeken</label>
            <input
              id="new-agenda-query"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Klant, machine, serienummer"
            />
          </div>
          <div className="field">
            <label>&nbsp;</label>
            <button className="button" type="submit">
              Zoeken
            </button>
          </div>
        </form>
      </section>

      {children ? <div className="new-agenda-calendar-slot">{children}</div> : null}

      {routeGroups.length > 0 ? (
        <section className="panel new-agenda-routes">
          <div className="eyebrow">Dashboard preview</div>
          <h2>Geplande routes</h2>
          <div className="new-agenda-list">
            {routeGroups.map((route) => (
              <button
                className="new-agenda-row scheduled"
                key={route.key}
                type="button"
                onClick={() => {
                  setHasSearched(true);
                  setSelectedRouteIds(route.entries.map((entry) => entry.item.id));
                }}
              >
                <span>
                  <strong>{route.title}</strong>
                  <small>
                    {formatDisplayDate(route.date)} | {route.entries.length} keuringen
                  </small>
                </span>
                <em>Gepland</em>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {hasSearched ? (
        <div className="modal-backdrop" onClick={() => setHasSearched(false)}>
          <div className="modal-card new-agenda-results-modal" onClick={(event) => event.stopPropagation()}>
            <div className="new-agenda-results-head">
              <div>
                <div className="eyebrow">Resultaat</div>
                <h2>{filteredItems.length > 0 ? `${filteredItems.length} gevonden` : "Nog geen resultaten"}</h2>
              </div>
              <Search size={20} />
            </div>
            <div className="new-agenda-list">
              {filteredItems.map((entry) => (
                <div
                  className={`new-agenda-row ${entry.state} ${isBatteryAccessoryMachine(entry.machine) ? "battery-accessory-event" : ""}`}
                  key={entry.item.id}
                >
                  <label className="new-agenda-route-check">
                    <input
                      checked={selectedRouteIds.includes(entry.item.id)}
                      onChange={() => toggleRouteSelection(entry.item.id)}
                      type="checkbox"
                    />
                  </label>
                  <span>
                    <button
                      className="new-agenda-row-link"
                      type="button"
                      onClick={() => {
                        setSelectedId(entry.item.id);
                        setHasSearched(false);
                      }}
                    >
                      <strong>{entry.customer?.companyName ?? "Onbekende klant"}</strong>
                    </button>
                    <small>
                      {formatDisplayDate(entry.item.dueDate)} | {entry.place} | {entry.machineLabel}
                    </small>
                  </span>
                  <em>{getPlanningDisplayLabel(entry.item)}</em>
                </div>
              ))}
              {filteredItems.length === 0 ? (
                <div className="list-item">
                  <span>Nog geen resultaten</span>
                  <strong>-</strong>
                </div>
              ) : null}
            </div>
            <div className="actions" style={{ marginTop: "1rem" }}>
              <button
                className="button-secondary"
                disabled={selectedRouteIds.length === 0}
                type="button"
                onClick={() => openRouteModal("selected")}
              >
                Selectie inplannen
              </button>
              <button
                className="button-secondary"
                disabled={filteredItems.length === 0}
                type="button"
                onClick={() => openRouteModal("all")}
              >
                Alles inplannen
              </button>
              <button className="button" type="button" onClick={() => setHasSearched(false)}>
                Sluiten
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {routeModalOpen ? (
        <div className="modal-backdrop" onClick={() => setRouteModalOpen(false)}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="eyebrow">Route plannen</div>
            <h2>
              {routeSelectionMode === "all"
                ? `${filteredItems.length} resultaten inplannen`
                : `${selectedRouteIds.length} geselecteerd inplannen`}
            </h2>
            <form action={createNewAgendaRouteAction} className="form-block" style={{ marginTop: "1rem" }}>
              <input
                type="hidden"
                name="ids"
                value={JSON.stringify(
                  routeSelectionMode === "all"
                    ? filteredItems.map((entry) => entry.item.id)
                    : selectedRouteIds
                )}
              />
              <input type="hidden" name="returnTo" value={currentReturnTo} />
              <div className="field">
                <label htmlFor="new-agenda-route-title">Routenaam</label>
                <input
                  id="new-agenda-route-title"
                  name="routeTitle"
                  value={routeTitle}
                  onChange={(event) => setRouteTitle(event.target.value)}
                  placeholder="Bijv. Harlingen week 23"
                />
              </div>
              <div className="field">
                <label htmlFor="new-agenda-route-date">Datum</label>
                <input
                  id="new-agenda-route-date"
                  name="dueDate"
                  type="date"
                  value={routeDate}
                  onChange={(event) => setRouteDate(event.target.value)}
                />
              </div>
              <div className="actions">
                <button className="button-secondary" type="button" onClick={() => setRoutePreviewOpen(true)}>
                  Voorbeeld bekijken
                </button>
                <button className="button" type="submit">
                  Route echt inplannen
                </button>
                <button className="button-secondary" type="button" onClick={() => setRouteModalOpen(false)}>
                  Annuleren
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {routePreviewOpen ? (
        <div className="modal-backdrop" onClick={() => setRoutePreviewOpen(false)}>
          <div className="modal-card new-agenda-results-modal" onClick={(event) => event.stopPropagation()}>
            <div className="eyebrow">Voorbeeld</div>
            <h2>{routeTitle || "Route zonder naam"}</h2>
            <p className="muted" style={{ marginTop: "-0.35rem", marginBottom: "1rem" }}>
              {formatDisplayDate(routeDate)} | {routePreviewItems.length} keuringen
            </p>
            <div className="panel" style={{ marginBottom: "1rem" }}>
              <div className="eyebrow">Zo komt hij op dashboard</div>
              <button className="new-agenda-row scheduled" type="button">
                <span>
                  <strong>{routeTitle || "Route zonder naam"}</strong>
                  <small>
                    {formatDisplayDate(routeDate)} | {routePreviewItems.length} keuringen
                  </small>
                </span>
                <em>Gepland</em>
              </button>
            </div>
            <div className="new-agenda-list">
              {routePreviewItems.map((entry) => (
                <div
                  className={`new-agenda-row ${entry.state} ${isBatteryAccessoryMachine(entry.machine) ? "battery-accessory-event" : ""}`}
                  key={`preview-${entry.item.id}`}
                >
                  <span>
                    <strong>{entry.customer?.companyName ?? "Onbekende klant"}</strong>
                    <small>
                      {formatDisplayDate(routeDate)} | {entry.place} | {entry.machineLabel}
                    </small>
                  </span>
                  <em>Wordt gepland</em>
                </div>
              ))}
              {routePreviewItems.length === 0 ? (
                <div className="list-item">
                  <span>Nog geen keuringen gekozen.</span>
                  <strong>-</strong>
                </div>
              ) : null}
            </div>
            <div className="actions" style={{ marginTop: "1rem" }}>
              <button className="button" type="button" onClick={() => setRoutePreviewOpen(false)}>
                Terug
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {selectedItem ? (
        <div className="modal-backdrop" onClick={() => setSelectedId("")}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="eyebrow">Verwachte keuring</div>
            <h2>{selectedItem.customer?.companyName ?? "Onbekende klant"}</h2>
            <p className="muted" style={{ marginTop: "-0.35rem", marginBottom: "1rem" }}>
              {selectedItem.place} | {selectedItem.machineLabel}
            </p>
            <div className="list">
              <div className="list-item static-list-item">
                <span>Datum</span>
                <strong>{formatDisplayDate(selectedItem.item.dueDate)}</strong>
              </div>
              <div className="list-item static-list-item">
                <span>Status</span>
                <strong>{getPlanningDisplayLabel(selectedItem.item)}</strong>
              </div>
              <div className={`list-item static-list-item ${isBatteryAccessoryMachine(selectedItem.machine) ? "battery-accessory-row" : ""}`}>
                <span>Notitie</span>
                <strong>{selectedItem.item.notes || "-"}</strong>
              </div>
            </div>

            <form action={updateNewAgendaPlanningItemAction} className="panel" style={{ marginTop: "1rem" }}>
              <input type="hidden" name="id" value={selectedItem.item.id} />
              <input type="hidden" name="returnTo" value={currentReturnTo} />
              <div className="eyebrow">Planning aanpassen</div>
              <div className="field" style={{ marginTop: "0.75rem" }}>
                <label htmlFor="new-agenda-due-date">Nieuwe datum</label>
                <input
                  id="new-agenda-due-date"
                  name="dueDate"
                  type="date"
                  defaultValue={selectedItem.item.dueDate}
                />
              </div>
              <div className="actions" style={{ marginTop: "0.75rem" }}>
                <button className="button-secondary" name="mode" type="submit" value="move">
                  Verplaatsen
                </button>
                <button className="button" name="mode" type="submit" value="schedule">
                  Inplannen
                </button>
              </div>
            </form>

            <div className="actions calendar-popup-actions" style={{ marginTop: "1rem" }}>
              <Link
                className="button"
                href={
                  `/keuringen/nieuw?customerId=${selectedItem.item.customerId}&machineId=${selectedItem.item.machineId}` as Route
                }
                target="_blank"
                rel="noreferrer"
              >
                Keuring maken
                <ExternalLink size={16} />
              </Link>
              {selectedItem.customer ? (
                <Link className="button-secondary" href={`/klanten/${selectedItem.customer.id}`}>
                  Klantkaart
                </Link>
              ) : null}
              {selectedItem.machine ? (
                <Link className="button-secondary" href={`/machines/${selectedItem.machine.id}`}>
                  Machinekaart
                </Link>
              ) : null}
              <button className="button-secondary" type="button" onClick={() => setSelectedId("")}>
                Sluiten
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
