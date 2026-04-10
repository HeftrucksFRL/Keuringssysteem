"use client";

import { useEffect, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { createAgendaEventAction, createManualPlanningAction } from "@/app/planning/actions";
import type { CustomerRecord, MachineRecord } from "@/lib/domain";

function buildDefaultDate(initialMonth?: string) {
  const today = new Date();
  const todayMonth = today.toISOString().slice(0, 7);

  if (!initialMonth || initialMonth === todayMonth) {
    return today.toISOString().slice(0, 10);
  }

  return `${initialMonth}-01`;
}

function SubmitButton({
  disabled,
  label,
  pendingLabel
}: {
  disabled: boolean;
  label: string;
  pendingLabel: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button className="button" type="submit" disabled={pending || disabled}>
      {pending ? pendingLabel : label}
    </button>
  );
}

interface PlanningCreateFormProps {
  customers: CustomerRecord[];
  machines: MachineRecord[];
  initialMonth?: string;
}

export function PlanningCreateForm({
  customers,
  machines,
  initialMonth
}: PlanningCreateFormProps) {
  const sortedCustomers = useMemo(
    () => [...customers].sort((left, right) => left.companyName.localeCompare(right.companyName, "nl")),
    [customers]
  );

  const [customerId, setCustomerId] = useState(sortedCustomers[0]?.id ?? "");
  const [machineId, setMachineId] = useState("");

  const filteredMachines = useMemo(
    () =>
      machines
        .filter((machine) => machine.customerId === customerId)
        .sort((left, right) =>
          `${left.internalNumber} ${left.brand} ${left.model}`.localeCompare(
            `${right.internalNumber} ${right.brand} ${right.model}`,
            "nl"
          )
        ),
    [customerId, machines]
  );

  useEffect(() => {
    if (!filteredMachines.some((machine) => machine.id === machineId)) {
      setMachineId(filteredMachines[0]?.id ?? "");
    }
  }, [filteredMachines, machineId]);

  return (
    <>
      <form action={createManualPlanningAction} className="form-block planning-create-form">
        <div>
          <div className="eyebrow">Handmatig plannen</div>
          <h2>Keuring toevoegen aan agenda</h2>
          <p className="muted">Plan alvast een keuring zonder eerst het keuringsformulier te starten.</p>
        </div>

        <div className="form-grid-wide planning-create-grid">
          <div className="field">
            <label htmlFor="planning-customer">Klant</label>
            <select
              id="planning-customer"
              name="customerId"
              value={customerId}
              onChange={(event) => setCustomerId(event.target.value)}
            >
              {sortedCustomers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.companyName}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="planning-machine">Machine</label>
            <select
              id="planning-machine"
              name="machineId"
              value={machineId}
              onChange={(event) => setMachineId(event.target.value)}
              disabled={filteredMachines.length === 0}
            >
              {filteredMachines.length === 0 ? (
                <option value="">Geen machines voor deze klant</option>
              ) : (
                filteredMachines.map((machine) => (
                  <option key={machine.id} value={machine.id}>
                    {[machine.internalNumber || machine.machineNumber, machine.brand, machine.model]
                      .filter(Boolean)
                      .join(" ")}
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="field">
            <label htmlFor="planning-date">Geplande datum</label>
            <input
              id="planning-date"
              name="dueDate"
              type="date"
              defaultValue={buildDefaultDate(initialMonth)}
              required
            />
          </div>
        </div>

        <div className="actions" style={{ marginTop: 0 }}>
          <SubmitButton
            disabled={!customerId || !machineId}
            label="Keuring plannen"
            pendingLabel="Even plannen..."
          />
        </div>
      </form>

      <form action={createAgendaEventAction} className="form-block planning-create-form" style={{ marginTop: "1rem" }}>
        <div>
          <div className="eyebrow">Losse afspraak</div>
          <h2>Vrije afspraak toevoegen</h2>
          <p className="muted">Gebruik dit voor een herinnering, werkafspraak of ander agendapunt zonder keuring.</p>
        </div>

        <div className="form-grid-wide planning-create-grid">
          <div className="field">
            <label htmlFor="agenda-title">Titel</label>
            <input id="agenda-title" name="title" placeholder="Bijv. Bezoek klant of onderdelen ophalen" required />
          </div>

          <div className="field">
            <label htmlFor="agenda-date">Datum</label>
            <input
              id="agenda-date"
              name="eventDate"
              type="date"
              defaultValue={buildDefaultDate(initialMonth)}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="agenda-description">Beschrijving</label>
            <input id="agenda-description" name="description" placeholder="Optioneel" />
          </div>
        </div>

        <div className="actions" style={{ marginTop: 0 }}>
          <SubmitButton
            disabled={false}
            label="Afspraak toevoegen"
            pendingLabel="Afspraak opslaan..."
          />
        </div>
      </form>
    </>
  );
}
