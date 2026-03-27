import { InspectionForm } from "@/components/inspection-form";

export default function NewInspectionPage() {
  return (
    <>
      <section className="hero">
        <div className="eyebrow">Workflow</div>
        <h1>Nieuwe keuring</h1>
        <p>
          De flow volgt exact: klant kiezen of aanmaken, machine kiezen of aanmaken,
          type kiezen, formulier invullen, opslaan en daarna automatisch documenten,
          mail en planning bijwerken.
        </p>
      </section>
      <div style={{ marginTop: "1rem" }}>
        <InspectionForm />
      </div>
    </>
  );
}
