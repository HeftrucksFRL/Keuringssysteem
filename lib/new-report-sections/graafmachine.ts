import type { ChecklistSectionDefinition } from "@/lib/types";

// Overgenomen uit het nieuwe keuringsrapportsjabloon van augustus 2026.
export const graafmachineSections: ChecklistSectionDefinition[] = [
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
        key: "veiligheidshendel_servo",
        label: "Veiligheidshendel servo"
      },
      {
        key: "op_afstapbeveiligingen",
        label: "Op- en afstapbeveiliging"
      },
      {
        key: "startsper_rijstand",
        label: "Startsper in rijstand"
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
        key: "vergrendelingen",
        label: "Vergrendelingen"
      }
    ]
  },
  {
    key: "onderwagen_rijwerk",
    title: "2. Onderwagen & rijwerk",
    items: [
      {
        key: "banden_wielen",
        label: "Banden / wielen"
      },
      {
        key: "tussenringen",
        label: "Tussenringen"
      },
      {
        key: "stabilisatoren",
        label: "Stabilisatoren"
      },
      {
        key: "schuifblad",
        label: "Schuifblad"
      },
      {
        key: "aandrijfunit",
        label: "Aandrijfunit"
      },
      {
        key: "stuurcilinder",
        label: "Stuurcilinder"
      },
      {
        key: "trekhaak",
        label: "Trekhaak"
      },
      {
        key: "draaikrans",
        label: "Draaikrans"
      },
      {
        key: "rupsplaten",
        label: "Rupsplaten"
      },
      {
        key: "sprocket",
        label: "Sprocket"
      },
      {
        key: "spancilinder",
        label: "Spancilinder"
      }
    ]
  },
  {
    key: "bovenwagen_constructie",
    title: "3. Bovenwagen & constructie",
    items: [
      {
        key: "plaatwerk",
        label: "Plaatwerk"
      },
      {
        key: "frame",
        label: "Frame"
      },
      {
        key: "centrale_doorvoer",
        label: "Centrale doorvoer"
      },
      {
        key: "contragewicht",
        label: "Contragewicht"
      },
      {
        key: "sluitingen",
        label: "Sluitingen"
      },
      {
        key: "brandstofvoorziening",
        label: "Brandstofvoorziening"
      }
    ]
  },
  {
    key: "hydrauliek",
    title: "4. Hydrauliek",
    items: [
      {
        key: "hydrauliek_werking",
        label: "Werking hydraulisch systeem"
      },
      {
        key: "hydrauliek_slangen_verbindingen",
        label: "Slangen, verbindingen & bevestigingen"
      },
      {
        key: "overdrukafstelling",
        label: "Overdrukafstelling"
      },
      {
        key: "hydraulisch_oliepeil",
        label: "Hydraulisch oliepeil"
      },
      {
        key: "lekkage_sl_cil",
        label: "Lekkage slangen / leidingen / cilinders"
      }
    ]
  },
  {
    key: "giek_uitrusting",
    title: "5. Giek & uitrusting",
    items: [
      {
        key: "ophanging",
        label: "Ophanging"
      },
      {
        key: "leidingwerk",
        label: "Leidingwerk"
      },
      {
        key: "giek_plaatwerk",
        label: "Plaatwerk"
      },
      {
        key: "opschriften",
        label: "Opschriften"
      },
      {
        key: "borging_pennen",
        label: "Borging pennen"
      },
      {
        key: "snelwisselsysteem",
        label: "Snelwisselsysteem"
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
    key: "elektrische_installatie_remsystemen",
    title: "8. Elektrische installatie & remsystemen",
    items: [
      {
        key: "elektrische_installatie",
        label: "Elektrische installatie"
      },
      {
        key: "remmen",
        label: "Remmen"
      },
      {
        key: "luchtdruksysteem",
        label: "Luchtdruksysteem"
      }
    ]
  }
];
