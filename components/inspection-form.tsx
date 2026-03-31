"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { getFormDefinition } from "@/lib/form-definitions";
import { previewNextInspectionNumber } from "@/lib/inspection-number";
import { addTwelveMonths } from "@/lib/utils";
import type { CustomerRecord, InspectionRecord, MachineRecord } from "@/lib/domain";
import type { ChecklistOption, MachineType } from "@/lib/types";

interface Props {
  customers: CustomerRecord[];
  machines: MachineRecord[];
  inspections: InspectionRecord[];
  defaultType?: MachineType;
  defaultCustomerId?: string;
  defaultMachineId?: string;
}

type Step = 1 | 2 | 3 | 4;
type Mode = "existing" | "new";
type Flash = { type: "success" | "error" | "info"; text: string } | null;
type PhotoItem = { file: File; previewUrl: string; sizeLabel: string };
type SavedDraft = {
  type: MachineType;
  step: Step;
  customerMode: Mode;
  machineMode: Mode;
  customerQuery: string;
  machineQuery: string;
  selectedCustomerId: string;
  selectedMachineId: string;
  values: Record<string, string>;
  checklist: Record<string, ChecklistOption>;
  savedAt: string;
};

const draftStorageKey = "inspection-form-draft";

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

function visibleField(key: string) {
  return !key.includes("sticker") && key !== "machine_number";
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

function customerValues(customer?: CustomerRecord | null) {
  return {
    customer_name: customer?.companyName ?? "",
    customer_address: customer?.address ?? "",
    customer_contact: customer?.contactName ?? "",
    customer_phone: customer?.phone ?? "",
    customer_email: customer?.email ?? ""
  };
}

function machineValues(machine?: MachineRecord | null) {
  return {
    brand: machine?.brand ?? "",
    model: machine?.model ?? "",
    serial_number: machine?.serialNumber ?? "",
    build_year: machine?.buildYear ?? "",
    internal_number: machine?.internalNumber || machine?.machineNumber || "",
    hour_reading: machine?.configuration.hour_reading ?? ""
  };
}

function machineConfigurationValues(configuration: Record<string, string>) {
  const blockedKeys = new Set([
    "machine_number",
    "brand",
    "model",
    "serial_number",
    "build_year",
    "internal_number",
    "inspection_date"
  ]);

  return Object.fromEntries(
    Object.entries(configuration).filter(([key]) => !blockedKeys.has(key))
  );
}

function latestInspectionForMachine(inspections: InspectionRecord[], machineId: string) {
  return [...inspections]
    .filter((inspection) => inspection.machineId === machineId)
    .sort((left, right) => {
      const leftDate = `${left.inspectionDate}|${left.updatedAt}`;
      const rightDate = `${right.inspectionDate}|${right.updatedAt}`;
      return rightDate.localeCompare(leftDate);
    })[0];
}

function machineSnapshotOverrides(snapshot: Record<string, string>) {
  const blockedKeys = new Set([
    "machine_number",
    "brand",
    "model",
    "serial_number",
    "build_year",
    "internal_number"
  ]);

  return Object.fromEntries(
    Object.entries(snapshot).filter(([key]) => !blockedKeys.has(key))
  );
}

async function compressImage(file: File) {
  const url = URL.createObjectURL(file);
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new Image();
    element.onload = () => resolve(element);
    element.onerror = reject;
    element.src = url;
  });
  const canvas = document.createElement("canvas");
  const scale = Math.min(1, 1600 / Math.max(image.width, image.height));
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas niet beschikbaar");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  URL.revokeObjectURL(url);
  let quality = 0.82;
  let blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  while (blob && blob.size > 300 * 1024 && quality > 0.45) {
    quality -= 0.08;
    blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  }
  if (!blob) throw new Error("Afbeelding kon niet worden verwerkt");
  return new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" });
}

