export function hasSupabaseConfig() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
      process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

export const appConfig = {
  companyName: process.env.COMPANY_NAME ?? "Heftrucks Friesland",
  defaultInspector: process.env.DEFAULT_INSPECTOR ?? "Age Terpstra",
  mailFrom:
    process.env.MAIL_FROM ?? "Keuringen Heftrucks Friesland <info@heftrucks.frl>",
  mailReplyTo: process.env.MAIL_REPLY_TO ?? "info@heftrucks.frl",
  mailInternalTo: process.env.MAIL_INTERNAL_TO ?? "keuringen@heftrucks.frl"
};
