export type InspectionStatus = "draft" | "completed" | "approved" | "rejected";

export type ChecklistOption = "goed" | "matig" | "slecht" | "nvt";

export type MachineType =
  | "heftruck_reachtruck"
  | "batterij_lader"
  | "graafmachine"
  | "hoogwerker"
  | "palletwagen_stapelaar"
  | "shovel"
  | "verreiker"
  | "stellingmateriaal";

export type FieldType = "text" | "textarea" | "date" | "number" | "email";

export interface MachineFieldDefinition {
  key: string;
  label: string;
  type?: FieldType;
  placeholder?: string;
}

export interface ChecklistItemDefinition {
  key: string;
  label: string;
}

export interface ChecklistSectionDefinition {
  key: string;
  title: string;
  items: ChecklistItemDefinition[];
}

export interface FormDefinition {
  type: MachineType;
  title: string;
  machineLabel: string;
  machineFields: MachineFieldDefinition[];
  checklistOptions: ChecklistOption[];
  sections: ChecklistSectionDefinition[];
  conclusionLabels: string[];
}

export interface DashboardKpi {
  label: string;
  value: string;
  helper: string;
}
