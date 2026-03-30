import { fileUrl } from "@/lib/file-urls";
import { getInspectionAttachments } from "@/lib/inspection-service";
import Link from "next/link";
import { notFound } from "next/navigation";
import { updateCustomerAction } from "@/app/klanten/actions";
import {
  getCustomerById,
  getInspections,
  getMachinesForCustomer
} from "@/lib/inspection-service";

export default async function CustomerDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ saved?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const customer = await getCustomerById(id);

  if (!customer) {
    notFound();
  }

  const machines = await getMachinesForCustomer(customer.id);
  const inspections = (await getInspections()).filter(
    (inspection) => inspection.customerId === customer.id
  );
  const attachments = await getInspectionAttachments();

  return (
    <>
      <section className="hero">
        <div className="eyebrow">Klantkaart</div>
        <h1>{customer.companyName}</h1>
        <p>Beheer hier de klantgegevens, machines en start direct een nieuwe keuring.</p>
        {query?.saved ? <p className="form-message success">Klant opgeslagen.</p> : null}
        <div className="actions">
          <Link className="button" href={`/keuringen/nieuw?customerId=${customer.id}`}>
            Nieuwe keuring starten
          </Link>
        </div>
      </section>

      <section className="grid-2" style={{ marginTop: "1rem" }}>
        <form action={updateCustomerAction} className="panel">
          <input type="hidden" name="id" value={customer.id} />
          <div className="eyebrow">Gegevens</div>
          <h2>Gegevens bewerken</h2>
          <div className="form-grid-wide">
            <div className="field">
              <label htmlFor="companyName">Naam</label>
              <input id="companyName" name="companyName" defaultValue={customer.companyName} />
            </div>
            <div className="field">
              <label htmlFor="contactName">Contactpersoon</label>
              <input id="contactName" name="contactName" defaultValue={customer.contactName} />
            </div>
            <div className="field">
              <label htmlFor="address">Adres</label>
              <input id="address" name="address" defaultValue={customer.address} />
            </div>
            <div className="field">
              <label htmlFor="phone">Telefoon</label>
              <input id="phone" name="phone" defaultValue={customer.phone} />
            </div>
            <div className="field">
              <label htmlFor="email">E-mail</label>
              <input id="email" name="email" defaultValue={customer.email} />
            </div>
          </div>
          <div className="actions">
            <button className="button" type="submit">
              Gegevens opslaan
            </button>
          </div>
        </form>

        <section className="panel">
          <div className="eyebrow">Machines</div>
          <h2>Bij deze klant</h2>
          <div className="list">
            {machines.map((machine) => (
              <Link className="list-item" key={machine.id} href={`/machines/${machine.id}`}>
                <span>
                  <strong>{machine.internalNumber || machine.machineNumber}</strong>
                  <br />
                  {machine.brand} {machine.model}
                </span>
                <strong>Open</strong>
              </Link>
            ))}
          </div>
        </section>
      </section>

      <section className="panel" style={{ marginTop: "1rem" }}>
        <div className="eyebrow">Historie</div>
        <h2>Recente keuringen</h2>
        <div className="table-like">
        <div className="table-row table-head">
          <span>Keurnummer</span>
          <span>Machine</span>
          <span>Datum</span>
          <span>Actie</span>
        </div>
        {inspections.map((inspection) => (
          <div className="table-row" key={inspection.id}>
            <span>{inspection.inspectionNumber}</span>
            <span>{inspection.machineSnapshot.model || inspection.machineSnapshot.brand || "-"}</span>
            <span>{inspection.inspectionDate}</span>
            <span>
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
                  target="_blank"
                  rel="noreferrer"
                >
                  Rapport openen
                </a>
              ) : (
                <span className={`badge ${inspection.status === "rejected" ? "orange" : "green"}`}>
                  {inspection.status === "rejected" ? "Afgekeurd" : "Goedgekeurd"}
                </span>
              )}
            </span>
          </div>
        ))}
      </div>
      </section>
    </>
  );
}
