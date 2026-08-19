import type { ChecklistSectionDefinition } from "@/lib/types";

// Overgenomen uit het nieuwe keuringsrapportsjabloon van augustus 2026.
export const hoogwerkerSections: ChecklistSectionDefinition[] = [
  {
    key: "documentatie_identificatie",
    title: "1. Documentatie & identificatie",
    items: [
      {
        key: "hoogwerkerboek",
        label: "Hoogwerkerboek"
      },
      {
        key: "werklast_vlucht_grafiek",
        label: "Werklast- / vluchtgrafiek / label"
      },
      {
        key: "ce_conformiteit",
        label: "CE-conformiteitsverklaring"
      },
      {
        key: "bedieningsvoorschrift",
        label: "Bedieningsvoorschrift"
      },
      {
        key: "montagevoorschrift",
        label: "Montagevoorschrift"
      },
      {
        key: "onderhoudsvoorschrift",
        label: "Onderhoudsvoorschrift"
      },
      {
        key: "elektrisch_schema",
        label: "Elektrisch schema"
      }
    ]
  },
  {
    key: "bediening_veiligheid",
    title: "2. Bediening & veiligheid",
    items: [
      {
        key: "bedieningshendels",
        label: "Bedieningshendels / nulstandvergrendeling"
      },
      {
        key: "instrumenten",
        label: "Instrumenten"
      },
      {
        key: "aanduidingen",
        label: "Aanduidingen"
      },
      {
        key: "aanduiding_werklast",
        label: "Aanduiding werklast"
      },
      {
        key: "tabellen_werklast",
        label: "Tabellen werklast"
      },
      {
        key: "contactslot_noodstop",
        label: "Contactslot / noodstop"
      },
      {
        key: "blokkering_beweging",
        label: "Blokkering beweging"
      },
      {
        key: "controle_waterpas",
        label: "Controle horizontaal / waterpas"
      },
      {
        key: "veiligheid_machinist",
        label: "Veiligheid machinist"
      },
      {
        key: "noodbediening",
        label: "Noodbediening"
      }
    ]
  },
  {
    key: "toegang_loopvlakken",
    title: "3. Toegang & loopvlakken",
    items: [
      {
        key: "opstappen_ladders",
        label: "Opstappen / ladders"
      },
      {
        key: "bordessen_loopvlakken",
        label: "Bordessen / loopvlakken"
      },
      {
        key: "handgrepen",
        label: "Handgrepen"
      },
      {
        key: "antislip",
        label: "Antislip"
      }
    ]
  },
  {
    key: "elektrische_installatie",
    title: "4. Elektrische installatie",
    items: [
      {
        key: "elektrische_bedrading",
        label: "Elektrische bedrading"
      },
      {
        key: "hoofdschakelaar",
        label: "Hoofdschakelaar"
      },
      {
        key: "sleepringinrichting",
        label: "Sleepringinrichting"
      },
      {
        key: "schakelkasten",
        label: "Schakelkasten"
      },
      {
        key: "apparatuur",
        label: "Apparatuur"
      }
    ]
  },
  {
    key: "hydrauliek",
    title: "5. Hydrauliek",
    items: [
      {
        key: "motoren",
        label: "Motoren"
      },
      {
        key: "pompen",
        label: "Pompen"
      },
      {
        key: "ventielen",
        label: "Ventielen"
      },
      {
        key: "slangbreukventielen",
        label: "Slangbreukventielen"
      },
      {
        key: "stabiliteit_1_uur",
        label: "Stabiliteit 1 uur gegarandeerd"
      },
      {
        key: "werkbak_verplaatsing",
        label: "Werkbakverplaatsing max. 0,1 m in 10 min."
      }
    ]
  },
  {
    key: "rijwerk_besturing_remmen",
    title: "6. Rijwerk, besturing & remmen",
    items: [
      {
        key: "ophanging_vering_vooras",
        label: "Ophanging / vering vooras"
      },
      {
        key: "ophanging_vering_achteras",
        label: "Ophanging / vering achteras"
      },
      {
        key: "wielbouten_moeren",
        label: "Wielbouten & moeren"
      },
      {
        key: "bandengesteldheid",
        label: "Bandengesteldheid"
      },
      {
        key: "blokkering_pendelas",
        label: "Blokkering pendelas"
      },
      {
        key: "stuurspeling",
        label: "Stuurspeling"
      },
      {
        key: "stuurassen",
        label: "Stuurassen"
      },
      {
        key: "parkeerrem",
        label: "Parkeerrem"
      },
      {
        key: "bedrijfsrem",
        label: "Bedrijfsrem"
      },
      {
        key: "automatische_rem",
        label: "Automatische rem"
      },
      {
        key: "remcilinders",
        label: "Remcilinders"
      },
      {
        key: "leidingen_koppelingen",
        label: "Leidingen & koppelingen"
      },
      {
        key: "slangen",
        label: "Slangen"
      }
    ]
  },
  {
    key: "zwenkinrichting",
    title: "7. Zwenkinrichting",
    items: [
      {
        key: "draaikrans",
        label: "Draaikrans"
      },
      {
        key: "bevestiging",
        label: "Bevestiging"
      },
      {
        key: "bonkelaar",
        label: "Bonkelaar"
      },
      {
        key: "aandrijving_lagering",
        label: "Aandrijving / lagering"
      },
      {
        key: "koppeling",
        label: "Koppeling"
      },
      {
        key: "rem",
        label: "Rem"
      },
      {
        key: "pal",
        label: "Pal"
      }
    ]
  },
  {
    key: "giek_schaarconstructie",
    title: "8. Giek- & schaarconstructie",
    items: [
      {
        key: "telescoop_schaartoren",
        label: "Telescoop / schaartoren"
      },
      {
        key: "constructie_lassen",
        label: "Constructie / lassen"
      },
      {
        key: "bevestiging_frame",
        label: "Bevestiging aan frame"
      },
      {
        key: "bout_penverbindingen",
        label: "Bout- / penverbindingen"
      },
      {
        key: "telescopeerkabel_ketting",
        label: "Telescopeerkabel / ketting"
      },
      {
        key: "bevestiging_borging",
        label: "Bevestiging / borging"
      },
      {
        key: "vanginrichting",
        label: "Vanginrichting"
      },
      {
        key: "parallelgeleiding",
        label: "Parallelgeleiding"
      },
      {
        key: "elektrische_kabels",
        label: "Elektrische kabels"
      },
      {
        key: "topknik_hefcilinders",
        label: "Topknik- / hefcilinders"
      },
      {
        key: "veiligheidskleppen",
        label: "Veiligheidskleppen"
      },
      {
        key: "telescoopcilinders",
        label: "Telescoopcilinders"
      },
      {
        key: "geleiding_telescoopgiek",
        label: "Geleiding telescoopgiek"
      },
      {
        key: "parallelgeleidingscilinder",
        label: "Parallelgeleidingscilinder"
      },
      {
        key: "slangen_leidingen_koppelingen",
        label: "Slangen / leidingen / koppelingen"
      },
      {
        key: "beveiliging_schaar",
        label: "Beveiliging schaar op 1,5 m hoogte"
      }
    ]
  },
  {
    key: "onder_bovenwagenconstructie",
    title: "9. Onder- & bovenwagenconstructie",
    items: [
      {
        key: "constructie_lassen_onderwagen",
        label: "Constructie / lassen onderwagen"
      },
      {
        key: "bout_penverbindingen_onderwagen",
        label: "Bout- / penverbindingen onderwagen"
      },
      {
        key: "constructie_lassen_bovenwagen",
        label: "Constructie / lassen bovenwagen"
      },
      {
        key: "bout_penverbindingen_bovenwagen",
        label: "Bout- / penverbindingen bovenwagen"
      }
    ]
  },
  {
    key: "werkbak_valbeveiliging",
    title: "10. Werkbak & valbeveiliging",
    items: [
      {
        key: "constructie_lassen_2",
        label: "Constructie / lassen"
      },
      {
        key: "bevestiging_2",
        label: "Bevestiging"
      },
      {
        key: "bout_penverbindingen_2",
        label: "Bout- / penverbindingen"
      },
      {
        key: "afsluiting_deur",
        label: "Afsluiting deur"
      },
      {
        key: "zwenkinrichting_bak",
        label: "Zwenkinrichting bak"
      },
      {
        key: "borging",
        label: "Borging"
      },
      {
        key: "horizontaalstelling",
        label: "Horizontaalstelling"
      },
      {
        key: "veiligheidsgordel",
        label: "Veiligheidsgordel"
      }
    ]
  },
  {
    key: "stempels_uithouders",
    title: "11. Stempels & uithouders",
    items: [
      {
        key: "uithouders",
        label: "Uithouders"
      },
      {
        key: "uithouders_borging",
        label: "Borging uithouders"
      },
      {
        key: "cilinders",
        label: "Cilinders"
      },
      {
        key: "stempelcilinders_spindels",
        label: "Stempelcilinders / spindels"
      },
      {
        key: "leidingbreukventielen",
        label: "Leidingbreukventielen"
      },
      {
        key: "borging_stempels",
        label: "Borging stempels"
      },
      {
        key: "stempelvoeten",
        label: "Stempelvoeten"
      },
      {
        key: "borging_stempelvoeten",
        label: "Borging stempelvoeten"
      }
    ]
  },
  {
    key: "elektromotoren",
    title: "12. Elektromotoren",
    items: [
      {
        key: "bevestiging_3",
        label: "Bevestiging"
      },
      {
        key: "sleepringen",
        label: "Sleepringen"
      },
      {
        key: "elektrische_aansluitingen",
        label: "Elektrische aansluitingen"
      },
      {
        key: "koolborstels",
        label: "Koolborstels"
      },
      {
        key: "aarding",
        label: "Aarding"
      }
    ]
  },
  {
    key: "begrenzers_beveiligingen",
    title: "13. Begrenzers & beveiligingen",
    items: [
      {
        key: "rijwerkbegrenzing",
        label: "Rijwerkbegrenzing"
      },
      {
        key: "optoppen_hoogste_stand",
        label: "Optoppen / hoogste stand"
      },
      {
        key: "aftoppen_laagste_stand",
        label: "Aftoppen / laagste stand"
      },
      {
        key: "inknikken",
        label: "Inknikken / intelescoperen"
      },
      {
        key: "uitknikken",
        label: "Uitknikken / uittelescoperen"
      },
      {
        key: "zwenkhoekbegrenzer",
        label: "Zwenkhoekbegrenzer"
      },
      {
        key: "lastbegrenzer",
        label: "Lastbegrenzer"
      },
      {
        key: "lastmomentbegrenzer",
        label: "Lastmomentbegrenzer"
      },
      {
        key: "vluchtbegrenzer",
        label: "Vluchtbegrenzer"
      },
      {
        key: "contraballasbegrenzer",
        label: "Contraballasbegrenzer"
      },
      {
        key: "rijsnelheidbegrenzer",
        label: "Rijsnelheidbegrenzer"
      },
      {
        key: "scheefstand_signaal",
        label: "Uitschakeling heffen bij scheefstand > 3° / signaal"
      }
    ]
  },
  {
    key: "ballast_markering_banden",
    title: "14. Ballast, markering & banden",
    items: [
      {
        key: "bevestiging_ballast",
        label: "Bevestiging ballast"
      },
      {
        key: "massa_ballast_conform_hoogwerkerboek",
        label: "Massa ballast conform hoogwerkerboek"
      },
      {
        key: "verfwerk",
        label: "Verfwerk"
      },
      {
        key: "waarschuwingskleuren",
        label: "Waarschuwingskleuren"
      },
      {
        key: "identificatie",
        label: "Identificatie"
      },
      {
        key: "bandenspanning",
        label: "Bandenspanning"
      }
    ]
  },
  {
    key: "functionele_beproeving",
    title: "15. Functionele beproeving",
    items: [
      {
        key: "op_stempels",
        label: "Op stempels"
      },
      {
        key: "stationair",
        label: "Stationair"
      },
      {
        key: "mobiel",
        label: "Mobiel"
      }
    ]
  }
];
