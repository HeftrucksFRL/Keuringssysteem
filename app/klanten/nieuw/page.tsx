import Link from "next/link";
import { createCustomerAction } from "@/app/klanten/actions";

export default function NewCustomerPage() {
  return (
    <>
      <section className="hero">
        <div className="eyebrow">Klantenbestand</div>
        <h1>Klant toevoegen</h1>
        <p>Zet een klant alvast in het systeem, ook als de eerste keuring nog later komt.</p>
      </section>

      <form action={createCustomerAction} className="panel" style={{ marginTop: "1rem" }}>
        <div className="form-grid-wide">
          <div className="field">
            <label htmlFor="companyName">Bedrijfsnaam</label>
            <input id="companyName" name="companyName" required />
          </div>
          <div className="field">
            <label htmlFor="contactName">Contactpersoon</label>
            <input id="contactName" name="contactName" />
          </div>
          <div className="field">
            <label htmlFor="address">Adres</label>
            <input id="address" name="address" />
          </div>
          <div className="field">
            <label htmlFor="city">Plaats</label>
            <input id="city" name="city" />
          </div>
          <div className="field">
            <label htmlFor="phone">Algemeen telefoonnummer</label>
            <input id="phone" name="phone" />
          </div>
          <div className="field">
            <label htmlFor="email">Algemeen e-mailadres</label>
            <input id="email" name="email" type="email" />
          </div>
        </div>
        <div className="actions">
          <button className="button" type="submit">
            Klant toevoegen
          </button>
          <Link className="button-secondary" href="/klanten">
            Terug naar klanten
          </Link>
        </div>
      </form>
    </>
  );
}
