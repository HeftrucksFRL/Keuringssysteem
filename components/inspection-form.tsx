"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { getFormDefinition } from "@/lib/form-definitions";
import { addTwelveMonths } from "@/lib/utils";
import type { ChecklistOption, MachineType } from "@/lib/types";
import type {
  CustomerRecord,
  InspectionRecord,
  MachineRecord
} from "@/lib/domain";

interface InspectionFormProps {
  customers: CustomerRecord[];
  machines: MachineRecord[];
  inspections: InspectionRecord[];
  defaultType?: MachineType;
  defaultCustomerId?: string;
  defaultMachineId?: string;
}

interface PhotoItem {
  file: File;
  previewUrl: string;
  sizeLabel: string;
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

function visibleField(fieldKey: string) {
  return !fieldKey.includes("sticker") && fieldKey !== "machine_number";
}

function buildDefaultChecklist(type: MachineType) {
  const definition = getFormDefinition(type);
  const defaultOption = definition.checklistOptions[0];

  return Object.fromEntries(
    definition.sections.flatMap((section) =>
      section.items.map((item) => [item.key, defaultOption])
    )
  ) as Record<string, ChecklistOption>;
}

async function compressImage(file: File) {
  const imageUrl = URL.createObjectURL(file);
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new Image();
    element.onload = () => resolve(element);
    element.onerror = reject;
    element.src = imageUrl;
  });

  const canvas = document.createElement("canvas");
  const scale = Math.min(1, 1600 / Math.max(image.width, image.height));
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas niet beschikbaar");
  }

  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  URL.revokeObjectURL(imageUrl);

  let quality = 0.82;
  let blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", quality)
  );

  while (blob && blob.size > 300 * 1024 && quality > 0.45) {
    quality -= 0.08;
    blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality)
    );
  }

  if (!blob) {
    throw new Error("Afbeelding kon niet worden verwerkt");
  }

  return new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), {
    type: "image/jpeg"
  });
}

