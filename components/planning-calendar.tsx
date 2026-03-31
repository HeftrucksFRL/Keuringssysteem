"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { CustomerRecord, MachineRecord, PlanningRecord } from "@/lib/domain";

interface PlanningCalendarProps {
  items: PlanningRecord[];
  customers: CustomerRecord[];
  machines: MachineRecord[];
}

type ViewMode = "day" | "week";

function formatDateLabel(date: Date) {
  return date.toLocaleDateString("nl-NL", {
    weekday: "short",
    day: "2-digit",
    month: "short"
  });
}

function startOfWeek(date: Date) {
  const next = new Date(date);
  const day = (next.getDay() + 6) % 7;
  next.setDate(next.getDate() - day);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function sameDay(left: string, right: string) {
  return left === right;
}

function stateLabel(state: PlanningRecord["state"]) {
  if (state === "overdue") return "Verlopen";
  if (state === "scheduled") return "Gepland";
  return "Aankomend";
}

export function PlanningCalendar({
  items,
  customers,
  machines
}: PlanningCalendarProps) {
  const [view, setView] = useState<ViewMode>("week");
  const [anchorDate, setAnchorDate] = useState(new Date());
  const [query, setQuery] = useState("");
  const [sortByPlace, setSortByPlace] = useState(true);
  const [selectedGroupKey, setSelectedGroupKey] = useState("");

  const visibleDays = useMemo(() => {
    if (view === "day") {
      const day = new Date(anchorDate);
      day.setHours(0, 0, 0, 0);
      return [day];
    }

    const weekStart = startOfWeek(anchorDate);
    return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  }, [anchorDate, view]);

  const visibleIsoDays = visibleDays.map((day) => day.toISOString().slice(0, 10));

  const groupedItems = useMemo(() => {
    const grouped = new Map<
      string,
      {
        key: string;
        dueDate: string;
        customer: CustomerRecord | undefined;
        items: PlanningRecord[];
        machineList: MachineRecord[];
        state: PlanningRecord["state"];
        place: string;
      }
    >();

    items
      .filter((item) => visibleIsoDays.includes(item.dueDate))
      .forEach((item) => {
        const customer = customers.find((entry) => entry.id === item.customerId);
        const machine = machines.find((entry) => entry.id === item.machineId);
        const key = `${item.customerId}-${item.dueDate}`;
        const place = customer?.city || customer?.address || "Onbekende plaats";

        if (!grouped.has(key)) {
          grouped.set(key, {
            key,
            dueDate: item.dueDate,
            customer,
            items: [item],
            machineList: machine ? [machine] : [],
            state: item.state,
            place
          });
          return;
        }

        const current = grouped.get(key)!;
        current.items.push(item);
        if (machine && !current.machineList.some((entry) => entry.id === machine.id)) {
          current.machineList.push(machine);
        }
        if (item.state === "overdue" || current.state === "overdue") {
          current.state = "overdue";
        } else if (item.state === "scheduled" || current.state === "scheduled") {
          current.state = "scheduled";
        } else {
          current.state = "upcoming";
        }
      });

    const needle = query.trim().toLowerCase();
    const groups = Array.from(grouped.values()).filter((group) => {
      if (!needle) {
        return true;
      }

      return [
        group.customer?.companyName,
        group.place,
        ...group.machineList.map((machine) =>
          [machine.internalNumber, machine.machineNumber, machine.brand, machine.model, machine.serialNumber]
            .filter(Boolean)
            .join(" ")
        )
      ]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });

    groups.sort((left, right) => {
      if (sortByPlace) {
        return left.place.localeCompare(right.place, "nl");
      }

      return left.customer?.companyName.localeCompare(right.customer?.companyName || "", "nl") ?? 0;
    });

    return groups;
  }, [customers, items, machines, query, sortByPlace, visibleIsoDays]);

  const selectedGroup = groupedItems.find((group) => group.key === selectedGroupKey) ?? null;
  const selectedPrimaryMachine = selectedGroup?.machineList[0] ?? null;

  return (
    <div className="panel">
      <div className="calendar-head">
        <div>
          <div className="eyebrow">Planning</div>
          <h1>Agenda</h1>
        </div>
        <div className="calendar-controls">
          <div className="inline-meta">
            <button
              className="button-secondary"
              type="button"
              onClick={() => setAnchorDate(addDays(anchorDate, view === "day" ? -1 : -7))}
            >
              Vorige
            </button>
            <button className="button-secondary" type="button" onClick={() => setAnchorDate(new Date())}>
              Vandaag
            </button>
            <button
              className="button-secondary"
              type="button"
              onClick={() => setAnchorDate(addDays(anchorDate, view === "day" ? 1 : 7))}
            >
              Volgende
            </button>
          </div>
          <div className="inline-meta">
            <button
              className={`button-secondary ${view === "day" ? "active-toggle" : ""}`}
              type="button"
              onClick={() => setView("day")}
            >
              Dag
            </button>
            <button
              className={`button-secondary ${view === "week" ? "active-toggle" : ""}`}
              type="button"
              onClick={() => setView("week")}
            >
              Week
            </button>
          </div>
        </div>
      </div>

      <div className="search-bar">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Zoek op klant, plaats of machine"
        />
      </div>

      <div className="inline-meta" style={{ marginBottom: "1rem" }}>
        <button
          className={`button-secondary ${sortByPlace ? "active-toggle" : ""}`}
          type="button"
          onClick={() => setSortByPlace(true)}
        >
          Sorteer op plaats
        </button>
        <button
          className={`button-secondary ${!sortByPlace ? "active-toggle" : ""}`}
          type="button"
          onClick={() => setSortByPlace(false)}
        >
          Sorteer op klant
        </button>
      </div>

      <div className="agenda-list mobile-agenda">
        {visibleDays.map((day) => {
          const dayKey = day.toISOString().slice(0, 10);
          const dayItems = groupedItems.filter((group) => sameDay(group.dueDate, dayKey));

          return (
            <section className="agenda-day" key={dayKey}>
              <div className="agenda-day-head">
                <strong>{formatDateLabel(day)}</strong>
                <span>{dayItems.length} afspraak{dayItems.length === 1 ? "" : "ken"}</span>
              </div>

              {dayItems.length === 0 ? (
                <div className="agenda-row empty">Geen afspraken</div>
              ) : (
                dayItems.map((group) => (
                  <button
                    key={group.key}
                    className={`agenda-row ${group.state}`}
                    type="button"
                    onClick={() => setSelectedGroupKey(group.key)}
                  >
                    <div className="agenda-time">{view === "day" ? "Vandaag" : group.place}</div>
                    <div className="agenda-main">
                      <strong>{group.customer?.companyName ?? "Onbekende klant"}</strong>
                      <span>
                        {group.machineList.length} machine{group.machineList.length === 1 ? "" : "s"} · {stateLabel(group.state)}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </section>
          );
        })}
      </div>

      <div className={`desktop-agenda desktop-agenda-${view}`}>
        {visibleDays.map((day) => {
          const dayKey = day.toISOString().slice(0, 10);
          const dayItems = groupedItems.filter((group) => sameDay(group.dueDate, dayKey));

          return (
            <section className="desktop-agenda-column" key={dayKey}>
              <div className="desktop-agenda-head">
                <strong>{formatDateLabel(day)}</strong>
                <span>{dayItems.length} afspraak{dayItems.length === 1 ? "" : "ken"}</span>
              </div>

              <div className="desktop-agenda-body">
                {dayItems.length === 0 ? (
                  <div className="desktop-agenda-empty">Geen afspraken</div>
                ) : (
                  dayItems.map((group) => (
                    <button
                      key={group.key}
                      className={`desktop-agenda-item ${group.state}`}
                      type="button"
                      onClick={() => setSelectedGroupKey(group.key)}
                    >
                      <strong>{group.customer?.companyName ?? "Onbekende klant"}</strong>
                      <span>{group.place}</span>
                      <span>
                        {group.machineList.length} machine{group.machineList.length === 1 ? "" : "s"} · {stateLabel(group.state)}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </section>
          );
        })}
      </div>

      {selectedGroup ? (
        <div className="modal-backdrop" onClick={() => setSelectedGroupKey("")}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="eyebrow">Geplande keuring</div>
            <h2>{selectedGroup.customer?.companyName ?? "Onbekende klant"}</h2>
            <div className="list">
              <div className="list-item static-list-item">
                <span>Plaats</span>
                <strong>{selectedGroup.place}</strong>
              </div>
              <div className="list-item static-list-item">
                <span>Datum</span>
                <strong>{selectedGroup.dueDate}</strong>
              </div>
              <div className="list-item static-list-item">
                <span>Status</span>
                <strong>{stateLabel(selectedGroup.state)}</strong>
              </div>
            </div>

            <div className="form-block" style={{ marginTop: "1rem" }}>
              <div className="eyebrow">Machines</div>
              <div className="list compact-list">
                {selectedGroup.machineList.map((machine) => (
                  <Link className="list-item" href={`/machines/${machine.id}`} key={machine.id}>
                    <span>
                      <strong>
                        {machine.brand} {machine.model}
                      </strong>
                      <br />
                      Serienr: {machine.serialNumber || "-"}
                    </span>
                    <strong>{machine.internalNumber || machine.machineNumber || "-"}</strong>
                  </Link>
                ))}
              </div>
            </div>

            <div className="actions">
              {selectedGroup.customer?.id ? (
                <Link className="button-secondary" href={`/klanten/${selectedGroup.customer.id}`}>
                  Open klantkaart
                </Link>
              ) : null}
              {selectedPrimaryMachine ? (
                <Link className="button-secondary" href={`/machines/${selectedPrimaryMachine.id}`}>
                  Open machinekaart
                </Link>
              ) : null}
              <button className="button" type="button" onClick={() => setSelectedGroupKey("")}>
                Sluiten
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
