# Werkplaatsagenda — module voor de keuringsapp

Versie 1.2.0, 12 november 2026. Een eigen werkplaatsagenda op `/werkplaats`, los van de bestaande keuringsplanning. Dit pakket is een Next.js-uitbreidingsmodule voor deze app, geen WordPress-plugin.

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

- Voeg monteurs en chauffeurs toe via **Medewerkers**. Dit zijn planningsmedewerkers; zij krijgen hiermee geen inlogaccount.
- Klik op **Werkbon** in een dagvak om direct een bon voor die monteur en datum aan te maken. Begintijd en duur staan op de bon. Nieuwe bonnen kunnen ook ongepland blijven.
- Sleep een bon naar een andere medewerker of dag. De begintijd blijft behouden; pas die aan door de bon te openen. Overlappende opdrachten voor dezelfde medewerker worden geweigerd. Aansluitende opdrachten zijn toegestaan.
- Statussen: Nieuw, Ingepland, Mee bezig, Wachten op onderdelen, Wachten op goedkeuring, Pauze, Klaar voor transport.
- Rond de drie werkplaatscontroles af en kies Klaar voor transport. Je kunt daarna **Opnemen in chauffeursplanning** aanvinken. Chauffeur, transportdatum, tijd, ritduur, ophaaladres, afleveradres en contact zijn verplicht. De rit verschijnt na opslaan bij de chauffeur.
- Ritten zijn ook versleepbaar. Ritstatussen: Gepland, Onderweg en Afgeleverd. Bij Afgeleverd is een ontvangstnotitie verplicht.
- Print een geopende bon met **Print werkbon**. De bon bevat geen prijzen. De normale browser geeft ook de mogelijkheid om als PDF op te slaan.
- Op een touchscreen kun je altijd datum, tijd en medewerker in de bon aanpassen; native slepen hangt af van het apparaat.

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

De bestaande ingelogde gebruikers kunnen de werkplaatsplanning bewerken. Het gedeelde account met serverrol `workshop_viewer` heeft uitsluitend kijkrechten op de agenda, kan bestelaanvragen indienen en wordt via middleware, de API en databasepolicies afgeschermd van de rest van de app. De rol komt uit `app_metadata`; zelf wijzigbare `user_metadata` wordt hiervoor niet vertrouwd. Klant, machine en serienummer zijn nu tekstvelden; er is nog geen automatische koppeling met klant- en machinekaarten.

De module bewaart de gezamenlijke planning in `workshop_planning`, met een versienummer. Elke wijziging gebruikt een atomische versiecontrole, zodat twee gebruikers elkaar niet stil overschrijven. Bij een conflict wordt de nieuwste planning opgehaald en moet de gebruiker de wijziging opnieuw toepassen. De API valideert medewerkers, datums, duur, overlap, gereedmelding en transportgegevens. De browser kan niet rechtstreeks naar de tabel schrijven. De API vereist een geldige login en CSRF-controle.

De planning ververst elke 30 seconden wanneer het scherm zichtbaar is en er geen bon openstaat. Met **Vernieuwen** kan dit ook handmatig. Een open formulier wordt niet door de achtergrondverversing vervangen.

Deze eerste versie bewaart maximaal 100 medewerkers en 5.000 werkbonnen in één gedeeld planningsdocument. Bonnen verwijderen, medewerkers hernoemen/archiveren en een historisch wijzigingenlogboek zijn niet opgenomen. Klaar voor transport blijft op de monteursagenda zichtbaar; de rit staat daarnaast op de chauffeursplanning. Verander je de bon terug naar een andere werkplaatsstatus, dan wordt de gekoppelde transportplanning bij opslaan ingetrokken.

## Verificatie

- `node --test tests/workshop-scheduling.test.cjs`
- `npx tsx --test tests/workshop.test.ts tests/workshop-access.test.ts tests/workshop-orders.test.ts`
- `npm run build`

Regeltests dekken overlap, aansluitende afspraken, medewerkers, kalendergrenzen, ongeldige datums en transportvoorwaarden. De proefagenda is in de browser getest op aanmaken, verslepen naar een monteur, gereedmelding en verschijnen/verslepen in de chauffeursagenda. De gedeelde Supabase-opslag moet na de SQL-installatie nog met twee ingelogde sessies worden gecontroleerd. De afdrukdialoog is in de ingebouwde browser niet volledig te controleren; controleer de papieren/PDF-afdruk ook in de normale browser.

## Bronbestanden en pakket opnieuw maken

De onderhoudbare agenda-assets staan in `modules/werkplaats/assets`; `scripts/package-workshop-module.mjs` kopieert deze naar `public/werkplaats-preview` en bouwt de ZIP. Voer dit script uit na wijzigingen aan de assets. Het pakket bevat geen credentials, klantgegevens of node_modules.
