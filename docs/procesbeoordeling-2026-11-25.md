# Procesbeoordeling bedrijfsportaal

Datum: 25 november 2026.

Vervolg: de gekozen naam en uitgevoerde wijzigingen staan in
[FRL werksysteem](frl-werksysteem.md). Deze beoordeling beschrijft de situatie
vóór die vervolgopdracht.

## Reikwijdte

Beoordeling van navigatie, dashboard, gedeelde klant-/machinegegevens, werkbonnen,
werkplaats- en transportregels en verhuurregistratie op basis van broncode en
bestaande tests. Dit is geen volledige praktijkacceptatie, beveiligingsaudit of
controle van de actuele productiedatabase. Onderstaande grotere wijzigingen zijn
aanbevelingen en zijn nog niet geïmplementeerd.

## Naam

Voorkeur: **Heftrucks.frl Bedrijfsportaal**. Alternatieven: HF Werkportaal en
HF Bedrijfssysteem. De bestaande naam blijft staan totdat de gebruiker kiest.
Een naamswijziging moet daarna consequent worden toegepast op navigatie,
login, paginatitels en installatie-/manifestnaam. Technische tabelnamen en
historische documenten hoeven daarvoor niet te worden hernoemd.

## Gewenste hoofdlogica

Klant en machine vormen de gezamenlijke basis. Keuringen, werkbonnen, verhuur
en transport zijn afzonderlijke processen rond diezelfde machine. Een machine
mag dus zonder eerdere keuring kunnen bestaan. Een afgeronde werkbon is geen
keuringsbewijs. Afgerond werk betekent evenmin automatisch betaald of afgeleverd.

Dagelijkse route: klant/machine kiezen → opdracht vastleggen → plannen →
uitvoeren → kantoorcontrole → administratieve afhandeling → eventueel transport.
Historie moet per machine én oorspronkelijke opdrachtgever beschikbaar blijven.
Losse inkoopritten behouden hun eigen route zonder werkbon of klantbetaling.

## Bevindingen en prioriteit

| Prioriteit | Bevinding en bron | Gevolg | Aanbevolen aanpak |
| --- | --- | --- | --- |
| Hoog | Machineoverdracht, urenstand en planning worden afzonderlijk opgeslagen (`app/api/werkplaats/route.ts`). De versiecontrole beschermt alleen het planningsdocument. | Bij gelijktijdige wijzigingen kan de machine al zijn overgezet terwijl de bon nog niet is opgeslagen. De API meldt dit, maar herstel vraagt handwerk. | Verwerk overdracht, urenstand en bonwijziging in één databasetransactie met versiecontrole. Test twee gelijktijdige saves en terugdraaien bij elke fout. |
| Hoog | `createRental` leest bestaande verhuur en voegt daarna apart een verhuurrecord toe (`lib/inspection-service.ts`). De functie controleert archivering en voorraadeigenaar, maar blokkeert onderhoud niet expliciet. | De functie zelf garandeert geen bescherming tegen twee gelijktijdige boekingen; machine-inzetbaarheid is niet gekoppeld aan werkplaatswerk. Eventuele aanvullende databasebescherming moet afzonderlijk worden onderzocht. | Leg periodeconflicten atomair vast. Definieer expliciet wanneer onderhoud verhuur blokkeert; een open werkbon hoeft niet altijd een blokkade te zijn. |
| Hoog | Heropenen van een bon verwijdert kantoorvrijgave, betaalregistratiedatum en afsluitdatum (`prepareWorkshopSave`, `lib/workshop.ts`). | Technisch opnieuw werken heeft ook administratieve gevolgen. Een bestaande betaling hoort niet zonder meer te verdwijnen door heropening. | Splits technische heropening en financiële correctie. Behoud betalingshistorie; registreer reden, actor en tijd. Bepaal of vervolgwerk een nieuwe gekoppelde bon krijgt. |
| Middel | Werkplaats en transport bewaren alle bonnen in één versiegebonden JSON-document (maximaal 5.000 werkbonnen, `lib/workshop.ts`). | Ook wijzigingen aan verschillende bonnen kunnen botsen. Historie en planning groeien samen; de limiet raakt uiteindelijk ook het archief. | Migreer naar afzonderlijke werkbonnen, updates en transportbonnen, met versiecontrole per bon en een apart opvraagbaar archief. Behoud bestaande IDs en nummers. |
| Middel | Dashboard en hoofdknop Nieuwe keuring weerspiegelen de keuringsstart (`app/page.tsx`, `components/app-navigation.tsx`). `/werkplaats` en `/planning/werkplaats` renderen dezelfde pagina. | Werkplaatswerk vraagt meer zoeken; dubbele ingangen geven geen duidelijk onderscheid tussen module en planning. | Dashboard biedt nu directe ingangen naar werkplaats, transport, werkbonnen en aanvragen. Vervolg: groepeer navigatie op dagelijkse taken en geef Werkplaats een eigen overzicht of één vaste planningsingang. |
| Middel | De werkplaats-GET vult machinegegevens opnieuw vanuit het huidige machinerecord (`app/api/werkplaats/route.ts`). | Een oude bon kan andere machinegegevens tonen dan bij uitvoering. | Bewaar een vastgelegde momentopname bij afsluiten en toon actuele machinegegevens afzonderlijk. Bepaal welke correcties op historische bonnen toegestaan blijven. |
| Middel | Klant-eigenaarschap is een veld op de machine; verhuur heeft een afzonderlijke klant; verkoop wijzigt de klant op de werkbon en bewaart een bronklant. | Eigenaar, opdrachtgever, huurder en afleveradres zijn verschillende begrippen die bij uitbreiding gemakkelijk door elkaar lopen. | Maak deze rollen expliciet in schermen en gegevensmodel. Bewaar oorspronkelijke opdrachtgever en overdrachtshistorie; gebruik huidige eigenaar niet automatisch als historische factuurklant. |

