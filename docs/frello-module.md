# Frellobord

Een gezamenlijk leadbord voor de bestaande accounts van Age en Renze op `/frello`, met daarnaast privéborden per ingelogd account. Het tabletaccount en andere gebruikers hebben geen toegang.

## Gebruik

- Het gezamenlijke bord begint met Nieuwe leads, Contact gelegd, Offerte verstuurd, Opvolgen, Gewonnen en Verloren.
- **＋ Nieuw bord** boven het bord (of **Bord bewerken → Nieuw bord**) biedt Gezamenlijk of Privé. Privé is standaard. De zichtbaarheid staat na aanmaken vast, zodat een privébord niet per ongeluk gedeeld kan worden.
- Open een kaart om titel, omschrijving, klant/contactgegevens, verantwoordelijke, opvolgdatum en labels bij te werken. Labels worden met komma’s gescheiden.
- Een kaart bevat een checklist, reacties en bijlagen. Reacties worden bij opslaan aan de huidige gebruiker gekoppeld. Een leeg checklistpunt wordt bij opslaan verwijderd.
- Sleep kaarten tussen kolommen of vóór een andere kaart. Op een touchscreen kan de kolom ook in de geopende kaart worden gekozen.
- Tijdens slepen kantelt de sleepweergave en markeert een open plek waar de kaart zal landen. Kaarten schuiven op rond die plek; de bovenste/onderste helft van een kaart bepaalt de invoegpositie. Na loslaten wordt de verplaatsing direct getoond en op de achtergrond opgeslagen. Bij een opslagfout of versieconflict gaat de kaart terug naar de vorige positie met een foutmelding. Ongewijzigd terugplaatsen veroorzaakt geen opslagverzoek. Verminderde beweging wordt gerespecteerd bij de animaties.
- **Bord bewerken → Bordnaam & kolommen** laat de bordnaam en kolomnamen aanpassen en een nieuwe kolom toevoegen. Bord kiezen, zoeken, filteren en het archief staan eveneens in de popup, zodat het bord direct zichtbaar is.
- Iedere kaart heeft daarnaast één instelbare status: **Nog doen** (grijs), **Bezig** (blauw), **Wachten** (oranje), **Nog afmaken** (paars) of **Klaar** (groen). Open de kaart en kies **Status**. Een kort kleurstreepje met de statusnaam blijft zichtbaar op het bord. Bestaande kaarten zonder status beginnen met Nog doen; verplaatsen verandert de status niet. Geen databasemigratie nodig.
- Kaarten kleuren automatisch op verantwoordelijke: Age lichtblauw en Renze lichtpaars. De naam blijft zichtbaar; niet-toegewezen kaarten zijn neutraal.
- Kaarten kunnen worden gearchiveerd en via Archief weer worden teruggezet. Er worden geen kaarten definitief verwijderd.
- Sla een nieuwe kaart eerst op; daarna kunnen bijlagen worden toegevoegd. Maximaal 4 MB per bestand: PDF, gangbare afbeeldingen, Office, TXT, CSV en ZIP. HTML, SVG, scripts en uitvoerbare bestanden worden geweigerd. Downloads gebruiken korte ondertekende links en worden als bestand aangeboden.

## Privacy en opslag

Voer `supabase/frello.sql` uit. De migratie maakt twee tabellen, een private storagebucket en toegangsregels aan, en initialiseert het gezamenlijke bord zonder bestaande gegevens te overschrijven. Board- en bestands-API’s gebruiken de ingelogde Supabase-client, zodat Row Level Security ook binnen de API van toepassing is. De service-role sleutel wordt hiervoor niet gebruikt.

Privéborden en hun bijlagen zijn alleen voor de eigenaar zichtbaar. Dat wordt afgedwongen via de databasepolicies, niet via een filter in de browser. Bordzichtbaarheid en eigenaarschap zijn na aanmaken niet wijzigbaar met de toegekende tabelrechten. Een restrictive storagepolicy voorkomt dat andere bestaande storagepolicies privébestanden alsnog openstellen. De authenticatieprovider/databasebeheerder behoudt zijn gebruikelijke administratieve toegang.

