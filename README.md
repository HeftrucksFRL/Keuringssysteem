# Keuringssysteem

Professionele webapplicatie voor digitale keuringen van intern transportmaterieel, ingericht voor Next.js op Vercel en Supabase als backend.

## Wat zit er in deze basis

- Mobile-first Next.js App Router interface
- Centrale formulierdefinities voor 8 keuringssoorten
- Supabase datamodel en SQL schema
- Keurnummerlogica per jaar, oplopend ongeacht type
- Basis voor PDF- en Word-templates
- Werkende server action voor keuring opslaan
- Mailteksten en documentworkflow
- Schermen voor dashboard, klanten, machines, planning en keuringen
- Demo fallback zonder Supabase via lokale `.data/demo-db.json`
- Machinedossiers en keuringsdetailpagina's met historie
- Echte mailverzending via Resend zodra `RESEND_API_KEY` aanwezig is
- Supabase Auth login/logout met beschermde routes
- Fotouploads met compressie en opslag per keuring

## Projectstructuur

- `app/` schermen en routes
- `components/` herbruikbare UI zoals het generieke keuringsformulier
- `lib/` domeinlogica, formulierdefinities en templates
- `supabase/schema.sql` database-opzet
- `supabase/storage.sql` storage bucket en policies
- `docs/architectuur.md` architectuurkeuzes
- `docs/formulier-mapping.md` mapping van bronformulieren naar data
- `docs/deploy.md` stap-voor-stap livegang
- `docs/production-checklist.md` productiecontrole

## Benodigde environment variables

Zie [`.env.example`](/C:/Users/Admin/Documents/Age%20documenten/Keuringssysteem/.env.example).

Belangrijk:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY`
- `MAIL_FROM`
- `MAIL_REPLY_TO`
- `MAIL_INTERNAL_TO`

## Supabase opzetten

1. Maak een nieuw Supabase-project aan.
2. Voer [schema.sql](/C:/Users/Admin/Documents/Age%20documenten/Keuringssysteem/supabase/schema.sql) uit in de SQL editor.
3. Voer daarna [storage.sql](/C:/Users/Admin/Documents/Age%20documenten/Keuringssysteem/supabase/storage.sql) uit.
4. Zet Auth op e-mail login of magic link.
5. Voeg de project URL en keys toe aan `.env.local`.

## Vercel deploy

1. Push het project naar GitHub.
2. Importeer de repository in Vercel.
3. Voeg dezelfde environment variables toe in Vercel.
4. Deploy.

Er is geen extra serverconfiguratie nodig; de applicatie is opgezet voor standaard Next.js deployment.

Voor de volledige livegang volg je [deploy.md](/C:/Users/Admin/Documents/Age%20documenten/Keuringssysteem/docs/deploy.md).

## Documenten en demo-opslag

- In lokale demo-modus worden keuringen opgeslagen in `.data/demo-db.json`
- Gegenereerde rapporten komen in `generated/<jaar>/<keurnummer>/`
- Gecomprimeerde keuringsfoto's komen lokaal in `uploads/inspections/<inspectionId>/`
- Zodra Supabase is geconfigureerd, worden data uit de database gelezen en documenten naar Storage bucket `inspection-files` geüpload
- Bij ingestelde `RESEND_API_KEY` wordt intern het Word-bestand gemaild en optioneel de PDF naar de klant

## Authenticatie

- Zodra Supabase-variabelen zijn ingesteld, beschermt `middleware.ts` de applicatie
- Loginpagina staat op `/login`
- Demo-modus blijft zonder Supabase toegankelijk voor snelle lokale tests

## Aanbevolen vervolgstappen

1. Dependencies installeren met `npm install`
2. Route handlers toevoegen voor echte opslag, documentgeneratie en mailverzending
3. Logo-assets toevoegen voor `heftrucks.frl` en BMWT
4. Formuliervelden verder finetunen per documentlay-out
