# Werkplaatsagenda — module voor de keuringsapp

Bijgewerkt op 19 november 2026. Een eigen werkplaatsagenda op `/werkplaats`, los van de bestaande keuringsplanning. Dit pakket is een Next.js-uitbreidingsmodule voor deze app, geen WordPress-plugin.

## Bestellijst voor onderdelen, gereedschap en verbruiksmateriaal

Open **Onderdelen & gereedschap** in de werkplaatsmodule. Iedereen in de module, inclusief het gedeelde tabletaccount, kan een aanvraag indienen met eigen naam, omschrijving, hoeveelheid/eenheid, categorie, optioneel artikelnummer, gewenste datum, prioriteit, werkbon en specificaties. De gedeelde tabletnaam bewijst niet welke individuele monteur de aanvraag deed; die kiest zelf zijn naam uit de medewerkerslijst.

Age en Renze zien **Te bestellen** op hun dashboard. Via de bestellijst behandelen zij aanvragen: Nieuw, In behandeling, Besteld, Ontvangen, Afgewezen. Leverancier, bestelreferentie en terugkoppeling kunnen worden ingevuld. Monteurs kunnen de status en terugkoppeling lezen, maar niet wijzigen. Dit is een interne aanvraaglijst; er worden geen bestellingen of e-mails naar leveranciers verstuurd. Er zijn geen prijsvelden.

Voer voor de bestellijst aanvullend `supabase/workshop-orders.sql` uit. Deze voegt een afzonderlijke tabel toe, zodat aanvragen de gezamenlijke agenda niet kunnen overschrijven. De browser heeft geen directe tabelrechten. De API valideert namen en werkbonnen tegen de echte planning en staat het tabletaccount alleen GET en POST toe. PATCH is uitsluitend voor Age/Renze. Een aanvraag-ID voorkomt dubbele aanvragen bij opnieuw versturen; versiecontrole beschermt de afhandeling bij gelijktijdige wijzigingen. Maximaal de nieuwste 5.000 aanvragen worden getoond, met een melding bij het bereiken van die grens.

Bij een bestaande installatie op v1.1 hoeft alleen deze nieuwe SQL-migratie erbij. De eerdere agenda- en toegangsmigraties zijn al geïnstalleerd in het aangesloten project. De productieplanner begint zonder fictieve aanvragen. De lokale proefversie bewaart aanvragen in de browser.

## Werkplaatstablet zonder mailbox

Age en Renze voegen de namen van monteurs en chauffeurs toe via **Medewerkers** in de agenda. Deze namen zijn alleen planningstoewijzingen en krijgen geen eigen account.

Na de database-installatie kan Age of Renze via **Werkplaatstablet instellen** een gedeeld account aanmaken. Kies een wachtwoord van minimaal 12 tekens. Op de tablet log je in met gebruikersnaam **werkplaats** en dat wachtwoord. Het account heeft geen mailbox nodig; de authenticatieprovider gebruikt intern een technisch adres op het gereserveerde `.invalid`-domein. Er wordt geen e-mail verstuurd. Het tabletaccount ziet alleen de werkplaatsmodule, kan bonnen lezen en afdrukken, en kan onderdelen/gereedschap aanvragen. De agenda blijft alleen-lezen. Aanmaken/verslepen, transportwijzigingen en medewerkersbeheer blijven bij de bestaande gebruikers. Age en Renze houden hun eigen login en volledige navigatie.

Voer voor deze versie na `workshop-module.sql` ook **`supabase/workshop-tablet-access.sql`** uit. Deze migratie beperkt de database- en opslagtoegang voor het tabletaccount. Zij stopt als bestaande publieke tabellen, views of functies de afscherming kunnen omzeilen; richt die rechten dan eerst in. De accountknop weigert een account aan te maken totdat de migratie is geïnstalleerd. Er is nog geen tabletaccount aangemaakt en er is geen wachtwoord in de broncode opgeslagen.

