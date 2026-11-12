# Snelheidsverbeteringen – 12 november 2026

## Gewijzigd

- Het hoofdmenu roept niet langer kort na iedere appstart `router.prefetch` aan voor alle negen hoofdschermen. Menulinks laden gericht voor bij pointer-enter of toetsenbordfocus. `prefetch={false}` voorkomt daarnaast automatisch voorladen van beide desktop-/mobiele menubomen. Dit volgt het [Next.js 15 patroon voor gericht voorladen](https://nextjs.org/docs/15/app/guides/prefetching).
- Rapportgeneratie, e-mailverzending en fotobewerking worden dynamisch geladen wanneer de betreffende bewerking nodig is. Overzichten hoeven PDF-, mail- en Sharp-modules niet bij het starten te initialiseren. De lazy module-resolver ondersteunt zowel de Next.js-build als de bestaande tsx onderhoudsscripts.
- Bij een selectie van meer dan 100 klant- of machine-ID's wordt niet langer het hele bestand gedownload en daarna lokaal gefilterd. Alle unieke gevraagde ID's worden in batches van maximaal 100 opgehaald, met maximaal vier gelijktijdige verzoeken. Volledige bestandsweergaven blijven pagineren; er is geen limiet van 1.000 records toegevoegd.
- De klantenpagina haalt het klantenbestand één keer op en bepaalt daaruit de actieve klanten en het archiefaantal. Voor de laatste keuringsdatum worden alleen klant-ID en datum opgehaald; machinegegevens voor de telling worden vóór verzending naar de browser tot klant-ID beperkt. De archiefpagina gebruikt dezelfde lichte gegevens.
- Op het dashboard begint de klantquery zodra de planning en recente machines beschikbaar zijn, zonder eerst op de onafhankelijke meldingen/takenquery's te wachten.
- Bekende publieke logo's, iconen, manifest en de twee statische plannerassets doen geen sessiecontrole meer voor GET/HEAD. De uitzondering gebruikt exacte paden, geen algemene extensieregel. Pagina's, API's en werkplaatsrechten behouden hun bestaande controles.
- Het logo gebruikt de bestaande Next.js image-optimalisatie. Een kleine route-loadingweergave geeft alvast feedback terwijl de inhoud wordt opgehaald.

## Verificatie en grenzen

De tests controleren volledigheid bij 2.501 ID's, ontdubbeling, begrensde concurrency, foutafhandeling en bescherming van pagina-/API-paden. De lichte klantgeschiedenis is vergeleken met de bestaande keuringssamenvattingen. De bestaande tests voor rapporten, foto-opslag en werkplaatsfuncties slagen ook.

In een lokale importcontrole werden voor gewone servicecode vóór deze wijziging 157 `pdf-lib`-modules en de mailmodule geladen. Na de wijziging bleven PDF-, mail- en Sharp-modules ongeladen totdat ze werden gebruikt. In de aanwezige lokale proefdata daalden uitsluitend de machine-/keuringsprops voor de klantenlijst van 4.025 naar 318 bytes. De rest van de pagina is hierin niet meegerekend; dit is geen claim over de volledige paginagrootte of de procentuele live laadtijd.

Klantenlijst, aantallen, laatste keuringsdatum, logo en dashboardnavigatie zijn in de browser gecontroleerd. De productiebuild is geslaagd. Er zijn geen databasemigraties of nieuwe dependencies nodig en er is geen gedeelde cache voor gebruikersgegevens toegevoegd. Live laadtijd blijft mede afhankelijk van databaseomvang, netwerk en hosting.
