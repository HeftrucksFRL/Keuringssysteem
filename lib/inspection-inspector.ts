import type { InspectionRecord } from "@/lib/domain";

export interface InspectionActor {
  id: string;
  email: string;
  name: string;
}

export type InspectionTemplateOwner = "Age" | "Renze";

const accountNames: Record<string, string> = {
  "info@heftrucks.frl": "Renze Pieter Veltman",
  "info@terpstratrading.frl": "Age Terpstra",
  "info@heftruckopleiding.frl": "Age Terpstra"
};

export function knownInspectorNameForEmail(email: string) {
  return accountNames[email.trim().toLowerCase()] ?? "";
}

export function canonicalInspectorName(email: string, fallbackName = "") {
  return knownInspectorNameForEmail(email) || fallbackName.trim() || "Age Terpstra";
}

export function canonicalInspectionActor(actor: InspectionActor): InspectionActor {
  const email = actor.email.trim().toLowerCase();
  return {
    id: actor.id,
    email,
    name: canonicalInspectorName(email, actor.name)
  };
}

export function inspectionTemplateOwner(
  inspection: Pick<InspectionRecord, "inspectorEmail" | "inspectorName">
): InspectionTemplateOwner {
  const email = String(inspection.inspectorEmail ?? "").trim().toLowerCase();
  const name = String(inspection.inspectorName ?? "").trim().toLowerCase();
  return email === "info@heftrucks.frl" || name.includes("renze") ? "Renze" : "Age";
}

export function inspectionInspectorName(
  inspection: Pick<InspectionRecord, "inspectorEmail" | "inspectorName">
) {
  const owner = inspectionTemplateOwner(inspection);
  return canonicalInspectorName(
    String(inspection.inspectorEmail ?? ""),
    String(inspection.inspectorName ?? "") ||
      (owner === "Renze" ? "Renze Pieter Veltman" : "Age Terpstra")
  );
}
