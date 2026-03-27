# Architectuur

## Stack

- Frontend: Next.js App Router op Vercel
- Backend: Supabase PostgreSQL, Auth, Storage
- Documentgeneratie: server-side templates voor PDF en Word
- Mail: Resend of vergelijkbare SMTP/API provider

## Hoofdmodules

1. Dashboard
2. Klantenbeheer
3. Machinebeheer
4. Keuring uitvoeren
5. Documentgeneratie
6. Mail en archivering
7. Planning en opvolging

## Kernflow

1. Keurmeester start een nieuwe keuring.
2. Applicatie kiest bestaande klant of maakt nieuwe klant aan.
3. Applicatie kiest bestaande machine of maakt nieuwe machine aan.
4. Machinegegevens worden vooringevuld vanuit de laatste keuring en machinekaart.
5. Formuliertype bepaalt welke secties en checklist-items zichtbaar zijn.
6. Autosave bewaart conceptdata tijdens het invullen.
7. Bij afronden krijgt de keuring automatisch een oplopend keurnummer binnen het jaar.
8. PDF en Word worden gegenereerd en opgeslagen in Supabase Storage.
9. Interne e-mail wordt altijd verzonden; klantmail alleen als checkbox actief is.
10. Vervolgkeuring over 12 maanden wordt aangemaakt in planning.

## Frontend-architectuur

- `app/`: routes en schermen
- `components/inspection-form.tsx`: generieke renderer voor alle formulieren
- `lib/form-definitions.ts`: centrale bron voor formulierstructuur
- `lib/report-templates.ts`: HTML- en documenttemplates
- `lib/inspection-number.ts`: preview- en formatlogica

## Backend-architectuur

- Supabase Postgres bewaart alle stamdata en keuringshistorie
- Trigger `finalize_inspection` vult keurnummer en vervolgdatum
- Storage bucket `inspection-files` bewaart foto's, PDF en Word
- Optioneel: Supabase Edge Function of Next.js Route Handler voor documentgeneratie en mail

## Storage-strategie

- Bucket `inspection-files`
- Padstructuur: `customers/{customerId}/machines/{machineId}/inspections/{inspectionId}/...`
- Foto's worden client-side gecomprimeerd richting circa 300KB
- PDF en Word worden na genereren direct opgeslagen en aan de keuring gekoppeld

## Beveiliging en schaalbaarheid

- RLS staat aan op alle hoofdtabellen
- Eerste versie kan met één keurmeester starten
- `profiles.role` maakt uitbreiding naar meerdere gebruikers mogelijk
- Snapshotvelden in `inspections` zorgen dat oude rapporten historisch correct blijven