Bij een bestaand werkplaatsaccount kan Age/Renze via dezelfde pagina expliciet **Wachtwoord vervangen** kiezen. Bewaar het gekozen wachtwoord zelf; het wordt niet teruggetoond of in het planningsdocument opgeslagen.

## Gebruik

De agenda staat rechtstreeks in de app, zonder iframe met een tweede verticale schuifbalk. De pagina zelf verzorgt het scrollen; alleen voor de brede weekindeling kan horizontaal worden geschoven. Bij een geopend venster wordt de achtergrond vastgezet. **Medewerkers** opent een compact formulier met Naam en Functie, zonder lange lijst van bestaande namen. De bestaande namen blijven in de agenda en keuzelijsten beschikbaar.

- Voeg monteurs en chauffeurs toe via **Medewerkers**. Dit zijn planningsmedewerkers; zij krijgen hiermee geen inlogaccount.
- Klik op **Werkbon** in een dagvak om direct een bon voor die monteur en datum aan te maken. De begintijd en een optionele richttijd staan op de bon; de werkelijk gewerkte uren worden apart ingevuld. Nieuwe bonnen kunnen ook ongepland blijven.
- Sleep een bon naar een andere medewerker of dag. De begintijd blijft behouden; pas die aan door de bon te openen. Overlappende opdrachten voor dezelfde medewerker worden geweigerd. Aansluitende opdrachten zijn toegestaan.
- Statussen: Nieuw, Ingepland, Mee bezig, Wachten op onderdelen, Wachten op goedkeuring, Werkbon-controle, On hold, Klaar voor transport en Afgerond. Bestaande Pauze-statussen blijven leesbaar.
- De planner selecteert per bon uit tien check-up punten. De monteur moet alle geselecteerde punten afvinken voordat hij de bon voor controle aanbiedt. Renze/Age doet daarna de laatste controle via **Controle goed · werkbon afsluiten**. De aparte transportbon kan alvast worden voorbereid en wordt planbaar na de betaalregistratie.
- Ritten zijn ook versleepbaar. Ritstatussen: Gepland, Onderweg en Afgeleverd. Bij Afgeleverd is een ontvangstnotitie verplicht.
- Print een geopende bon met **Print werkbon**. De bon bevat geen prijzen. De normale browser geeft ook de mogelijkheid om als PDF op te slaan.
- Slepen gebruikt pointerbewegingen voor muis en aanraking. De kaart volgt de aanwijzer, een gemarkeerd vak toont de bestemming en de verplaatsing verschijnt direct. Opslaan gebeurt op de achtergrond; bij een fout wordt de bon teruggezet. Escape annuleert het slepen. Datum, tijd en medewerker blijven ook in de bon aanpasbaar.

## Installatie in deze keuringsapp

1. Pak de ZIP uit en voeg de nieuwe bestanden uit `app`, `lib`, `components`, `public` en `supabase` op dezelfde paden toe aan het project. Ze gebruiken bestaande dependencies: Next.js, Zod en Supabase. Er zijn geen nieuwe npm-pakketten nodig.
2. Pas de volledige meegeleverde `navigation.patch` toe (`git apply --check navigation.patch`, daarna `git apply navigation.patch`). De patch bevat naast de menuknop ook de noodzakelijke wijzigingen aan login, layout, uitloggen en middleware voor de tabletbeperking. Bij een conflict moet de patch zorgvuldig worden samengevoegd; alleen een menuknop toevoegen is voor v1.1 onvoldoende. In de lokale projectmap zijn deze wijzigingen al aangebracht: pas de patch daar niet opnieuw toe.
3. Voer `supabase/workshop-module.sql`, daarna `supabase/workshop-tablet-access.sql` en tot slot `supabase/workshop-orders.sql` uit via de SQL-editor van de bestaande Supabase-omgeving. Opnieuw uitvoeren behoudt bestaande werkbonnen. De tweede migratie voegt uitsluitend extra toegangseisen voor het tabletaccount toe; bestaande accountrollen en appgegevens blijven behouden.
4. De bestaande `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` en `SUPABASE_SERVICE_ROLE_KEY` blijven nodig. De service key blijft uitsluitend op de server.
5. Voer `npm run build` uit en deploy de app via het bestaande proces. Open vervolgens `/werkplaats` en voeg de medewerkers toe. De gedeelde omgeving begint leeg; voorbeeldbonnen worden niet geïmporteerd.

