"use client";

import { useActionState, useMemo, useState } from "react";
import { getFormDefinition } from "@/lib/form-definitions";
import { addTwelveMonths } from "@/lib/utils";
import type { ChecklistOption, MachineType } from "@/lib/types";
import {
  submitInspectionAction,
  type InspectionActionState
} from "@/app/keuringen/nieuw/actions";

interface InspectionFormProps {
  defaultType?: MachineType;
}

const machineTypeOptions: { value: MachineType; label: string }[] = [
  { value: "heftruck_reachtruck", label: "Heftruck / reachtruck" },
  { value: "batterij_lader", label: "Batterij en laders" },
  { value: "graafmachine", label: "Graafmachine" },
  { value: "hoogwerker", label: "Hoogwerker" },
  { value: "palletwagen_stapelaar", label: "Palletwagen / heffer / stapelaar" },
  { value: "shovel", label: "Shovel" },
  { value: "verreiker", label: "Verreiker" },
  { value: "stellingmateriaal", label: "Stellingmateriaal" }
];

export function InspectionForm({
  defaultType = "heftruck_reachtruck"
}: InspectionFormProps) {
  const [type, setType] = useState<MachineType>(defaultType);
  const [values, setValues] = useState<Record<string, string>>({
    inspection_date: new Date().toISOString().slice(0, 10),
    machine_number: ""
  });
  const [checklist, setChecklist] = useState<Record<string, ChecklistOption>>({});
  const [actionState, formAction, isPending] = useActionState<InspectionActionState, FormData>(
    submitInspectionAction,
    { status: "idle" }
  );

  const form = useMemo(() => getFormDefinition(type), [type]);
  const nextInspectionDate = addTwelveMonths(values.inspection_date);

  return (
    <form action={formAction} className="inspection-layout">
      <input type="hidden" name="machine_type" value={type} />
      <input type="hidden" name="checklist" value={JSON.stringify(checklist)} />
      <section className="inspection-card">
        <div className="eyebrow">Stap 1</div>
        <h2>Start nieuwe keuring</h2>
        <p className="muted">
          Kies eerst klant, machine en keuringstype. Bij een bestaande machine kunnen
          velden later automatisch worden vooringevuld vanuit Supabase.
        </p>
        <div className="grid-2">
          <div className="field">
            <label htmlFor="customer-search">Klant</label>
            <input id="customer-search" placeholder="Zoek of maak klant aan" />
          </div>
          <div className="field">
            <label htmlFor="machine-search">Machine</label>
            <input id="machine-search" placeholder="Zoek of maak machine aan" />
          </div>
          <div className="field">
            <label htmlFor="machine-type">Keuringstype</label>
            <select
              id="machine-type"
              name="machine_type_display"
              value={type}
              onChange={(event) => setType(event.target.value as MachineType)}
            >
              {machineTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="autosave">Autosave status</label>
            <input id="autosave" value="Concept wordt automatisch opgeslagen" readOnly />
          </div>
        </div>
      </section>

      <section className="inspection-card">
        <div className="eyebrow">Stap 2</div>
        <h2>{form.title}</h2>
        <p className="muted">
          Het formulier hieronder wordt rechtstreeks opgebouwd uit de Word-structuur.
        </p>
        <div className="grid-2">
          <div className="field">
            <label htmlFor="machine_number">Uniek machinenummer</label>
            <input
              id="machine_number"
              name="machine_number"
              value={values.machine_number ?? ""}
              placeholder="Bijv. M-26001"
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  machine_number: event.target.value
                }))
              }
            />
          </div>
          {form.machineFields.map((field) => (
            <div className="field" key={field.key}>
              <label htmlFor={field.key}>{field.label}</label>
              <input
                id={field.key}
                name={field.key}
                type={field.type ?? "text"}
                value={values[field.key] ?? ""}
                placeholder={field.placeholder}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    [field.key]: event.target.value
                  }))
                }
              />
            </div>
          ))}
        </div>
      </section>

      <section className="inspection-card" style={{ gridColumn: "1 / -1" }}>
        <div className="eyebrow">Stap 3</div>
        <h2>Checklist</h2>
        <div className="checklist">
          {form.sections.map((section) => (
            <div className="section-card" key={section.key}>
              <h3>{section.title}</h3>
              <div className="checklist">
                {section.items.map((item) => (
                  <div className="checklist-row" key={item.key}>
                    <strong>{item.label}</strong>
                    <div className="status-options">
                      {form.checklistOptions.map((option) => (
                        <label className="status-chip" key={option}>
                          <input
                            type="radio"
                            name={item.key}
                            checked={checklist[item.key] === option}
                            onChange={() =>
                              setChecklist((current) => ({
                                ...current,
                                [item.key]: option
                              }))
                            }
                          />
                          {option === "nvt" ? "n.v.t." : option}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="inspection-card">
        <div className="eyebrow">Stap 4</div>
        <h2>Afsluiting</h2>
        <div className="field">
          <label htmlFor="findings">Bevindingen</label>
          <textarea id="findings" name="findings" />
        </div>
        <div className="field">
          <label htmlFor="recommendations">Aanbevelingen</label>
          <textarea id="recommendations" name="recommendations" />
        </div>
        <div className="field">
          <label htmlFor="conclusion">Conclusie</label>
          <textarea id="conclusion" name="conclusion" />
        </div>
        <div className="field">
          <label>Resultaat</label>
          <div className="status-options">
            {form.conclusionLabels.map((label) => (
              <label className="status-chip" key={label}>
                <input type="checkbox" name="result_labels" value={label} />
                {label}
              </label>
            ))}
          </div>
        </div>
        <div className="field">
          <label className="status-chip" htmlFor="send_pdf_to_customer">
            <input id="send_pdf_to_customer" type="checkbox" name="send_pdf_to_customer" />
            PDF ook naar klant mailen
          </label>
        </div>
        <div className="field">
          <label htmlFor="photos">Foto&apos;s van de keuring</label>
          <input id="photos" type="file" name="photos" accept="image/*" multiple />
          <span className="muted">Worden automatisch gecomprimeerd richting circa 300KB per foto.</span>
        </div>
        {actionState.status === "error" ? (
          <p style={{ color: "var(--danger)", margin: 0 }}>{actionState.message}</p>
        ) : null}
      </section>

      <section className="inspection-card">
        <div className="eyebrow">Automatisch na opslaan</div>
        <div className="list">
          <div className="list-item">
            <span>Keurnummer</span>
            <strong>Volgend nummer via jaarreeks</strong>
          </div>
          <div className="list-item">
            <span>Vervolgkeuring</span>
            <strong>{nextInspectionDate || "Kies eerst keuringsdatum"}</strong>
          </div>
          <div className="list-item">
            <span>Documenten</span>
            <strong>PDF klant + Word intern</strong>
          </div>
          <div className="list-item">
            <span>E-mail</span>
            <strong>Intern altijd, klant optioneel</strong>
          </div>
        </div>
        <div className="actions">
          <button className="button" type="submit" disabled={isPending}>
            {isPending ? "Bezig met opslaan..." : "Keuring opslaan"}
          </button>
          <button className="button-secondary" type="button">
            Concept bewaren
          </button>
        </div>
      </section>
    </form>
  );
}
