import type { FormDefinition, ChecklistOption } from "@/lib/types";

export function buildChecklistRemarkLines(
  form: FormDefinition,
  checklist: Record<string, ChecklistOption>,
  checklistNotes: Record<string, string>
) {
  return form.sections.flatMap((section) =>
    section.items.flatMap((item) => {
      const note = String(checklistNotes[item.key] ?? "").trim();
      const status = checklist[item.key];
      if (!note || (status !== "aandacht" && status !== "afkeur")) {
        return [];
      }

      const statusLabel = status === "aandacht" ? "Aandacht" : "Afkeur";
      return [`${section.title} - ${item.label} (${statusLabel}): ${note}`];
    })
  );
}
