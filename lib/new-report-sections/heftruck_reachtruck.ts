import type { ChecklistSectionDefinition } from "@/lib/types";

// Overgenomen uit het nieuwe keuringsrapportsjabloon van augustus 2026.
export const heftruckReachtruckSections: ChecklistSectionDefinition[] = [
  {
    key: "chassis_constructie",
    title: "1. Chassis & constructie",
    items: [
      {
        key: "bevestigingen",
        label: "Bevestigingen"
      },
      {
        key: "aanhangkoppeling",
        label: "Aanhangkoppeling"
      },
      {
        key: "beschermroosters",
        label: "Beschermroosters"
      },
      {
        key: "beschermkap",
        label: "Beschermkap"
      },
      {
        key: "beplating_afscherming",
        label: "Beplating & afscherming"
      },
      {
        key: "lasverbindingen",
        label: "Lasverbindingen"
      }
    ]
  },
  {
    key: "wielen_remmen",
    title: "2. Wielen & remmen",
    items: [
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
        key: "lekkage",
        label: "Lekkage remsysteem"
      },
      {
        key: "werking_parkeerrem",
        label: "Werking parkeerrem"
      },
      {
        key: "remvloeistof",
        label: "Remvloeistof"
      },
      {
        key: "remvoering_trommels_schijven",
        label: "Remvoering, trommels & schijven"
      },
      {
        key: "ankerplaten",
        label: "Ankerplaten / remklauwen"
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
        key: "stuurwiel",
        label: "Stuurwiel"
      },
      {
        key: "stuurboom_disselboom",
        label: "Stuurboom / disselboom"
      },
      {
        key: "lekkage_stuursysteem",
        label: "Lekkage stuursysteem"
      },
      {
        key: "stuuras",
        label: "Stuuras"
      },
      {
        key: "stuurkogels",
        label: "Stuurkogels"
      },
      {
        key: "fuseepennen",
        label: "Fuseepennen"
      },
      {
        key: "stuurketting",
        label: "Stuurketting"
      },
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
        key: "aandrijfunit_verbranding_elektrisch",
        label: "Aandrijfunit (verbranding / elektrisch)"
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
        key: "uitlaatsysteem",
        label: "Uitlaatsysteem"
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
        key: "lastbeschermrek",
        label: "Lastbeschermrek"
      },
      {
        key: "vorkophanging",
        label: "Vorkophanging"
      },
      {
        key: "meetcontrole_vorken",
        label: "Meetcontrole vorken"
      },
      {
        key: "meetcontrole_hefkettingen",
        label: "Meetcontrole hefkettingen"
      },
      {
        key: "kettingrollen",
        label: "Kettingrollen"
      },
      {
        key: "looprollen",
        label: "Looprollen"
      },
      {
        key: "voorzetstukken",
        label: "Voorzetstukken"
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
        key: "hefmastverbindingen",
        label: "Hefmastverbindingen"
      },
      {
        key: "lekkage_cilinders",
        label: "Lekkage hydraulische cilinders"
      },
      {
        key: "hydr_slangen_lekkage",
        label: "Hydraulische slangen, lekkage & verbindingen"
      },
      {
        key: "hydr_oliepeil",
        label: "Hydraulisch oliepeil"
      },
      {
        key: "overdrukafstelling_sperventiel",
        label: "Overdrukafstelling / sperventiel"
      },
      {
        key: "werking_pomp",
        label: "Werking pomp / pompmotor"
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
        key: "elektrische_installatie",
        label: "Elektrische installatie algemeen"
      },
      {
        key: "veiligheidsschakelingen",
        label: "Veiligheidsschakelingen"
      },
      {
        key: "keurstatus_tractiebatterij_keursticker",
        label: "Keurstatus tractiebatterij / keursticker"
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
        key: "op_afstap_handgrepen",
        label: "Op- en afstap / handgrepen"
      },
      {
        key: "cabine_toebehoren",
        label: "Cabine & toebehoren"
      },
      {
        key: "bedieningsorganen",
        label: "Bedieningsorganen"
      },
      {
        key: "stoelbevestiging_verstelling",
        label: "Stoelbevestiging & -verstelling"
      },
      {
        key: "veiligheidsgordel",
        label: "Veiligheidsgordel"
      },
      {
        key: "totale_werking_proefrit",
        label: "Totale werking / proefrit"
      },
      {
        key: "identificatieplaten",
        label: "Identificatieplaten"
      }
    ]
  }
];