De drie SQL-migraties zijn op 12 november 2026 uitgevoerd in het aangesloten Supabase-project. Tabelrechten en de tablet-afscherming zijn gecontroleerd. Een daadwerkelijke productie-deploy moet afzonderlijk worden geverifieerd.

## Voorbeeld bekijken

In lokale testmodus (`LOCAL_TEST_MODE=1`) toont `/werkplaats` de proefagenda met voorbeeldbonnen. `/werkplaats-preview/index.html` opent dezelfde proefagenda rechtstreeks. Proefwijzigingen blijven in de browser, worden niet naar Supabase gestuurd en worden niet gedeeld met andere apparaten. Deze v2-agenda importeert de oude proefbordgegevens niet.

## Opslag en toegang

De bestaande ingelogde gebruikers kunnen de werkplaatsplanning bewerken. Het gedeelde account met serverrol `workshop_viewer` heeft uitsluitend kijkrechten op de agenda, kan bestelaanvragen indienen en wordt via middleware, de API en databasepolicies afgeschermd van de rest van de app. De rol komt uit `app_metadata`; zelf wijzigbare `user_metadata` wordt hiervoor niet vertrouwd. Nieuwe werkbonnen worden gekoppeld aan een bestaande klant en een machine van die klant. Nieuwe klanten en machines kunnen vanuit de bon worden aangemaakt in dezelfde klanten- en machinebak als de keuringen. Bestaande tekstbonnen blijven leesbaar; bij bewerken kan de planner ze koppelen. Het tabletaccount kan geen klanten of machines aanmaken.

De module bewaart de gezamenlijke planning in `workshop_planning`, met een versienummer. Elke wijziging gebruikt een atomische versiecontrole, zodat twee gebruikers elkaar niet stil overschrijven. Bij een conflict wordt de nieuwste planning opgehaald en moet de gebruiker de wijziging opnieuw toepassen. De API valideert medewerkers, datums, duur, overlap, gereedmelding en transportgegevens. De browser kan niet rechtstreeks naar de tabel schrijven. De API vereist een geldige login en CSRF-controle.

De planning ververst elke 30 seconden wanneer het scherm zichtbaar is en er geen bon openstaat. Met **Vernieuwen** kan dit ook handmatig. Een open formulier wordt niet door de achtergrondverversing vervangen.

Deze eerste versie bewaart maximaal 100 medewerkers en 5.000 werkbonnen in één gedeeld planningsdocument. Open bonnen kunnen worden verwijderd; afgeronde bonnen blijven bewaard in het archief. Medewerkers kunnen via hun naam worden versleept naar een andere volgorde, of met Alt+pijl omhoog/omlaag. Klaar voor transport blijft op de monteursagenda zichtbaar; de rit staat daarnaast op de chauffeursplanning. Verander je de bon terug naar een andere werkplaatsstatus, dan wordt de gekoppelde transportplanning bij opslaan ingetrokken.

## Verificatie

- `node --test tests/workshop-scheduling.test.cjs`
- `npx tsx --test tests/workshop.test.ts tests/workshop-access.test.ts tests/workshop-orders.test.ts`
- `npm run build`

