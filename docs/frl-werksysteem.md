# FRL werksysteem

## Dagelijkse indeling

- **Dashboard**: directe ingangen en meldingen.
- **Planning**: Keuringsplanning, Werkplaatsplanning en Transportplanning.
- **Werk & dossiers**: Werkbonnen, Keuringen, Verhuur en Onderdelen & gereedschap.
- **Relaties & materieel**: Klanten en Machines, de gezamenlijke basisgegevens.
- **Agenda**: keuringsreminders, geplande keuringen, verhuurmomenten, eigen afspraken en de bestaande alleen-lezen cursusfeed.
- **Frellobord**: vrije taken en opvolging op het bestaande Frello-bord.

Agenda blijft het gezamenlijke kalenderoverzicht, inclusief keuringsreminders.
Keuringsplanning bevat daarnaast de gerichte planning van keuringen en keuringsroutes. Verhuur wordt
beheerd vanuit het eigen dossieroverzicht. Werkplaatsagenda en Monteursagenda
heten voortaan consequent Werkplaatsplanning. De dubbele hoofdmenu-ingang
Werkplaats is verwijderd; de oude URL blijft werken, ook voor de tablet.
Oude/nieuwe keuringsagenda verwijzen met behoud van filters naar Keuringsplanning.
Een keuring inplannen en een nieuwe keuring uitvoeren zijn afzonderlijke acties.

## Opslag en samenhang

Installeer `supabase/workshop-relational.sql` voordat deze appversie gebruikt
wordt. De migratie importeert de bestaande planning éénmalig naar
`workshop_jobs`, `workshop_transports` en `workshop_meta`. Het oude document blijft
als alleen-lezen reservekopie aanwezig. `workshop_state` levert de samengestelde
leesweergave voor agenda en tablet; bonnen worden afzonderlijk opgeslagen.
De browser heeft geen directe rechten op deze nieuwe opslag of de schrijffunctie.

Een save vergelijkt uitsluitend de gewijzigde records. De browser stuurt de
ongewijzigde basis mee voor een vergelijking met de actuele opslag. Wijzigingen
aan verschillende bonnen worden gecombineerd; concurrerende wijzigingen aan
dezelfde bon worden geweigerd. De database controleert daarna de gezamenlijke
monteursbezetting, medewerkers, transportvrijgave en machine-inzetbaarheid.
Een korte transactievergrendeling ordent de gezamenlijke planningsbeslissingen.
Er is nog een gezamenlijke leesweergave en bestaande limiet van 5.000 werkbonnen;
dit is geen onbeperkt of gepagineerd archiefsysteem.

Machineoverdracht, gewijzigde urenstand, werkbon en gekoppelde keuringsconcepten
en keuringsplanning worden in één transactie opgeslagen. Bij fouten wordt alles
teruggedraaid. Een gewijzigde machine-eigenaar of urenstand veroorzaakt een
expliciet conflict. Overdracht wist oude locatiegegevens. Afgeronde keuringen
blijven ongewijzigd. Documentverwijzingen op keuringsconcepten worden ongeldig
gemaakt, zodat geen oud bestand met de vorige klant wordt verzonden; bij het
opnieuw opslaan van het concept worden actuele documenten gegenereerd.

## Heropening en betaling

Alleen kantoor heropent afgesloten bonnen. Factuurreferentie, verzenddatum en
betaalregistratiedatum blijven behouden. Kantoorvrijgave en technische
afsluitdatum vervallen, zodat opnieuw controle nodig is. Een nog niet afgeleverde
gekoppelde rit gaat terug naar de ongeplande bak en verliest eventuele oude
vrijgave. Na aflevering wordt vervolgwerk op een nieuwe werkbon geregistreerd.
Heropening en financiële wijzigingen krijgen servermatig een gebeurtenis in
`officeHistory` met actor, tijd en factuurgegevens. Historie uit de browser wordt
niet vertrouwd. Een financiële correctie gebeurt via de afzonderlijke kantooractie.

## Werkplaats en verhuur

Een open geplande werkbon blokkeert verhuur op de werkdag. Omgekeerd kan een bon
niet op een verhuurdag worden gepland of gestart. De verhuureinddatum blijft een
wisseldag; een verhuur van één dag bezet die dag wel. Onderhoud en archivering
blokkeren nieuwe verhuur. Lopende of toekomstige verhuur blokkeert overdracht,
archivering en het expliciet op onderhoud zetten van de machine. Verhuur is
uitsluitend voor de bestaande herkende eigen voorraadeigenaren. Deze regels
staan ook in databasetriggers zodat twee gelijktijdige verzoeken ze niet omzeilen.
De verhuurstatus van de machine wordt in dezelfde transactie bijgewerkt.

De lokale proefplanner bewaart uitsluitend browsergegevens en voert geen echte
verkooptransacties uit. De gedeelde database is leidend voor module-overstijgende
blokkades. Bestaande ongeplande bonnen blokkeren geen hele verhuurperiode.

## Controle

## Verhuur en optioneel transport (25 november 2026)

Aanvullende migratie: `supabase/rental-open-transport.sql`, na de relationele
werkplaatsmigratie. Bestaande einddatums en transportbonnen blijven behouden.
Verhuur krijgt een versienummer en twee optionele transportkeuzes: brengen en
ophalen. Deze keuzes maken elk één gekoppelde transportbon in dezelfde
chauffeursplanning; zonder keuze ontstaat geen transportbon. Een open
huurperiode heeft in de database een lege (`NULL`) einddatum. Een bekende
einddatum blijft beschikbaar en bewerkbaar. Afsluiten vereist een expliciete
werkelijke einddatum, op of na de startdatum en uiterlijk vandaag.

Vanuit zowel Verhuur als de machinekaart kan de gebruiker een klant toevoegen
aan het bestaande gezamenlijke klantenbestand en direct kiezen voor verhuur.
In Verhuur zijn periode en transport later te wijzigen. Open huurperioden
blokkeren conflicterende verhuur en werkplaatsplanning; na afsluiten wordt de
machinebeschikbaarheid in dezelfde transactie bijgewerkt.

Transportaanvragen en verhuur worden atomair opgeslagen. Transportbonnen hebben
een vaste koppeling naar de verhuur en een heen-/retourrichting. Hun planning,
chauffeur, volgorde, afdruk en aflevermelding gebruiken de bestaande planner.
Een geannuleerde aanvraag bewaart de bon als verwijderd; een gestarte of
afgeleverde rit kan niet worden uitgezet. Als ophalen door ons is aangevraagd,
moet de ophaalrit afgemeld zijn vóór afsluiten van de verhuur. Klanten die zelf
halen/brengen hebben geen transportbon nodig.

Nieuwe werkbonnen krijgen uitsluitend bij **Transport nodig** een transportbon.
Het invullen van een afleveradres alleen is geen aanvraag. Bestaande bonnen
krijgen de keuze op basis van hun huidige actieve transportbon; er worden geen
historische bonnen verwijderd. Uitzetten bewaart een ongebruikte of geplande bon
met een verwijdermarkering; opnieuw aanzetten herstelt deze in de ongeplande bak.

## Controle van deze uitbreiding

`npm test`, `node --test tests/workshop-scheduling.test.cjs`,
`npm run typecheck` en `npm run build`. De opslagtests voeren de daadwerkelijke
migratie en transacties uit in PostgreSQL via PGlite: herhaalbare import,
verouderde saves, behoud van andere bonnen, terugdraaien na machinewijziging,
verhuurconflicten in beide richtingen en afscherming van directe toegang.
De live migratie en deployment worden afzonderlijk gecontroleerd en gerapporteerd.
