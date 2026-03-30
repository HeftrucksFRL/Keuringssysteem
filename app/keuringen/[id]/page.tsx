import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Route } from "next";
import { updateInspectionAction } from "@/app/keuringen/actions";
import {
  getAttachmentsForInspection,
  getCustomers,
  getInspectionById,
  getMachineById
} from "@/lib/inspection-service";
import { getFormDefinition } from "@/lib/form-definitions";
import { downloadUrl, fileUrl } from "@/lib/file-urls";

export default async function InspectionDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ saved?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const inspection = await getInspectionById(id);

  if (!inspection) {
    notFound();
  }

  const customer = (await getCustomers()).find(
    (item) => item.id === inspection.customerId
  );
  const machine = await getMachineById(inspection.machineId);
  const attachments = await getAttachmentsForInspection(inspection.id);
  const form = getFormDefinition(inspection.machineType);
  const photos = attachments.filter((attachment) => attachment.kind === "photo");
  const pdfAttachment = attachments.find((attachment) => attachment.kind === "pdf");
  const wordAttachment = attachments.find((attachment) => attachment.kind === "word");

  return (
    <>
      <section className="hero">
        <div className="eyebrow">Keuringsdossier</div>
        <h1>Keuring {inspection.inspectionNumber}</h1>
        <p>
          {customer?.companyName ?? "-"} | {machine?.brand ?? ""} {machine?.model ?? ""}
        </p>
        {query?.saved ? <p className="form-message success">Keuring opgeslagen.</p> : null}
        <div className="actions">
          {pdfAttachment ? (
            <a
              className="button-secondary"
              href={fileUrl(pdfAttachment.storagePath)}
              target="_blank"
              rel="noreferrer"
            >
              Rapport openen
            </a>
          ) : null}
          {wordAttachment ? (
            <a
              className="button-secondary"
              href={downloadUrl(wordAttachment.storagePath)}
            >
              Word openen
            </a>
          ) : null}
          {machine ? (
            <Link className="button" href={`/machines/${machine.id}` as Route}>
              Naar machinedossier
            </Link>
          ) : null}
        </div>
      </section>

      <section className="grid-2" style={{ marginTop: "1rem" }}>
        <article className="panel">
          <div className="eyebrow">Samenvatting</div>
          <div className="list">
            <div className="list-item">
              <span>Datum</span>
              <strong>{inspection.inspectionDate}</strong>
            </div>
            <div className="list-item">
              <span>Vervolgdatum</span>
              <strong>{inspection.nextInspectionDate}</strong>
            </div>
            <div className="list-item">
              <span>Status</span>
              <strong>
                {inspection.status === "rejected"
                  ? "Afgekeurd"
                  : inspection.status === "draft"
                    ? "Concept"
                    : inspection.status === "completed"
                      ? "Afgerond"
                      : "Goedgekeurd"}
              </strong>
            </div>
            <div className="list-item">
              <span>Mail klant</span>
              <strong>{inspection.sendPdfToCustomer ? "Ja" : "Nee"}</strong>
            </div>
          </div>
        </article>

        <form action={updateInspectionAction} className="panel">
          <input type="hidden" name="id" value={inspection.id} />
          <div className="eyebrow">Aanpassen</div>
          <h2>Keuring bijwerken</h2>
          <div className="form-grid-wide">
            <div className="field">
              <label htmlFor="inspectionDate">Keuringsdatum</label>
              <input id="inspectionDate" name="inspectionDate" type="date" defaultValue={inspection.inspectionDate} />
            </div>
            <div className="field">
              <label htmlFor="status">Status</label>
              <select id="status" name="status" defaultValue={inspection.status}>
                <option value="draft">Concept</option>
                <option value="approved">Goedgekeurd</option>
                <option value="rejected">Afgekeurd</option>
                <option value="completed">Afgerond</option>
              </select>
            </div>
          </div>
          <div className="field">
            <label htmlFor="findings">Bevindingen</label>
            <textarea id="findings" name="findings" defaultValue={inspection.findings} />
          </div>
          <div className="field">
            <label htmlFor="recommendations">Aanbevelingen</label>
            <textarea id="recommendations" name="recommendations" defaultValue={inspection.recommendations} />
          </div>
          <div className="field">
            <label htmlFor="conclusion">Conclusie</label>
            <textarea id="conclusion" name="conclusion" defaultValue={inspection.conclusion} />
          </div>
          <div className="field">
            <label className="status-chip" htmlFor="sendPdfToCustomer">
              <input
                id="sendPdfToCustomer"
                name="sendPdfToCustomer"
                type="checkbox"
                defaultChecked={inspection.sendPdfToCustomer}
              />
              PDF naar klant mailen
            </label>
          </div>
          <div className="actions">
            <button className="button" type="submit">
              Keuring opslaan
            </button>
          </div>
        </form>
      </section>

      {photos.length > 0 ? (
        <section className="panel" style={{ marginTop: "1rem" }}>
          <div className="eyebrow">Foto&apos;s</div>
          <h2>Fotodossier</h2>
          <div className="grid-3">
            {photos.map((photo) => (
              <a
                className="panel"
                key={photo.id}
                href={fileUrl(photo.storagePath)}
                style={{ padding: "0.75rem" }}
              >
                <Image
                  alt={photo.fileName}
                  src={fileUrl(photo.storagePath)}
                  width={640}
                  height={440}
                  unoptimized
                  style={{
                    width: "100%",
                    height: "220px",
                    objectFit: "cover",
                    borderRadius: "16px",
                    display: "block"
                  }}
                />
                <p className="muted" style={{ marginBottom: 0 }}>
                  {photo.fileName}
                </p>
              </a>
            ))}
          </div>
        </section>
      ) : null}

      <section className="panel" style={{ marginTop: "1rem" }}>
        <div className="eyebrow">Checklist</div>
        <h2>{form.title}</h2>
        <div className="checklist">
          {form.sections.map((section) => (
            <div className="section-card" key={section.key}>
              <h3>{section.title}</h3>
              <div className="list">
                {section.items.map((item) => (
                  <div className="list-item" key={item.key}>
                    <span>{item.label}</span>
                    <strong>{inspection.checklist[item.key] ?? "n.v.t."}</strong>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