Regeltests dekken overlap, aansluitende afspraken, medewerkers, kalendergrenzen, ongeldige datums en transportvoorwaarden. De proefagenda is in de browser getest op aanmaken, verslepen naar een monteur, gereedmelding en verschijnen/verslepen in de chauffeursagenda. De gedeelde Supabase-opslag moet na de SQL-installatie nog met twee ingelogde sessies worden gecontroleerd. De afdrukdialoog is in de ingebouwde browser niet volledig te controleren; controleer de papieren/PDF-afdruk ook in de normale browser.

## Bronbestanden en pakket opnieuw maken

De onderhoudbare agenda-assets staan in `modules/werkplaats/assets`; `scripts/package-workshop-module.mjs` kopieert deze naar `public/werkplaats-preview` en bouwt de ZIP. Voer dit script uit na wijzigingen aan de assets. Het pakket bevat geen credentials, klantgegevens of node_modules.

### Voortgang op het werkplaatstablet
Monteurs kiezen hun naam op de gedeelde tablet en voegen notities toe of gebruiken Mee bezig, Wachten op onderdelen, Afronden / controle en On hold. Elke update bewaart naam, datum en tijd. Mee bezig is een voortgangsmelding; er is geen pauzeknop. De monteur vult daarnaast handmatig de werkelijk bestede tijd als totaal in uren en minuten in. De registratie bewaart naam en datum/tijd en verandert de begintijd en richttijd niet. Afronden wordt Werkbon-controle; vrijgave en transport blijven bij het beheer. De tablet mag de planning niet wijzigen. De beperkte POST-route /api/werkplaats/werkbon controleert invoer, bestaande medewerker en werkbon en bewaart wijzigingen met versiecontrole.

De bestellijst gebruikt vrije tekst, een medewerkernaam en optioneel een werkbonnummer of voorraadvermelding. De server legt datum en tijd vast. Bestaande aanvragen blijven beschikbaar. Deze aanpassingen gebruiken de bestaande JSON-opslag en vragen geen databasemigratie.

Een bestaande werkbon opent voor alle accounts direct met voortgangsknoppen, notities en bestede tijd. Beheerders openen het planningsformulier via **Planning & bon bewerken**. Het tabletaccount krijgt die beheerknop niet. De werkelijke tijd en de updategeschiedenis worden ook op de geprinte werkbon getoond.

## Klantkoppeling, werkbonhistorie en voorraadklussen

De nieuwe knop **Nieuwe werkbon** zoekt klanten uit de klantenbak en toont uitsluitend machines van de gekozen klant. Het afleveradres kan los van transport worden ingevuld. De knop **Nieuwe klant** of **Nieuwe machine** bewaart het nieuwe record direct in het systeem. Een dubbele klant of machine wordt geweigerd, zodat een bestaande machine niet ongemerkt bij een andere klant terechtkomt.

Werkzaamheden leren losse zinnen uit opgeslagen bonnen. Tijdens typen verschijnen maximaal zes passende eerdere omschrijvingen. Deze voorstellen worden gedeeld met de planning en blijven bewaard na verwijderen van een open bon. Klantvelden leren geen losse teksten; die zoeken alleen in de klantenbak.

De algemene werkbonnenbak staat boven de monteurs en bevat een apart vak **Voorraadmachines**. Voor een voorraadbon is een richttijd verplicht en zichtbaar in de titel. De planner kan de bon naar een monteur en dag slepen. Een monteur kan een ongeplande voorraadklus zelf oppakken met zijn naam; de server zoekt vandaag een vrij tijdvak vanaf het huidige kwartier. Gelijktijdige wijzigingen blijven beveiligd met versiecontrole.

De achtergrondkleur toont de status (onder meer groen voor Mee bezig en rood voor On hold). Een smal balkje toont Klantreparatie, Verkooptruck of Voorraadtruck. Spoed heeft een rood balkje en uitroepteken.

