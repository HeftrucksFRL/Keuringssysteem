"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { getCsrfHeaders } from "@/lib/client-security";
import { getFormDefinition } from "@/lib/form-definitions";
import { previewNextInspectionNumber } from "@/lib/inspection-number";
import { addTwelveMonths } from "@/lib/utils";
import type {
  CustomerContactRecord,
  CustomerRecord,
  InspectionRecord,
  MachineRecord
} from "@/lib/domain";
import type { ChecklistOption, MachineType } from "@/lib/types";

interface Props {
  customers: CustomerRecord[];
  customerContacts: CustomerContactRecord[];
  machines: MachineRecord[];
  inspections: InspectionRecord[];
  defaultType?: MachineType;
  defaultCustomerId?: string;
  defaultMachineId?: string;
  existingInspection?: InspectionRecord | null;
  savedState?: string;
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
  linkedBatteryQuery: string;
  selectedCustomerId: string;
  selectedMachineId: string;
  linkedBatteryMachineId: string;
  selectedContactId: string;
  contactMode: "existing" | "new";
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
    customer_contact_department: "",
    customer_phone: customer?.phone ?? "",
    customer_email: customer?.email ?? ""
  };
}

function customerContactValues(
  contact?: Pick<CustomerContactRecord, "name" | "department" | "phone" | "email"> | null,
  customer?: Pick<CustomerRecord, "phone" | "email"> | null
) {
  return {
    customer_contact: contact?.name ?? "",
    customer_contact_department: contact?.department ?? "",
    customer_phone: contact?.phone || customer?.phone || "",
    customer_email: contact?.email || customer?.email || ""
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

function batteryChargerSearchText(machine: MachineRecord) {
  return [
    machine.internalNumber,
    machine.machineNumber,
    machine.serialNumber,
    machine.brand,
    machine.model,
    machine.configuration.vehicle_internal_number,
    machine.configuration.vehicle_serial_number,
    machine.configuration.battery_internal_number,
    machine.configuration.battery_serial_number,
    machine.configuration.charger_internal_number,
    machine.configuration.charger_serial_number
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function batteryChargerLabel(machine?: MachineRecord | null) {
  if (!machine) {
    return "Nog geen batterij / lader gekoppeld";
  }

  const vehicle = [
    machine.configuration.vehicle_brand || machine.brand,
    machine.configuration.vehicle_type || machine.model
  ]
    .filter(Boolean)
    .join(" ");
  const internal =
    machine.configuration.vehicle_internal_number ||
    machine.internalNumber ||
    machine.machineNumber ||
    "-";

  return `${vehicle || "Batterij / lader"} - ${internal}`;
}

function resultLabelsFromStatus(status?: InspectionRecord["status"]) {
  if (status === "rejected") {
    return ["Afgekeurd"];
  }

  if (status === "draft") {
    return ["In behandeling"];
  }

  return ["Goedgekeurd"];
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
  customerContacts,
  machines,
  inspections,
  defaultType = "heftruck_reachtruck",
  defaultCustomerId = "",
  defaultMachineId = "",
  existingInspection = null,
  savedState = ""
}: Props) {
  const isEditingExisting = Boolean(existingInspection);
  const formRef = useRef<HTMLFormElement | null>(null);
  const topRef = useRef<HTMLDivElement | null>(null);
  const [isPending, startTransition] = useTransition();
  const [type, setType] = useState<MachineType>(existingInspection?.machineType ?? defaultType);
  const [step, setStep] = useState<Step>(existingInspection ? 4 : defaultMachineId ? 4 : defaultCustomerId ? 3 : 1);
  const [customerMode, setCustomerMode] = useState<Mode>(existingInspection || defaultCustomerId || defaultMachineId ? "existing" : "new");
  const [machineMode, setMachineMode] = useState<Mode>(existingInspection || defaultMachineId ? "existing" : "new");
  const [customerQuery, setCustomerQuery] = useState("");
  const [machineQuery, setMachineQuery] = useState("");
  const [customerMenuOpen, setCustomerMenuOpen] = useState(false);
  const [machineMenuOpen, setMachineMenuOpen] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState(existingInspection?.customerId ?? defaultCustomerId);
  const [selectedMachineId, setSelectedMachineId] = useState(existingInspection?.machineId ?? defaultMachineId);
  const [linkedBatteryMachineId, setLinkedBatteryMachineId] = useState("");
  const [linkedBatteryQuery, setLinkedBatteryQuery] = useState("");
  const [linkedBatteryMenuOpen, setLinkedBatteryMenuOpen] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState("");
  const [contactMode, setContactMode] = useState<"existing" | "new">("existing");
  const [values, setValues] = useState<Record<string, string>>(() =>
    existingInspection
      ? {
          customer_name: existingInspection.customerSnapshot.customer_name ?? "",
          customer_address: existingInspection.customerSnapshot.customer_address ?? "",
          customer_contact: existingInspection.customerSnapshot.customer_contact ?? "",
          customer_contact_department:
            existingInspection.customerSnapshot.customer_contact_department ?? "",
          customer_phone: existingInspection.customerSnapshot.customer_phone ?? "",
          customer_email: existingInspection.customerSnapshot.customer_email ?? "",
          brand: existingInspection.machineSnapshot.brand ?? "",
          model: existingInspection.machineSnapshot.model ?? "",
          serial_number: existingInspection.machineSnapshot.serial_number ?? "",
          build_year: existingInspection.machineSnapshot.build_year ?? "",
          internal_number: existingInspection.machineSnapshot.internal_number ?? "",
          inspection_date: existingInspection.inspectionDate,
          findings: existingInspection.findings,
          recommendations: existingInspection.recommendations,
          conclusion: existingInspection.conclusion,
          ...machineSnapshotOverrides(existingInspection.machineSnapshot)
        }
      : { inspection_date: new Date().toISOString().slice(0, 10) }
  );
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [message, setMessage] = useState<Flash>(null);
  const [checklist, setChecklist] = useState<Record<string, ChecklistOption>>(
    existingInspection
      ? { ...buildDefaultChecklist(existingInspection.machineType), ...existingInspection.checklist }
      : buildDefaultChecklist(defaultType)
  );
  const [selectedResultLabels, setSelectedResultLabels] = useState<string[]>(
    existingInspection ? resultLabelsFromStatus(existingInspection.status) : []
  );
  const [draftNotice, setDraftNotice] = useState("");

  const form = useMemo(() => getFormDefinition(type), [type]);
  const selectedCustomer = customers.find((item) => item.id === selectedCustomerId) ?? null;
  const selectedMachine = machines.find((item) => item.id === selectedMachineId) ?? null;
  const availableContacts = useMemo(
    () =>
      selectedCustomerId
        ? customerContacts.filter((item) => item.customerId === selectedCustomerId)
        : [],
    [customerContacts, selectedCustomerId]
  );
  const resolvedSelectedContactId = useMemo(() => {
    if (selectedContactId && availableContacts.some((item) => item.id === selectedContactId)) {
      return selectedContactId;
    }

    const byExactValues = availableContacts.find(
      (item) =>
        item.name === (values.customer_contact ?? "") &&
        item.phone === (values.customer_phone ?? "") &&
        item.email === (values.customer_email ?? "")
    );

    return byExactValues?.id ?? availableContacts.find((item) => item.isPrimary)?.id ?? availableContacts[0]?.id ?? "";
  }, [
    availableContacts,
    selectedContactId,
    values.customer_contact,
    values.customer_email,
    values.customer_phone
  ]);
  const selectedContact =
    availableContacts.find((item) => item.id === resolvedSelectedContactId) ??
    availableContacts.find((item) => item.isPrimary) ??
    availableContacts[0] ??
    null;
  const nextInspectionDate = addTwelveMonths(values.inspection_date);
  const previewInspectionNumber = useMemo(() => {
    if (existingInspection?.inspectionNumber) {
      return existingInspection.inspectionNumber;
    }

    const inspectionDate = values.inspection_date || new Date().toISOString().slice(0, 10);
    const year = Number(inspectionDate.slice(0, 4));
    const sequencesForYear = inspections
      .filter((inspection) => inspection.inspectionDate.startsWith(String(year)))
      .map((inspection) => Number(inspection.inspectionNumber))
      .filter((sequence) => !Number.isNaN(sequence));

    const lastSequenceForYear =
      sequencesForYear.length > 0 ? Math.max(...sequencesForYear) : null;

    return previewNextInspectionNumber(year, lastSequenceForYear);
  }, [existingInspection?.inspectionNumber, inspections, values.inspection_date]);

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

  const batteryChargerMachines = useMemo(
    () => machines.filter((machine) => machine.machineType === "batterij_lader"),
    [machines]
  );

  const selectedLinkedBatteryMachine = useMemo(
    () => batteryChargerMachines.find((machine) => machine.id === linkedBatteryMachineId) ?? null,
    [batteryChargerMachines, linkedBatteryMachineId]
  );

  const filteredBatteryChargerMachines = useMemo(() => {
    const query = linkedBatteryQuery.trim().toLowerCase();
    if (!query) {
      return batteryChargerMachines.slice(0, 8);
    }

    return batteryChargerMachines.filter((machine) =>
      batteryChargerSearchText(machine).includes(query)
    );
  }, [batteryChargerMachines, linkedBatteryQuery]);

  useEffect(() => {
    if (isEditingExisting) {
      return;
    }
    setChecklist(buildDefaultChecklist(type));
  }, [isEditingExisting, type]);

  useEffect(() => {
    if (isEditingExisting) {
      return;
    }
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
      setLinkedBatteryQuery(draft.linkedBatteryQuery ?? "");
      setSelectedCustomerId(draft.selectedCustomerId);
      setSelectedMachineId(draft.selectedMachineId);
      setLinkedBatteryMachineId(draft.linkedBatteryMachineId ?? "");
      setSelectedContactId(draft.selectedContactId);
      setContactMode(draft.contactMode);
      setValues(draft.values);
      setChecklist(draft.checklist);
      setMessage({ type: "info", text: "Concept opnieuw geladen." });
    } catch {
      window.localStorage.removeItem(draftStorageKey);
    }
  }, [defaultCustomerId, defaultMachineId, isEditingExisting]);

  useEffect(() => {
    if (!savedState) {
      return;
    }

    setMessage({
      type: "success",
      text:
        savedState === "draft"
          ? "Keuring in behandeling bijgewerkt."
          : "Keuring bijgewerkt."
    });
  }, [savedState]);

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
    if (isEditingExisting) return;
    if (!selectedCustomer) return;
    setValues((current) => ({ ...current, ...customerValues(selectedCustomer) }));
    if (!customerQuery) setCustomerQuery(selectedCustomer.companyName);
  }, [selectedCustomer, customerQuery, isEditingExisting]);

  useEffect(() => {
    if (isEditingExisting) {
      return;
    }

    if (availableContacts.length === 0) {
      setSelectedContactId("");
      setContactMode("new");
      return;
    }

    setSelectedContactId((current) =>
      current && availableContacts.some((contact) => contact.id === current)
        ? current
        : (availableContacts.find((contact) => contact.isPrimary)?.id ?? availableContacts[0].id)
    );
    setContactMode("existing");
  }, [availableContacts, isEditingExisting]);

  useEffect(() => {
    if (isEditingExisting) {
      return;
    }

    if (contactMode !== "existing" || !selectedContact) {
      return;
    }

    setValues((current) => ({ ...current, ...customerContactValues(selectedContact, selectedCustomer) }));
  }, [contactMode, isEditingExisting, selectedContact, selectedCustomer]);

  useEffect(() => {
    if (isEditingExisting) return;
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
      findings: previousInspection.findings || previousInspection.recommendations,
      recommendations: previousInspection.recommendations,
      conclusion: previousInspection.conclusion,
      inspection_date: current.inspection_date
    }));
    setChecklist({ ...buildDefaultChecklist(selectedMachine.machineType), ...previousInspection.checklist });
  }, [selectedMachine, inspections, isEditingExisting]);

  useEffect(() => {
    if (type === "batterij_lader") {
      setLinkedBatteryMachineId("");
      setLinkedBatteryQuery("");
      return;
    }

    if (!selectedMachineId) {
      setLinkedBatteryMachineId("");
      setLinkedBatteryQuery("");
      return;
    }

    const linkedBattery =
      batteryChargerMachines.find(
        (machine) => machine.configuration.linked_machine_id === selectedMachineId
      ) ?? null;

    if (!linkedBattery) {
      setLinkedBatteryMachineId("");
      setLinkedBatteryQuery("");
      return;
    }

    setLinkedBatteryMachineId(linkedBattery.id);
    setLinkedBatteryQuery(batteryChargerLabel(linkedBattery));
  }, [batteryChargerMachines, selectedMachineId, type]);

  function setFieldValue(key: string, value: string) {
    setDraftNotice("");
    setValues((current) => ({ ...current, [key]: value }));
  }

  function chooseCustomer(customer: CustomerRecord) {
    setCustomerMode("existing");
    setSelectedCustomerId(customer.id);
    setSelectedContactId("");
    setContactMode("existing");
    setCustomerQuery(customer.companyName);
    setSelectedMachineId("");
    setMachineQuery("");
    setLinkedBatteryMachineId("");
    setLinkedBatteryQuery("");
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
    setSelectedContactId("");
    setContactMode("new");
    setCustomerQuery("");
    setSelectedMachineId("");
    setMachineQuery("");
    setLinkedBatteryMachineId("");
    setLinkedBatteryQuery("");
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
    setLinkedBatteryMenuOpen(false);
    setDraftNotice("");
  }

  function resetForMachineMode(mode: Mode) {
    setMachineMode(mode);
    setSelectedMachineId("");
    setMachineQuery("");
    setLinkedBatteryMachineId("");
    setLinkedBatteryQuery("");
    setLinkedBatteryMenuOpen(false);
    setMachineMenuOpen(false);
    setDraftNotice("");
    setValues((current) => ({ ...current, ...machineValues(null) }));
    setChecklist(buildDefaultChecklist(type));
  }

  function chooseContactMode(nextMode: "existing" | "new") {
    setContactMode(nextMode);
    setDraftNotice("");

    if (nextMode === "new") {
      setSelectedContactId("");
      setValues((current) => ({
        ...current,
        customer_contact: "",
        customer_contact_department: "",
        customer_phone: "",
        customer_email: ""
      }));
      return;
    }

    const fallbackContact =
      availableContacts.find((contact) => contact.id === selectedContactId) ??
      availableContacts.find((contact) => contact.isPrimary) ??
      availableContacts[0];

    if (fallbackContact) {
      setSelectedContactId(fallbackContact.id);
      setValues((current) => ({ ...current, ...customerContactValues(fallbackContact, selectedCustomer) }));
    }
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
      const response = await fetch("/api/inspections", {
        method: "POST",
        body: formData,
        headers: getCsrfHeaders()
      });
      const result = (await response.json()) as
        | { ok: true; inspectionId: string; inspectionNumber: string; status: InspectionRecord["status"] }
        | { ok: false; message: string };

      if (!response.ok || !result.ok) {
        setMessage({ type: "error", text: result.ok ? "Opslaan is niet gelukt." : result.message });
        return;
      }

      window.localStorage.removeItem(draftStorageKey);
      if (result.status === "draft") {
        window.location.assign(`/keuringen/nieuw?inspectionId=${result.inspectionId}&saved=draft`);
        return;
      }

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
      linkedBatteryQuery,
      selectedCustomerId,
      selectedMachineId,
      linkedBatteryMachineId,
      selectedContactId,
      contactMode,
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
      {existingInspection ? <input type="hidden" name="inspection_id" value={existingInspection.id} /> : null}
      {Object.entries(values).filter(([key]) => key.startsWith("customer_")).map(([key, value]) => (
        <input key={key} type="hidden" name={key} value={value} />
      ))}
      <input type="hidden" name="existing_customer_id" value={selectedCustomerId} />
      <input type="hidden" name="existing_machine_id" value={selectedMachineId} />
      <input type="hidden" name="linked_battery_machine_id" value={linkedBatteryMachineId} />
      <input type="hidden" name="selected_contact_id" value={contactMode === "existing" ? resolvedSelectedContactId : ""} />
      <input type="hidden" name="save_as_new_contact" value={contactMode === "new" ? "1" : ""} />
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        style={{ position: "absolute", left: "-9999px", opacity: 0, pointerEvents: "none" }}
        aria-hidden="true"
      />

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
            {selectedCustomer ? (
              <div className="form-grid-wide" style={{ marginBottom: "1rem" }}>
                <div className="field">
                  <label htmlFor="contact-choice">Contactpersoon</label>
                  <select
                    id="contact-choice"
                    value={contactMode === "new" ? "__new__" : resolvedSelectedContactId}
                    onChange={(event) => {
                      const nextValue = event.target.value;
                      if (nextValue === "__new__") {
                        chooseContactMode("new");
                        return;
                      }

                      setSelectedContactId(nextValue);
                      setContactMode("existing");
                      const nextContact = availableContacts.find((contact) => contact.id === nextValue);
                      if (nextContact) {
                        setValues((current) => ({
                          ...current,
                          ...customerContactValues(nextContact, selectedCustomer)
                        }));
                      }
                    }}
                  >
                    {availableContacts.map((contact) => (
                      <option key={contact.id} value={contact.id}>
                        {contact.name || "Contactpersoon"}
                        {contact.department ? ` · ${contact.department}` : ""}
                        {contact.isPrimary ? " · huidig" : ""}
                      </option>
                    ))}
                    <option value="__new__">Nieuwe contactpersoon toevoegen</option>
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="customer_contact_department">Afdeling / functie</label>
                  <input
                    id="customer_contact_department"
                    name="customer_contact_department"
                    value={values.customer_contact_department ?? ""}
                    placeholder="Bijv. keuring, verhuur of planning"
                    onChange={(event) => setFieldValue("customer_contact_department", event.target.value)}
                  />
                </div>
                <div className="info-card">
                  <strong>
                    {contactMode === "existing"
                      ? selectedContact?.name || "Geen contactpersoon"
                      : "Nieuwe contactpersoon"}
                  </strong>
                  <span>
                    {contactMode === "existing"
                      ? selectedContact?.department ||
                        selectedContact?.email ||
                        selectedContact?.phone ||
                        selectedCustomer?.email ||
                        "Wordt gebruikt in deze keuring."
                      : "Deze contactpersoon wordt bewaard bij de klant."}
                  </span>
                </div>
              </div>
            ) : null}
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
                  <strong>{values.customer_contact || "-"}</strong>
                  <span>Contactpersoon</span>
                </div>
                <div className="info-card">
                  <strong>{values.customer_contact_department || "-"}</strong>
                  <span>Afdeling / functie</span>
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
                {selectedCustomer ? (
                  <>
                    <div className="field">
                      <label htmlFor="contact-choice-step4">Contactpersoon voor deze keuring</label>
                      <select
                        id="contact-choice-step4"
                        value={contactMode === "new" ? "__new__" : resolvedSelectedContactId}
                        onChange={(event) => {
                          const nextValue = event.target.value;
                          if (nextValue === "__new__") {
                            chooseContactMode("new");
                            return;
                          }

                          setSelectedContactId(nextValue);
                          setContactMode("existing");
                          const nextContact = availableContacts.find((contact) => contact.id === nextValue);
                          if (nextContact) {
                            setValues((current) => ({
                              ...current,
                              ...customerContactValues(nextContact, selectedCustomer)
                            }));
                          }
                        }}
                      >
                        {availableContacts.map((contact) => (
                          <option key={contact.id} value={contact.id}>
                            {contact.name || "Contactpersoon"}
                            {contact.department ? ` · ${contact.department}` : ""}
                            {contact.isPrimary ? " · huidig" : ""}
                          </option>
                        ))}
                        <option value="__new__">Nieuwe contactpersoon toevoegen</option>
                      </select>
                    </div>
                    <div className="field">
                      <label htmlFor="customer_email">Mailadres voor deze keuring</label>
                      <input
                        id="customer_email"
                        name="customer_email"
                        type="email"
                        value={values.customer_email ?? ""}
                        placeholder="Algemeen of persoonlijk e-mailadres"
                        onChange={(event) => setFieldValue("customer_email", event.target.value)}
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="customer_contact_department_step4">Afdeling / functie</label>
                      <input
                        id="customer_contact_department_step4"
                        name="customer_contact_department"
                        value={values.customer_contact_department ?? ""}
                        placeholder="Bijv. keuring, verhuur of planning"
                        onChange={(event) => setFieldValue("customer_contact_department", event.target.value)}
                      />
                    </div>
                  </>
                ) : null}
                {type !== "batterij_lader" ? (
                  <>
                    <div className="field autocomplete">
                      <label htmlFor="linked-battery-search">Batterij / lader koppelen (optioneel)</label>
                      <input
                        id="linked-battery-search"
                        value={linkedBatteryQuery}
                        onChange={(event) => {
                          setLinkedBatteryQuery(event.target.value);
                          setLinkedBatteryMachineId("");
                          setLinkedBatteryMenuOpen(true);
                        }}
                        onFocus={() => setLinkedBatteryMenuOpen(true)}
                        placeholder="Zoek op intern nummer of serienummer"
                        autoComplete="off"
                      />
                      {filteredBatteryChargerMachines.length > 0 &&
                      linkedBatteryQuery &&
                      linkedBatteryMenuOpen ? (
                        <div className="autocomplete-menu">
                          {filteredBatteryChargerMachines.map((machine) => (
                            <button
                              className="autocomplete-item"
                              key={machine.id}
                              type="button"
                              onClick={() => {
                                setLinkedBatteryMachineId(machine.id);
                                setLinkedBatteryQuery(batteryChargerLabel(machine));
                                setLinkedBatteryMenuOpen(false);
                              }}
                            >
                              <strong>{batteryChargerLabel(machine)}</strong>
                              <span>
                                {machine.configuration.battery_serial_number ||
                                  machine.configuration.charger_serial_number ||
                                  machine.serialNumber ||
                                  "-"}
                              </span>
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <div className="info-card">
                      <strong>{batteryChargerLabel(selectedLinkedBatteryMachine)}</strong>
                      <span>
                        {selectedLinkedBatteryMachine
                          ? "Wordt aan deze machine gekoppeld en is later direct vanaf de machinekaart te openen."
                          : "Niet verplicht. Gebruik dit alleen als deze machine een eigen batterij / lader dossier heeft."}
                      </span>
                    </div>
                    {selectedMachineId ? (
                      <div className="actions" style={{ alignItems: "center" }}>
                        <Link
                          className="button-secondary"
                          href={`/machines/nieuw?type=batterij_lader&customerId=${selectedCustomerId}&linkedMachineId=${selectedMachineId}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Nieuwe batterij / lader
                        </Link>
                      </div>
                    ) : null}
                  </>
                ) : null}
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
                <label htmlFor="findings">Opmerking voor klant</label>
                <textarea id="findings" name="findings" value={values.findings ?? ""} onChange={(event) => setFieldValue("findings", event.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="conclusion">Eigen notitie</label>
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
                      <input
                        type="checkbox"
                        name="result_labels"
                        value={label}
                        checked={selectedResultLabels.includes(label)}
                        onChange={() => {
                          setSelectedResultLabels((current) =>
                            current.includes(label) ? current.filter((item) => item !== label) : [label]
                          );
                        }}
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
              <div className="field">
                <label className="status-chip" htmlFor="send_pdf_to_customer">
                  <input id="send_pdf_to_customer" type="checkbox" name="send_pdf_to_customer" />
                  Mail de keuring ook naar de klant
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
              {isPending
                ? "Bezig met opslaan..."
                : selectedResultLabels.includes("In behandeling")
                  ? "Keuring bijwerken"
                  : "Keuring afronden"}
            </button>
          )}
        </div>
      </section>
    </form>
  );
}
