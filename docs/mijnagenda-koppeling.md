# Alleen-lezen keuringsbron voor Mijn Agenda FRL

`GET /api/planning/mijnagenda?from=YYYY-MM-DD&to=YYYY-MM-DD` leest uitsluitend eigen Supabase-tabellen `planning_items`, `rentals` en optioneel `agenda_events`. De afzonderlijke cursusimport van Age wordt nooit aangeroepen of meegestuurd. De bestaande cursusimport en de planner blijven ongewijzigd.

`due_date` is een keuringsreminder, geen bewijs van een ingepland bezoek. De export markeert deze items als `category: reminder`, `allDay: true` met exclusieve einddatum. Ook verhuurgrensdatums zijn dagherinneringen. De ontvangende FRL-agenda zet deze items op vrij en laat de gebruiker afzonderlijk kiezen of reminders op de telefoon zichtbaar worden. Er worden geen fictieve begintijden gemaakt. Persoonlijke losse afspraken zijn alleen opt-in; ze worden als `category: appointment` aangeboden en evenmin van een fictieve begintijd voorzien.

## Eenmalig instellen

1. Genereer een willekeurige 32-byte hexsleutel (64 kleine hextekens) en zet die in Vercel, Production, als `MIJNAGENDA_EXPORT_KEY`. Nooit `NEXT_PUBLIC_` gebruiken. Sleutel niet committen of via chat/e-mail delen.
2. Publiceer deze code en de nieuwe Production-omgeving. Gebruik het vaste domein `https://keuringssysteem.vercel.app`, niet een adres van een losse publicatie.
3. In Mijn Agenda FRL, versie 0.3.1 of hoger, Koppelingen → Werkagenda → Heftrucks keuringsplanning. Endpoint: `https://keuringssysteem.vercel.app/api/planning/mijnagenda`. Vul dezelfde sleutel in. Kies afzonderlijk of de keuringsreminders mee moeten.
4. Optioneel: om specifieke interne persoonlijke agenda-items uit `agenda_events` te delen, zet `MIJNAGENDA_AGENDA_OWNER_IDS` op een expliciete lijst toegestane Supabase user-UUID's, gescheiden door komma's. Standaard wordt niets uit die persoonlijke tabel geëxporteerd. Dit vereist afzonderlijke keuze van de eigenaar; deel geen andere privéagenda's mee.

De Supabase service-role sleutel blijft uitsluitend in de keuringsapp en wordt niet gedeeld met FRL. De uitleeskoppeling accepteert alleen zijn eigen bearer key. Zonder ingestelde sleutel: 503. Ongeldige sleutel: 401. Ongeldige periode: 400. Fout of onvolledig resultaat: 503; nooit een misleidende lege kalender. Leesfouten worden zonder database-/contactgegevens geretourneerd. Maximumperiode 1100 dagen, maximaal 10000 records per tabel en 10000 exportitems.

De sessiemiddleware maakt uitsluitend voor exact GET /api/planning/mijnagenda een uitzondering; die route doet eigen sleutelauthenticatie. Andere API's blijven hun bestaande sessiecontrole houden.

De bestaande cronjob van Mijn Agenda FRL moet iedere minuut draaien om ook bij gesloten browser veranderingen op te halen en door te sturen. Google OAuth-testmodus moet voor blijvend gebruik nog worden afgerond.

## Validatie

`node node_modules/tsx/dist/cli.mjs --test tests/mijnagenda-export.test.ts`

`node node_modules/typescript/bin/tsc --noEmit --incremental false`

Controleer na configuratie een reminderdatum, een wijziging en een verwijdering. Controleer dat één cursus van Age slechts via de cursusbron aanwezig is. Dat de export technisch werkt, bewijst niet dat er een klantbezoek is ingepland.