De twee bestaande Age-inlogadressen blijven aparte accounts. Een privébord is gekoppeld aan het account waarmee het is aangemaakt. Gezamenlijke borden zijn voor alle bestaande Age/Renze-accounts zichtbaar.

Gelijktijdig opslaan wordt met versienummers gecontroleerd. Bij een conflict blijft het open concept staan. Sluit het concept, vernieuw en voer de wijziging opnieuw uit. Open formulieren worden niet door de automatische verversing vervangen. De bordenlijst toont maximaal 100 borden, elk met maximaal 30 kolommen en 1.000 kaarten. Per kaart zijn maximaal 100 checklistpunten en 100 reacties mogelijk.

## Proefversie

Met `LOCAL_TEST_MODE=1` gebruikt `/frello` voorbeeldgegevens in browseropslag. `/frello?as=renze` simuleert Renze; zonder parameter simuleert de demo Age. Deze optie verandert in productie niets aan de ingelogde identiteit. Demobijlagen worden in browseropslag bewaard en kunnen door opslaglimieten eerder geweigerd worden. Voorbeeldgegevens gaan niet naar de echte database.

## Controle

`npx tsx --test tests/frello.test.ts` controleert verplaatsen, rangschikken, invoeggrenzen, direct tonen bij een vertraagd opslagverzoek, terugdraaien na mislukken, geldige kaartgegevens, onbevoegde privacywijzigingen, tablettoegang en uploadgrenzen. `npm run build` controleert de integratie met de app. Verplaatsen naar een gevulde kolom en opnieuw rangschikken zijn ook via echte browserdragacties getest, gevolgd door herladen om de opgeslagen volgorde te controleren.

Op 12 november 2026 is de migratie uitgevoerd in het aangesloten Supabase-project. Een transactie met de twee echte accountrollen heeft gecontroleerd dat beiden het gezamenlijke bord zien en alleen hun eigen privébord/bijlagemetadata. Een wijziging van het privébord van de ander wordt geweigerd; wijzigen van zichtbaarheid heeft geen tabelrecht. De tabletrol ziet geen bord- of bijlageregels. De tijdelijke testregels zijn met ROLLBACK verwijderd. De proefinterface is gecontroleerd op verslepen, kaartbewerking, checklist/reacties, privéborden en upload van een tekstbijlage. Er is geen proefbestand in productie opgeslagen.

Dit is een eigen kanbanmodule voor leadopvolging. Automatische acties, koppelingen met Trello, agenda-e-mails en pushmeldingen zijn niet inbegrepen.

## Hoofdnavigatie

Dashboard, Nieuwe keuring, Werkplaats en Frellobord blijven direct bereikbaar. Onder **Relaties & materieel** staan Klanten, Machines en Keuringen. Onder **Planning** staan Keuringsplanning en Verhuur. Het menu loopt zo nodig door op meerdere regels en heeft geen horizontale schuifbalk. Submenu's sluiten bij een klik buiten het menu, bij navigatie of met Escape. De werkplaatstablet houdt uitsluitend de Werkplaats-knop.

## Compacte werkplaatsweergave

Op het dashboard staat **Bestellijst** rechts naast Welkom terug. Het rode bolletje telt aanvragen met status Nieuw en verdwijnt zodra die behandeld worden; het is geen persoonlijk leesvinkje. De teller ververst elke 30 seconden, bij terugkeren naar het venster en bij wijzigingen in de proefversie. De knop blijft zonder nieuwe aanvragen bereikbaar.

De werkplaatsagenda toont één tekstregel per werkbon: tijd, machine en waar de ruimte het toelaat klant. Hover toont de volledige samenvatting; klikken opent de bestaande werkbon met alle details. Medewerkerrijen zijn compact, de +knoppen blijven beschikbaar en verslepen blijft werken. Dezelfde weergave geldt voor chauffeursplanning.

