import type { ChecklistSectionDefinition } from "@/lib/types";

// Overgenomen uit het nieuwe keuringsrapportsjabloon van augustus 2026.
export const stellingmateriaalSections: ChecklistSectionDefinition[] = [
  {
    key: "gebouwvloer_ondergrond",
    title: "1. Gebouwvloer & ondergrond",
    items: [
      {
        key: "scheuren",
        label: "Scheuren"
      },
      {
        key: "verzakkingen",
        label: "Verzakkingen"
      }
    ]
  },
  {
    key: "veiligheidsvoorzieningen",
    title: "2. Veiligheidsvoorzieningen",
    items: [
      {
        key: "doorvalbeveiliging",
        label: "Doorvalbeveiliging"
      },
      {
        key: "diepteliggers",
        label: "Diepteliggers bij pallets met afwijkende maten / kwaliteiten"
      }
    ]
  },
  {
    key: "aanrijbeveiliging",
    title: "3. Aanrijbeveiliging",
    items: [
      {
        key: "aanwezigheid_1",
        label: "Aanwezigheid aanrijbeschermers (1)"
      },
      {
        key: "aanwezigheid_2",
        label: "Aanwezigheid aanrijbeschermers (2)"
      }
    ]
  },
  {
    key: "constructie_conditie",
    title: "4. Constructie & conditie",
    items: [
      {
        key: "corrosie",
        label: "Corrosie"
      },
      {
        key: "aanrijbeschadigingen",
        label: "Aanrijbeschadigingen"
      },
      {
        key: "vervormingen",
        label: "Vervormingen"
      },
      {
        key: "boren_lassen",
        label: "Bewerkingen zoals boren / lassen"
      }
    ]
  },
  {
    key: "belasting_gebruik",
    title: "5. Belasting & gebruik",
    items: [
      {
        key: "max_doorbuiging",
        label: "Max. doorbuiging 1/200 × L"
      },
      {
        key: "conform_belastingen",
        label: "Gebruik conform opgegeven belastingen"
      },
      {
        key: "actuele_draagvermogenborden",
        label: "Actuele draagvermogenborden"
      }
    ]
  },
  {
    key: "montage_verankering",
    title: "6. Montage & verankering",
    items: [
      {
        key: "inhaken_liggers",
        label: "Inhaken liggers"
      },
      {
        key: "aanwezigheid_borging",
        label: "Aanwezigheid borging"
      },
      {
        key: "loodrechte_stand",
        label: "Loodrechte stand stellingen"
      },
      {
        key: "aanwezigheid_schoorverbanden",
        label: "Aanwezigheid schoorverbanden"
      },
      {
        key: "wijzigingen_vakhoogtes",
        label: "Wijzigingen vakhoogtes / liggerniveaus"
      },
      {
        key: "juiste_montage_koppelstukken",
        label: "Juiste montage koppelstukken"
      },
      {
        key: "ontbrekende_delen",
        label: "Ontbrekende delen t.o.v. oorspronkelijke configuratie"
      },
      {
        key: "verschuivingen",
        label: "Verschuivingen"
      },
      {
        key: "aanwezigheid_verankering",
        label: "Aanwezigheid verankering"
      },
      {
        key: "wijziging_rijlengte",
        label: "Wijziging rijlengte"
      },
      {
        key: "wijzigingen_aantal_etages",
        label: "Wijzigingen aantal etages"
      },
      {
        key: "vulplaten_staanders",
        label: "Vulplaten staanders"
      }
    ]
  },
  {
    key: "stellingvloer_entresol",
    title: "7. Stellingvloer & entresol",
    items: [
      {
        key: "gebruik_belasting",
        label: "Gebruik conform opgegeven belasting"
      },
      {
        key: "conditie_staalconstructie",
        label: "Conditie staalconstructie"
      },
      {
        key: "conditie_railing",
        label: "Conditie railing"
      },
      {
        key: "conditie_dekvloeren",
        label: "Conditie dekvloeren"
      },
      {
        key: "conditie_trappen",
        label: "Conditie trappen"
      },
      {
        key: "conditie_palletopzetplaatsen",
        label: "Conditie palletopzetplaatsen"
      }
    ]
  },
  {
    key: "verrijdbare_stellingen",
    title: "8. Verrijdbare stellingen",
    items: [
      {
        key: "beveiligingen",
        label: "Beveiligingen"
      },
      {
        key: "railconditie",
        label: "Railconditie"
      },
      {
        key: "onderwagen_aandrijving",
        label: "Onderwagen & aandrijving"
      },
      {
        key: "besturing",
        label: "Besturing"
      }
    ]
  }
];
