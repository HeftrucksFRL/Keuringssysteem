import type { PlanningRecord } from "@/lib/domain";
import { todayLocalIso } from "@/lib/utils";

export type PlanningDisplayState = "upcoming" | "overdue" | "scheduled" | "completed";

function normalizePlanningNote(value?: string) {
  return (value ?? "").trim().toLowerCase();
}

export function isManualPlanningItem(item: Pick<PlanningRecord, "inspectionId" | "notes">) {
  const note = normalizePlanningNote(item.notes);
  return !item.inspectionId || note.includes("handmatig gepland");
}

export function getPlanningDisplayState(
  item: Pick<PlanningRecord, "state" | "inspectionId" | "notes" | "dueDate">
): PlanningDisplayState {
  if (item.state === "completed") {
    return "completed";
  }

  if (item.state === "overdue" || item.dueDate < todayLocalIso()) {
    return "overdue";
  }

  return isManualPlanningItem(item) ? "scheduled" : "upcoming";
}

export function getPlanningDisplayLabel(
  item: Pick<PlanningRecord, "state" | "inspectionId" | "notes" | "dueDate">
) {
  const displayState = getPlanningDisplayState(item);

  if (displayState === "completed") {
    return "Afgerond";
  }

  if (displayState === "overdue") {
    return "Verlopen";
  }

  return displayState === "scheduled" ? "Gepland" : "Niet ingepland";
}
