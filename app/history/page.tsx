import { generationHistory } from "@/lib/content-platform";

export default function HistoryPage() {
  return (
    <>
      <section className="hero">
        <div className="eyebrow">History</div>
        <h1>Gegenereerde content en feedback</h1>
        <p>
          Een overzicht van eerdere outputs, favorieten en versies die zijn aangescherpt met
          feedback van Jolanda.
        </p>
      </section>

      <section className="panel" style={{ marginTop: "1rem" }}>
        <div className="eyebrow">Recente generatie</div>
        <h2>Outputlog</h2>
        <div className="dataset-list">
          {generationHistory.map((item) => (
            <div className="dataset-row" key={item.id}>
              <strong>{item.title}</strong>
              <span>
                {item.mode} · {item.createdAt}
              </span>
              <span>{item.summary}</span>
              <span className="badge green">{item.status}</span>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