**Afgerond** verplaatst een werkbon uit de actieve agenda naar **Relaties & materieel → Werkbonnen**. De volledige bon, geselecteerde en uitgevoerde check-up, werkelijk gewerkte tijd en updates blijven daar leesbaar en afdrukbaar. De klant- en machinekaart tonen gekoppelde werkbonnen met een link naar de volledige bon. Afgeronde bonnen kunnen door de planner worden heropend en kunnen niet direct worden verwijderd.

Deze uitbreiding gebruikt de bestaande JSON-opslag en bestaande klanten- en machinetabellen; een nieuwe SQL-migratie is niet nodig. Proefbonnen blijven in de browser; nieuw aangemaakte klanten en machines in lokale testmodus staan in de lokale demodatabase.

Aanvullende verificatie: `npx tsx --test tests/workshop-workflow.test.ts`.

## Agenda en transport vanaf 18 november 2026

De keuringsagenda, werkplaatsagenda en transportplanning tonen ISO-weeknummers. Nederlandse feestdagen worden per jaar berekend, inclusief Goede Vrijdag, beide paasdagen, Hemelvaart, beide pinksterdagen en Koningsdag met de zondagcorrectie. De referentie is de Rijksoverheid: https://www.rijksoverheid.nl/themas/werk/arbeidsovereenkomst-en-cao/vraag-en-antwoord/arbeidsovereenkomst-en-cao/officiele-feestdagen.

Vrije agenda-afspraken hebben een begin- en einddatum (inclusief) en optionele begin- en eindtijden. Een afspraak verschijnt op alle dagen van de periode, ook over maand- of jaargrenzen. De bestaande agenda-tabel blijft bruikbaar: nieuwe afspraken bewaren de periode als versiegebonden metadata in de beschrijvingskolom; de service decodeert die naar losse velden. Bestaande beschrijvingen blijven gewone tekst. Een SQL-migratie is niet nodig.

Een werkbon krijgt onmiddellijk één gekoppelde transportbon. Voorbereidingsinstructies, ophaaladres en contact kunnen tegelijk met de nieuwe werkbon worden ingevuld. De tab **Transportplanning** heeft een bak voor gekoppelde werkbonnen en een aparte bak voor inkoop/losse transporten. De monteur zet de complete bon op **Afronden / te controleren**. Alleen kantoor kan daarna de laatste controle goedkeuren en de werkbon afsluiten. De factuur wordt via het bestaande facturatiesysteem verstuurd; in de app legt kantoor de referentie, verzending en betaling handmatig vast. Het is geen automatische bank- of facturatiekoppeling. Een gekoppeld transport is pas na die afsluiting en betaalregistratie planbaar. Losse inkoopritten hebben geen klantfactuurblokkade.

Transport is opgeslagen als een aparte bon in het bestaande gedeelde planningsdocument, met dag, chauffeur en positie binnen die dag. Een tijdstip is optioneel en veroorzaakt geen overlapblokkade. Ritten zijn naar een andere chauffeur/dag, binnen een dagvolgorde en terug naar hun eigen transportbak te slepen. Bestaande reeds ingeplande transporten worden met hun gegevens behouden; een oude vrijgave wordt herkend zodat zij niet plotseling verdwijnen.

Een geplande werkbon kan terug naar de werkplaatsbak worden gesleept. Voorraadbonnen horen uitsluitend in voorraad; de overige soorten uitsluitend in algemeen. De bon behoudt werkzaamheden en historie.

Via **Medewerkers** kunnen monteurs ook als chauffeur beschikbaar worden gemaakt, bijvoorbeeld Renze. De medewerker blijft dan eveneens in de monteursagenda.

**Lege werkbon afdrukken** opent een A4-formulier met klant, datum, monteur, machinenummer, serienummer, urenstand, afleveradres, schrijfruimte voor werkzaamheden, onderdelen en uren, plus dezelfde tien controlepunten met penvakjes voor te controleren/gecheckt. Digitale werkbonnen en transportbonnen kunnen eveneens worden afgedrukt.

