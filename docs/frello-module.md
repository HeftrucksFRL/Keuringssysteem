# Frellobord

Een gezamenlijk leadbord voor de bestaande accounts van Age en Renze op `/frello`, met daarnaast privéborden per ingelogd account. Het tabletaccount en andere gebruikers hebben geen toegang.

## Gebruik

- Het gezamenlijke bord begint met Nieuwe leads, Contact gelegd, Offerte verstuurd, Opvolgen, Gewonnen en Verloren.
- **Nieuw bord** biedt Gezamenlijk of Privé. Privé is standaard. De zichtbaarheid staat na aanmaken vast, zodat een privébord niet per ongeluk gedeeld kan worden.
- Open een kaart om titel, omschrijving, klant/contactgegevens, verantwoordelijke, opvolgdatum en labels bij te werken. Labels worden met komma’s gescheiden.
- Een kaart bevat een checklist, reacties en bijlagen. Reacties worden bij opslaan aan de huidige gebruiker gekoppeld. Een leeg checklistpunt wordt bij opslaan verwijderd.
- Sleep kaarten tussen kolommen of vóór een andere kaart. Op een touchscreen kan de kolom ook in de geopende kaart worden gekozen.
- **Bord & kolommen** laat de bordnaam en kolomnamen aanpassen en een nieuwe kolom toevoegen.
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

`npx tsx --test tests/frello.test.ts` controleert verplaatsen, rangschikken, geldige kaartgegevens, onbevoegde privacywijzigingen, tablettoegang en uploadgrenzen. `npm run build` controleert de integratie met de app.

Op 12 november 2026 is de migratie uitgevoerd in het aangesloten Supabase-project. Een transactie met de twee echte accountrollen heeft gecontroleerd dat beiden het gezamenlijke bord zien en alleen hun eigen privébord/bijlagemetadata. Een wijziging van het privébord van de ander wordt geweigerd; wijzigen van zichtbaarheid heeft geen tabelrecht. De tabletrol ziet geen bord- of bijlageregels. De tijdelijke testregels zijn met ROLLBACK verwijderd. De proefinterface is gecontroleerd op verslepen, kaartbewerking, checklist/reacties, privéborden en upload van een tekstbijlage. Er is geen proefbestand in productie opgeslagen.

Dit is een eigen kanbanmodule voor leadopvolging. Automatische acties, koppelingen met Trello, agenda-e-mails en pushmeldingen zijn niet inbegrepen.
