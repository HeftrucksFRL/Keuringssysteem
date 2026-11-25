-- Transportvrijgave na kantoorcontrole, onafhankelijk van factuur/betaling.
-- Installeer na workshop-archive-bin.sql. Verandert geen werkbonnen of betaalgegevens.
begin;
select pg_advisory_xact_lock(72190411);
do $migration$
declare definition text;
begin
 definition:=pg_get_functiondef('public.save_workshop_changes(jsonb,jsonb,uuid,jsonb)'::regprocedure);
 definition:=replace(definition,$old$ or j.data->>'invoicePaidAt' is null$old$,'');
 definition:=replace(definition,'Transport heeft een geldige chauffeur, kantoorcontrole en betaling nodig.','Transport heeft een geldige chauffeur en kantoorcontrole nodig.');
 execute definition;
end $migration$;
notify pgrst,'reload schema';
commit;