export function InspectionForm({
  customers,
  machines,
  inspections,
  defaultType = "heftruck_reachtruck",
  defaultCustomerId = "",
  defaultMachineId = ""
}: InspectionFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [type, setType] = useState<MachineType>(defaultType);
  const [values, setValues] = useState<Record<string, string>>({
    inspection_date: new Date().toISOString().slice(0, 10)
  });
  const [customerQuery, setCustomerQuery] = useState("");
  const [machineQuery, setMachineQuery] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState(defaultCustomerId);
  const [selectedMachineId, setSelectedMachineId] = useState(defaultMachineId);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [checklist, setChecklist] = useState<Record<string, ChecklistOption>>(
    buildDefaultChecklist(defaultType)
  );

  const form = useMemo(() => getFormDefinition(type), [type]);
  const nextInspectionDate = addTwelveMonths(values.inspection_date);

  useEffect(() => {
    setChecklist(buildDefaultChecklist(type));
  }, [type]);

  const filteredCustomers = useMemo(() => {
    const query = customerQuery.trim().toLowerCase();
    if (!query) {
      return customers.slice(0, 8);
    }

    return customers.filter((customer) =>
      customer.companyName.toLowerCase().includes(query)
    );
  }, [customerQuery, customers]);

  const customerMachines = useMemo(() => {
    return machines.filter((machine) =>
      selectedCustomerId ? machine.customerId === selectedCustomerId : true
    );
  }, [machines, selectedCustomerId]);

  const filteredMachines = useMemo(() => {
    const query = machineQuery.trim().toLowerCase();
    if (!query) {
      return customerMachines.slice(0, 8);
    }

    return customerMachines.filter((machine) => {
      const haystack = [
        machine.machineNumber,
        machine.internalNumber,
        machine.brand,
        machine.model
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [customerMachines, machineQuery]);

  useEffect(() => {
    if (!selectedCustomerId) {
      return;
    }

    const customer = customers.find((item) => item.id === selectedCustomerId);
    if (!customer) {
      return;
    }

    setValues((current) => ({
      ...current,
      customer_name: customer.companyName,
      customer_address: customer.address,
      customer_contact: customer.contactName,
      customer_phone: customer.phone,
      customer_email: customer.email
    }));
    if (!customerQuery) {
      setCustomerQuery(customer.companyName);
    }
  }, [selectedCustomerId, customers, customerQuery]);

  useEffect(() => {
    if (!selectedMachineId) {
      return;
    }

    const machine = machines.find((item) => item.id === selectedMachineId);
    if (!machine) {
      return;
    }

    setType(machine.machineType);
    setMachineQuery(
      [machine.machineNumber, machine.brand, machine.model].filter(Boolean).join(" ")
    );
    setValues((current) => ({
      ...current,
      brand: machine.brand,
      model: machine.model,
      serial_number: machine.serialNumber,
      build_year: machine.buildYear,
      internal_number: machine.internalNumber || machine.machineNumber
    }));
    if (!machineQuery) {
      setMachineQuery(
        [machine.internalNumber || machine.machineNumber, machine.brand, machine.model]
          .filter(Boolean)
          .join(" ")
      );
    }

    const previousInspection = inspections.find(
      (inspection) => inspection.machineId === machine.id
    );
    if (!previousInspection) {
      return;
    }

    setValues((current) => ({
      ...current,
      ...previousInspection.machineSnapshot,
      findings: previousInspection.findings,
      recommendations: previousInspection.recommendations,
      conclusion: previousInspection.conclusion,
      inspection_date: current.inspection_date
    }));
    setChecklist({
      ...buildDefaultChecklist(machine.machineType),
      ...previousInspection.checklist
    });
  }, [selectedMachineId, machines, inspections, customerQuery, machineQuery]);

  async function handlePhotoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) {
      setPhotos([]);
      return;
    }

    setMessage("Foto’s worden voorbereid...");
    try {
      const compressed = await Promise.all(
        files.map(async (file) => {
          const compressedFile = await compressImage(file);
          return {
            file: compressedFile,
            previewUrl: URL.createObjectURL(compressedFile),
            sizeLabel: `${Math.round(compressedFile.size / 1024)} KB`
          };
        })
      );
      setPhotos(compressed);
      setMessage(null);
    } catch {
      setMessage("Een foto kon niet worden verwerkt. Probeer het opnieuw.");
    }
  }

  function setFieldValue(key: string, value: string) {
    setValues((current) => ({
      ...current,
      [key]: value
    }));
  }

  function chooseCustomer(customer: CustomerRecord) {
    setSelectedCustomerId(customer.id);
    setCustomerQuery(customer.companyName);
  }

  function chooseMachine(machine: MachineRecord) {
    setSelectedMachineId(machine.id);
  }

  async function submitForm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const formData = new FormData(formElement);
    formData.set("machine_type", type);
    formData.set("checklist", JSON.stringify(checklist));
    formData.set(
      "findings",
      String(formData.get("findings") || values.findings || "")
    );
    formData.set(
      "recommendations",
      String(formData.get("recommendations") || values.recommendations || "")
    );
    formData.set(
      "conclusion",
      String(formData.get("conclusion") || values.conclusion || "")
    );

    formData.delete("photos");
    photos.forEach((photo) => {
      formData.append("photos", photo.file);
    });

    setMessage(null);
    startTransition(async () => {
      const response = await fetch("/api/inspections", {
        method: "POST",
        body: formData
      });

      const result = (await response.json()) as
        | { ok: true; inspectionNumber: string }
        | { ok: false; message: string };

      if (!response.ok || !result.ok) {
        setMessage(result.ok ? "Opslaan is niet gelukt." : result.message);
        return;
      }

      router.push(`/keuringen?created=${result.inspectionNumber}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={submitForm} className="inspection-layout">
      <section className="inspection-card inspection-header-card">
        <div className="eyebrow">Nieuwe keuring</div>
        <h2>Vul hieronder de keuring in</h2>
        <div className="grid-3">
          <div className="field autocomplete">
            <label htmlFor="customer-search">Klant</label>
            <input
              id="customer-search"
              value={customerQuery}
              onChange={(event) => {
                setCustomerQuery(event.target.value);
                setSelectedCustomerId("");
              }}
              placeholder="Typ de eerste letters van de klant"
              autoComplete="off"
            />
            {filteredCustomers.length > 0 && customerQuery ? (
              <div className="autocomplete-menu">
                {filteredCustomers.map((customer) => (
                  <button
                    className="autocomplete-item"
                    key={customer.id}
                    type="button"
                    onClick={() => chooseCustomer(customer)}
                  >
                    <strong>{customer.companyName}</strong>
                    <span>{customer.contactName}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="field autocomplete">
            <label htmlFor="machine-search">Machine</label>
            <input
              id="machine-search"
              value={machineQuery}
              onChange={(event) => {
                setMachineQuery(event.target.value);
                setSelectedMachineId("");
              }}
              placeholder="Zoek op intern nummer, merk of type"
              autoComplete="off"
            />
            {filteredMachines.length > 0 && machineQuery ? (
              <div className="autocomplete-menu">
                {filteredMachines.map((machine) => (
                  <button
                    className="autocomplete-item"
                    key={machine.id}
                    type="button"
                    onClick={() => chooseMachine(machine)}
                  >
                    <strong>
                      {machine.internalNumber || machine.machineNumber} · {machine.brand}
                    </strong>
                    <span>{machine.model}</span>
                  </button>
                ))}
              </div>
            ) : null}
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
        </div>
      </section>

      <section className="inspection-card">
        <div className="eyebrow">{form.title}</div>
        <h2>Gegevens</h2>
        <div className="keurnummer-banner">
          <span>Keurnummer</span>
          <strong>Wordt automatisch aangemaakt bij opslaan</strong>
        </div>
        <div className="form-grid-wide">
          {form.machineFields.filter((field) => visibleField(field.key)).map((field) => (
            <div className="field" key={field.key}>
              <label htmlFor={field.key}>{field.label}</label>
              <input
                id={field.key}
                name={field.key}
                type={field.type ?? "text"}
                value={values[field.key] ?? ""}
                placeholder={field.placeholder}
                onChange={(event) => setFieldValue(field.key, event.target.value)}
              />
            </div>
          ))}
        </div>
      </section>

      <section className="inspection-card inspection-card-full">
        <div className="eyebrow">Controlepunten</div>
        <h2>Checklist</h2>
        <p className="muted">Alles staat standaard op goed. Pas alleen aan waar nodig.</p>
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
                        <label
                          className={`status-chip ${checklist[item.key] === option ? "active" : ""}`}
                          key={option}
                        >
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
        <div className="eyebrow">Afronding</div>
        <h2>Notities</h2>
        <div className="field">
          <label htmlFor="findings">Bevindingen</label>
          <textarea
            id="findings"
            name="findings"
            value={values.findings ?? ""}
            onChange={(event) => setFieldValue("findings", event.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="recommendations">Aanbevelingen</label>
          <textarea
            id="recommendations"
            name="recommendations"
            value={values.recommendations ?? ""}
            onChange={(event) => setFieldValue("recommendations", event.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="conclusion">Conclusie</label>
          <textarea
            id="conclusion"
            name="conclusion"
            value={values.conclusion ?? ""}
            onChange={(event) => setFieldValue("conclusion", event.target.value)}
          />
        </div>
      </section>

      <section className="inspection-card">
        <div className="eyebrow">Afsluiten</div>
        <h2>Resultaat en foto’s</h2>
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
            Mail de PDF ook naar de klant
          </label>
        </div>
        <div className="field">
          <label htmlFor="photos">Foto’s</label>
          <input id="photos" type="file" accept="image/*" multiple onChange={handlePhotoChange} />
          {photos.length > 0 ? (
            <div className="photo-strip">
              {photos.map((photo) => (
                <div className="photo-chip" key={photo.previewUrl}>
                  <div
                    className="photo-thumb"
                    style={{ backgroundImage: `url(${photo.previewUrl})` }}
                    aria-hidden="true"
                  />
                  <div>
                    <strong>{photo.file.name}</strong>
                    <span>{photo.sizeLabel}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
        <div className="list compact-list">
          <div className="list-item">
            <span>Volgende keurdatum</span>
            <strong>{nextInspectionDate || "Kies eerst keuringsdatum"}</strong>
          </div>
        </div>
        {message ? <p style={{ color: "var(--danger)", margin: 0 }}>{message}</p> : null}
        <div className="actions">
          <button className="button" type="submit" disabled={isPending}>
            {isPending ? "Bezig met opslaan..." : "Keuring opslaan"}
          </button>
        </div>
      </section>
    </form>
  );
}
