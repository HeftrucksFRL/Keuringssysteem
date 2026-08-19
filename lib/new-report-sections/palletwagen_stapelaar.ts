import type { ChecklistSectionDefinition } from "@/lib/types";

// Overgenomen uit het nieuwe keuringsrapportsjabloon van augustus 2026.
export const palletwagenStapelaarSections: ChecklistSectionDefinition[] = [
  {
    key: "chassis_constructie",
    title: "1. Chassis & constructie",
    items: [
      {
        key: "bevestigingen",
        label: "Bevestigingen"
      },
      {
        key: "beplating_afscherming",
        label: "Beplating, afscherming, beschermroosters & ruiten"
      },
      {
        key: "beschermkooi",
        label: "Beschermkooi / bestuurdersbescherming"
      },
      {
        key: "lasverbindingen",
        label: "Lasverbindingen"
      },
      {
        key: "zwenkwielen_steunblokken",
        label: "Zwenkwielen / steunblokken"
      }
    ]
  },
  {
    key: "wielen_remmen",
    title: "2. Wielen & remmen",
    items: [
      {
        key: "ophanging",
        label: "Ophanging"
      },
      {
        key: "velgen",
        label: "Velgen"
      },
      {
        key: "bandenspanning_slijtage",
        label: "Bandenspanning & slijtage"
      },
      {
        key: "wielbouten_moeren_assen",
        label: "Wielbouten, moeren & assen"
      },
      {
        key: "lekkage_remsysteem",
        label: "Lekkage remsysteem"
      },
      {
        key: "remvoering",
        label: "Remvoering, trommels & schijven"
      },
      {
        key: "ankerplaten_remklauwen",
        label: "Ankerplaten / remklauwen"
      },
      {
        key: "werking_parkeerrem",
        label: "Werking parkeerrem"
      },
      {
        key: "totale_remwerking",
        label: "Totale remwerking"
      }
    ]
  },
  {
    key: "besturing",
    title: "3. Besturing",
    items: [
      {
        key: "overbrengingsmechanisme",
        label: "Overbrengingsmechanisme"
      },
      {
        key: "werking_stuurbekrachtiging",
        label: "Werking stuurbekrachtiging"
      }
    ]
  },
  {
    key: "aandrijving",
    title: "4. Aandrijving",
    items: [
      {
        key: "motor_aandrijfunit_verbranding_elektrisch",
        label: "Motor / aandrijfunit (verbranding / elektrisch)"
      },
      {
        key: "motorophanging",
        label: "Motorophanging"
      },
      {
        key: "werking_aandrijfmotor",
        label: "Werking aandrijfmotor"
      },
      {
        key: "montage_brandstoftank_tractiebatterij",
        label: "Montage brandstoftank / tractiebatterij"
      },
      {
        key: "bevestiging_transmissie",
        label: "Bevestiging & lekkage transmissie"
      }
    ]
  },
  {
    key: "hefinrichting_hydrauliek",
    title: "5. Hefinrichting & hydrauliek",
    items: [
      {
        key: "vervormingen",
        label: "Vervormingen"
      },
      {
        key: "borgingen",
        label: "Borgingen"
      },
      {
        key: "looprollen",
        label: "Looprollen"
      },
      {
        key: "werking_hefmast",
        label: "Werking hefmast"
      },
      {
        key: "hefmastophanging",
        label: "Hefmastophanging"
      },
      {
        key: "meetcontrole_hefkettingen",
        label: "Meetcontrole hefkettingen"
      },
      {
        key: "hefmastverbindingen",
        label: "Hefmastverbindingen / inrichting"
      },
      {
        key: "lekkage_hydraulische_cilinders",
        label: "Lekkage hydraulische cilinders"
      },
      {
        key: "hydraulisch_oliepeil",
        label: "Hydraulisch oliepeil"
      },
      {
        key: "overdrukafstelling",
        label: "Overdrukafstelling"
      },
      {
        key: "werking_pomp",
        label: "Werking pomp / pompmotor"
      },
      {
        key: "hydraulische_slangen",
        label: "Hydraulische slangen, lekkage & verbindingen"
      },
      {
        key: "totale_werking_hefgedeelte",
        label: "Totale werking hefinrichting"
      }
    ]
  },
  {
    key: "elektrische_installatie",
    title: "6. Elektrische installatie",
    items: [
      {
        key: "bedrading",
        label: "Bedrading"
      },
      {
        key: "schakelapparatuur",
        label: "Schakelapparatuur"
      },
      {
        key: "elektrische_installatie_algemeen",
        label: "Elektrische installatie algemeen"
      },
      {
        key: "veiligheidsschakelingen",
        label: "Veiligheidsschakelingen"
      },
      {
        key: "keursticker_tractiebatterij",
        label: "Keursticker tractiebatterij"
      },
      {
        key: "keursticker_lader",
        label: "Keursticker lader"
      },
      {
        key: "resultaat_nen3140",
        label: "Resultaat NEN 3140"
      }
    ]
  },
  {
    key: "bediening_veiligheid",
    title: "7. Bediening & veiligheid",
    items: [
      {
        key: "beschermingen_instructies",
        label: "Beschermingen & instructies"
      },
      {
        key: "identificatieplaten_opschriften_documentatie",
        label: "Identificatieplaten, opschriften & documentatie"
      },
      {
        key: "op_afstap_handgrepen",
        label: "Op- en afstap / handgrepen"
      },
      {
        key: "bedieningsorganen",
        label: "Bedieningsorganen"
      },
      {
        key: "veiligheidssignalering",
        label: "Veiligheidssignalering"
      },
      {
        key: "totale_werking_proefrit",
        label: "Totale werking / proefrit"
      }
    ]
  }
];
