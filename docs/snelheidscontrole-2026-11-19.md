# Snelheidscontrole - 19 november 2026

De belangrijkste leesroutes zijn nagekeken: dashboard, klanten/archief, machines, keuringslijsten, agenda, werkplaats/transport en historie op kaarten. Rapportgeneratie is al lui geladen en gebruikersinformatie wordt binnen een serverrender al gedeeld. Daar is geen nieuwe cache of verandering aan de toegang toegevoegd.

De onderstaande vergelijking gebruikt de aangesloten dataset via serverfuncties. Tijden zijn een enkele meting en zijn geen garantie voor de volledige paginalaadtijd. De reductie in aantallen en bytes is rechtstreeks gecontroleerd. Er zijn geen lijsten afgekapt om de winst te behalen.

| Onderdeel | Voor | Na | Controle |
| --- | --- | --- | --- |
| Machinegegevens voor actieve klantentellingen | 961 volledige records, 549.132 bytes; 638 ms | 961 eigenaarsverwijzingen, 51.895 bytes; 321 ms | Exact dezelfde telling per klant |
| Keuringslijst november 2026 | Alle 1.790 samenvattingen, 1.409.224 bytes; 776 ms | 26 samenvattingen, 23.094 bytes; 144 ms | Exact dezelfde keurings-ID's na filteren |
| Ongewijzigde werkplaatsverversing | Volledig document, 19.911 bytes in deze dataset | Kleine versiebevestiging, 31 bytes | Geen veranderde versie betekent geen vervanging van de planning |
| Werkbonhistorie op kaarten | Hele planning met werknemers, transport en updates | Alleen samenvattingen van gekoppelde bonnen | Zelfde klant-/machinefilter en volgorde |

De klantentellingen halen circa 91% minder gegevens op. Het novembervoorbeeld haalt circa 98% minder gegevens op. Voor de ongefilterde keuringslijst blijven alle resultaten beschikbaar. Week-, dag-, maand- en conceptfilters worden als databasevoorwaarden meegestuurd; de bestaande weergavefilters blijven behouden. Maandeindes, inclusief schrikkeljaren, worden getest.

De verversingsfrequentie van 30 seconden blijft gelijk. De databasequery selecteert het document alleen wanneer de versie afwijkt. Een handmatige verversing blijft beschikbaar. Gegevens worden niet tussen gebruikers of verzoeken gecachet.

Ook de koppeling van werkbonnen aan transportbonnen gebruikt nu een index op werkbon-ID in plaats van voor iedere bon de hele transportlijst te doorzoeken. Bij een synthetische planning met 5.000 bonnen was de mediaan van zeven runs 43,5 ms voorheen en 1,0 ms na wijziging. De volledige uitvoer is diep vergeleken en was gelijk. Dit is uitsluitend de normalisatiestap, geen volledige paginalaadtijd. Ook de oude-bonopzoekingen bij opslaan gebruiken nu een index.

Verificatie omvat automatische tests, typecontrole, productiebuild, gelijkheidscontroles tegen de aangesloten dataset en browsercontroles van machinekeuze, bewerken/opslaan en de opslaanbevestiging. Urenstandopslag is zowel lokaal voor een bestaande en een nieuwe machine getest als op een expliciete fictieve testmachine in de aangesloten database; de laatste is daarna naar zijn eerdere testwaarde teruggezet.

Zes herkenbaar fictieve werkbonnen WB-0006 t/m WB-0011 zijn op verzoek toegevoegd aan de transportbak. De adressen, vrijgave en factuurreferenties zijn uitsluitend testgegevens. De bonnen zijn bij aanmaak gecontroleerd op ongepland en planbaar; er zijn geen echte facturen of transportopdrachten verstuurd.
