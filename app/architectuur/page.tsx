import Link from "next/link";

export default function ArchitecturePage() {
  return (
    <section className="panel">
      <div className="eyebrow">Architectuur</div>
      <h1>Next.js + Supabase opzet</h1>
      <div className="list">
        <div className="list-item">
          <span>Frontend</span>
          <strong>Next.js App Router op Vercel</strong>
        </div>
        <div className="list-item">
          <span>Backend</span>
          <strong>Supabase Postgres, Storage, Auth en Edge-ready workflows</strong>
        </div>
        <div className="list-item">
          <span>Documenten</span>
          <strong>PDF voor klant, Word voor intern archief</strong>
        </div>
        <div className="list-item">
          <span>Mail</span>
          <strong>Resend met vaste afzender en optionele klantmail</strong>
        </div>
      </div>
      <div className="actions">
        <Link className="button" href="/keuringen/nieuw">
          Formulier bekijken
        </Link>
      </div>
    </section>
  );
}
