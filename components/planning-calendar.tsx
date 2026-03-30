"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import type { CustomerRecord, MachineRecord, PlanningRecord } from "@/lib/domain";
import { movePlanningItemAction } from "@/app/klanten/actions";

interface PlanningCalendarProps {
  items: PlanningRecord[];
  customers: CustomerRecord[];
  machines: MachineRecord[];
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
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedItemId, setSelectedItemId] = useState<string>("");
  const [, startTransition] = useTransition();

  const days = useMemo(() => {
    const start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const end = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    const startOffset = (start.getDay() + 6) % 7;
    const totalDays = end.getDate();
    const cells = [];

    for (let i = 0; i < startOffset; i += 1) {
      cells.push(null);
    }

    for (let day = 1; day <= totalDays; day += 1) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
      cells.push(date.toISOString().slice(0, 10));
    }

    return cells;
  }, [currentDate]);

  const selectedItem = items.find((item) => item.id === selectedItemId) ?? null;
  const selectedCustomer = customers.find((customer) => customer.id === selectedItem?.customerId);
  const selectedMachine = machines.find((machine) => machine.id === selectedItem?.machineId);

  return (
    <div className="panel">
      <div className="calendar-head">
        <div>
          <div className="eyebrow">Planning</div>
          <h1>Agenda</h1>
        </div>
        <div className="inline-meta">
          <button
            className="button-secondary"
            type="button"
            onClick={() =>
              setCurrentDate(
                new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1)
              )
            }
          >
            Vorige
          </button>
          <span className="badge blue">
            {currentDate.toLocaleDateString("nl-NL", {
              month: "long",
              year: "numeric"
            })}
          </span>
          <button
            className="button-secondary"
            type="button"
            onClick={() =>
              setCurrentDate(
                new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1)
              )
            }
          >
            Volgende
          </button>
        </div>
      </div>
      <div className="calendar-grid">
        {["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"].map((day) => (
          <div className="calendar-day-head" key={day}>
            {day}
          </div>
        ))}
        {days.map((date) => (
          <div
            className="calendar-cell"
            key={date ?? Math.random()}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              const id = event.dataTransfer.getData("text/planning-id");
              if (!id || !date) {
                return;
              }
              const formData = new FormData();
              formData.set("id", id);
              formData.set("dueDate", date);
              startTransition(() => {
                movePlanningItemAction(formData);
              });
            }}
          >
            {date ? <strong>{date.slice(-2)}</strong> : null}
            <div className="calendar-items">
              {items
                .filter((item) => item.dueDate === date)
                .map((item) => (
                  <button
                    key={item.id}
                    className={`calendar-item ${item.state}`}
                    draggable
                    onDragStart={(event) =>
                      event.dataTransfer.setData("text/planning-id", item.id)
                    }
                    onClick={() => setSelectedItemId(item.id)}
                    type="button"
                  >
                    <strong>
                      {machines.find((machine) => machine.id === item.machineId)?.internalNumber ||
                        machines.find((machine) => machine.id === item.machineId)?.machineNumber ||
                        "Machine"}
                    </strong>
                    <span>
                      {customers.find((customer) => customer.id === item.customerId)?.companyName ??
                        "-"}
                    </span>
                    <em>{stateLabel(item.state)}</em>
                  </button>
                ))}
            </div>
          </div>
        ))}
      </div>
      {selectedItem ? (
        <div className="modal-backdrop" onClick={() => setSelectedItemId("")}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="eyebrow">Geplande keuring</div>
            <h2>{selectedCustomer?.companyName ?? "Onbekende klant"}</h2>
            <div className="list">
              <div className="list-item">
                <span>Machine</span>
                <strong>
                  {selectedMachine?.brand ?? "Machine"} {selectedMachine?.model ?? ""}
                </strong>
              </div>
              <div className="list-item">
                <span>Datum</span>
                <strong>{selectedItem.dueDate}</strong>
              </div>
            </div>
            <div className="actions">
              <Link className="button-secondary" href={`/klanten/${selectedItem.customerId}`}>
                Open klantkaart
              </Link>
              <Link className="button-secondary" href={`/machines/${selectedItem.machineId}`}>
                Open machinekaart
              </Link>
              <button className="button" type="button" onClick={() => setSelectedItemId("")}>
                Sluiten
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
