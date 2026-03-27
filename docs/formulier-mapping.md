# Mapping formulieren naar datastructuur

## Opzet

Elke keuring gebruikt hetzelfde hoofdschema:

- `customer_snapshot`
- `machine_snapshot`
- `checklist`
- `findings`
- `recommendations`
- `conclusion`
- `inspection_number`
- `inspection_date`
- `next_inspection_date`

## Checklist-opslag

`checklist` is JSONB en bewaart per controlepunt de gekozen waarde:

```json
{
  "bevestigingen": "goed",
  "lasverbindingen": "slecht",
  "veiligheidsgordel": "nvt"
}
```

## Waardesets

- Standaard machines: `goed | slecht | nvt`
- Stellingmateriaal: `goed | matig | slecht | nvt`

## Formulierfamilies

- Heftruck / reachtruck: chassis, rijwerk, besturing, aandrijving, hefgedeelte, diversen
- Batterij en laders: container, tractiebatterijen, lader
- Graafmachine: algemeen, onderwagen, bovenwagen, hydraulisch systeem, gieken, motor, cabine, overige
- Hoogwerker: 18 secties uit het bronformulier
- Palletwagen / heffer / stapelaar: 7 secties
- Shovel: algemeen, chassis, remmen en stuursysteem, hydraulisch systeem, laadframe, motor, cabine, overige
- Verreiker: algemeen, veiligheidsvoorzieningen, chassis, remmen/stuursysteem, hydraulisch systeem, telescoop, motor, cabine, overige
- Stellingmateriaal: gebouwvloer, beveiliging, aanrijbeschermers, beschadigingen, gebruik, montage, stellingvloer/entresol, verrijdbare stellingen

## Voorinvullen

Bij starten van een nieuwe keuring:

1. laad machinekaart
2. laad laatste afgeronde keuring
3. vul machinevelden en bekende checklistcontext in
4. toon vorige keuring als snelkoppeling in het dossier