export function InspectionForm({
  customers,
  machines,
  inspections,
  defaultType = "heftruck_reachtruck",
  defaultCustomerId = "",
  defaultMachineId = ""
}: Props) {
  const formRef = useRef<HTMLFormElement | null>(null);
  const topRef = useRef<HTMLDivElement | null>(null);
  const [isPending, startTransition] = useTransition();
  const [type, setType] = useState<MachineType>(defaultType);
  const [step, setStep] = useState<Step>(defaultMachineId ? 4 : defaultCustomerId ? 3 : 1);
  const [customerMode, setCustomerMode] = useState<Mode>(defaultCustomerId || defaultMachineId ? "existing" : "new");
  const [machineMode, setMachineMode] = useState<Mode>(defaultMachineId ? "existing" : "new");
  const [customerQuery, setCustomerQuery] = useState("");
  const [machineQuery, setMachineQuery] = useState("");
  const [customerMenuOpen, setCustomerMenuOpen] = useState(false);
  const [machineMenuOpen, setMachineMenuOpen] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState(defaultCustomerId);
  const [selectedMachineId, setSelectedMachineId] = useState(defaultMachineId);
  const [values, setValues] = useState<Record<string, string>>({ inspection_date: new Date().toISOString().slice(0, 10) });
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [message, setMessage] = useState<Flash>(null);
  const [checklist, setChecklist] = useState<Record<string, ChecklistOption>>(buildDefaultChecklist(defaultType));
  const [draftNotice, setDraftNotice] = useState("");

  const form = useMemo(() => getFormDefinition(type), [type]);
  const selectedCustomer = customers.find((item) => item.id === selectedCustomerId) ?? null;
  const selectedMachine = machines.find((item) => item.id === selectedMachineId) ?? null;
  const nextInspectionDate = addTwelveMonths(values.inspection_date);
  const previewInspectionNumber = useMemo(() => {
    const inspectionDate = values.inspection_date || new Date().toISOString().slice(0, 10);
    const year = Number(inspectionDate.slice(0, 4));
    const sequencesForYear = inspections
      .filter((inspection) => inspection.inspectionDate.startsWith(String(year)))
      .map((inspection) => Number(inspection.inspectionNumber))
      .filter((sequence) => !Number.isNaN(sequence));

    const lastSequenceForYear =
      sequencesForYear.length > 0 ? Math.max(...sequencesForYear) : null;

    return previewNextInspectionNumber(year, lastSequenceForYear);
  }, [inspections, values.inspection_date]);

  const filteredCustomers = useMemo(() => {
    const query = customerQuery.trim().toLowerCase();
    if (!query) return customers.slice(0, 8);
    return customers.filter((customer) =>
      [customer.companyName, customer.contactName, customer.email, customer.phone].join(" ").toLowerCase().includes(query)
    );
  }, [customerQuery, customers]);

  const customerMachines = useMemo(
    () => (selectedCustomerId ? machines.filter((machine) => machine.customerId === selectedCustomerId) : []),
    [machines, selectedCustomerId]
  );

  const filteredMachines = useMemo(() => {
    const query = machineQuery.trim().toLowerCase();
    if (!query) return customerMachines.slice(0, 8);
    return customerMachines.filter((machine) =>
      [machine.internalNumber, machine.machineNumber, machine.brand, machine.model, machine.serialNumber]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [customerMachines, machineQuery]);

  useEffect(() => setChecklist(buildDefaultChecklist(type)), [type]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const raw = window.localStorage.getItem(draftStorageKey);
    if (!raw) {
      return;
    }

    try {
      const draft = JSON.parse(raw) as SavedDraft;
      const canRestore =
        (!defaultCustomerId && !defaultMachineId) ||
        draft.selectedCustomerId === defaultCustomerId ||
        draft.selectedMachineId === defaultMachineId;

      if (!canRestore) {
        return;
      }

      setType(draft.type);
      setStep(draft.step);
      setCustomerMode(draft.customerMode);
      setMachineMode(draft.machineMode);
      setCustomerQuery(draft.customerQuery);
      setMachineQuery(draft.machineQuery);
      setSelectedCustomerId(draft.selectedCustomerId);
      setSelectedMachineId(draft.selectedMachineId);
      setValues(draft.values);
      setChecklist(draft.checklist);
      setMessage({ type: "info", text: "Concept opnieuw geladen." });
    } catch {
      window.localStorage.removeItem(draftStorageKey);
    }
  }, [defaultCustomerId, defaultMachineId]);

  useEffect(() => {
    const activeElement = document.activeElement;
    if (activeElement instanceof HTMLElement) {
      activeElement.blur();
    }

    const scrollToTop = () => {
      topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const frame = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(scrollToTop);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [step]);

  useEffect(() => {
    if (!selectedCustomer) return;
    setValues((current) => ({ ...current, ...customerValues(selectedCustomer) }));
    if (!customerQuery) setCustomerQuery(selectedCustomer.companyName);
  }, [selectedCustomer, customerQuery]);

  useEffect(() => {
    if (!selectedMachine) return;
    setType(selectedMachine.machineType);
    setValues((current) => ({
      ...current,
      ...machineValues(selectedMachine),
      ...machineConfigurationValues(selectedMachine.configuration)
    }));
    setMachineQuery([selectedMachine.internalNumber || selectedMachine.machineNumber, selectedMachine.brand, selectedMachine.model].filter(Boolean).join(" "));
    const previousInspection = latestInspectionForMachine(inspections, selectedMachine.id);
    if (!previousInspection) {
      setChecklist(buildDefaultChecklist(selectedMachine.machineType));
      return;
    }
    setValues((current) => ({
      ...current,
      ...machineSnapshotOverrides(previousInspection.machineSnapshot),
      ...machineValues(selectedMachine),
      ...machineConfigurationValues(selectedMachine.configuration),
      findings: previousInspection.findings,
      recommendations: previousInspection.recommendations,
      conclusion: previousInspection.conclusion,
      inspection_date: current.inspection_date
    }));
    setChecklist({ ...buildDefaultChecklist(selectedMachine.machineType), ...previousInspection.checklist });
  }, [selectedMachine, inspections]);

  function setFieldValue(key: string, value: string) {
    setDraftNotice("");
    setValues((current) => ({ ...current, [key]: value }));
  }

  function chooseCustomer(customer: CustomerRecord) {
    setCustomerMode("existing");
    setSelectedCustomerId(customer.id);
    setCustomerQuery(customer.companyName);
    setSelectedMachineId("");
    setMachineQuery("");
    setCustomerMenuOpen(false);
    setMachineMenuOpen(false);
    setMachineMode("existing");
    setDraftNotice("");
    setValues((current) => ({ ...current, ...customerValues(customer), ...machineValues(null), findings: "", recommendations: "", conclusion: "" }));
    setChecklist(buildDefaultChecklist(type));
    setStep(2);
  }

  function resetForCustomerMode(mode: Mode) {
    setCustomerMode(mode);
    setSelectedCustomerId("");
    setCustomerQuery("");
    setSelectedMachineId("");
    setMachineQuery("");
    setCustomerMenuOpen(false);
    setMachineMenuOpen(false);
    setMachineMode("new");
    setDraftNotice("");
    setValues((current) => ({ ...current, ...customerValues(null), ...machineValues(null), findings: "", recommendations: "", conclusion: "" }));
    setChecklist(buildDefaultChecklist(type));
  }

  function chooseMachine(machine: MachineRecord) {
    setMachineMode("existing");
    setSelectedMachineId(machine.id);
    setMachineMenuOpen(false);
    setDraftNotice("");
  }

  function resetForMachineMode(mode: Mode) {
    setMachineMode(mode);
    setSelectedMachineId("");
    setMachineQuery("");
    setMachineMenuOpen(false);
    setDraftNotice("");
    setValues((current) => ({ ...current, ...machineValues(null) }));
    setChecklist(buildDefaultChecklist(type));
  }

  function validateStep(targetStep: Step) {
    if (targetStep === 1 && customerMode === "existing" && !selectedCustomerId) {
      setMessage({ type: "error", text: "Kies eerst een klant om verder te gaan." });
      return false;
    }
    if (targetStep === 2 && !String(values.customer_name || "").trim()) {
      setMessage({ type: "error", text: "Vul eerst de klantgegevens in." });
      return false;
    }
    if (targetStep === 3 && machineMode === "existing" && !selectedMachineId && customerMachines.length > 0) {
      setMessage({ type: "error", text: "Kies eerst een machine of maak een nieuwe aan." });
      return false;
    }
    if (targetStep === 3 && !String(values.internal_number || "").trim()) {
      setMessage({ type: "error", text: "Vul eerst het interne nummer van de machine in." });
      return false;
    }
    return true;
  }

  function nextStep() {
    if (!validateStep(step)) return;
    setMessage(null);
    setStep((current) => (current < 4 ? ((current + 1) as Step) : current));
  }

  function previousStep() {
    setMessage(null);
    setStep((current) => (current > 1 ? ((current - 1) as Step) : current));
  }

  async function handlePhotoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) {
      setPhotos([]);
      return;
    }
    setMessage({ type: "info", text: "Foto's worden voorbereid..." });
    try {
      const compressed = await Promise.all(
        files.map(async (file) => {
          const compressedFile = await compressImage(file);
          return { file: compressedFile, previewUrl: URL.createObjectURL(compressedFile), sizeLabel: `${Math.round(compressedFile.size / 1024)} KB` };
        })
      );
      setPhotos(compressed);
      setMessage(null);
    } catch {
      setMessage({ type: "error", text: "Een foto kon niet worden verwerkt. Probeer het opnieuw." });
    }
  }

  async function submitForm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validateStep(3)) return;

    const formData = new FormData(event.currentTarget);
    formData.set("machine_type", type);
    formData.set("checklist", JSON.stringify(checklist));
    formData.delete("photos");
    photos.forEach((photo) => formData.append("photos", photo.file));

    setMessage(null);
    startTransition(async () => {
      const response = await fetch("/api/inspections", { method: "POST", body: formData });
      const result = (await response.json()) as
        | { ok: true; inspectionId: string; inspectionNumber: string }
        | { ok: false; message: string };

      if (!response.ok || !result.ok) {
        setMessage({ type: "error", text: result.ok ? "Opslaan is niet gelukt." : result.message });
        return;
      }

      window.localStorage.removeItem(draftStorageKey);
      window.location.assign(`/?saved=${result.inspectionNumber}`);
    });
  }

  function saveDraft() {
    if (typeof window === "undefined") {
      return;
    }

    const draft: SavedDraft = {
      type,
      step,
      customerMode,
      machineMode,
      customerQuery,
      machineQuery,
      selectedCustomerId,
      selectedMachineId,
      values,
      checklist,
      savedAt: new Date().toISOString()
    };

    window.localStorage.setItem(draftStorageKey, JSON.stringify(draft));
    setDraftNotice("Gegevens bijgewerkt");
    setMessage({ type: "success", text: "Concept tussentijds opgeslagen." });
  }

  return (
    <form ref={formRef} onSubmit={submitForm} className="inspection-layout">
      <div ref={topRef} />
      {Object.entries(values).filter(([key]) => key.startsWith("customer_")).map(([key, value]) => (
        <input key={key} type="hidden" name={key} value={value} />
      ))}
      <input type="hidden" name="existing_customer_id" value={selectedCustomerId} />
      <input type="hidden" name="existing_machine_id" value={selectedMachineId} />

      <section className="keurnummer-banner inspection-card-full">
        <span>Keurnummer</span>
        <strong>{previewInspectionNumber}</strong>
      </section>

      {step === 1 ? (
        <section className="inspection-card inspection-card-full">
          <div className="eyebrow">Stap 1</div>
          <h2>Start keuring</h2>
          <div className="choice-grid">
            <button type="button" className={`choice-card ${customerMode === "existing" ? "active" : ""}`} onClick={() => resetForCustomerMode("existing")}>
              <strong>Bestaande klant of machine zoeken</strong>
              <span>Kies een klant en pak daarna direct de juiste machine erbij.</span>
            </button>
            <button type="button" className={`choice-card ${customerMode === "new" ? "active" : ""}`} onClick={() => resetForCustomerMode("new")}>
              <strong>Nieuwe klant of machine aanmaken</strong>
              <span>Gebruik deze route als het dossier nog niet in het systeem staat.</span>
            </button>
          </div>
          {customerMode === "existing" ? (
            <div className="form-grid-wide" style={{ marginTop: "1rem" }}>
              <div className="field autocomplete">
                <label htmlFor="customer-search">Zoek klant</label>
                <input
                  id="customer-search"
                  value={customerQuery}
                  onChange={(event) => {
                    setCustomerQuery(event.target.value);
                    setSelectedCustomerId("");
                    setSelectedMachineId("");
                    setMachineQuery("");
                    setCustomerMenuOpen(true);
                  }}
                  onFocus={() => setCustomerMenuOpen(true)}
                  placeholder="Typ de eerste letters van de klant"
                  autoComplete="off"
                />
                {filteredCustomers.length > 0 && customerQuery && customerMenuOpen ? (
                  <div className="autocomplete-menu">
                    {filteredCustomers.map((customer) => (
                      <button className="autocomplete-item" key={customer.id} type="button" onClick={() => chooseCustomer(customer)}>
                        <strong>{customer.companyName}</strong>
                        <span>{customer.contactName || customer.email}</span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="compact-card">
                <div className="eyebrow">Gekozen klant</div>
                <div className="info-card">
                  <strong>{selectedCustomer?.companyName || "Nog geen klant gekozen"}</strong>
                  <span>{selectedCustomer?.contactName || "Kies eerst een klant om verder te gaan."}</span>
                </div>
              </div>
            </div>
          ) : (
            <p className="muted" style={{ marginTop: "1rem" }}>
              Je maakt in de volgende stap direct de klant aan.
            </p>
          )}
        </section>
      ) : null}

      {step === 2 ? (
        <section className="inspection-card inspection-card-full">
          <div className="eyebrow">Stap 2</div>
          <h2>Klantgegevens</h2>
          <div className="form-block">
            <div className="form-grid-wide">
              {form.machineFields.filter((field) => field.key.startsWith("customer_")).map((field) => (
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
          </div>
        </section>
      ) : null}

      {step === 3 ? (
        <section className="inspection-card inspection-card-full">
          <div className="eyebrow">Stap 3</div>
          <h2>Machine kiezen of aanmaken</h2>
          {selectedCustomer ? (
            <div className="compact-card" style={{ marginBottom: "1rem" }}>
              <div className="eyebrow">Gekozen klant</div>
              <div className="info-card">
                <strong>{selectedCustomer.companyName}</strong>
                <span>Kies hieronder een bestaande machine of zet een nieuwe erin.</span>
              </div>
            </div>
          ) : null}
          <div className="choice-grid">
            <button type="button" className={`choice-card ${machineMode === "existing" ? "active" : ""}`} onClick={() => resetForMachineMode("existing")}>
              <strong>Bestaande machine</strong>
              <span>Handig als je eerdere keuringsgegevens wilt overnemen.</span>
            </button>
            <button type="button" className={`choice-card ${machineMode === "new" ? "active" : ""}`} onClick={() => resetForMachineMode("new")}>
              <strong>Nieuwe machine</strong>
              <span>Voer een nieuwe machine in voor deze klant.</span>
            </button>
          </div>

          {machineMode === "existing" ? (
            <>
              <div className="form-block" style={{ marginTop: "1rem" }}>
                <div className="field autocomplete">
                  <label htmlFor="machine-search">Zoek machine</label>
                  <input
                    id="machine-search"
                    value={machineQuery}
                    onChange={(event) => {
                      setMachineQuery(event.target.value);
                      setSelectedMachineId("");
                      setMachineMenuOpen(true);
                    }}
                    onFocus={() => setMachineMenuOpen(true)}
                    placeholder="Zoek op intern nummer, merk of type"
                    autoComplete="off"
                  />
                  {filteredMachines.length > 0 && machineQuery && machineMenuOpen ? (
                    <div className="autocomplete-menu">
                      {filteredMachines.map((machine) => (
                        <button className="autocomplete-item" key={machine.id} type="button" onClick={() => chooseMachine(machine)}>
                          <strong>{machine.internalNumber || machine.machineNumber} - {machine.brand}</strong>
                          <span>{machine.model}</span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="compact-card" style={{ marginTop: "1rem" }}>
                <div className="eyebrow">Gekozen machine</div>
                <div className="read-only-grid compact-machine-summary">
                  <div className="info-card">
                    <strong>{selectedMachine ? `${selectedMachine.brand} ${selectedMachine.model}`.trim() : "Nog geen machine gekozen"}</strong>
                    <span>Machine</span>
                  </div>
                  <div className="info-card">
                    <strong>{selectedMachine?.internalNumber || selectedMachine?.machineNumber || "-"}</strong>
                    <span>Intern nummer</span>
                  </div>
                  <div className="info-card">
                    <strong>{selectedMachine?.serialNumber || "-"}</strong>
                    <span>Serienummer</span>
                  </div>
                </div>
              </div>
            </>
          ) : null}

          {machineMode === "new" ? (
            <div className="form-block" style={{ marginTop: "1rem" }}>
              <div className="form-grid-wide">
                <div className="field">
                  <label htmlFor="machine-type">Keuringstype</label>
                  <select
                    id="machine-type"
                    name="machine_type_display"
                    value={type}
                    onChange={(event) => {
                      const nextType = event.target.value as MachineType;
                      setType(nextType);
                      setChecklist(buildDefaultChecklist(nextType));
                      setDraftNotice("");
                    }}
                  >
                    {machineTypeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                {form.machineFields
                  .filter((field) => !field.key.startsWith("customer_") && visibleField(field.key) && field.key !== "inspection_date")
                  .map((field) => (
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
            </div>
          ) : null}
        </section>
      ) : null}

      {step === 4 ? (
        <>
          <section className="inspection-card inspection-card-full form-screen">
            <div className="eyebrow">Stap 4</div>
            <h2>Keuring</h2>
            <p className="muted" style={{ marginTop: 0 }}>{form.title}</p>
            <div className="compact-card" style={{ marginBottom: "1rem" }}>
              <div className="eyebrow">Geselecteerde gegevens</div>
              <div className="read-only-grid">
                <div className="info-card">
                  <strong>{values.customer_name || "-"}</strong>
                  <span>Gekozen klant</span>
                </div>
                <div className="info-card">
                  <strong>{[values.brand, values.model].filter(Boolean).join(" ") || "-"}</strong>
                  <span>Gekozen machine</span>
                </div>
                <div className="info-card">
                  <strong>{values.internal_number || "-"}</strong>
                  <span>Intern nummer</span>
                </div>
              </div>
            </div>
            <div className="form-block">
              <div className="form-grid-wide">
                {form.machineFields
                  .filter((field) => visibleField(field.key) && !field.key.startsWith("customer_") && field.key !== "inspection_date")
                  .map((field) => (
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
                <div className="field">
                  <label htmlFor="inspection_date">Keuringsdatum</label>
                  <input
                    id="inspection_date"
                    name="inspection_date"
                    type="date"
                    value={values.inspection_date ?? ""}
                    onChange={(event) => setFieldValue("inspection_date", event.target.value)}
                  />
                </div>
              </div>
              <div className="actions" style={{ marginTop: "0.75rem" }}>
                <button className="button-secondary" type="button" onClick={saveDraft}>
                  Gegevens opslaan
                </button>
                {draftNotice ? <span className="draft-notice">{draftNotice}</span> : null}
              </div>
            </div>
          </section>

          <section className="inspection-card inspection-card-full">
            <div className="eyebrow">Controlepunten</div>
            <h2>Checklist</h2>
            <p className="muted">Alles staat alvast op goed. Pas alleen de punten aan die afwijken.</p>
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
                            <label className={`status-chip ${checklist[item.key] === option ? "active" : ""}`} key={option}>
                              <input
                                type="radio"
                                name={item.key}
                                checked={checklist[item.key] === option}
                                onChange={() => {
                                  setDraftNotice("");
                                  setChecklist((current) => ({ ...current, [item.key]: option }));
                                }}
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
            <div className="form-block">
              <div className="field">
                <label htmlFor="findings">Bevindingen</label>
                <textarea id="findings" name="findings" value={values.findings ?? ""} onChange={(event) => setFieldValue("findings", event.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="recommendations">Aanbevelingen</label>
                <textarea id="recommendations" name="recommendations" value={values.recommendations ?? ""} onChange={(event) => setFieldValue("recommendations", event.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="conclusion">Conclusie</label>
                <textarea id="conclusion" name="conclusion" value={values.conclusion ?? ""} onChange={(event) => setFieldValue("conclusion", event.target.value)} />
              </div>
            </div>
          </section>

          <section className="inspection-card">
            <div className="eyebrow">Opslaan</div>
            <h2>Resultaat en foto&apos;s</h2>
            <div className="form-block">
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
                <label htmlFor="photos">Foto&apos;s</label>
                <input id="photos" type="file" accept="image/*" multiple onChange={handlePhotoChange} />
                {photos.length > 0 ? (
                  <div className="photo-strip">
                    {photos.map((photo) => (
                      <div className="photo-chip" key={photo.previewUrl}>
                        <div className="photo-thumb" style={{ backgroundImage: `url(${photo.previewUrl})` }} aria-hidden="true" />
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
                  <strong>{nextInspectionDate || "Kies eerst een keuringsdatum"}</strong>
                </div>
              </div>
            </div>
          </section>
        </>
      ) : null}

      <section className="inspection-card inspection-card-full">
        {message ? <p className={`form-message ${message.type}`}>{message.text}</p> : null}
        <div className="wizard-actions">
          <button className="button-secondary" type="button" onClick={previousStep} disabled={step === 1 || isPending}>
            Terug
          </button>
          {step < 4 ? (
            <button className="button" type="button" onClick={nextStep} disabled={isPending}>
              Volgende stap
            </button>
          ) : (
            <button
              className="button"
              type="button"
              disabled={isPending}
              onClick={() => formRef.current?.requestSubmit()}
            >
              {isPending ? "Bezig met opslaan..." : "Keuring afronden"}
            </button>
          )}
        </div>
      </section>
    </form>
  );
}
