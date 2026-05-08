"use client";

import Link from "next/link";
import { CheckCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import {
  deletePlanningItemAction,
  deleteAgendaEventAction,
  updateAgendaEventAction,
  updatePlanningItemAction,
  updateRentalAction
} from "@/app/planning/actions";
import { CustomerPicker } from "@/components/customer-picker";
import type {
  AgendaEventRecord,
  CustomerRecord,
  MachineRecord,
  PlanningRecord,
  RentalRecord
} from "@/lib/domain";
import {
  getPlanningDisplayLabel,
  getPlanningDisplayState,
  type PlanningDisplayState
} from "@/lib/planning";
import { formatMachineKindBrandType } from "@/lib/machine-presentation";
import { getCustomerDisplayName, isRentalStockCustomer } from "@/lib/stock-customer";
import { formatDisplayDate, formatLocalDateInput, parseLocalDateInput, todayLocalIso } from "@/lib/utils";

interface PlanningCalendarProps {
  items: PlanningRecord[];
  rentals: RentalRecord[];
  agendaEventItems: AgendaEventRecord[];
  customers: CustomerRecord[];
  machines: MachineRecord[];
  initialMonth?: string;
  children?: ReactNode;
}

type ViewFilter = "all" | "inspections" | "rentals" | "appointments";

type AgendaEvent =
  | {
      key: string;
      kind: "inspection";
      dueDate: string;
      customer?: CustomerRecord;
      machineList: MachineRecord[];
      planningEntries: Array<{
        customer?: CustomerRecord;
        machine?: MachineRecord;
        item: PlanningRecord;
        state: PlanningDisplayState;
      }>;
      routeName?: string;
      state: PlanningDisplayState;
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
      rentalMoment: "start" | "end";
    }
  | {
      key: string;
      kind: "appointment";
      dueDate: string;
      place: string;
      appointment: AgendaEventRecord;
      machineList: [];
    };

function compactMonthLabel(date: Date) {
  return date
    .toLocaleDateString("nl-NL", {
      month: "short",
      year: "numeric"
    })
    .replace(".", "");
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

function customerDisplayName(customer?: CustomerRecord) {
  if (!customer) {
    return "Onbekende klant";
  }

  return isRentalStockCustomer(customer) ? "Voorraad machine" : getCustomerDisplayName(customer);
}

function stateLabel(state: PlanningDisplayState) {
  if (state === "overdue") return "Verlopen";
  if (state === "scheduled") return "Gepland";
  return "Niet ingepland";
}

function routeNameFromPlanningItem(item: Pick<PlanningRecord, "notes">) {
  const note = item.notes?.trim() ?? "";
  return note.startsWith("Route: ") ? note.replace(/^Route:\s*/, "").trim() : "";
}

function combinePlanningState(
  current: PlanningDisplayState,
  next: PlanningDisplayState
): PlanningDisplayState {
  if (current === "overdue" || next === "overdue") return "overdue";
  if (current === "scheduled" || next === "scheduled") return "scheduled";
  if (current === "completed" && next === "completed") return "completed";
  if (current === "completed") return next;
  if (next === "completed") return current;
  return "upcoming";
}

function rentalPhaseLabel(rental: RentalRecord) {
  const today = todayLocalIso();
  if (rental.status === "completed" || rental.endDate < today) {
    return "Afgerond";
  }
  if (rental.startDate > today) {
    return "Komend";
  }
  return "Actief";
}

function rentalMomentLabel(moment: "start" | "end") {
  return moment === "start" ? "Start verhuur" : "Einde verhuur";
}

function planningMachineLabel(machine?: MachineRecord) {
  if (!machine) {
    return "Machine";
  }

  if (machine.machineType === "batterij_lader" || machine.machineType === "stellingmateriaal") {
    return formatMachineKindBrandType(machine);
  }

  return [machine.internalNumber || machine.machineNumber, machine.brand, machine.model]
    .filter(Boolean)
    .join(" ") || "Machine";
}

function isBatteryAccessoryMachine(machine?: MachineRecord) {
  return machine?.machineType === "batterij_lader";
}

function eventHasBatteryAccessory(event: AgendaEvent) {
  return event.machineList.some(isBatteryAccessoryMachine);
}

function eventMatchesFilter(event: AgendaEvent, filter: ViewFilter) {
  if (filter === "all") {
    return true;
  }
  if (filter === "inspections") {
    return event.kind === "inspection";
  }
  if (filter === "rentals") {
    return event.kind === "rental";
  }
  return event.kind === "appointment";
}

function mobileDaySummary(events: AgendaEvent[]) {
  const counts = {
    inspection: 0,
    rental: 0,
    appointment: 0
  };
  let inspectionTone: PlanningDisplayState = "upcoming";

  for (const event of events) {
    counts[event.kind] += 1;
    if (event.kind === "inspection") {
      if (event.state === "overdue") {
        inspectionTone = "overdue";
      } else if (event.state === "scheduled" && inspectionTone !== "overdue") {
        inspectionTone = "scheduled";
      }
    }
  }

  return ([
    counts.inspection
      ? {
          kind: "inspection" as const,
          tone: inspectionTone,
          label: `${counts.inspection} keur`
        }
      : null,
    counts.rental ? { kind: "rental" as const, tone: "rental" as const, label: `${counts.rental} huur` } : null,
    counts.appointment
      ? { kind: "appointment" as const, tone: "appointment" as const, label: `${counts.appointment} vrij` }
      : null
  ].filter(Boolean) as Array<{
    kind: "inspection" | "rental" | "appointment";
    tone: PlanningDisplayState | "rental" | "appointment";
    label: string;
  }>).slice(0, 3);
}

function dayPopupTitle(event: AgendaEvent) {
  if (event.kind === "appointment") {
    return event.appointment.title;
  }

  if (event.kind === "inspection") {
    if (event.routeName) {
      return event.routeName;
    }
    return `${customerDisplayName(event.customer)} - ${event.machineList.length}`;
  }

  return customerDisplayName(event.customer);
}

function dayPopupSubtitle(event: AgendaEvent) {
  if (event.kind === "appointment") {
    return event.appointment.description || "Losse agenda-afspraak";
  }

  if (event.kind === "rental") {
    return `${rentalMomentLabel(event.rentalMoment)} | ${planningMachineLabel(event.machineList[0])}`;
  }

  if (event.routeName) {
    return `Route | ${event.machineList.length} keuringen`;
  }

  return `${event.place} | ${event.machineList.length} machine${event.machineList.length === 1 ? "" : "s"}`;
}

export function PlanningCalendar({
  items,
  rentals,
  agendaEventItems,
  customers,
  machines,
  initialMonth,
  children
}: PlanningCalendarProps) {
  const [anchorDate, setAnchorDate] = useState(() => parseMonthKey(initialMonth));
  const [query, setQuery] = useState("");
  const [sortByPlace, setSortByPlace] = useState(true);
  const [viewFilter, setViewFilter] = useState<ViewFilter>("all");
  const [selectedDayKey, setSelectedDayKey] = useState("");
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

  const customerById = useMemo(
    () => new Map(customers.map((customer) => [customer.id, customer])),
    [customers]
  );

  const machineById = useMemo(
    () => new Map(machines.map((machine) => [machine.id, machine])),
    [machines]
  );

  const planningItemIdsByEventKey = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const item of items) {
      const routeName = routeNameFromPlanningItem(item);
      const key = routeName
        ? `route-${item.dueDate}-${routeName}`
        : `inspection-${item.customerId}-${item.dueDate}`;
      const current = map.get(key) ?? [];
      current.push(item.id);
      map.set(key, current);
    }
    return map;
  }, [items]);

  const monthStart = startOfMonth(anchorDate);
  const monthStartIso = formatLocalDateInput(monthStart);
  const monthEndIso = formatLocalDateInput(new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0));

  const calendarEvents = useMemo(() => {
    const groupedPlanning = new Map<string, AgendaEvent>();

    items
      .filter((item) => item.dueDate >= monthStartIso && item.dueDate <= monthEndIso)
      .forEach((item) => {
        const customer = customerById.get(item.customerId);
        const machine = machineById.get(item.machineId);
        const routeName = routeNameFromPlanningItem(item);
        const key = routeName
          ? `route-${item.dueDate}-${routeName}`
          : `inspection-${item.customerId}-${item.dueDate}`;
        const place = routeName || placeLabel(customer);
        const state = getPlanningDisplayState(item);

        if (!groupedPlanning.has(key)) {
          groupedPlanning.set(key, {
            key,
            kind: "inspection",
            dueDate: item.dueDate,
            customer,
            machineList: machine ? [machine] : [],
            planningEntries: [{ customer, machine, item, state }],
            routeName: routeName || undefined,
            state,
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
        current.planningEntries.push({ customer, machine, item, state: getPlanningDisplayState(item) });
        if (!current.inspectionId && item.inspectionId) {
          current.inspectionId = item.inspectionId;
        }
        current.state = combinePlanningState(current.state, getPlanningDisplayState(item));
      });

    const rentalEvents: AgendaEvent[] = rentals.flatMap((rental) => {
      const customer = customerById.get(rental.customerId);
      const machine = machineById.get(rental.machineId);
      if (!machine) {
        return [];
      }

      const result: AgendaEvent[] = [];
      const moments = [
        { dueDate: rental.startDate, rentalMoment: "start" as const },
        { dueDate: rental.endDate, rentalMoment: "end" as const }
      ];

      for (const moment of moments) {
        if (moment.dueDate < monthStartIso || moment.dueDate > monthEndIso) {
          continue;
        }

        result.push({
          key: `rental-${rental.id}-${moment.rentalMoment}`,
          kind: "rental",
          dueDate: moment.dueDate,
          customer,
          machineList: [machine],
          place: placeLabel(customer),
          rental,
          rentalMoment: moment.rentalMoment
        });
      }

      return result;
    });

    const manualEvents: AgendaEvent[] = agendaEventItems
      .filter((item) => item.eventDate >= monthStartIso && item.eventDate <= monthEndIso)
      .map((item) => ({
        key: `appointment-${item.id}`,
        kind: "appointment" as const,
        dueDate: item.eventDate,
        place: "Eigen afspraak",
        appointment: item,
        machineList: []
      }));

    const allEvents = [...Array.from(groupedPlanning.values()), ...rentalEvents, ...manualEvents];
    const needle = query.trim().toLowerCase();

    return allEvents
      .filter((event) => {
        if (!eventMatchesFilter(event, viewFilter)) {
          return false;
        }

        if (!needle) {
          return true;
        }

        const haystack = [
          event.kind === "appointment" ? event.appointment.title : customerDisplayName(event.customer),
          event.place,
          event.kind === "appointment" ? event.appointment.description : "",
          event.kind === "rental" ? rentalMomentLabel(event.rentalMoment) : "",
          ...event.machineList.map((machine) =>
            [
              planningMachineLabel(machine),
              machine.internalNumber,
              machine.machineNumber,
              machine.brand,
              machine.model,
              machine.serialNumber,
              machine.configuration.battery_brand,
              machine.configuration.battery_type,
              machine.configuration.charger_brand,
              machine.configuration.charger_type,
              machine.configuration.racking_type
            ]
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
          const kindWeight = { appointment: 0, rental: 1, inspection: 2 } as const;
          return kindWeight[left.kind] - kindWeight[right.kind];
        }

        if (sortByPlace) {
          if (left.kind === "appointment" && right.kind === "appointment") {
            return left.appointment.title.localeCompare(right.appointment.title, "nl");
          }
          return left.place.localeCompare(right.place, "nl");
        }

        return (left.kind === "appointment"
          ? left.appointment.title
          : customerDisplayName(left.customer)
        ).localeCompare(
          right.kind === "appointment"
            ? right.appointment.title
            : customerDisplayName(right.customer),
          "nl"
        );
      });
  }, [
    agendaEventItems,
    customerById,
    items,
    machineById,
    monthEndIso,
    monthStartIso,
    query,
    rentals,
    sortByPlace,
    viewFilter
  ]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, AgendaEvent[]>();
    calendarEvents.forEach((event) => {
      const current = map.get(event.dueDate) ?? [];
      current.push(event);
      map.set(event.dueDate, current);
    });
    return map;
  }, [calendarEvents]);

  const mobileDays = useMemo(
    () =>
      Array.from(eventsByDay.entries())
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([date, groups]) => ({ date, groups })),
    [eventsByDay]
  );

  const selectedDayEvents = selectedDayKey ? eventsByDay.get(selectedDayKey) ?? [] : [];
  const selectedDayDate = selectedDayKey ? parseLocalDateInput(selectedDayKey) : null;
  const eventByKey = useMemo(
    () => new Map(calendarEvents.map((event) => [event.key, event])),
    [calendarEvents]
  );
  const selectedEvent = selectedEventKey ? eventByKey.get(selectedEventKey) ?? null : null;
  const selectedPrimaryMachine = selectedEvent?.machineList[0] ?? null;
  const selectedPlanningItemIds =
    selectedEvent?.kind === "inspection"
      ? planningItemIdsByEventKey.get(selectedEvent.key) ?? []
      : [];
  const selectedTitle =
    selectedEvent?.kind === "appointment"
      ? selectedEvent.appointment.title
      : selectedEvent?.kind === "inspection"
        ? selectedEvent.routeName || `${customerDisplayName(selectedEvent.customer)} - ${selectedEvent.machineList.length}`
        : customerDisplayName(selectedEvent?.customer);
  const selectedSubtitle =
    selectedEvent?.kind === "appointment"
      ? selectedEvent.appointment.description || "Losse agenda-afspraak"
      : selectedEvent?.kind === "inspection" && selectedEvent.routeName
        ? `${formatDisplayDate(selectedEvent.dueDate)} | ${selectedEvent.machineList.length} keuringen`
        : [
          selectedEvent?.customer?.address,
          selectedEvent?.customer?.city
        ]
          .filter(Boolean)
          .join(", ") || "Adres onbekend";
  const selectedInspectionTone =
    selectedEvent?.kind === "inspection"
      ? getPlanningDisplayLabel({
          state: selectedEvent.state,
          inspectionId: selectedEvent.inspectionId ?? "",
          dueDate: selectedEvent.dueDate,
          notes: selectedEvent.state === "scheduled" ? "Handmatig gepland" : ""
        })
      : "";
  const showMoveAction =
    selectedEvent?.kind === "inspection" &&
    (selectedEvent.state === "upcoming" || selectedEvent.state === "overdue");

  return (
    <div className="panel">
      <div className="calendar-head">
        <div className="calendar-head-main">
          <h1 className="calendar-title">Planning</h1>
          <div className="search-bar calendar-head-search">
            <input
              className="calendar-search-input"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Zoek in agenda"
            />
          </div>
        </div>
        <div className="calendar-controls">
          <div className="calendar-mobile-toolbar">
            <div className="calendar-month-switcher" aria-label="Maand wisselen">
              <button
                className="button-secondary calendar-arrow-button"
                type="button"
                onClick={() => setAnchorDate(addMonths(anchorDate, -1))}
                aria-label="Vorige maand"
              >
                <ChevronLeft size={18} />
              </button>
              <div className="calendar-month-pill">{compactMonthLabel(anchorDate)}</div>
              <button
                className="button-secondary calendar-arrow-button"
                type="button"
                onClick={() => setAnchorDate(addMonths(anchorDate, 1))}
                aria-label="Volgende maand"
              >
                <ChevronRight size={18} />
              </button>
            </div>
            {children ? <div className="calendar-mobile-actions">{children}</div> : null}
          </div>
        </div>
      </div>

      <div className="mobile-month-grid-wrap">
        <div className="mobile-month-grid-head">
          {["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"].map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>
        <div className="mobile-month-grid">
          {calendarDays.map((day) => {
            const dayKey = formatLocalDateInput(day);
            const dayEvents = eventsByDay.get(dayKey) ?? [];
            const isCurrentMonth = day.getMonth() === anchorDate.getMonth();
            const isToday = dayKey === todayLocalIso();
            const daySummary = mobileDaySummary(dayEvents);

            return (
              <button
                className={`mobile-month-cell ${isCurrentMonth ? "" : "is-outside"} ${isToday ? "is-today" : ""} ${dayEvents.length ? "has-events" : ""}`}
                disabled={dayEvents.length === 0}
                key={dayKey}
                type="button"
                onClick={() => setSelectedDayKey(dayKey)}
              >
                <span className="mobile-month-cell-date">{dateNumber(day)}</span>
                <div className="mobile-month-cell-events">
                  {daySummary.length === 0 ? (
                    <span className="mobile-month-cell-empty" />
                  ) : (
                    daySummary.map((item) => (
                      <span
                        className={`mobile-month-pill ${item.tone}`}
                        key={`${dayKey}-${item.kind}`}
                      >
                        {item.label}
                      </span>
                    ))
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mobile-agenda-list">
        {mobileDays.length === 0 ? (
          <div className="agenda-row empty">Geen afspraken in deze maand</div>
        ) : (
          mobileDays.map(({ date, groups }) => (
            <section className="agenda-day-card" key={date}>
              <div className="agenda-day-head">
                <strong>{dayLabel(parseLocalDateInput(date))}</strong>
                <span>
                  {groups.length} {groups.length === 1 ? "afspraak" : "afspraken"}
                </span>
              </div>
              {groups.map((event) => (
                <button
                  key={event.key}
                  className={`agenda-row ${event.kind === "appointment" ? "appointment" : event.kind === "rental" ? "rental" : event.state}`}
                  type="button"
                  onClick={() => setSelectedEventKey(event.key)}
                >
                  <div className="agenda-time">
                    {event.kind === "rental"
                      ? planningMachineLabel(event.machineList[0])
                      : event.kind === "appointment"
                        ? "Afspraak"
                        : event.routeName
                          ? "Route"
                        : event.place}
                  </div>
                  <div className="agenda-main">
                    <strong>
                      {event.kind === "appointment"
                        ? event.appointment.title
                        : event.kind === "inspection"
                          ? event.routeName || `${customerDisplayName(event.customer)} - ${event.machineList.length}`
                          : customerDisplayName(event.customer)}
                    </strong>
                    {event.kind === "appointment" ? (
                      <span>{event.appointment.description || "Losse agenda-afspraak"}</span>
                    ) : (
                      <span>
                        {event.machineList.length} machine{event.machineList.length === 1 ? "" : "s"}
                      </span>
                    )}
                    {event.kind === "appointment" ? (
                      <span>Afspraak</span>
                    ) : (
                      <span>
                        {event.kind === "rental"
                          ? `${rentalMomentLabel(event.rentalMoment)} - ${rentalPhaseLabel(event.rental)}`
                          : `Keuring - ${stateLabel(event.state)}`}
                      </span>
                    )}
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
            const dayKey = formatLocalDateInput(day);
            const dayEvents = eventsByDay.get(dayKey) ?? [];
            const visibleDayEventCount = dayEvents.length > 2 ? 1 : 2;
            const visibleDayEvents = dayEvents.slice(0, visibleDayEventCount);
            const hiddenDayEvents = dayEvents.length - visibleDayEvents.length;
            const isCurrentMonth = day.getMonth() === anchorDate.getMonth();
            const isToday = dayKey === todayLocalIso();

            return (
              <div
                className={`month-cell ${isCurrentMonth ? "" : "is-outside"} ${isToday ? "is-today" : ""}`}
                key={dayKey}
              >
                <div className="month-cell-date">{dateNumber(day)}</div>
                <div className="month-cell-events">
                  {visibleDayEvents.map((event) => (
                    <button
                      key={event.key}
                      className={`month-event ${event.kind === "appointment" ? "appointment" : event.kind === "rental" ? "rental" : event.state} ${eventHasBatteryAccessory(event) ? "battery-accessory-event" : ""}`}
                      type="button"
                      onClick={() => setSelectedEventKey(event.key)}
                    >
                      <strong>
                        {event.kind === "rental"
                          ? planningMachineLabel(event.machineList[0])
                          : event.kind === "appointment"
                            ? event.appointment.title
                            : event.routeName || `${customerDisplayName(event.customer)} - ${event.machineList.length}`}
                      </strong>
                      <span>
                        {event.kind === "rental"
                          ? rentalMomentLabel(event.rentalMoment)
                          : event.kind === "appointment"
                            ? "Afspraak"
                            : "Keuring"}
                      </span>
                      <span className="month-event-meta">
                        {event.kind === "rental"
                          ? customerDisplayName(event.customer)
                          : event.kind === "appointment"
                            ? event.appointment.description || "Eigen agenda"
                            : event.routeName
                              ? `${event.machineList.length} keuringen`
                              : `${event.machineList.length} machine${event.machineList.length === 1 ? "" : "s"}`}
                      </span>
                    </button>
                  ))}
                  {hiddenDayEvents > 0 ? (
                    <button
                      className="month-event month-event-more"
                      type="button"
                      onClick={() => setSelectedDayKey(dayKey)}
                    >
                      <strong>+{hiddenDayEvents} meer</strong>
                      <span>Bekijk alle afspraken</span>
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="calendar-filter-row">
        <button
          className={`button-secondary calendar-filter-button ${viewFilter === "all" ? "active-toggle" : ""}`}
          type="button"
          onClick={() => setViewFilter("all")}
        >
          Alles
        </button>
        <button
          className={`button-secondary calendar-filter-button ${viewFilter === "inspections" ? "active-toggle" : ""}`}
          type="button"
          onClick={() => setViewFilter("inspections")}
        >
          Keuring
        </button>
        <button
          className={`button-secondary calendar-filter-button ${viewFilter === "rentals" ? "active-toggle" : ""}`}
          type="button"
          onClick={() => setViewFilter("rentals")}
        >
          Verhuur
        </button>
        <button
          className={`button-secondary calendar-filter-button ${viewFilter === "appointments" ? "active-toggle" : ""}`}
          type="button"
          onClick={() => setViewFilter("appointments")}
        >
          Vrij
        </button>
      </div>

      {selectedDayDate ? (
        <div className="modal-backdrop" onClick={() => setSelectedDayKey("")}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="eyebrow">Dagoverzicht</div>
            <h2>{dayLabel(selectedDayDate)}</h2>
            <p className="muted" style={{ marginTop: "-0.35rem", marginBottom: "1rem" }}>
              {formatDisplayDate(selectedDayKey)} | {selectedDayEvents.length}{" "}
              {selectedDayEvents.length === 1 ? "afspraak" : "afspraken"}
            </p>
            <div className="list compact-list">
              {selectedDayEvents.map((event) => (
                <button
                  className={`list-item calendar-day-option ${eventHasBatteryAccessory(event) ? "battery-accessory-row" : ""}`}
                  key={event.key}
                  type="button"
                  onClick={() => {
                    setSelectedDayKey("");
                    setSelectedEventKey(event.key);
                  }}
                >
                  <span>
                    <strong>{dayPopupTitle(event)}</strong>
                    <br />
                    {dayPopupSubtitle(event)}
                  </span>
                  <strong>
                    {event.kind === "appointment"
                      ? "Vrij"
                      : event.kind === "rental"
                        ? "Huur"
                        : stateLabel(event.state)}
                  </strong>
                </button>
              ))}
            </div>
            <div className="actions">
              <button className="button" type="button" onClick={() => setSelectedDayKey("")}>
                Sluiten
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {selectedEvent ? (
        <div className="modal-backdrop" onClick={() => setSelectedEventKey("")}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="eyebrow">
              {selectedEvent.kind === "rental"
                ? "Verhuur"
                : selectedEvent.kind === "appointment"
                  ? "Afspraak"
                  : selectedEvent.routeName
                    ? "Route"
                  : selectedInspectionTone === "Gepland"
                    ? "Ingeplande keuring"
                    : "Verwachte keuring"}
            </div>
            <h2>{selectedTitle}</h2>
            <p className="muted" style={{ marginTop: "-0.35rem", marginBottom: "1rem" }}>
              {selectedSubtitle}
              {selectedEvent.kind !== "appointment" && selectedEvent.customer?.phone
                ? ` | ${selectedEvent.customer.phone}`
                : ""}
            </p>
            <div className="list">
              {selectedEvent.kind === "appointment" ? (
                <>
                  <div className="list-item static-list-item">
                    <span>Datum</span>
                    <strong>{formatDisplayDate(selectedEvent.dueDate)}</strong>
                  </div>
                  <div className="list-item static-list-item">
                    <span>Type</span>
                    <strong>Vrije afspraak</strong>
                  </div>
                </>
              ) : selectedEvent.kind === "rental" ? (
                <>
                  <div className="list-item static-list-item">
                    <span>Plaats</span>
                    <strong>{selectedEvent.place}</strong>
                  </div>
                  <div className="list-item static-list-item">
                    <span>{selectedEvent.rentalMoment === "start" ? "Verhuur start" : "Verhuur eindigt"}</span>
                    <strong>{formatDisplayDate(selectedEvent.dueDate)}</strong>
                  </div>
                  <div className="list-item static-list-item">
                    <span>Periode</span>
                    <strong>{formatDisplayDate(selectedEvent.rental.startDate)} t/m {formatDisplayDate(selectedEvent.rental.endDate)}</strong>
                  </div>
                </>
              ) : (
                <>
                  <div className="list-item static-list-item">
                    <span>{selectedEvent.routeName ? "Route" : "Plaats"}</span>
                    <strong>{selectedEvent.routeName || selectedEvent.place}</strong>
                  </div>
                  <div className="list-item static-list-item">
                    <span>Datum</span>
                    <strong>{formatDisplayDate(selectedEvent.dueDate)}</strong>
                  </div>
                </>
              )}
              {selectedEvent.kind === "appointment" ? null : (
                <div className="list-item static-list-item">
                  <span>Status</span>
                  <strong>
                    {selectedEvent.kind === "rental"
                      ? rentalPhaseLabel(selectedEvent.rental)
                      : stateLabel(selectedEvent.state)}
                  </strong>
                </div>
              )}
            </div>

            {selectedEvent.kind === "appointment" ? null : (
              <div className="form-block" style={{ marginTop: "1rem" }}>
                <div className="eyebrow">{selectedEvent.kind === "inspection" && selectedEvent.routeName ? "Routeplanning" : "Machines"}</div>
                <div className="list compact-list">
                  {selectedEvent.kind === "inspection" && selectedEvent.routeName
                    ? selectedEvent.planningEntries.map((entry) => (
                        <Link
                          className={`list-item ${isBatteryAccessoryMachine(entry.machine) ? "battery-accessory-row" : ""}`}
                          href={entry.machine ? `/machines/${entry.machine.id}` : "#"}
                          key={entry.item.id}
                        >
                          <span>
                            <strong>
                              {entry.customer ? customerDisplayName(entry.customer) : "Onbekende klant"}
                            </strong>
                            <br />
                            {planningMachineLabel(entry.machine)}
                            {entry.machine?.serialNumber ? ` | Serienr: ${entry.machine.serialNumber}` : ""}
                          </span>
                          <strong className={entry.state === "completed" ? "route-done-badge" : undefined}>
                            {entry.state === "completed" ? (
                              <>
                                <CheckCircle size={16} />
                                Gedaan
                              </>
                            ) : (
                              stateLabel(entry.state)
                            )}
                          </strong>
                        </Link>
                      ))
                    : selectedEvent.machineList.map((machine) => (
                        <Link
                          className={`list-item ${isBatteryAccessoryMachine(machine) ? "battery-accessory-row" : ""}`}
                          href={`/machines/${machine.id}`}
                          key={machine.id}
                        >
                          <span>
                            <strong>
                              {planningMachineLabel(machine)}
                            </strong>
                            {machine.machineType !== "batterij_lader" ? (
                              <>
                                <br />
                                Serienr: {machine.serialNumber || "-"}
                              </>
                            ) : null}
                          </span>
                          <strong>{machine.machineType === "batterij_lader" ? "Batterij/lader" : machine.internalNumber || machine.machineNumber || "-"}</strong>
                        </Link>
                      ))}
                </div>
              </div>
            )}

            <div className="actions calendar-popup-actions">
              {selectedEvent.kind === "rental" ? (
                <form action={updateRentalAction} className="panel" style={{ width: "100%", marginBottom: "0.5rem" }}>
                  <input type="hidden" name="rentalId" value={selectedEvent.rental.id} />
                  <input type="hidden" name="month" value={monthKey(anchorDate)} />
                  <div className="eyebrow">Verhuur aanpassen</div>
                  <div className="form-grid-wide" style={{ marginTop: "0.75rem" }}>
                    <CustomerPicker
                      customers={customers}
                      defaultCustomerId={selectedEvent.customer?.id}
                      label="Klant"
                      required
                    />
                    <div className="field">
                      <label htmlFor="popup-rental-start">Startdatum</label>
                      <input
                        id="popup-rental-start"
                        name="startDate"
                        type="date"
                        defaultValue={selectedEvent.rental.startDate}
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="popup-rental-end">Einddatum</label>
                      <input
                        id="popup-rental-end"
                        name="endDate"
                        type="date"
                        defaultValue={selectedEvent.rental.endDate}
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="popup-rental-price">Prijs</label>
                      <input
                        id="popup-rental-price"
                        name="price"
                        defaultValue={selectedEvent.rental.price || ""}
                      />
                    </div>
                  </div>
                  <div className="actions" style={{ marginTop: "0.75rem" }}>
                    <button className="button" type="submit">
                      Verhuur bijwerken
                    </button>
                  </div>
                </form>
              ) : selectedEvent.kind === "appointment" ? (
                <>
                  <form
                    action={updateAgendaEventAction}
                    className="panel"
                    style={{ width: "100%", marginBottom: "0.5rem" }}
                  >
                    <input type="hidden" name="id" value={selectedEvent.appointment.id} />
                    <input type="hidden" name="month" value={monthKey(anchorDate)} />
                    <div className="eyebrow">Afspraak aanpassen</div>
                    <div className="form-grid-wide" style={{ marginTop: "0.75rem" }}>
                      <div className="field">
                        <label htmlFor="popup-agenda-title">Titel</label>
                        <input
                          id="popup-agenda-title"
                          name="title"
                          defaultValue={selectedEvent.appointment.title}
                        />
                      </div>
                      <div className="field">
                        <label htmlFor="popup-agenda-date">Datum</label>
                        <input
                          id="popup-agenda-date"
                          name="eventDate"
                          type="date"
                          defaultValue={selectedEvent.appointment.eventDate}
                        />
                      </div>
                      <div className="field">
                        <label htmlFor="popup-agenda-description">Beschrijving</label>
                        <input
                          id="popup-agenda-description"
                          name="description"
                          defaultValue={selectedEvent.appointment.description || ""}
                        />
                      </div>
                    </div>
                    <div className="actions" style={{ marginTop: "0.75rem" }}>
                      <button className="button" type="submit">
                        Afspraak bijwerken
                      </button>
                    </div>
                  </form>
                  <form action={deleteAgendaEventAction} style={{ width: "100%" }}>
                    <input type="hidden" name="id" value={selectedEvent.appointment.id} />
                    <input type="hidden" name="month" value={monthKey(anchorDate)} />
                    <button className="button-secondary calendar-popup-button" type="submit">
                      Afspraak verwijderen
                    </button>
                  </form>
                </>
              ) : (
                <>
                  <form action={updatePlanningItemAction} className="panel" style={{ width: "100%", marginBottom: "0.5rem" }}>
                    <input type="hidden" name="ids" value={JSON.stringify(selectedPlanningItemIds)} />
                    <input type="hidden" name="month" value={monthKey(anchorDate)} />
                    <div className="eyebrow">Keuring verplaatsen</div>
                    <div className="field" style={{ marginTop: "0.75rem" }}>
                      <label htmlFor="popup-planning-date">Nieuwe datum</label>
                      <input
                        id="popup-planning-date"
                        name="dueDate"
                        type="date"
                        defaultValue={selectedEvent.dueDate}
                      />
                    </div>
                    <div className="actions" style={{ marginTop: "0.75rem" }}>
                      {showMoveAction ? (
                        <button className="button-secondary" type="submit" name="mode" value="move">
                          Verplaatsen
                        </button>
                      ) : null}
                      <button className="button" type="submit" name="mode" value="schedule">
                        Inplannen
                      </button>
                    </div>
                  </form>
                  <form action={deletePlanningItemAction} style={{ width: "100%", marginBottom: "0.5rem" }}>
                    <input type="hidden" name="ids" value={JSON.stringify(selectedPlanningItemIds)} />
                    <input type="hidden" name="month" value={monthKey(anchorDate)} />
                    <button className="button-secondary calendar-popup-button" type="submit">
                      Planning verwijderen
                    </button>
                  </form>
                </>
              )}
              {selectedEvent.kind !== "appointment" && selectedEvent.customer?.id ? (
                <Link className="button-secondary calendar-popup-button" href={`/klanten/${selectedEvent.customer.id}`}>
                  Open klantkaart
                </Link>
              ) : null}
              {selectedEvent.kind !== "appointment" && selectedPrimaryMachine ? (
                <Link className="button-secondary calendar-popup-button" href={`/machines/${selectedPrimaryMachine.id}`}>
                  Open machinekaart
                </Link>
              ) : null}
              <button className="button calendar-popup-button" type="button" onClick={() => setSelectedEventKey("")}>
                Sluiten
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
