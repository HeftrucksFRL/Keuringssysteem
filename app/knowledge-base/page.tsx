import { Database, FileText, Globe, Mic, Sparkles } from "lucide-react";
import { styleSources } from "@/lib/content-platform";

const pillars = [
  {
    title: "Bronnen verzamelen",
    text: "Upload blogs, mails, captions en transcripts zodat het systeem echte schrijfsamples leert.",
    icon: FileText
  },
  {
    title: "Website indexeren",
    text: "Scrape kernpagina's en verrijk de kennislaag met proposities, CTA's en terugkerende formuleringen.",
    icon: Globe
  },
  {
    title: "Embeddings + RAG",
    text: "Chunk content, maak embeddings en haal per opdracht de meest relevante stijl- en contextfragmenten op.",
    icon: Database
  },
  {
    title: "Feedbacklus",
    text: "Bewaar likes, afkeuringen en favorieten zodat de generator steeds scherper wordt.",
    icon: Sparkles
  }
];

export default function KnowledgeBasePage() {
  return (
    <>
      <section className="hero">
        <div className="eyebrow">Knowledge base</div>
        <h1>Bronmateriaal en geheugenlaag</h1>
        <p>
          Deze module vormt de basis voor de style learning engine: alles wat Jolanda schrijft,
          zegt en goedkeurt wordt hier voorbereid voor retrieval.
        </p>
      </section>

      <section className="grid-2" style={{ marginTop: "1rem" }}>
        <article className="panel">
          <div className="eyebrow">Bronstatus</div>
          <h2>Indexeerbare content</h2>
          <div className="dataset-list">
            {styleSources.map((source) => (
              <div className="dataset-row" key={source.id}>
                <strong>{source.title}</strong>
                <span>
                  {source.type} · {source.words} woorden
                </span>
                <span>{source.note}</span>
                <span className="badge blue">{source.status}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="panel">
          <div className="eyebrow">Pipeline</div>
          <h2>Hoe de engine straks leert</h2>
          <div className="list">
            {pillars.map((pillar) => {
              const Icon = pillar.icon;
              return (
                <div className="list-item static-list-item" key={pillar.title}>
                  <span style={{ display: "flex", alignItems: "center", gap: "0.7rem" }}>
                    <Icon size={18} />
                    <strong>{pillar.title}</strong>
                  </span>
                  <span>{pillar.text}</span>
                </div>
              );
            })}
          </div>

          <div className="info-card" style={{ marginTop: "1rem" }}>
            <strong>Volgende backendstap</strong>
            <span>
              Supabase Storage + `pgvector` voor embeddings, metadata per chunk en feedbackscores.
            </span>
          </div>
        </article>
      </section>

      <section className="panel" style={{ marginTop: "1rem" }}>
        <div className="eyebrow">Toekomstige inputs</div>
        <h2>Bronnen die later toegevoegd kunnen worden</h2>
        <div className="hero-grid">
          <div className="info-card">
            <strong>Audio en video</strong>
            <span>Transcripts van podcasts, masterclasses en reels.</span>
          </div>
          <div className="info-card">
            <strong>Live feedback</strong>
            <span>Per output bewaren wat Jolanda sterk of vlak vond.</span>
          </div>
          <div className="info-card">
            <strong>Favoriete formuleringen</strong>
            <span>Veelgebruikte hooks, CTA&apos;s en tegenstellingen prioriteren.</span>
          </div>
          <div className="info-card">
            <strong>
              <Mic size={16} style={{ verticalAlign: "text-bottom", marginRight: "0.35rem" }} />
              Transcript workflows
            </strong>
            <span>Automatische transcript-import voor gesproken content.</span>
          </div>
        </div>
      </section>
    </>
  );
}
