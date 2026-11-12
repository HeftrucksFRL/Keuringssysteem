import { LoginForm } from "@/components/login-form";
import { hasSupabaseConfig } from "@/lib/env";

export default function LoginPage() {
  return (
    <section className="hero" style={{ maxWidth: "560px", margin: "0 auto" }}>
      <h1>Keuringssysteem</h1>
      <p>
        Log in met je eigen account. Gebruik op de werkplaatstablet de gebruikersnaam ‘werkplaats’ en het afgesproken wachtwoord.
      </p>
      {!hasSupabaseConfig() ? (
        <div className="panel" style={{ marginTop: "1rem" }}>
          Demo-modus is actief. Voeg Supabase-variabelen toe om echte login te gebruiken.
        </div>
      ) : null}
      <div style={{ marginTop: "1rem" }}>
        <LoginForm />
      </div>
    </section>
  );
}
