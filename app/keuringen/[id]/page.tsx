import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Route } from "next";
import {
  getAttachmentsForInspection,
  getCustomers,
  getInspectionById,
  getMachineById
} from "@/lib/inspection-service";
import { getFormDefinition } from "@/lib/form-definitions";
import { downloadUrl, fileUrl } from "@/lib/file-urls";

export default async function InspectionDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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
        <div className="actions">
          {pdfAttachment ? (
            <a
              className="button-secondary"
              href={fileUrl(pdfAttachment.storagePath)}
              target="_blank"
              rel="noreferrer"
            >
              PDF openen
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
              <strong>{inspection.status === "rejected" ? "Afgekeurd" : "Goedgekeurd"}</strong>
            </div>
            <div className="list-item">
              <span>Mail klant</span>
              <strong>{inspection.sendPdfToCustomer ? "Ja" : "Nee"}</strong>
            </div>
          </div>
        </article>

        <article className="panel">
          <div className="eyebrow">Afsluiting</div>
          <p><strong>Bevindingen</strong><br />{inspection.findings || "-"}</p>
          <p><strong>Aanbevelingen</strong><br />{inspection.recommendations || "-"}</p>
          <p><strong>Conclusie</strong><br />{inspection.conclusion || "-"}</p>
        </article>
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