Verificatie: `npm test`, `node --test tests/workshop-scheduling.test.cjs`, `npm run build`. De tests dekken ook betaald/onbetaald transport, kantoorcontrole, behoud van oude ritten, terugplaatsen naar bakken, kalendergrenzen en feestdagen in meerdere jaren.

## Werkbonnenoverzicht, compacte filters en slepen tussen weken

Het menu **Relaties & materieel → Werkbonnen** opent een documentenoverzicht zonder de planningsbediening. Het overzicht toont open en afgeronde bonnen, met filters voor jaar, maand, datum, status en zoektekst. Afgeronde bonnen gebruiken hun afsluitdatum; open bonnen de plandatum. De bon blijft via de lijst te openen en af te drukken. Het keuringsmenu gebruikt het pictogram van een rapport met een pen.

Het grote filterblok boven de keuringsagenda is vervangen door een smalle filterbalk; op kleinere schermen schuiven de velden naar twee regels. De richttijd op een werkbon wordt in uren ingevoerd, met stappen van 0,25 uur, bijvoorbeeld 1,5 uur. De bestaande minutengegevens blijven behouden.

Tijdens slepen verschijnen zones **Vorige week** en **Volgende week**. Laat een geplande bon op een zone los om dezelfde medewerker en weekdag in de andere week te gebruiken. Bij vasthouden boven de weekzone of aan de rand gaat de agenda vanzelf over naar de andere week; je kunt de bon vervolgens op een gekozen dag laten vallen. Dezelfde bediening werkt voor transportbonnen. Boven de werkplaatsplanning staat een kleine legenda met statusvlakjes en de balkkleuren voor soort werkbon.

## Papieren werkbonnen, transportbonnen en ritlijsten

Lege en ingevulde werkbonnen gebruiken hetzelfde A4-PDF-formulier. Bekende gegevens worden ingevuld; ontbrekende gegevens laten schrijfruimte vrij. Het formulier bevat tien onderdelenregels, dezelfde tien check-ups, gewerkte uren, opmerkingen van de monteur en een afvinkvak voor kantoorcontrole. Lange inhoud loopt door op vervolgpagina's. Status, updates, prijzen en browserkop/-voet (paginatitel en URL) worden niet op de PDF afgedrukt. De knop opent de PDF; de gebruiker drukt af vanuit de PDF-lezer.

Transportbonnen gebruiken dezelfde PDF-stijl, met invulruimte voor adressen, instructies, afleverbevestiging en handtekeningen. **Ritlijst afdrukken** in de transportplanning neemt de zichtbare week, de geselecteerde chauffeur en het zoekfilter over. Kies daarna één dag of de hele week. Alleen geplande ritten worden opgenomen, gegroepeerd per datum/chauffeur en gesorteerd op de geplande positie, onafhankelijk van optionele afspraaktijden.

De PDF-API vereist een ingelogde gebruiker, en bij POST ook origin-/CSRF-controle. Het is uitsluitend een renderer: afdrukken wijzigt geen bonnen of planning. De HTML-preview heeft voor PDF-afdrukken een draaiende app nodig. Er is geen extra database-migratie of afhankelijkheid nodig.

Klant en machine hebben elk één doorzoekbare keuze uit de opgeslagen records. Een wijziging van klant wist de machinekeuze onmiddellijk. Vrije zoektekst geldt nooit als een gekoppeld record. **Opmerkingen monteur** vervangt de onduidelijke veldnaam Terugkoppeling / onderdelen; gebruikte onderdelen blijven apart staan. Spoed heeft een neongroen balkje; wachten op onderdelen een oranje statusvlak. De legenda gebruikt dezelfde kleuren.

## Machinevelden en urenstand (19 november 2026)

