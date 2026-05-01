import { stylePrinciples } from "@/lib/content-platform";

const noGoWords = [
  "manifesteren als leeg containerbegrip",
  "te veel holle beloftes",
  "algemene coachingcliches",
  "pushy verkooppraat",
  "emoji-overload"
];

const brandBeliefs = [
  "Je hoeft niet harder te werken om waardevoller te worden.",
  "Grenzen zijn geen luxe, maar leiderschap.",
  "Zachtheid zonder helderheid helpt niemand vooruit.",
  "Eerlijkheid schuurt soms, maar opent wel de juiste deur."
];

export default function StyleProfilePage() {
  return (
    <>
      <section className="hero">
        <div className="eyebrow">Style profile</div>
        <h1>Het schrijfdna van Jolanda</h1>
        <p>
          Hier leggen we vast wat de generator moet raken, bewaken en juist vermijden om niet
          generiek te worden.
        </p>
      </section>

      <section className="grid-2" style={{ marginTop: "1rem" }}>
        <article className="panel">
          <div className="eyebrow">Tone of voice</div>
          <h2>Stevige basisregels</h2>
          <div className="list compact-list">
            {stylePrinciples.map((principle) => (
              <div className="list-item static-list-item" key={principle}>
                <span>{principle}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="panel">
          <div className="eyebrow">Merkopvattingen</div>
          <h2>Wat onder de tekst ligt</h2>
          <div className="list compact-list">
            {brandBeliefs.map((belief) => (
              <div className="list-item static-list-item" key={belief}>
                <span>{belief}</span>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="grid-2" style={{ marginTop: "1rem" }}>
        <article className="panel">
          <div className="eyebrow">Verboden zone</div>
          <h2>Wat we actief willen filteren</h2>
          <div className="list compact-list">
            {noGoWords.map((item) => (
              <div className="list-item static-list-item" key={item}>
                <span>{item}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="panel">
          <div className="eyebrow">Modulair ontwerp</div>
          <h2>Klaar voor meerdere brands</h2>
          <div className="list compact-list">
            <div className="list-item static-list-item">
              <span>Per gebruiker een eigen style profile, bronnenmap en outputvoorkeuren.</span>
            </div>
            <div className="list-item static-list-item">
              <span>Meerdere stijlen per brand mogelijk, bijvoorbeeld zakelijk, mail en social.</span>
            </div>
            <div className="list-item static-list-item">
              <span>Latere uitbreiding naar teamgebruik en brand switching zonder herbouw.</span>
            </div>
          </div>
        </article>
      </section>
    </>
  );
}
