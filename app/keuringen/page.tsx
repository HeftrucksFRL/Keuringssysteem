import { resendInspectionMailAction } from "@/app/keuringen/actions";
import {
  getCustomers,
  getInspectionAttachments,
  getInspections,
  getMachines
} from "@/lib/inspection-service";
import Link from "next/link";
import type { Route } from "next";
import { fileUrl } from "@/lib/file-urls";

export default async function InspectionsPage({
  searchParams
}: {
  searchParams?: Promise<{ created?: string }>;
}) {
  const inspections = await getInspections();
  const customers = await getCustomers();
  const machines = await getMachines();
  const attachments = await getInspectionAttachments();
  const params = await searchParams;

  return (
    <section className="panel">
      <div className="eyebrow">Overzicht keuringen</div>
      <h1>Alle keuringen</h1>
      <p className="muted">Filters op klant, machine, datum en status komen rechtstreeks op deze dataset.</p>
      {params?.created ? (
        <p style={{ color: "var(--success)", fontWeight: 700 }}>
          Keuring {params.created} is opgeslagen, documenten zijn aangemaakt en planning is bijgewerkt.
        </p>
      ) : null}
      <div className="table-like">
        <div className="table-row table-head">
          <span>Keurnummer</span>
          <span>Klant / machine</span>
          <span>Datum</span>
          <span>Acties</span>
        </div>
        {inspections.map((inspection) => (
          <div className="table-row" key={inspection.id}>
            <span>
              <Link href={`/keuringen/${inspection.id}` as Route}>{inspection.inspectionNumber}</Link>
            </span>
            <span>
              <strong>
                {customers.find((customer) => customer.id === inspection.customerId)?.companyName ??
                  "-"}
              </strong>
              <br />
              {machines.find((machine) => machine.id === inspection.machineId)?.brand ?? "Machine"}{" "}
              {machines.find((machine) => machine.id === inspection.machineId)?.model ?? ""}
            </span>
            <span>{inspection.inspectionDate}</span>
            <span className="inline-meta">
              <span
                className={`badge ${
                  inspection.status === "rejected" ? "orange" : "green"
                }`}
              >
                {inspection.status === "rejected" ? "Afgekeurd" : "Goedgekeurd"}
              </span>
              {attachments.find(
                (attachment) =>
                  attachment.inspectionId === inspection.id && attachment.kind === "pdf"
              ) ? (
                <a
                  className="button-secondary"
                  href={fileUrl(
                    attachments.find(
                      (attachment) =>
                        attachment.inspectionId === inspection.id && attachment.kind === "pdf"
                    )!.storagePath
                  )}
                >
                  PDF
                </a>
              ) : null}
              <form action={resendInspectionMailAction}>
                <input type="hidden" name="inspection_id" value={inspection.id} />
                <button className="button-secondary" type="submit">
                  Opnieuw mailen
                </button>
              </form>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