## Logica die behouden moet blijven

- Eén klanten- en machinebestand voor keuringen en werkplaats.
- Monteur biedt werk aan voor controle; kantoor sluit af.
- Geselecteerde controles zijn verplicht vóór gereedmelding.
- Betaald transport en losse inkoopritten volgen verschillende vrijgaveregels.
- Annuleren bewaart werkbon, nummer, reden en historie.
- Werkelijke uren staan los van geplande tijd.
- Tablettoegang blijft beperkt; gekozen medewerkernaam is geen persoonlijke login.
- Bestaande gegevens worden niet stil samengevoegd of opnieuw genummerd.

## Uitvoering in deze opdracht

Dashboard uitgebreid met Werkplaatsplanning openen, Transportplanning openen,
Werkbonnen en Onderdelen & gereedschap. De algemene knop Planning openen heet
nu Keuringsplanning openen, zodat de bestemming duidelijk is. Geen nieuwe
databaseverzoeken of wijzigingen aan klantgegevens en procesregels.

## Vervolgvolgorde en acceptatie

1. Maak machineoverdracht en werkbonopslag atomair. Een conflict mag geen
   gedeeltelijke overdracht of urenstandwijziging achterlaten.
2. Leg heropening en financiële historie vast. Een heropende betaalde bon
   behoudt aantoonbaar de eerdere betaling en krijgt geen onbedoelde transportvrijgave.
3. Maak machine-inzetbaarheid over werkplaats en verhuur expliciet. Gelijktijdige
   verhuuraanvragen mogen niet dubbel boeken; onderhoudsblokkades moeten herkenbaar zijn.
4. Scheid opslag per bon en laad archief op aanvraag. Twee gebruikers moeten
   verschillende bonnen onafhankelijk kunnen opslaan.
5. Werk de definitieve naam en navigatie uit; controleer de dagelijkse route
   met kantoor, monteur en chauffeur.

Voor wijzigingen aan betaling, heropening en onderhoudsblokkades moet de precieze
bedrijfsregel eerst worden afgestemd. Deze beoordeling verandert die regels niet.