Machine bevat uitsluitend merk en type. Intern nummer en serienummer zijn afzonderlijke velden en worden uit de gekoppelde machine gelezen; het interne nummer valt nooit terug op het serienummer. Een bekende urenstand wordt uit `configuration.hour_reading` opgehaald. Bij een nieuwe of gewijzigde urenstand wordt alleen die sleutel op de machine bijgewerkt, ook bij een machine die zojuist via de werkbon is aangemaakt. Andere configuratievelden blijven behouden. Het opnieuw plannen van een oude bon schrijft zijn oude urenstand niet terug naar de machine.

Machine en werkbon zijn afzonderlijke opslagbewerkingen: na validatie wordt de urenstand bewaard en daarna de planning met versiecontrole. Als die laatste bewerking conflicteert, meldt de app expliciet dat de machine-uren wel bewaard zijn en de werkbon opnieuw moet worden opgeslagen. De proefmodus gebruikt dezelfde machineopslag via de relaties-API; de planning blijft daar in de browser.

Bij een geopende bon bewaart **Wijzigingen opslaan** notitie, aangevinkte controles en ingevulde werktijd samen. Daarna verschijnt **Wijzigingen opgeslagen**. De planner houdt daarnaast de bestaande knop voor het bewerken en opslaan van de bon/planning.

De snelheidscontrole en meetresultaten staan in `docs/snelheidscontrole-2026-11-19.md`. Machine-eigenaars voor klantentellingen gebruiken een smalle projectie; keuringsperioden worden vooraf in de database gefilterd. Ongewijzigde werkplaatsverversingen sturen geen planningsdocument meer terug. Historie op klant-/machinekaarten stuurt alleen de gekoppelde samenvattingen terug. Er is geen nieuwe migratie nodig.

## Directe planningnavigatie

Onder Planning staan Keuringsplanning, Transportplanning, Werkplaatsplanning en Verhuur. De werkplaats blijft ook bereikbaar via het losse hoofdmenu-item Werkplaats. De planningtabknoppen gebruiken dezelfde routes; het tabletaccount behoudt de bestaande interne tabbediening. De werkplaatsknop Onderdelen bestellen opent de bestellijst. Het werkbonnenoverzicht blijft onder Relaties & materieel staan en is uit de werkplaatsknoppenbalk verwijderd.

Transportbonnen kunnen via de geopende bon worden verwijderd na een bevestiging. De bon krijgt een deletedAt-markering en verdwijnt uit de transportbakken, planning, plankeuze en ritlijsten. Gekoppelde werkbonnen en hun historie worden behouden. De koppeling blijft intern bestaan zodat normaliseren de verwijderde bon niet opnieuw aanmaakt. Vanuit de werkbon kan de verwijderde transportbon expliciet worden teruggezet in de ongeplande bak. Verwijderde bonnen kunnen niet worden versleept of vrijgegeven. Alleen planners kunnen verwijderen en terugzetten; er is geen migratie nodig.

De weekpijlen staan direct in de dagkoppen van de planning: vorige week bij maandag en volgende week bij zondag. Bovenaan blijft alleen Deze week staan. De bestaande klik- en sleepbediening gebruikt dezelfde acties; de dagkoppen worden gedeeld door werkplaats- en transportplanning.

De oude werkbonstatus Klaar voor transport wordt bij laden genormaliseerd naar Afgerond. Zulke bonnen worden ook in validatie, archieffilters en klant-/machinehistorie als afgesloten behandeld en blokkeren geen monteurstijd meer. Alle bongegevens, updates, klant-/machinekoppelingen, betaalregistraties en bestaande transportplanning blijven behouden. Er wordt geen kantoorcontrole of betaling verzonnen. Alleen een al aanwezige afsluitdatum of kantoorcontroledatum wordt als afsluitdatum gebruikt; anders blijft de bestaande werkdatum de vinddatum. De oude status blijft intern leesbaar voor compatibiliteit. Bij de controle op 19 november stonden in de aangesloten database geen bonnen meer met deze oude status; er zijn daarom geen gegevens gewijzigd.
