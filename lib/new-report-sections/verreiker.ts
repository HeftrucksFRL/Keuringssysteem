import type { ChecklistSectionDefinition } from "@/lib/types";

// Overgenomen uit het nieuwe keuringsrapportsjabloon van augustus 2026.
export const verreikerSections: ChecklistSectionDefinition[] = [
  {
    key: "documentatie_identificatie",
    title: "1. Documentatie & identificatie",
    items: [
      {
        key: "documenten",
        label: "Documenten"
      },
      {
        key: "veiligheids_bedieningsstickers",
        label: "Veiligheids- & bedieningsstickers"
      }
    ]
  },
  {
    key: "bediening_veiligheid",
    title: "2. Bediening & veiligheid",
    items: [
      {
        key: "op_afstapbeveiligingen",
        label: "Op- en afstapbeveiliging"
      },
      {
        key: "startbeveiliging_noodstop",
        label: "Startbeveiliging / noodstopschakelaar"
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
        key: "achteruitrijalarm_zwaailamp",
        label: "Achteruitrijalarm / zwaailamp / overlastsignalering"
      },
      {
        key: "vergrendelingen",
        label: "Vergrendelingen"
      },
      {
        key: "brandbeveiliging",
        label: "Brandbeveiliging"
      }
    ]
  },
  {
    key: "chassis_rijwerk",
    title: "3. Chassis & rijwerk",
    items: [
      {
        key: "scheuren_vervormingen",
        label: "Scheuren & vervormingen"
      },
      {
        key: "banden_wielen",
        label: "Banden & wielen"
      },
      {
        key: "assen_steunpoten",
        label: "Assen & steunpoten"
      },
      {
        key: "trekhaak_stopcontact",
        label: "Trekhaak / stopcontact aanhangwagen"
      },
      {
        key: "leveling",
        label: "Leveling"
      },
      {
        key: "draaikrans",
        label: "Draaikrans"
      }
    ]
  },
  {
    key: "besturing_remmen",
    title: "4. Besturing & remmen",
    items: [
      {
        key: "werking_remmen",
        label: "Werking remmen"
      },
      {
        key: "remaccumulator",
        label: "Remaccumulator"
      },
      {
        key: "luchtdrukremsysteem",
        label: "Luchtdrukremsysteem"
      },
      {
        key: "stuurcilinder",
        label: "Stuurcilinder"
      },
      {
        key: "stuursysteem",
        label: "Stuursysteem"
      }
    ]
  },
  {
    key: "hydrauliek",
    title: "5. Hydrauliek",
    items: [
      {
        key: "hydrauliek_werking",
        label: "Werking"
      },
      {
        key: "slangen_cilinders_bevestigingen",
        label: "Slangen / cilinders / bevestigingen"
      },
      {
        key: "afstelling_maximale_werkdruk",
        label: "Afstelling maximale werkdruk"
      },
      {
        key: "hydraulisch_oliepeil",
        label: "Hydraulisch oliepeil"
      }
    ]
  },
  {
    key: "telescoop_hefinrichting",
    title: "6. Telescoop & hefinrichting",
    items: [
      {
        key: "vervormingen",
        label: "Vervormingen"
      },
      {
        key: "lastbeschermrek",
        label: "Lastbeschermrek"
      },
      {
        key: "vorken",
        label: "Vorken"
      },
      {
        key: "looprollen_glijblokken_kettingen",
        label: "Looprollen / glijblokken / kettingen"
      },
      {
        key: "voorzetapparatuur",
        label: "Voorzetapparatuur"
      },
      {
        key: "werking_telescoop",
        label: "Werking telescoop"
      },
      {
        key: "telescoopophanging",
        label: "Telescoopophanging"
      },
      {
        key: "lastmomentprogrammas",
        label: "Lastmomentprogramma's"
      },
      {
        key: "werking_lastmomentbeveiliging",
        label: "Werking lastmomentbeveiliging"
      },
      {
        key: "wissel_vorkenbord",
        label: "Wissel vorkenbord"
      },
      {
        key: "werking_compensatiecircuit",
        label: "Werking compensatiecircuit"
      }
    ]
  },
  {
    key: "motor_aandrijving",
    title: "7. Motor & aandrijving",
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
        key: "roetfilter",
        label: "Roetfilter"
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
      },
      {
        key: "aandrijving",
        label: "Aandrijving"
      }
    ]
  },
  {
    key: "cabine_bediening",
    title: "8. Cabine & bediening",
    items: [
      {
        key: "bevestiging_cabine",
        label: "Bevestiging cabine"
      },
      {
        key: "op_afstap_handgrepen",
        label: "Op- en afstap / handgrepen"
      },
      {
        key: "overdruk_cabine",
        label: "Overdruk cabine"
      },
      {
        key: "ruiten_wissers_sproeiers",
        label: "Ruiten / ruitenwissers / sproeiers"
      },
      {
        key: "bediening_stoel",
        label: "Bediening & stoel"
      },
      {
        key: "losliggende_delen",
        label: "Losliggende delen"
      },
      {
        key: "waterpas",
        label: "Waterpas"
      },
      {
        key: "last_vluchtdiagrammen",
        label: "Last- / vluchtdiagrammen"
      },
      {
        key: "kachel",
        label: "Kachel"
      }
    ]
  },
  {
    key: "elektrische_installatie_accessoires",
    title: "9. Elektrische installatie & accessoires",
    items: [
      {
        key: "verlichting_bekabeling",
        label: "Verlichting & bekabeling"
      },
      {
        key: "accubevestigingen",
        label: "Accubevestigingen"
      },
      {
        key: "radiograaf",
        label: "Radiograaf"
      }
    ]
  }
];
