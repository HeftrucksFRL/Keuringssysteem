import type { ChecklistSectionDefinition, MachineType } from "@/lib/types";
import { batterijLaderSections } from "@/lib/new-report-sections/batterij_lader";
import { graafmachineSections } from "@/lib/new-report-sections/graafmachine";
import { heftruckReachtruckSections } from "@/lib/new-report-sections/heftruck_reachtruck";
import { hoogwerkerSections } from "@/lib/new-report-sections/hoogwerker";
import { palletwagenStapelaarSections } from "@/lib/new-report-sections/palletwagen_stapelaar";
import { shovelSections } from "@/lib/new-report-sections/shovel";
import { stellingmateriaalSections } from "@/lib/new-report-sections/stellingmateriaal";
import { verreikerSections } from "@/lib/new-report-sections/verreiker";

export const newReportSections: Record<MachineType, ChecklistSectionDefinition[]> = {
  batterij_lader: batterijLaderSections,
  graafmachine: graafmachineSections,
  heftruck_reachtruck: heftruckReachtruckSections,
  hoogwerker: hoogwerkerSections,
  palletwagen_stapelaar: palletwagenStapelaarSections,
  shovel: shovelSections,
  stellingmateriaal: stellingmateriaalSections,
  verreiker: verreikerSections
};