Browsercontrole: start de app met LOCAL_TEST_MODE=1 en voer scripts/workplace-ui-review.cjs uit met Playwright beschikbaar (eventueel PLAYWRIGHT_MODULE_PATH), UI_BASE_URL en indien nodig CHROME_PATH. Voorbeeldgegevens blijven lokaal in de testbrowser. Screenshots komen in test-results/workplace-ui (of UI_ARTIFACT_DIR).
## Bordvolgorde en onderdelenstatus (19 november 2026)

Bij Wissel bord staat een versleepbare lijst met afzonderlijke labels voor gezamenlijke en eigen privéborden. Pijltjes bieden dezelfde bediening zonder slepen. De bovenste rij is het standaardbord bij een nieuw bezoek. De volgorde wordt via een beveiligde PATCH op de Frello-API opgeslagen in `user_metadata.frello_board_order` van uitsluitend de ingelogde gebruiker. Voor de proefversie is er een afzonderlijke localStorage-sleutel per demo-account. Nieuwe borden worden achteraan toegevoegd; een eerder gekozen bord blijft tijdens verversen geopend.

De API leest alle toegankelijke borden gepagineerd, in plaats van de lijst tot 100 af te kappen. Onbekende of niet-toegankelijke ID's worden bij het bewaren van de volgorde geweigerd. De voorkeur sorteert alleen al toegankelijke borden en verandert nooit de zichtbaarheid, eigenaar of inhoud. Een database-migratie is niet nodig. Wissel bord ververst de lijst bij openen en heeft een eigen knop Borden vernieuwen.

De kaartstatus Onderdeel is besteld (`ordered`) is toegevoegd. Bestaande kaarten zonder status blijven Nog doen; bestaande statussen, kaartvolgorde, reacties en bijlagen blijven behouden.

Bij de alleen-lezen controle op 19 november stonden vijf borden opgeslagen. Het privébord TTD Renze was gekoppeld aan info@heftrucks.frl; het gezamenlijke bord Klant wil offerte stond eveneens opgeslagen. Een privébord is alleen zichtbaar voor het account waarmee het is gemaakt. Er zijn tijdens deze controle geen bordgegevens of privacyinstellingen gewijzigd. De databasecontrole bewijst dat deze borden bestaan; niet of er ooit andere, niet genoemde borden hebben bestaan.

Bij een nieuwe kaart wordt de opvolgdatum op de lokale datum van vandaag gezet, berekend op het moment dat de kaart wordt geopend. Morgen krijgt een nieuwe kaart dus automatisch de nieuwe datum. De gebruiker kan deze datum aanpassen of leegmaken; bestaande kaarten en hun opgeslagen opvolgdatums worden niet overschreven.

Kolommen zijn op alle borden versleepbaar via het stippelhandvat in de kolomkop. Loslaten boven een andere kolom slaat de nieuwe volgorde automatisch op. Met focus op het handvat werken ook Alt + pijl links/rechts. De volgorde hoort bij de bordinhoud en geldt op een gezamenlijk bord voor alle gebruikers. Kaarten behouden hun kolom-ID en inhoud; mislukte opslag zet de volgorde terug. De persoonlijke volgorde van de borden zelf blijft hiervan gescheiden.

Borden kunnen via Bord bewerken worden verwijderd, met een bevestiging die bij gezamenlijke borden expliciet vermeldt dat het bord voor iedereen verdwijnt. De API markeert het bord met deletedAt in de JSON-staat, gebruikt bestaande bordrechten en versiecontrole en sluit het uit van lijsten, openen en normale bewerkingen. Bijlagen van verwijderde borden of kaarten kunnen niet meer via de app worden geopend of toegevoegd. Er is geen database-migratie nodig.

Kaarten hebben naast archiveren een eigen verwijderknop. Kolommen hebben een verwijderknop in de kop en in Bordnaam & kolommen. Lege kolomnamen worden bij opslaan weggelaten; kaarten uit vervallen kolommen worden behouden in de eerste overgebleven kolom. Een bord houdt minimaal één ingevulde kolom. Met Kolom toevoegen kunnen maximaal 30 velden worden aangemaakt en ingevuld; lege velden zijn niet verplicht.
