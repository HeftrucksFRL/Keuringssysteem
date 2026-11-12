# Cursusagenda van Age in de keuringsapp

De koppeling leest rechtstreeks uit de WordPress-planning op heftruckopleiding.frl. Alleen de cursussen van één ingestelde instructeur worden getoond. Selecteer bij installatie **Age**, en gebruik zijn numerieke WordPress-instructeur-ID in de keuringsapp. Sipke en niet-toegewezen cursussen vallen buiten de export.

## Installeren en activeren

1. Maak de ZIP met `node scripts/package-course-agenda.mjs`. Upload `generated/heftruckopleiding-keuringsagenda-v1.0.0.zip` in WordPress via **Plugins → Nieuwe plugin → Plugin uploaden** en activeer hem naast de bestaande planningsplugin. Er is geen vervanging van de bestaande plugin nodig. De aanvullende plugin gebruikt de bestaande `hp_courses`-tabel; er is geen databasewijziging.
2. Ga naar **Instellingen → Keuringsagenda**. Selecteer Age en maak de sleutel aan. Het scherm toont zijn ID en de sleutel; de sleutel wordt maar één keer getoond.
3. Zet in het Vercel-project van de keuringsapp voor Production `HEFTRUCK_COURSE_INSTRUCTOR_ID` en `HEFTRUCK_COURSE_AGENDA_TOKEN` op de getoonde waarden. Gebruik geen `NEXT_PUBLIC_`-prefix. De sleutel hoort uitsluitend in serverinstellingen, niet in chat, Git of browsercode.
4. Deploy de bijgewerkte keuringsapp opnieuw. Voor lokale echte brondata kunnen dezelfde servervariabelen in `.env.local` staan, zonder `LOCAL_TEST_MODE=1`.
5. Open **Planning** als Age of Renze en vergelijk datum, tijden en locatie van een cursus met de bron. Controleer tevens dat een cursus van Sipke ontbreekt. Zonder sleutel/configuratie toont de app een melding dat de agenda nog niet gekoppeld is; zij presenteert dat niet als een lege agenda.

## Gedrag

Cursussen hebben een paarse kleur en een filter **Cursussen Age**. Openen toont de brongegevens en een link naar de cursusplanning, zonder aanpassen- of verwijderen-knoppen. Meerdaagse cursussen verschijnen op elke betrokken dag. UTC-brontijden worden naar Europe/Amsterdam omgerekend, inclusief zomer- en wintertijd. Een eindtijd op middernacht veroorzaakt geen extra bezette dag.

De app leest opnieuw bij maandwisseling, handmatig verversen en iedere vijf minuten zolang de agenda zichtbaar is. Cursussen worden niet als eigen afspraken in Supabase gekopieerd. Wijzigingen en annuleringen worden daardoor bij de volgende succesvolle verversing overgenomen. Bij uitval blijft een waarschuwing zichtbaar; eerder geladen afspraken kunnen dan verouderd zijn.

De API accepteert alleen een periode van maximaal 63 dagen, gebruikt een vaste HTTPS-bron zonder redirects en geeft de sleutel nooit aan de browser door. Het antwoord wordt gecontroleerd op het ingestelde instructeur-ID. Concepten, geannuleerde en gearchiveerde cursussen worden uitgesloten; afgeronde cursussen blijven zichtbaar. De export bevat alleen cursus-ID, titel, begin/einde, locatie en instructeur. Deelnemers, andere afspraken en andere instructeurs worden niet opgehaald. Alleen Age en Renze hebben via de keuringsapp toegang; het werkplaatsaccount niet.

Een nieuwe WordPress-sleutel maken trekt de vorige in. Werk dan de servervariabele bij en deploy opnieuw. **Koppeling uitschakelen** in WordPress maakt alle bestaande toegang ongeldig.

## Verificatie

`npm test` bevat contracttests voor instructeursafscherming, ongeldige/te lange perioden, dubbele records, ongewenste velden, tijdzones en meerdaagse afspraken. `scripts/test-course-agenda-plugin.mjs <node_modules-met-php-wasm>` test de WordPress-export met bestaande PHP WASM-runtimes; tijdens ontwikkeling zijn PHP 7.4 en 8.3 getest. De aanvullende plugin is gebaseerd op het gegevensmodel van Heftruckopleiding Planning & Certificering 0.68.4.

In expliciete `LOCAL_TEST_MODE=1` gebruikt de keuringsapp één herkenbare voorbeeldcursus en wordt de website niet aangeroepen. Dit is geen bewijs van een geslaagde liveverbinding; daarvoor is stap 5 nodig nadat de plugin en servervariabelen zijn ingesteld.
