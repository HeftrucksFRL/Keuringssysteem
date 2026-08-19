import type { ChecklistSectionDefinition } from "@/lib/types";

// Overgenomen uit het nieuwe keuringsrapportsjabloon van augustus 2026.
export const shovelSections: ChecklistSectionDefinition[] = [
  {
    key: "documentatie_veiligheid",
    title: "1. Documentatie & veiligheid",
    items: [
      {
        key: "documenten",
        label: "Documenten"
      },
      {
        key: "veiligheidslabel",
        label: "Veiligheids- & bedieningslabels"
      },
      {
        key: "veiligheidsvoorzieningen",
        label: "Veiligheidsvoorzieningen"
      },
      {
        key: "op_afstapbeveiliging",
        label: "Op- en afstapbeveiliging"
      },
      {
        key: "startbeveiliging",
        label: "Startbeveiliging"
      },
      {
        key: "knikbeveiliging",
        label: "Knikbeveiliging voor transport"
      },
      {
        key: "veiligheidsgordel",
        label: "Veiligheidsgordel"
      },
      {
        key: "spiegels_zonneklep",
        label: "Spiegels & zonneklep"
      },
      {
        key: "achteruitrijalarm",
        label: "Achteruitrijalarm"
      },
      {
        key: "blokkering_bedieningshendels",
        label: "Blokkering bedieningshendels"
      }
    ]
  },
  {
    key: "chassis_rijwerk",
    title: "2. Chassis & rijwerk",
    items: [
      {
        key: "scheuren_vervormingen",
        label: "Scheuren & vervormingen"
      },
      {
        key: "knikpunt",
        label: "Knikpunt"
      },
      {
        key: "banden_wielen",
        label: "Banden / wielen"
      },
      {
        key: "trekhaak",
        label: "Trekhaak"
      },
      {
        key: "asophanging",
        label: "Asophanging"
      }
    ]
  },
  {
    key: "besturing_remmen",
    title: "3. Besturing & remmen",
    items: [
      {
        key: "werking",
        label: "Werking"
      },
      {
        key: "slijtage",
        label: "Slijtage"
      },
      {
        key: "werking_vulling_accumulator",
        label: "Werking / vulling accumulator"
      },
      {
        key: "noodstuursysteem",
        label: "Noodstuursysteem"
      },
      {
        key: "parkeerrem",
        label: "Parkeerrem"
      },
      {
        key: "overmatige_speling",
        label: "Overmatige speling"
      },
      {
        key: "luchtdruksysteem",
        label: "Luchtdruksysteem"
      }
    ]
  },
  {
    key: "hydrauliek",
    title: "4. Hydrauliek",
    items: [
      {
        key: "hydraulisch_oliepeil",
        label: "Hydraulisch oliepeil"
      },
      {
        key: "hydraulisch_werking",
        label: "Werking hydraulisch systeem"
      },
      {
        key: "hydraulische_slangen",
        label: "Slangen, verbindingen & bevestigingen"
      },
      {
        key: "overdrukafstelling",
        label: "Overdrukafstelling"
      }
    ]
  },
  {
    key: "laadframe_uitrusting",
    title: "5. Laadframe & uitrusting",
    items: [
      {
        key: "scharnierpennen",
        label: "Scharnierpennen"
      },
      {
        key: "bak_snelwisselsysteem",
        label: "Bak- & snelwisselsysteem"
      }
    ]
  },
  {
    key: "motor_aandrijving",
    title: "6. Motor & aandrijving",
    items: [
      {
        key: "motorophanging",
        label: "Motorophanging"
      },
      {
        key: "uitlaat",
        label: "Uitlaat"
      },
      {
        key: "brandstofsysteem",
        label: "Brandstofsysteem"
      },
      {
        key: "kabels",
        label: "Kabels"
      },
      {
        key: "v_snaren",
        label: "V-snaren"
      },
      {
        key: "afdichtingen",
        label: "Afdichtingen"
      }
    ]
  },
  {
    key: "cabine_bediening",
    title: "7. Cabine & bediening",
    items: [
      {
        key: "afdichting_cabine",
        label: "Afdichting cabine"
      },
      {
        key: "overdruk_cabine",
        label: "Overdruk cabine"
      },
      {
        key: "overdruksignalering",
        label: "Overdruksignalering"
      },
      {
        key: "werking_filters",
        label: "Werking filters"
      },
      {
        key: "stickers",
        label: "Stickers"
      },
      {
        key: "ruitenwissers_sproeiers",
        label: "Ruitenwissers / sproeiers"
      },
      {
        key: "bedieningshendels",
        label: "Bedieningshendels"
      },
      {
        key: "losliggende_delen",
        label: "Losliggende delen"
      },
      {
        key: "slangen",
        label: "Slangen"
      }
    ]
  },
  {
    key: "elektrische_installatie",
    title: "8. Elektrische installatie",
    items: [
      {
        key: "elektrische_installatie",
        label: "Elektrische installatie"
      }
    ]
  }
];
