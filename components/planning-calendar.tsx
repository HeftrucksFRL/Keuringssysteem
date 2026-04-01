"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { CustomerRecord, MachineRecord, PlanningRecord, RentalRecord } from "@/lib/domain";

interface PlanningCalendarProps {
  items: PlanningRecord[];
  rentals: RentalRecord[];
  customers: CustomerRecord[];
  machines: MachineRecord[];
  initialMonth?: string;
}

type AgendaEvent =
  | {
      key: string;
      kind: "inspection";
      dueDate: string;
      customer?: CustomerRecord;
      machineList: MachineRecord[];
      state: PlanningRecord["state"];
      place: string;
      inspectionId?: string;
    }
  | {
      key: string;
      kind: "rental";
      dueDate: string;
      customer?: CustomerRecord;
      machineList: MachineRecord[];
      place: string;
      rental: RentalRecord;
    };

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

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function parseMonthKey(value?: string) {
  if (!value || !/^\d{4}-\d{2}$/.test(value)) {
    return new Date();
  }

  const [year, month] = value.split("-").map(Number);
  return new Date(year, month - 1, 1);
}

function placeLabel(customer?: CustomerRecord) {
  const city = customer?.city?.trim();
  if (city) {
    return city;
  }

  const address = customer?.address?.trim() ?? "";
  if (!address) {
    return "Onbekende plaats";
  }

  const parts = address
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length > 1) {
    return parts[parts.length - 1];
  }

  return address;
}

function stateLabel(state: PlanningRecord["state"]) {
  if (state === "overdue") return "Verlopen";
  if (state === "scheduled") return "Gepland";
  return "Aankomend";
}

function rentalPhaseLabel(rental: RentalRecord) {
  const today = new Date().toISOString().slice(0, 10);
  if (rental.status === "completed" || rental.endDate < today) {
    return "Afgerond";
  }
  if (rental.startDate > today) {
    return "Komend";
  }
  return "Actief";
}

