Heftruckopleiding – agenda voor keuringsapp 1.0.0

1. Upload de ZIP in WordPress via Plugins > Nieuwe plugin > Plugin uploaden.
   Activeer deze aanvullende plugin. De bestaande planningsplugin blijft staan.
2. Open Instellingen > Keuringsagenda en selecteer Age uit de instructeurslijst.
3. Kies Nieuwe sleutel maken voor deze instructeur.
4. Vul in Vercel > keuringssysteem > Settings > Environment Variables voor Production:
   HEFTRUCK_COURSE_INSTRUCTOR_ID = het getoonde nummer van Age
   HEFTRUCK_COURSE_AGENDA_TOKEN = de eenmalig getoonde sleutel
   Deze variabelen mogen GEEN NEXT_PUBLIC_ prefix krijgen.
5. Deploy de bijgewerkte keuringsapp opnieuw zodat de variabelen actief zijn.
6. Open Planning in de keuringsapp als Age of Renze. Cursussen staan in paars
   en zijn te filteren via Cursussen Age. Controleer datum, tijden en locatie
   tegen de cursusplanning. Sipkes cursussen mogen niet zichtbaar zijn.

De sleutel is een uitsluitend-lezen sleutel voor de gekozen instructeur.
Hij wordt op WordPress alleen als hash opgeslagen. Er gaan geen deelnemers-
gegevens, overige afspraken of cursussen van andere instructeurs mee.
Concepten, geannuleerde en gearchiveerde cursussen worden niet getoond.
Afgeronde cursussen blijven als historische afspraken zichtbaar.
Wijzigingen en annuleringen worden verwerkt bij verversen of iedere vijf
minuten zolang de agenda open en zichtbaar is. Er worden geen cursussen
gekopieerd naar de database van de keuringsapp; er ontstaan geen dubbele
handmatige afspraken. Bij een storing staat er een duidelijke melding.

Een nieuwe sleutel maken trekt de oude sleutel direct in. Werk daarna ook
de variabelen in Vercel bij en deploy opnieuw. Koppeling uitschakelen kan
in hetzelfde WordPress-scherm. Alleen beheerders kunnen deze instellingen
wijzigen. Er is geen databasewijziging in de keuringsapp nodig.
