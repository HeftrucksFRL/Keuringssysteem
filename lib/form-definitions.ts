import type { FormDefinition } from "@/lib/types";

const commonCustomerFields = [
  { key: "customer_name", label: "Klantnaam" },
  { key: "customer_address", label: "Adres" },
  { key: "customer_phone", label: "Telefoonnummer" },
  { key: "customer_contact", label: "Contactpersoon" },
  { key: "customer_email", label: "E-mailadres", type: "email" as const }
];

function withHourReading(
  type: FormDefinition["type"],
  fields: FormDefinition["machineFields"]
) {
  if (type === "batterij_lader" || type === "stellingmateriaal") {
    return fields;
  }

  const hourField = { key: "hour_reading", label: "Urenstand", type: "number" as const };
  const inspectionDateIndex = fields.findIndex((field) => field.key === "inspection_date");

  if (inspectionDateIndex === -1) {
    return [...fields, hourField];
  }

  return [
    ...fields.slice(0, inspectionDateIndex),
    hourField,
    ...fields.slice(inspectionDateIndex)
  ];
}

export const formDefinitions: FormDefinition[] = [
  {
    type: "verreiker",
    title: "Verreiker",
    machineLabel: "Verreiker",
    machineFields: withHourReading("verreiker", [
      ...commonCustomerFields,
      { key: "brand", label: "Merk" },
      { key: "build_year", label: "Bouwjaar", type: "number" },
      { key: "model", label: "Type" },
      { key: "internal_number", label: "Intern nummer" },
      { key: "serial_number", label: "Serienummer" },
      { key: "inspection_date", label: "Keuringsdatum", type: "date" },
      { key: "sticker_number", label: "Stickernummer" }
    ]),
    checklistOptions: ["goed", "slecht", "nvt"],
    conclusionLabels: ["Goedgekeurd", "Afgekeurd", "In behandeling"],
    sections: [
      {
        key: "algemeen",
        title: "1. Algemeen",
        items: [
          { key: "documenten", label: "Documenten" },
          { key: "veiligheids_bedieningsstickers", label: "Veiligheids- en bedieningsstickers" }
        ]
      },
      {
        key: "veiligheidsvoorzieningen",
        title: "2. Veiligheidsvoorzieningen",
        items: [
          { key: "op_afstapbeveiligingen", label: "Op- en afstapbeveiligingen" },
          { key: "startbeveiliging_noodstop", label: "Startbeveiliging / noodstopschakelaar" },
          { key: "veiligheidsgordel", label: "Veiligheidsgordel" },
          { key: "spiegels_zonneklep", label: "Spiegels, zonneklep" },
          { key: "achteruitrijalarm_zwaailamp", label: "Achteruitrijalarm / zwaailamp / overlastsignalering" },
          { key: "vergrendelingen", label: "Vergrendelingen" },
          { key: "brandbeveiliging", label: "Brandbeveiliging" }
        ]
      },
      {
        key: "chassis",
        title: "3. Chassis",
        items: [
          { key: "scheuren_vervormingen", label: "Scheuren en vervormingen" },
          { key: "banden_wielen", label: "Banden en wielen" },
          { key: "assen_steunpoten", label: "Assen en steunpoten" },
          { key: "trekhaak_stopcontact", label: "Trekhaak / stopcontact aanhangwagen" },
          { key: "leveling", label: "Leveling" },
          { key: "draaikrans", label: "Draaikrans" }
        ]
      },
      {
        key: "remmen_stuursysteem",
        title: "4. Remmen en stuursysteem",
        items: [
          { key: "werking_remmen", label: "Werking remmen" },
          { key: "remaccumulator", label: "Remaccumulator" },
          { key: "luchtdrukremsysteem", label: "Luchtdrukremsysteem" },
          { key: "stuurcilinder", label: "Stuurcilinder" },
          { key: "stuursysteem", label: "Stuursysteem" }
        ]
      },
      {
        key: "hydraulisch_systeem",
        title: "5. Hydraulisch systeem",
        items: [
          { key: "hydrauliek_werking", label: "Werking" },
          { key: "slangen_cilinders_bevestigingen", label: "Slangen / cilinders / bevestigingen" },
          { key: "afstellingen_max_werkdruk", label: "Afstellingen max werkdruk" },
          { key: "hydrauliek_oliepeil", label: "Hydrauliek oliepeil" }
        ]
      },
      {
        key: "telescoop",
        title: "6. Telescoop",
        items: [
          { key: "vervormingen", label: "Vervormingen" },
          { key: "lastbeschermrek", label: "Lastbeschermrek" },
          { key: "vorken", label: "Vorken" },
          { key: "looprollen_glijblokken_kettingen", label: "Looprollen / glijblokken / kettingen" },
          { key: "voorzetapparatuur", label: "Voorzetapparatuur" },
          { key: "functionering_telescoop", label: "Functionering telescoop" },
          { key: "telescoopophanging", label: "Telescoopophanging" },
          { key: "lastmomentprogrammas", label: "Lastmomentprogramma's" },
          { key: "werking_lastmomentbeveiliging", label: "Werking lastmomentbeveiliging" },
          { key: "wissel_vorkenbord", label: "Wissel vorkenbord" },
          { key: "werking_compensatiecircuit", label: "Werking compensatiecircuit" }
        ]
      },
      {
        key: "motor",
        title: "7. Motor",
        items: [
          { key: "motorophanging", label: "Motorophanging" },
          { key: "uitlaat", label: "Uitlaat" },
          { key: "roetfilter", label: "Roetfilter" },
          { key: "brandstofsysteem", label: "Brandstofsysteem" },
          { key: "kabels", label: "Kabels" },
          { key: "v_snaren", label: "V-snaren" },
          { key: "afdichtingen", label: "Afdichtingen" },
          { key: "aandrijving", label: "Aandrijving" }
        ]
      },
      {
        key: "cabine",
        title: "8. Cabine",
        items: [
          { key: "bevestiging_cabine", label: "Bevestiging van de cabine" },
          { key: "op_afstap_handgrepen", label: "Op / afstap handgrepen" },
          { key: "overdruk_cabine", label: "Overdruk in cabine" },
          { key: "ruiten_wissers_sproeiers", label: "Ruiten / ruitenwissers / sproeiers" },
          { key: "bediening_stoel", label: "Bediening en stoel" },
          { key: "losliggende_delen", label: "Losliggende delen" },
          { key: "waterpas", label: "Waterpas" },
          { key: "last_vluchtdiagrammen", label: "Last / vluchtdiagrammen" },
          { key: "kachel", label: "Kachel" }
        ]
      },
      {
        key: "overige",
        title: "9. Overige",
        items: [
          { key: "verlichting_bekabeling", label: "Verlichting en bekabeling" },
          { key: "accubevestigingen", label: "Accubevestigingen" },
          { key: "radiograaf", label: "Radiograaf" }
        ]
      }
    ]
  },
  {
    type: "stellingmateriaal",
    title: "Stellingmateriaal",
    machineLabel: "Stelling",
    machineFields: withHourReading("stellingmateriaal", [
      ...commonCustomerFields,
      { key: "brand", label: "Merk" },
      { key: "build_year", label: "Bouwjaar", type: "number" },
      { key: "dossier_number", label: "Dossiernummer" },
      { key: "zone", label: "Gebied" },
      { key: "inspection_date", label: "Keuringsdatum", type: "date" },
      { key: "sticker_number", label: "Stickernummer" },
      { key: "racking_type", label: "Soort stelling" }
    ]),
    checklistOptions: ["goed", "matig", "slecht", "nvt"],
    conclusionLabels: ["Goedgekeurd", "Afgekeurd", "In behandeling"],
    sections: [
      {
        key: "gebouwvloer",
        title: "Gebouwvloer",
        items: [
          { key: "scheuren", label: "Scheuren" },
          { key: "verzakkingen", label: "Verzakkingen" }
        ]
      },
      {
        key: "beveiliging",
        title: "Beveiliging",
        items: [
          { key: "doorval_beveiliging", label: "Doorval-beveiliging" },
          { key: "diepteliggers", label: "Diepteliggers bij pallets met afwijkende maten en kwaliteiten" }
        ]
      },
      {
        key: "aanrijbeschermers",
        title: "Aanrijbeschermers",
        items: [
          { key: "aanwezigheid_1", label: "Aanwezigheid (1)" },
          { key: "aanwezigheid_2", label: "Aanwezigheid (2)" }
        ]
      },
      {
        key: "beschadigingen",
        title: "Beschadigingen",
        items: [
          { key: "corrosie", label: "Corrosie" },
          { key: "aanrij_beschadigingen", label: "Aanrij-beschadigingen" },
          { key: "vervormingen", label: "Vervormingen" },
          { key: "boren_lassen", label: "Bewerkingen als boren, lassen e.d." }
        ]
      },
      {
        key: "gebruik",
        title: "Gebruik van de stelling",
        items: [
          { key: "max_doorbuiging", label: "Max doorbuigingen van 1/200 x L" },
          { key: "conform_belastingen", label: "Conform opgegeven belastingen" },
          { key: "actuele_draagvermogenborden", label: "Actuele draagvermogenborden" }
        ]
      },
      {
        key: "montage",
        title: "Montage",
        items: [
          { key: "inhaken_liggers", label: "Inhaken liggers" },
          { key: "aanwezigheid_borging", label: "Aanwezigheid borging" },
          { key: "loodrechte_stand", label: "Loodrechte stand stellingen" },
          { key: "aanwezigheid_schoorverbanden", label: "Aanwezigheid schoorverbanden" },
          { key: "wijzigingen_vakhoogtes", label: "Wijzigingen vakhoogtes en liggerniveaus" },
          { key: "juiste_montage_koppelstukken", label: "Juiste montage koppelstukken" },
          { key: "ontbrekende_delen", label: "Ontbrekende delen t.o.v. oorspronkelijke configuratie" },
          { key: "verschuivingen", label: "Verschuivingen" },
          { key: "aanwezigheid_verankering", label: "Aanwezigheid verankering" },
          { key: "wijziging_rijlengte", label: "Wijziging rijlengte" },
          { key: "wijzigingen_aantal_etages", label: "Wijzigingen aantal etages" },
          { key: "vulplaten_staanders", label: "Vulplaten staanders" }
        ]
      },
      {
        key: "stellingvloer_entresol",
        title: "Stellingvloer / entresol",
        items: [
          { key: "gebruik_belasting", label: "Gebruik conform opgegeven belasting" },
          { key: "conditie_staalconstructie", label: "Conditie staalconstructie" },
          { key: "conditie_railing", label: "Conditie railing" },
          { key: "conditie_dekvloeren", label: "Conditie dekvloeren" },
          { key: "conditie_trappen", label: "Conditie trappen" },
          { key: "conditie_palletopzetplaatsen", label: "Conditie palletopzetplaatsen" }
        ]
      },
      {
        key: "verrijdbare_stellingen",
        title: "Verrijdbare stellingen",
        items: [
          { key: "beveiligingen", label: "Beveiligingen" },
          { key: "railconditie", label: "Railconditie" },
          { key: "onderwagen_aandrijving", label: "Onderwagen en aandrijving" },
          { key: "besturing", label: "Besturing" }
        ]
      }
    ]
  },
  {
    type: "palletwagen_stapelaar",
    title: "Palletwagen / heffer / stapelaar",
    machineLabel: "Machine",
    machineFields: withHourReading("palletwagen_stapelaar", [
      ...commonCustomerFields,
      { key: "inspector", label: "Keurmeester" },
      { key: "brand", label: "Merk" },
      { key: "build_year", label: "Bouwjaar", type: "number" },
      { key: "model", label: "Type" },
      { key: "internal_number", label: "Intern nummer" },
      { key: "serial_number", label: "Serienummer" },
      { key: "inspection_date", label: "Keuringsdatum", type: "date" },
      { key: "sticker_number", label: "Stickernummer" }
    ]),
    checklistOptions: ["goed", "slecht", "nvt"],
    conclusionLabels: ["Goedgekeurd", "Afgekeurd", "In behandeling"],
    sections: [
      {
        key: "chassis_constructie",
        title: "1. Chassis en constructiedelen",
        items: [
          { key: "bevestigingen", label: "Bevestigingen" },
          { key: "beplating_afscherming", label: "Beplating, afscherming, beschermroosters en ruiten" },
          { key: "beschermkooi", label: "Beschermkooi / bestuurdersbescherming" },
          { key: "lasverbindingen", label: "Lasverbindingen" },
          { key: "zwenkwielen_steunblokken", label: "Zwenkwielen / steunblokken" },
          { key: "totaal", label: "Totaal: voldoende / onvoldoende / n.v.t." }
        ]
      },
      {
        key: "rijwerk",
        title: "2. Rijwerk",
        items: [
          { key: "ophanging", label: "Ophanging" },
          { key: "velgen", label: "Velgen" },
          { key: "bandenspanning_slijtage", label: "Bandenspanning en slijtage" },
          { key: "wielbouten_moeren_assen", label: "Wielbouten, moeren en assen" },
          { key: "lekkages_remsysteem", label: "Lekkages (remsysteem)" },
          { key: "remvoering", label: "Remvoering, trommels en schijven" },
          { key: "ankerplaten_remklauwen", label: "Ankerplaten / remklauwen" },
          { key: "werking_parkeerrem", label: "Werking parkeerrem" },
          { key: "algehele_remwerking", label: "Algehele remwerking" }
        ]
      },
      {
        key: "besturing",
        title: "3. Besturing",
        items: [
          { key: "overbrengmechanisme", label: "Overbrengmechanisme" },
          { key: "werking_stuurbekrachtiging", label: "Werking stuurbekrachtiging" }
        ]
      },
      {
        key: "aandrijving",
        title: "4. Aandrijving",
        items: [
          { key: "motor_aandrijfunit", label: "Motor / aandrijfunit V/E" },
          { key: "motorophanging", label: "Motorophanging" },
          { key: "bedrading", label: "Bedrading" },
          { key: "werking_aandrijfmotor", label: "Werking aandrijfmotor (E/V)" },
          { key: "montage_brandstoftank_tractiebatterij", label: "Montage brandstoftank / tractiebatterij" },
          { key: "schakelapparatuur", label: "Schakelapparatuur" },
          { key: "bevestiging_transmissie", label: "Bevestiging / lekkage transmissie" }
        ]
      },
      {
        key: "hefgedeelte",
        title: "5. Hefgedeelte",
        items: [
          { key: "vervormingen", label: "Vervormingen" },
          { key: "borgingen", label: "Borgingen" },
          { key: "looprollen", label: "Looprollen" },
          { key: "functioneren_hefmast", label: "Functioneren hefmast" },
          { key: "hefmast_ophanging", label: "Hefmast ophanging" },
          { key: "meetcontrole_hefkettingen", label: "Meetcontrole hefkettingen" },
          { key: "hefmastverbindingen", label: "Hefmastverbindingen / inrichtingen" },
          { key: "lekkage_hydraulische_cilinders", label: "Lekkage hydraulische cilinders" },
          { key: "hydraulisch_oliepeil", label: "Hydraulisch oliepeil" },
          { key: "overdruk_afstelling", label: "Overdruk afstelling" },
          { key: "werking_pomp", label: "Werking pomp / pompmotor" },
          { key: "praktische_werking_hefgedeelte", label: "Praktische werking hefgedeelte" },
          { key: "hydraulische_slangen", label: "Hydraulische slangen, lekkage, verbindingen" },
          { key: "totale_werking_hefgedeelte", label: "Totale werking hefgedeelte" }
        ]
      },
      {
        key: "bedieningsplaats",
        title: "6. Bedieningsplaats",
        items: [
          { key: "beschermingen_instructies", label: "Beschermingen / instructies" },
          { key: "identificatieplaten_opschriften", label: "Identificatieplaten, opschriften, documentatie" },
          { key: "op_afstap_handgrepen", label: "Op- en afstap en handgrepen" },
          { key: "bedieningsorganen", label: "Bedieningsorganen" },
          { key: "veiligheid_signalering", label: "Veiligheid signalering" }
        ]
      },
      {
        key: "elektrische_installatie",
        title: "7. Elektrische installatie",
        items: [
          { key: "elektrische_installatie_algemeen", label: "Elektrische installatie (algemeen)" },
          { key: "veiligheidsschakelingen", label: "Veiligheidsschakelingen" },
          { key: "keursticker_tractiebatterij", label: "Keursticker van de tractiebatterij" },
          { key: "keursticker_lader", label: "Keursticker van de lader" },
          { key: "resultaat_nen3140", label: "Resultaat NEN 3140" },
          { key: "totale_werking_proefrit", label: "Totale werking / proefrit" }
        ]
      }
    ]
  },
  {
    type: "shovel",
    title: "Shovel",
    machineLabel: "Shovel",
    machineFields: withHourReading("shovel", [
      ...commonCustomerFields,
      { key: "brand", label: "Merk" },
      { key: "build_year", label: "Bouwjaar", type: "number" },
      { key: "model", label: "Type" },
      { key: "internal_number", label: "Intern nummer" },
      { key: "serial_number", label: "Serienummer" },
      { key: "inspection_date", label: "Keuringsdatum", type: "date" },
      { key: "sticker_number", label: "Stickernummer" }
    ]),
    checklistOptions: ["goed", "slecht", "nvt"],
    conclusionLabels: ["Goedgekeurd", "Afgekeurd", "In behandeling"],
    sections: [
      {
        key: "algemeen",
        title: "Algemeen",
        items: [
          { key: "documenten", label: "Documenten" },
          { key: "veiligheidslabel", label: "Veiligheids- en bedieningslabel" },
          { key: "veiligheidsvoorzieningen", label: "Veiligheidsvoorzieningen" },
          { key: "op_afstapbeveiliging", label: "Op- en afstapbeveiliging" },
          { key: "startbeveiliging", label: "Startbeveiliging" },
          { key: "knikbeveiliging", label: "Knikbeveiliging t.b.v. transport" },
          { key: "veiligheidsriem", label: "Veiligheidsriem" },
          { key: "spiegels_zonneklep", label: "Spiegels, zonneklep" },
          { key: "achteruitrij_alarm", label: "Achteruitrij-alarm" },
          { key: "blokkering_bedieningshandles", label: "Blokkering bedieningshandles" }
        ]
      },
      {
        key: "chassis",
        title: "Chassis",
        items: [
          { key: "scheuren_vervormingen", label: "Scheuren en vervormingen" },
          { key: "knikpunt", label: "Knikpunt" },
          { key: "banden_wielen", label: "Banden / wielen" },
          { key: "trekhaak", label: "Trekhaak" },
          { key: "asophanging", label: "Asophanging" }
        ]
      },
      {
        key: "remmen_stuursysteem",
        title: "Remmen en stuursysteem",
        items: [
          { key: "werking", label: "Werking" },
          { key: "slijtage", label: "Slijtage" },
          { key: "werking_vulling_accumulator", label: "Werking / vulling accumulator" },
          { key: "noodstuursysteem", label: "Noodstuursysteem" },
          { key: "parkeerrem", label: "Parkeerrem" },
          { key: "overmatige_speling", label: "Overmatige speling" },
          { key: "luchtdruksysteem", label: "Luchtdruksysteem" },
          { key: "hydraulisch_oliepeil", label: "Hydraulisch oliepeil" }
        ]
      },
      {
        key: "hydraulisch_systeem",
        title: "Hydraulisch systeem",
        items: [
          { key: "hydraulisch_werking", label: "Werking" },
          { key: "hydraulische_slangen", label: "Slangen / verbindingen / bevestigingen" },
          { key: "overdrukafstelling", label: "Overdrukafstelling" }
        ]
      },
      {
        key: "laadframe",
        title: "Laadframe",
        items: [
          { key: "scharnierpennen", label: "Scharnierpennen" },
          { key: "bak_snelwisselsysteem", label: "Bak- en snelwisselsysteem" }
        ]
      },
      {
        key: "motor",
        title: "Motor",
        items: [
          { key: "motorophanging", label: "Motorophanging" },
          { key: "uitlaat", label: "Uitlaat" },
          { key: "brandstofsysteem", label: "Brandstofsysteem" },
          { key: "kabels", label: "Kabels" },
          { key: "v_snaren", label: "V-snaren" },
          { key: "afdichtingen", label: "Afdichtingen" }
        ]
      },
      {
        key: "cabine",
        title: "Cabine",
        items: [
          { key: "afdichting_cabine", label: "Afdichting van de cabine" },
          { key: "overdruk_cabine", label: "Overdruk in de cabine" },
          { key: "overdruksignalering", label: "Overdruksignalering" },
          { key: "werking_filters", label: "Werking van filters" },
          { key: "stickers", label: "Stickers" },
          { key: "ruitenwissers_sproeiers", label: "Ruitenwissers / sproeiers" },
          { key: "bedieningshandles", label: "Bedieningshandles" },
          { key: "losliggende_delen", label: "Losliggende delen" },
          { key: "slangen", label: "Slangen" }
        ]
      },
      {
        key: "overige",
        title: "Overige",
        items: [{ key: "electrisch_systeem", label: "Electrisch systeem" }]
      }
    ]
  },
  {
    type: "hoogwerker",
    title: "Hoogwerker",
    machineLabel: "Hoogwerker",
    machineFields: withHourReading("hoogwerker", [
      ...commonCustomerFields,
      { key: "brand", label: "Merk" },
      { key: "build_year", label: "Bouwjaar", type: "number" },
      { key: "model", label: "Type" },
      { key: "internal_number", label: "Intern nummer" },
      { key: "serial_number", label: "Serienummer" },
      { key: "inspection_date", label: "Keuringsdatum", type: "date" },
      { key: "sticker_number", label: "Stickernummer" },
      { key: "undercarriage", label: "Onderwagen" },
      { key: "setup", label: "Opstelling" },
      { key: "platform_type", label: "Type hoogwerker" },
      { key: "drive_type", label: "Aandrijving" },
      { key: "max_payload", label: "Werkbak max. werklast" },
      { key: "max_outreach", label: "Werkbak max. vlucht" },
      { key: "max_height", label: "Werkbak max. vloerhoogte" },
      { key: "max_persons", label: "Aantal personen", type: "number" }
    ]),
    checklistOptions: ["goed", "slecht", "nvt"],
    conclusionLabels: ["Goedgekeurd", "Afgekeurd", "In behandeling"],
    sections: [
      {
        key: "algemeen",
        title: "1. Algemeen",
        items: [
          { key: "hoogwerkerboek", label: "Hoogwerkerboek" },
          { key: "werklast_vlucht_grafiek", label: "Werklast / vlucht-grafiek / -label" },
          { key: "ce_conformiteit", label: "CE conformiteitsverklaring" },
          { key: "bedieningsvoorschrift", label: "Bedieningsvoorschrift" },
          { key: "montagevoorschrift", label: "Montagevoorschrift" },
          { key: "onderhoudsvoorschrift", label: "Onderhoudsvoorschrift" },
          { key: "elektrisch_schema", label: "Elektrisch schema" }
        ]
      },
      {
        key: "bedieningsplaats",
        title: "2. Bedieningsplaats boven / onder",
        items: [
          { key: "bedieningshendels", label: "Bedieningshendels / nulstandvergrendeling" },
          { key: "instrumenten", label: "Instrumenten" },
          { key: "aanduidingen", label: "Aanduidingen" },
          { key: "aanduidingen_werklast", label: "Aanduidingen werklast" },
          { key: "tabellen_werklast", label: "Tabellen werklast" },
          { key: "contactslot_noodstop", label: "Contactslot / noodstop" },
          { key: "beweging_niet_meer_mogelijk", label: "Beweging niet meer mogelijk" },
          { key: "controle_waterpas", label: "Controle horizontaal waterpas" },
          { key: "veiligheid_machinist", label: "Veiligheid machinist" },
          { key: "noodbediening", label: "Noodbediening" }
        ]
      },
      {
        key: "toegangen",
        title: "3. Toegangen",
        items: [
          { key: "opstappen_ladders", label: "Opstappen ladders" },
          { key: "bordessen_loopvlakken", label: "Bordessen loopvlakken" },
          { key: "handgrepen", label: "Handgrepen" },
          { key: "antislip", label: "Antislip" }
        ]
      },
      {
        key: "elektrische_installatie",
        title: "4. Elektrische installatie",
        items: [
          { key: "elektrische_bedrading", label: "Elektrische bedrading" },
          { key: "hoofdschakelaar", label: "Hoofdschakelaar" },
          { key: "sleepringinrichting", label: "Sleepringinrichting" },
          { key: "schakelkasten", label: "Schakelkasten" },
          { key: "apparatuur", label: "Apparatuur" }
        ]
      },
      {
        key: "hydraulische_installatie",
        title: "5. Hydraulische installatie",
        items: [
          { key: "motoren", label: "Motoren" },
          { key: "pompen", label: "Pompen" },
          { key: "ventielen", label: "Ventielen" },
          { key: "slangbreukventielen", label: "Slangbreukventielen" },
          { key: "stabiliteit_1_uur", label: "Stabiliteit 1 uur gegarandeerd" },
          { key: "werkbak_verplaatsing", label: "Werkbak verplaatsing max 0.1 mtr in 10 min." }
        ]
      },
      {
        key: "assen",
        title: "6. Voor / achterassen",
        items: [
          { key: "ophanging_vering_vooras", label: "Ophanging / vering vooras" },
          { key: "ophanging_vering_achteras", label: "Ophanging / vering achteras" },
          { key: "wielbouten_moeren", label: "Wielbouten moeren" },
          { key: "bandengesteldheid", label: "Bandengesteldheid" },
          { key: "blokkering_pendelas", label: "Blokkering pendelas" }
        ]
      },
      {
        key: "stuurinrichting",
        title: "7. Stuurinrichting",
        items: [
          { key: "stuurspeling", label: "Stuurspeling" },
          { key: "stuurassen", label: "Stuurassen" }
        ]
      },
      {
        key: "remmen",
        title: "8. Remmen t.b.v. rijden",
        items: [
          { key: "parkeerrem", label: "Parkeerrem" },
          { key: "bedrijfsrem", label: "Bedrijfsrem" },
          { key: "automatische_rem", label: "Automatische rem" },
          { key: "remcilinders", label: "Remcilinders" },
          { key: "leidingen_koppelingen", label: "Leidingen koppelingen" },
          { key: "slangen", label: "Slangen" }
        ]
      },
      {
        key: "zwenkrichting",
        title: "9. Zwenkrichting",
        items: [
          { key: "draaikrans", label: "Draaikrans" },
          { key: "bevestiging", label: "Bevestiging" },
          { key: "bonkelaar", label: "Bonkelaar" },
          { key: "aandrijving_lagering", label: "Aandrijving / lagering" },
          { key: "koppeling", label: "Koppeling" },
          { key: "rem", label: "Rem" },
          { key: "pal", label: "Pal" }
        ]
      },
      {
        key: "telescoop_knikgiek",
        title: "10. Telescoop / knikgiek",
        items: [
          { key: "telescoop_schaartoren", label: "Telescoop / schaartoren" },
          { key: "constructie_lassen", label: "Constructie / lassen" },
          { key: "bevestiging_frame", label: "Bevestiging aan frame" },
          { key: "bout_penverbindingen", label: "Bout / penverbindingen" },
          { key: "telescopeerkabel_ketting", label: "Telescopeerkabel / ketting" },
          { key: "bevestiging_borging", label: "Bevestiging / borging" },
          { key: "vanginrichting", label: "Vanginrichting" },
          { key: "paralelgeleiding", label: "Paralelgeleiding" },
          { key: "elektrische_kabels", label: "Elektrische kabels" },
          { key: "top_knik_hefcilinders", label: "Top knik hefcilinders" },
          { key: "veiligheidskleppen", label: "Veiligheidskleppen" },
          { key: "telescoopcilinders", label: "Telescoopcilinders" },
          { key: "geleiding_telescopeergiek", label: "Geleiding telescopeergiek" },
          { key: "parallel_geleidingscilinder", label: "Parallel geleidingscilinder" },
          { key: "slangen_leidingen_koppelingen", label: "Slangen / leidingen / koppelingen" },
          { key: "beveiliging_schaar", label: "Beveiliging schaar 1.5 mtr hoog" }
        ]
      },
      {
        key: "constructie_onderwagen",
        title: "11. Constructie onderwagen",
        items: [
          { key: "constructie_onderwagen_lassen", label: "Constructie / lassen" },
          { key: "constructie_onderwagen_bout", label: "Bout / penverbindingen" }
        ]
      },
      {
        key: "constructie_bovenwagen",
        title: "12. Constructie bovenwagen",
        items: [
          { key: "constructie_bovenwagen_lassen", label: "Constructie / lassen" },
          { key: "constructie_bovenwagen_bout", label: "Bout / penverbindingen" }
        ]
      },
      {
        key: "hoogwerkerbak",
        title: "13. Hoogwerkerbak",
        items: [
          { key: "bak_constructie_lassen", label: "Constructie / lassen" },
          { key: "bak_bevestiging", label: "Bevestiging" },
          { key: "bak_bout_penverbindingen", label: "Bout / penverbindingen" },
          { key: "afsluiting_deur", label: "Afsluiting deur" },
          { key: "zwenkrichting_bak", label: "Zwenkrichting bak" },
          { key: "bak_borging", label: "Borging" },
          { key: "horizontaal_stelling", label: "Horizontaal stelling" },
          { key: "bak_veiligheidsgordel", label: "Veiligheidsgordel" }
        ]
      },
      {
        key: "uithouders_stempels",
        title: "14. Uithouders stempels",
        items: [
          { key: "uithouders", label: "Uithouders" },
          { key: "uithouders_borging", label: "Borging" },
          { key: "cilinders", label: "Cilinders" },
          { key: "stempelcilinders_spindels", label: "Stempelcilinders / spindels" },
          { key: "leidingbreukventielen", label: "Leidingbreukventielen" },
          { key: "stempelvoeten", label: "Stempelvoeten" },
          { key: "borgingen", label: "Borgingen" }
        ]
      },
      {
        key: "electromotoren",
        title: "15. Electromotoren",
        items: [
          { key: "electromotoren_bevestiging", label: "Bevestiging" },
          { key: "sleepringen", label: "Sleepringen" },
          { key: "elektrische_aansluitingen", label: "Elektrische aansluitingen" },
          { key: "koolborstels", label: "Koolborstels" },
          { key: "aarding", label: "Aarding" }
        ]
      },
      {
        key: "automatische_begrenzers",
        title: "16. Automatische begrenzers",
        items: [
          { key: "rijwerk", label: "Rijwerk" },
          { key: "optoppen_hoogste_stand", label: "Optoppen / hoogste stand" },
          { key: "aftoppen_laagste_stand", label: "Aftoppen / laagste stand" },
          { key: "inknikken", label: "Inknikken / intelescoperen" },
          { key: "uitknikken", label: "Uitknikken / uittelescoperen" },
          { key: "zwenkhoekbegrenzer", label: "Zwenkhoekbegrenzer" },
          { key: "lastbegrenzer", label: "Lastbegrenzer" },
          { key: "lastmomentbegrenzer", label: "Lastmomentbegrenzer" },
          { key: "vluchtbegrenzer", label: "Vluchtbegrenzer" },
          { key: "contraballasbegrenzer", label: "Contraballasbegrenzer" },
          { key: "rijsnelheidbegrenzer", label: "Rijsnelheidbegrenzer" },
          { key: "scheefstand_signaal", label: "Uitschakeling heffen bij scheefstand > 3 graden of signaal" }
        ]
      },
      {
        key: "diversen",
        title: "17. Diversen",
        items: [
          { key: "bevestiging_ballast", label: "Bevestiging ballast" },
          { key: "massa_ballast", label: "Massa ballast i.o.m. hoogwerkerboek" },
          { key: "verfwerk", label: "Verfwerk" },
          { key: "waarschuwingskleuren", label: "Waarschuwingskleuren" },
          { key: "identificatie", label: "Identificatie" },
          { key: "bandenspanning", label: "Bandenspanning" }
        ]
      },
      {
        key: "beproeving",
        title: "18. Beproeving",
        items: [
          { key: "op_stempels", label: "Op stempels" },
          { key: "stationair", label: "Stationair" },
          { key: "mobiel", label: "Mobiel" }
        ]
      }
    ]
  },
  {
    type: "batterij_lader",
    title: "Batterij en laders",
    machineLabel: "Voertuig / batterij / lader",
    machineFields: withHourReading("batterij_lader", [
      ...commonCustomerFields,
      { key: "vehicle_brand", label: "Merk voertuig" },
      { key: "vehicle_type", label: "Type voertuig" },
      { key: "vehicle_build_year", label: "Bouwjaar voertuig", type: "number" },
      { key: "vehicle_internal_number", label: "Intern nummer voertuig" },
      { key: "vehicle_serial_number", label: "Serienummer voertuig" },
      { key: "battery_type", label: "Batterijtype" },
      { key: "battery_brand", label: "Fabricaat batterij" },
      { key: "battery_serial_number", label: "Serienummer batterij" },
      { key: "battery_internal_number", label: "Intern nummer batterij" },
      { key: "drawing_number", label: "Tekening nummer" },
      { key: "battery_sticker_number", label: "Stickernummer batterij" },
      { key: "charger_type", label: "Ladertype" },
      { key: "charger_brand", label: "Fabricaat lader" },
      { key: "charger_serial_number", label: "Serienummer lader" },
      { key: "charger_internal_number", label: "Intern nummer lader" },
      { key: "charger_voltage", label: "Netspanning" },
      { key: "charger_sticker_number", label: "Stickernummer lader" },
      { key: "double_insulated", label: "Dubbel geisoleerd" },
      { key: "inspection_date", label: "Keuringsdatum", type: "date" }
    ]),
    checklistOptions: ["goed", "slecht", "nvt"],
    conclusionLabels: [
      "Batterij goedgekeurd",
      "Batterij afgekeurd",
      "Lader goedgekeurd",
      "Lader afgekeurd",
      "In behandeling"
    ],
    sections: [
      {
        key: "container",
        title: "1. Container",
        items: [
          { key: "staat_container", label: "Staat container" },
          { key: "hijsogen", label: "Hijsogen" },
          { key: "identificatieplaatje", label: "Identificatieplaatje" }
        ]
      },
      {
        key: "tractiebatterijen",
        title: "2. Tractiebatterijen",
        items: [
          { key: "staat_batterij", label: "Staat batterij" },
          { key: "eindkabels", label: "Eindkabels" },
          { key: "celverbindingen", label: "Celverbindingen" },
          { key: "stekkers", label: "Stekkers" },
          { key: "poolbouten", label: "Poolbouten" },
          { key: "vuldoppen", label: "Vuldoppen" },
          { key: "celdeksels", label: "Celdeksels" }
        ]
      },
      {
        key: "lader",
        title: "3. Lader",
        items: [
          { key: "primaire_kabel", label: "Primaire kabel" },
          { key: "primaire_stekker", label: "Primaire stekker" },
          { key: "primaire_kabel_trekontlasting", label: "Primaire kabel trekontlasting" },
          { key: "secundaire_kabel", label: "Secundaire kabel (laadkabel)" },
          { key: "secundaire_kabel_stekker", label: "Secundaire kabel stekker" },
          { key: "secundaire_kabel_trekontlasting", label: "Secundaire kabel trekontlasting" },
          { key: "secundaire_kabel_stopknop", label: "Secundaire kabel stopknop / aan-uit schakelaar" },
          { key: "veiligheid_indicatielampjes", label: "Veiligheid indicatielampjes" },
          { key: "veiligheid_opschriften", label: "Veiligheid opschriften" },
          { key: "veiligheid_aarde", label: "Veiligheid aarde" },
          { key: "veiligheid_behuizing_lader", label: "Veiligheid behuizing lader" },
          { key: "veiligheid_opstelling_kast", label: "Veiligheid opstelling van de kast" },
          { key: "bedieningsvoorschriften", label: "Bedieningsvoorschriften" }
        ]
      }
    ]
  },
  {
    type: "graafmachine",
    title: "Graafmachine",
    machineLabel: "Graafmachine",
    machineFields: withHourReading("graafmachine", [
      ...commonCustomerFields,
      { key: "brand", label: "Merk" },
      { key: "build_year", label: "Bouwjaar", type: "number" },
      { key: "model", label: "Type" },
      { key: "internal_number", label: "Intern nummer" },
      { key: "serial_number", label: "Serienummer" },
      { key: "inspection_date", label: "Keuringsdatum", type: "date" },
      { key: "sticker_number", label: "Stickernummer" }
    ]),
    checklistOptions: ["goed", "slecht", "nvt"],
    conclusionLabels: ["Goedgekeurd", "Afgekeurd", "In behandeling"],
    sections: [
      {
        key: "algemeen",
        title: "1. Algemeen",
        items: [
          { key: "documenten", label: "Documenten" },
          { key: "veiligheidslabel", label: "Veiligheids- en bedieningslabel" },
          { key: "veiligheidshandel_servo", label: "Veiligheidshandel in servo" },
          { key: "op_afstapbeveiligingen", label: "Op- en afstapbeveiligingen" },
          { key: "startsper_rijstand", label: "Startsper in rijstand" },
          { key: "spiegels_zonneklep", label: "Spiegels, zonneklep" },
          { key: "achteruitrij_alarm", label: "Achteruitrij-alarm" },
          { key: "vergrendelingen", label: "Vergrendelingen" }
        ]
      },
      {
        key: "onderwagen",
        title: "Onderwagen",
        items: [
          { key: "banden_wielen", label: "Banden / wielen" },
          { key: "tussenringen", label: "Tussenringen" },
          { key: "stabilisators", label: "Stabilisators" },
          { key: "schuifblad", label: "Schuifblad" },
          { key: "aandrijfunit", label: "Aandrijfunit" },
          { key: "stuurcilinder", label: "Stuurcilinder" },
          { key: "trekhaak", label: "Trekhaak" },
          { key: "draaikrans", label: "Draaikrans" },
          { key: "rupsplaten", label: "Rupsplaten" },
          { key: "sprocket", label: "Sprocket" },
          { key: "spancilinder", label: "Spancilinder" }
        ]
      },
      {
        key: "bovenwagen",
        title: "Bovenwagen",
        items: [
          { key: "plaatwerk", label: "Plaatwerk" },
          { key: "frame", label: "Frame" },
          { key: "centrale_doorvoer", label: "Centrale doorvoer" },
          { key: "contragewicht", label: "Contragewicht" },
          { key: "sluitingen", label: "Sluitingen" },
          { key: "brandstofvoorziening", label: "Brandstofvoorziening" }
        ]
      },
      {
        key: "hydraulisch_systeem",
        title: "Hydraulisch systeem",
        items: [
          { key: "hydrauliek_werking", label: "Werking" },
          { key: "hydrauliek_slangen_verbindingen", label: "Slangen / verbindingen / bevestigingen" },
          { key: "overdrukafstelling", label: "Overdrukafstelling" },
          { key: "hydraulisch_oliepeil", label: "Hydraulisch oliepeil" },
          { key: "lekkage_sl_cil", label: "Lekkage slangen / leidingen / cilinders" }
        ]
      },
      {
        key: "gieken",
        title: "Gieken",
        items: [
          { key: "ophanging", label: "Ophanging" },
          { key: "leidingwerk", label: "Leidingwerk" },
          { key: "giek_plaatwerk", label: "Plaatwerk" },
          { key: "opschriften", label: "Opschriften" },
          { key: "borging_pennen", label: "Borging pennen" },
          { key: "snelwisselsysteem", label: "Snelwisselsysteem" }
        ]
      },
      {
        key: "motor",
        title: "Motor",
        items: [
          { key: "motorophanging", label: "Motorophanging" },
          { key: "uitlaat", label: "Uitlaat" },
          { key: "brandstofsysteem", label: "Brandstofsysteem" },
          { key: "kabels", label: "Kabels" },
          { key: "v_snaren", label: "V-snaren" },
          { key: "afdichtingen", label: "Afdichtingen" }
        ]
      },
      {
        key: "cabine",
        title: "Cabine",
        items: [
          { key: "afdichting_cabine", label: "Afdichting van de cabine" },
          { key: "overdruk_cabine", label: "Overdruk in de cabine" },
          { key: "overdruksignalering", label: "Overdruksignalering" },
          { key: "werking_filters", label: "Werking van filters" },
          { key: "stickers", label: "Stickers" },
          { key: "ruitenwissers_sproeiers", label: "Ruitenwissers / sproeiers" },
          { key: "bedieningshandles", label: "Bedieningshandles" },
          { key: "losliggende_delen", label: "Losliggende delen" },
          { key: "slangen", label: "Slangen" }
        ]
      },
      {
        key: "overige",
        title: "Overige",
        items: [
          { key: "electrisch_systeem", label: "Electrisch systeem" },
          { key: "remmen", label: "Remmen" },
          { key: "luchtdruksysteem", label: "Luchtdruksysteem" }
        ]
      }
    ]
  },
  {
    type: "heftruck_reachtruck",
    title: "Heftruck / reachtruck",
    machineLabel: "Machine",
    machineFields: withHourReading("heftruck_reachtruck", [
      ...commonCustomerFields,
      { key: "brand", label: "Merk" },
      { key: "model", label: "Type" },
      { key: "mast_details", label: "Mastgegevens" },
      { key: "build_year", label: "Bouwjaar", type: "number" },
      { key: "internal_number", label: "Intern nummer" },
      { key: "serial_number", label: "Serienummer" },
      { key: "inspection_date", label: "Keuringsdatum", type: "date" },
      { key: "sticker_number", label: "Stickernummer" }
    ]),
    checklistOptions: ["goed", "slecht", "nvt"],
    conclusionLabels: ["Goedgekeurd", "Afgekeurd", "In behandeling"],
    sections: [
      {
        key: "chassis_constructie",
        title: "1. Chassis en constructiedelen",
        items: [
          { key: "bevestigingen", label: "Bevestigingen" },
          { key: "aanhangkoppeling", label: "Aanhangkoppeling" },
          { key: "beschermroosters", label: "Beschermroosters" },
          { key: "beschermkap", label: "Beschermkap" },
          { key: "beplating_afscherming", label: "Beplating en afscherming" },
          { key: "lasverbindingen", label: "Lasverbindingen" },
          { key: "totaal_constructie", label: "Totaal: voldoende / onvoldoende / n.v.t." }
        ]
      },
      {
        key: "rijwerk",
        title: "2. Rijwerk",
        items: [
          { key: "velgen", label: "Velgen" },
          { key: "bandenspanning_slijtage", label: "Bandenspanning en slijtage" },
          { key: "wielboutmoeren_assen", label: "Wielboutmoeren en assen" },
          { key: "lekkage", label: "Lekkage" },
          { key: "werking_parkeerrem", label: "Werking parkeerrem" },
          { key: "remvloeistof", label: "Remvloeistof" },
          { key: "remvoering_trommels_schijven", label: "Remvoering, trommels, schijven" },
          { key: "ankerplaten", label: "Ankerplaten" },
          { key: "algehele_remwerking", label: "Algehele remwerking" }
        ]
      },
      {
        key: "besturing",
        title: "3. Besturing",
        items: [
          { key: "stuurwiel", label: "Stuurwiel" },
          { key: "stuurboom_disselboom", label: "Stuurboom / disselboom" },
          { key: "lekkage_stuursysteem", label: "Lekkage stuursysteem" },
          { key: "stuuras", label: "Stuuras" },
          { key: "stuurkogels", label: "Stuurkogels" },
          { key: "fusee_pennen", label: "Fusee pennen" },
          { key: "stuurketting", label: "Stuurketting" },
          { key: "overbrengingsmechanisme", label: "Overbrengingsmechanisme" },
          { key: "werking_stuurbekrachtiging", label: "Werking stuurbekrachtiging" }
        ]
      },
      {
        key: "aandrijving",
        title: "4. Aandrijving",
        items: [
          { key: "aandrijfunit", label: "Aandrijfunit V/E" },
          { key: "motorophanging", label: "Motorophanging" },
          { key: "bedrading", label: "Bedrading" },
          { key: "schakelapparatuur", label: "Schakelapparatuur" },
          { key: "werking_aandrijfmotor", label: "Werking aandrijfmotor E/V" },
          { key: "uitlaatgassysteem", label: "Uitlaatgassysteem" },
          { key: "montage_brandstoftank_tractiebatterij", label: "Montage brandstoftank / tractiebatterij" },
          { key: "bevestiging_transmissie", label: "Bevestiging / lekkage transmissie" }
        ]
      },
      {
        key: "hefgedeelte",
        title: "5. Hefgedeelte",
        items: [
          { key: "vervormingen", label: "Vervormingen" },
          { key: "borgingen", label: "Borgingen" },
          { key: "lastbeschermrek", label: "Lastbeschermrek" },
          { key: "vorkophanging", label: "Vorkophanging" },
          { key: "meetcontrole_vorken", label: "Meetcontrole vorken" },
          { key: "meetcontrole_hefkettingen", label: "Meetcontrole hefkettingen" },
          { key: "kettingrollen", label: "Kettingrollen" },
          { key: "looprollen", label: "Looprollen" },
          { key: "voorzetstukken", label: "Voorzetstukken" },
          { key: "functionering_hefmast", label: "Functionering hefmast" },
          { key: "hefmastophanging", label: "Hefmastophanging" },
          { key: "hefmastverbindingen", label: "Hefmastverbindingen" },
          { key: "lekkage_cilinders", label: "Lekkage cilinders" },
          { key: "hydr_slangen_lekkage", label: "Hydraulische slangen / lekkage / verbindingen" },
          { key: "hydr_oliepeil", label: "Hydraulisch oliepeil" },
          { key: "overdrukafstelling_sperventiel", label: "Overdrukafstelling (sper)ventiel" },
          { key: "werking_pomp", label: "Werking pomp / pompmotor" },
          { key: "totale_werking_hefgedeelte", label: "Totale werking hefgedeelte" }
        ]
      },
      {
        key: "diversen",
        title: "9. Diversen",
        items: [
          { key: "beschermingen_instructies", label: "Beschermingen / instructies" },
          { key: "op_afstap_handgrepen", label: "Op / afstap / handgrepen" },
          { key: "cabine_toebehoren", label: "Cabine en toebehoren" },
          { key: "bedieningsorganen", label: "Bedieningsorganen" },
          { key: "stoelbevestiging_verstelling", label: "Stoelbevestiging en -verstelling" },
          { key: "veiligheidsgordel", label: "Veiligheidsgordel" },
          { key: "veiligheidsschakelingen", label: "Veiligheidsschakelingen" },
          { key: "elektrische_installatie", label: "Elektrische installatie" },
          { key: "totale_werking_proefrit", label: "Totale werking / proefrit" },
          { key: "identificatieplaten", label: "Identificatieplaten" },
          { key: "sticker_tractiebatterij", label: "Sticker tractiebatterij" }
        ]
      }
    ]
  }
];

export function getFormDefinition(type: FormDefinition["type"]) {
  return formDefinitions.find((definition) => definition.type === type) ?? formDefinitions[0];
}
