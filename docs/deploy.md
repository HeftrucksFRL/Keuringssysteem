# Deploy

## 1. GitHub

1. Maak een nieuwe repository aan.
2. Zet alle projectbestanden in de repository.
3. Push de code naar `main`.
4. Controleer in GitHub Actions dat de workflow uit [ci.yml](/C:/Users/Admin/Documents/Age%20documenten/Keuringssysteem/.github/workflows/ci.yml) groen is.

## 2. Supabase

1. Maak een nieuw Supabase-project aan.
2. Voer eerst [schema.sql](/C:/Users/Admin/Documents/Age%20documenten/Keuringssysteem/supabase/schema.sql) uit.
3. Voer daarna [storage.sql](/C:/Users/Admin/Documents/Age%20documenten/Keuringssysteem/supabase/storage.sql) uit.
4. Zet in Auth minimaal e-mail/password aan.
5. Maak een eerste gebruiker aan voor Age Terpstra.

## 3. Vercel

1. Importeer de GitHub repository in Vercel.
2. Framework wordt automatisch als Next.js herkend.
3. Voeg alle environment variables uit [`.env.example`](/C:/Users/Admin/Documents/Age%20documenten/Keuringssysteem/.env.example) toe.
4. Deploy naar production.

## 4. Vereiste environment variables

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY`
- `MAIL_FROM`
- `MAIL_REPLY_TO`
- `MAIL_INTERNAL_TO`
- `COMPANY_NAME`
- `DEFAULT_INSPECTOR`

## 5. Na livegang controleren

1. Inloggen via `/login`
2. Nieuwe keuring opslaan
3. PDF en Word openen vanuit dossier
4. Foto uploaden en openen
5. Mail-event controleren
6. Planningregel controleren

## 6. Aanbevolen eerste live test

1. Maak 1 testklant aan
2. Maak 1 testmachine aan
3. Rond 1 keuring volledig af
4. Controleer of keurnummer, documenten, mail en planning allemaal kloppen
