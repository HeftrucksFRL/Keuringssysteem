import type { ChecklistSectionDefinition } from "@/lib/types";

// Overgenomen uit het nieuwe keuringsrapportsjabloon van augustus 2026.
export const batterijLaderSections: ChecklistSectionDefinition[] = [
  {
    key: "batterijbehuizing_constructie",
    title: "1. Batterijbehuizing & constructie",
    items: [
      {
        key: "staat_batterijcontainer",
        label: "Staat batterijcontainer"
      },
      {
        key: "hijsogen",
        label: "Hijsogen"
      },
      {
        key: "identificatieplaatje",
        label: "Identificatieplaatje"
      }
    ]
  },
  {
    key: "batterij_aansluitingen",
    title: "2. Batterij & aansluitingen",
    items: [
      {
        key: "staat_batterij",
        label: "Staat batterij"
      },
      {
        key: "eindkabels",
        label: "Eindkabels"
      },
      {
        key: "celverbindingen",
        label: "Celverbindingen"
      },
      {
        key: "stekkers",
        label: "Stekkers"
      },
      {
        key: "poolbouten",
        label: "Poolbouten"
      },
      {
        key: "vuldoppen",
        label: "Vuldoppen"
      },
      {
        key: "celdeksels",
        label: "Celdeksels"
      }
    ]
  },
  {
    key: "lader_bekabeling",
    title: "3. Lader & bekabeling",
    items: [
      {
        key: "primaire_kabel",
        label: "Primaire kabel"
      },
      {
        key: "primaire_stekker",
        label: "Primaire stekker"
      },
      {
        key: "primaire_kabel_trekontlasting",
        label: "Trekontlasting primaire kabel"
      },
      {
        key: "secundaire_kabel",
        label: "Secundaire kabel / laadkabel"
      },
      {
        key: "secundaire_kabel_stekker",
        label: "Secundaire stekker"
      },
      {
        key: "secundaire_kabel_trekontlasting",
        label: "Trekontlasting secundaire kabel"
      },
      {
        key: "secundaire_kabel_stopknop",
        label: "Stopknop / aan-uit-schakelaar"
      }
    ]
  },
  {
    key: "veiligheid_opstelling",
    title: "4. Veiligheid & opstelling",
    items: [
      {
        key: "veiligheid_indicatielampjes",
        label: "Indicatielampjes"
      },
      {
        key: "veiligheidsopschriften",
        label: "Veiligheidsopschriften"
      },
      {
        key: "aarding",
        label: "Aarding"
      },
      {
        key: "veiligheid_behuizing_lader",
        label: "Behuizing lader"
      },
      {
        key: "opstelling_lader",
        label: "Opstelling lader"
      },
      {
        key: "bedieningsvoorschriften",
        label: "Bedieningsvoorschriften"
      }
    ]
  }
];
