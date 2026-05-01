# Forminator Nummerexport

Gebruik dit als we de originele Forminator-keuringsnummers willen koppelen aan de detail-CSV's, zonder handmatig pagina's te kopieren en plakken.

## Beste methode

Exporteer in `phpMyAdmin` of via je hosting een simpele CSV uit de Forminator entries-tabel.

We hebben alleen dit nodig:

- `oud_nummer` = het Forminator entry ID
- `inzendingstijd` = exacte datum+tijd van inzending
- `form_id`
- `entry_type`

Dat is genoeg om de oude nummers weer terug te koppelen aan de keuringsregels.

## SQL

Let op: vervang `wp_` door jouw eigen WordPress tabelprefix als die anders is.

```sql
SELECT
  entry_id AS oud_nummer,
  form_id,
  entry_type,
  date_created AS inzendingstijd
FROM wp_frmt_form_entry
WHERE date_created >= '2021-01-01'
ORDER BY date_created ASC, entry_id ASC;
```

## Exporteren

1. Open `phpMyAdmin`
2. Kies de WordPress database
3. Open tabblad `SQL`
4. Plak de query hierboven
5. Klik op `Go` / `Uitvoeren`
6. Exporteer de resultaten als `CSV`

## Resultaat

Je krijgt dan een compacte lijst zoals:

```csv
oud_nummer,form_id,entry_type,inzendingstijd
18,1234,custom-forms,2025-10-07 17:44:00
211,1234,custom-forms,2026-04-13 14:18:00
```

## Waarom dit beter is

- geen handmatig knip- en plakwerk
- alle formulieren in 1 keer
- exacte match met de detail-CSV's via inzendingstijd
- veilig: dit is alleen een `SELECT`, dus leest alleen data en wijzigt niets

## Als phpMyAdmin niet handig is

Dan kunnen we ook een tijdelijke WordPress export-snippet maken die exact dezelfde CSV downloadt vanuit wp-admin. Dat is plan B.