export function PlanningCalendar({
  items,
  rentals,
  customers,
  machines,
  initialMonth
}: PlanningCalendarProps) {
  const [anchorDate, setAnchorDate] = useState(() => parseMonthKey(initialMonth));
  const [query, setQuery] = useState("");
  const [sortByPlace, setSortByPlace] = useState(true);
  const [selectedEventKey, setSelectedEventKey] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const url = new URL(window.location.href);
    url.searchParams.set("month", monthKey(anchorDate));
    window.history.replaceState(null, "", url);
  }, [anchorDate]);

  const calendarDays = useMemo(() => {
    const first = startOfGrid(anchorDate);
    return Array.from({ length: 42 }, (_, index) => addDays(first, index));
  }, [anchorDate]);

  const monthStart = startOfMonth(anchorDate);
  const monthStartIso = isoDate(monthStart);
  const monthEndIso = isoDate(new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0));

  const agendaEvents = useMemo(() => {
    const groupedPlanning = new Map<string, AgendaEvent>();

    items
      .filter((item) => item.dueDate >= monthStartIso && item.dueDate <= monthEndIso)
      .forEach((item) => {
        const customer = customers.find((entry) => entry.id === item.customerId);
        const machine = machines.find((entry) => entry.id === item.machineId);
        const key = `inspection-${item.customerId}-${item.dueDate}`;
        const place = placeLabel(customer);

        if (!groupedPlanning.has(key)) {
          groupedPlanning.set(key, {
            key,
            kind: "inspection",
            dueDate: item.dueDate,
            customer,
            machineList: machine ? [machine] : [],
            state: item.state,
            place,
            inspectionId: item.inspectionId || undefined
          });
          return;
        }

        const current = groupedPlanning.get(key);
        if (!current || current.kind !== "inspection") {
          return;
        }

        if (machine && !current.machineList.some((entry) => entry.id === machine.id)) {
          current.machineList.push(machine);
        }
        if (!current.inspectionId && item.inspectionId) {
          current.inspectionId = item.inspectionId;
        }
        if (item.state === "overdue" || current.state === "overdue") {
          current.state = "overdue";
        } else if (item.state === "scheduled" || current.state === "scheduled") {
          current.state = "scheduled";
        } else {
          current.state = "upcoming";
        }
      });

    const rentalEvents: AgendaEvent[] = rentals.flatMap((rental) => {
      const customer = customers.find((entry) => entry.id === rental.customerId);
      const machine = machines.find((entry) => entry.id === rental.machineId);
      if (!machine) {
        return [];
      }

      const start = rental.startDate < monthStartIso ? monthStartIso : rental.startDate;
      const end = rental.endDate > monthEndIso ? monthEndIso : rental.endDate;
      if (start > end) {
        return [];
      }

      const days: AgendaEvent[] = [];
      let cursor = new Date(start);
      const last = new Date(end);

      while (cursor <= last) {
        const day = isoDate(cursor);
        days.push({
          key: `rental-${rental.id}-${day}`,
          kind: "rental",
          dueDate: day,
          customer,
          machineList: [machine],
          place: placeLabel(customer),
          rental
        });
        cursor = addDays(cursor, 1);
      }

      return days;
    });

    const allEvents = [...Array.from(groupedPlanning.values()), ...rentalEvents];
    const needle = query.trim().toLowerCase();

    return allEvents
      .filter((event) => {
        if (!needle) {
          return true;
        }

        const haystack = [
          event.customer?.companyName,
          event.place,
          ...event.machineList.map((machine) =>
            [machine.internalNumber, machine.machineNumber, machine.brand, machine.model, machine.serialNumber]
              .filter(Boolean)
              .join(" ")
          )
        ]
          .join(" ")
          .toLowerCase();

        return haystack.includes(needle);
      })
      .sort((left, right) => {
        if (left.dueDate !== right.dueDate) {
          return left.dueDate.localeCompare(right.dueDate);
        }

        if (left.kind !== right.kind) {
          return left.kind === "rental" ? -1 : 1;
        }

        if (sortByPlace) {
          return left.place.localeCompare(right.place, "nl");
        }

        return (left.customer?.companyName ?? "").localeCompare(right.customer?.companyName ?? "", "nl");
      });
  }, [customers, items, machines, monthEndIso, monthStartIso, query, rentals, sortByPlace]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, AgendaEvent[]>();
    agendaEvents.forEach((event) => {
      const current = map.get(event.dueDate) ?? [];
      current.push(event);
      map.set(event.dueDate, current);
    });
    return map;
  }, [agendaEvents]);

  const mobileDays = useMemo(
    () =>
      Array.from(eventsByDay.entries())
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([date, groups]) => ({ date, groups })),
    [eventsByDay]
  );

  const selectedEvent = agendaEvents.find((event) => event.key === selectedEventKey) ?? null;
  const selectedPrimaryMachine = selectedEvent?.machineList[0] ?? null;

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
            <button className="button-secondary" type="button" onClick={() => setAnchorDate(addMonths(anchorDate, -1))}>
              Vorige maand
            </button>
            <button className="button-secondary" type="button" onClick={() => setAnchorDate(new Date())}>
              {monthLabel(anchorDate)}
            </button>
            <button className="button-secondary" type="button" onClick={() => setAnchorDate(addMonths(anchorDate, 1))}>
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
                <span>{groups.length} {groups.length === 1 ? "afspraak" : "afspraken"}</span>
              </div>
              {groups.map((event) => (
                <button
                  key={event.key}
                  className={`agenda-row ${event.kind === "rental" ? "scheduled" : event.state}`}
                  type="button"
                  onClick={() => setSelectedEventKey(event.key)}
                >
                  <div className="agenda-time">{event.kind === "rental" ? "Verhuur" : event.place}</div>
                  <div className="agenda-main">
                    <strong>{event.customer?.companyName ?? "Onbekende klant"}</strong>
                    <span>
                      {event.machineList.length} machine{event.machineList.length === 1 ? "" : "s"}
                    </span>
                    <span>{event.kind === "rental" ? rentalPhaseLabel(event.rental) : stateLabel(event.state)}</span>
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
            const dayEvents = eventsByDay.get(dayKey) ?? [];
            const isCurrentMonth = day.getMonth() === anchorDate.getMonth();
            const isToday = dayKey === isoDate(new Date());

            return (
              <div
                className={`month-cell ${isCurrentMonth ? "" : "is-outside"} ${isToday ? "is-today" : ""}`}
                key={dayKey}
              >
                <div className="month-cell-date">{dateNumber(day)}</div>
                <div className="month-cell-events">
                  {dayEvents.map((event) => (
                    <button
                      key={event.key}
                      className={`month-event ${event.kind === "rental" ? "scheduled" : event.state}`}
                      type="button"
                      onClick={() => setSelectedEventKey(event.key)}
                    >
                      <strong>
                        {event.kind === "rental" ? "Verhuur" : event.customer?.companyName ?? "Onbekende klant"}
                      </strong>
                      <span>{event.kind === "rental" ? event.customer?.companyName ?? "-" : event.place}</span>
                      <span>
                        {event.machineList.length} machine{event.machineList.length === 1 ? "" : "s"}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {selectedEvent ? (
        <div className="modal-backdrop" onClick={() => setSelectedEventKey("")}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="eyebrow">{selectedEvent.kind === "rental" ? "Verhuur" : "Geplande keuring"}</div>
            <h2>{selectedEvent.customer?.companyName ?? "Onbekende klant"}</h2>
            <p className="muted" style={{ marginTop: "-0.35rem", marginBottom: "1rem" }}>
              {[selectedEvent.customer?.address, selectedEvent.customer?.city].filter(Boolean).join(", ") || "Adres onbekend"}
              {selectedEvent.customer?.phone ? ` | ${selectedEvent.customer.phone}` : ""}
            </p>
            <div className="list">
              <div className="list-item static-list-item">
                <span>Plaats</span>
                <strong>{selectedEvent.place}</strong>
              </div>
              {selectedEvent.kind === "rental" ? (
                <div className="list-item static-list-item">
                  <span>Periode</span>
                  <strong>{selectedEvent.rental.startDate} t/m {selectedEvent.rental.endDate}</strong>
                </div>
              ) : (
                <div className="list-item static-list-item">
                  <span>Datum</span>
                  <strong>{selectedEvent.dueDate}</strong>
                </div>
              )}
              <div className="list-item static-list-item">
                <span>Status</span>
                <strong>
                  {selectedEvent.kind === "rental"
                    ? rentalPhaseLabel(selectedEvent.rental)
                    : stateLabel(selectedEvent.state)}
                </strong>
              </div>
            </div>

            <div className="form-block" style={{ marginTop: "1rem" }}>
              <div className="eyebrow">Machines</div>
              <div className="list compact-list">
                {selectedEvent.machineList.map((machine) => (
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
              {selectedEvent.customer?.id ? (
                <Link className="button-secondary" href={`/klanten/${selectedEvent.customer.id}`}>
                  Open klantkaart
                </Link>
              ) : null}
              {selectedPrimaryMachine ? (
                <Link className="button-secondary" href={`/machines/${selectedPrimaryMachine.id}`}>
                  Open machinekaart
                </Link>
              ) : null}
              <button className="button" type="button" onClick={() => setSelectedEventKey("")}>
                Sluiten
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
