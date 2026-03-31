"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { CustomerRecord, MachineRecord, PlanningRecord } from "@/lib/domain";

interface PlanningCalendarProps {
  items: PlanningRecord[];
  customers: CustomerRecord[];
  machines: MachineRecord[];
}

function monthLabel(date: Date) {
  return date.toLocaleDateString("nl-NL", {
    month: "long",
    year: "numeric"
  });
}

function dayLabel(date: Date) {
  return date.toLocaleDateString("nl-NL", {
    weekday: "short",
    day: "numeric"
  });
}

function dateNumber(date: Date) {
  return date.toLocaleDateString("nl-NL", { day: "numeric" });
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function startOfGrid(date: Date) {
  const monthStart = startOfMonth(date);
  const day = (monthStart.getDay() + 6) % 7;
  monthStart.setDate(monthStart.getDate() - day);
  monthStart.setHours(0, 0, 0, 0);
  return monthStart;
}

function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function addMonths(date: Date, amount: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + amount);
  return next;
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
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
  const [anchorDate, setAnchorDate] = useState(new Date());
  const [query, setQuery] = useState("");
  const [sortByPlace, setSortByPlace] = useState(true);
  const [selectedGroupKey, setSelectedGroupKey] = useState("");

  const calendarDays = useMemo(() => {
    const first = startOfGrid(anchorDate);
    return Array.from({ length: 42 }, (_, index) => addDays(first, index));
  }, [anchorDate]);

  const monthStart = startOfMonth(anchorDate);
  const monthIsoPrefix = `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, "0")}`;

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
      .filter((item) => item.dueDate.startsWith(monthIsoPrefix))
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
      if (left.dueDate !== right.dueDate) {
        return left.dueDate.localeCompare(right.dueDate);
      }

      if (sortByPlace) {
        return left.place.localeCompare(right.place, "nl");
      }

      return left.customer?.companyName.localeCompare(right.customer?.companyName || "", "nl") ?? 0;
    });

    return groups;
  }, [customers, items, machines, monthIsoPrefix, query, sortByPlace]);

  const groupsByDay = useMemo(() => {
    const map = new Map<string, typeof groupedItems>();
    groupedItems.forEach((group) => {
      const current = map.get(group.dueDate) ?? [];
      current.push(group);
      map.set(group.dueDate, current);
    });
    return map;
  }, [groupedItems]);

  const mobileDays = useMemo(
    () =>
      Array.from(groupsByDay.entries())
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([date, groups]) => ({ date, groups })),
    [groupsByDay]
  );

  const selectedGroup = groupedItems.find((group) => group.key === selectedGroupKey) ?? null;
  const selectedPrimaryMachine = selectedGroup?.machineList[0] ?? null;

  return (
    <div className="panel">
      <div className="calendar-head">
        <div>
          <div className="eyebrow">Planning</div>
          <h1>Agenda</h1>
          <p className="muted" style={{ marginBottom: 0 }}>{monthLabel(anchorDate)}</p>
        </div>
        <div className="calendar-controls">
          <div className="inline-meta">
            <button
              className="button-secondary"
              type="button"
              onClick={() => setAnchorDate(addMonths(anchorDate, -1))}
            >
              Vorige maand
            </button>
            <button className="button-secondary" type="button" onClick={() => setAnchorDate(new Date())}>
              {monthLabel(anchorDate)}
            </button>
            <button
              className="button-secondary"
              type="button"
              onClick={() => setAnchorDate(addMonths(anchorDate, 1))}
            >
              Volgende maand
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

      <div className="mobile-agenda-list">
              {mobileDays.length === 0 ? (
          <div className="agenda-row empty">Geen afspraken in deze maand</div>
        ) : (
          mobileDays.map(({ date, groups }) => (
            <section className="agenda-day-card" key={date}>
              <div className="agenda-day-head">
                <strong>{dayLabel(new Date(date))}</strong>
                <span>{groups.length} afspraak{groups.length === 1 ? "" : "ken"}</span>
              </div>
              {groups.map((group) => (
                <button
                  key={group.key}
                  className={`agenda-row ${group.state}`}
                  type="button"
                  onClick={() => setSelectedGroupKey(group.key)}
                >
                  <div className="agenda-time">{group.place}</div>
                  <div className="agenda-main">
                    <strong>{group.customer?.companyName ?? "Onbekende klant"}</strong>
                    <span>
                      {group.machineList.length} machine{group.machineList.length === 1 ? "" : "s"}
                    </span>
                    <span>
                      {stateLabel(group.state)}
                    </span>
                  </div>
                </button>
              ))}
            </section>
          ))
        )}
      </div>

      <div className="month-grid-wrap">
        <div className="month-grid-head">
          {["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"].map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>
        <div className="month-grid">
          {calendarDays.map((day) => {
            const dayKey = isoDate(day);
            const dayGroups = groupsByDay.get(dayKey) ?? [];
            const isCurrentMonth = day.getMonth() === anchorDate.getMonth();
            const isToday = dayKey === isoDate(new Date());

            return (
              <div
                className={`month-cell ${isCurrentMonth ? "" : "is-outside"} ${isToday ? "is-today" : ""}`}
                key={dayKey}
              >
                <div className="month-cell-date">{dateNumber(day)}</div>
                <div className="month-cell-events">
                  {dayGroups.map((group) => (
                    <button
                      key={group.key}
                      className={`month-event ${group.state}`}
                      type="button"
                      onClick={() => setSelectedGroupKey(group.key)}
                    >
                      <strong>{group.customer?.companyName ?? "Onbekende klant"}</strong>
                      <span>{group.place}</span>
                      <span>{group.machineList.length} machine{group.machineList.length === 1 ? "" : "s"}</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
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
                      <strong>{machine.brand} {machine.model}</strong>
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
