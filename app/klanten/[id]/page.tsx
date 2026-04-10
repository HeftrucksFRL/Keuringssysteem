import { fileUrl } from "@/lib/file-urls";
import { getInspectionAttachments } from "@/lib/inspection-service";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Route } from "next";
import {
  addCustomerContactAction,
  deleteCustomerContactAction,
  updateCustomerAction,
  updateCustomerContactAction
} from "@/app/klanten/actions";
import {
  getCustomerById,
  getCustomerContacts,
  getInspections,
  getMachineArchivedAt,
  getMachines,
  getMachinesForCustomer,
  getRentalsForCustomer
} from "@/lib/inspection-service";

function rentalPhase(rental: { startDate: string; endDate: string; status: "active" | "completed" }) {
  const today = new Date().toISOString().slice(0, 10);
  if (rental.status === "completed" || rental.endDate < today) {
    return "completed" as const;
  }
  if (rental.startDate > today) {
    return "upcoming" as const;
  }
  return "active" as const;
}

export default async function CustomerDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ saved?: string; created?: string; contactSaved?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const customer = await getCustomerById(id);

  if (!customer) {
    notFound();
  }

  const machines = await getMachinesForCustomer(customer.id, { includeArchived: true });
  const contacts = await getCustomerContacts(customer.id);
  const allMachines = await getMachines({ includeArchived: true });
  const rentals = await getRentalsForCustomer(customer.id);
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
        {query?.created ? <p className="form-message success">Klant toegevoegd.</p> : null}
        {query?.contactSaved ? <p className="form-message success">Contactpersoon toegevoegd.</p> : null}
        <div className="actions">
          <Link className="button" href={`/keuringen/nieuw?customerId=${customer.id}`}>
            Nieuwe keuring starten
          </Link>
          <Link className="button-secondary" href={`/machines/nieuw?customerId=${customer.id}`}>
            Machine toevoegen
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
              <label htmlFor="address">Adres</label>
              <input id="address" name="address" defaultValue={customer.address} />
            </div>
            <div className="field">
              <label htmlFor="city">Plaats</label>
              <input id="city" name="city" defaultValue={customer.city} />
            </div>
            <div className="field">
              <label htmlFor="phone">Algemeen telefoonnummer</label>
              <input id="phone" name="phone" defaultValue={customer.phone} />
            </div>
            <div className="field">
              <label htmlFor="email">Algemeen e-mailadres</label>
              <input id="email" name="email" defaultValue={customer.email} />
            </div>
          </div>
          <input type="hidden" name="contactName" value={customer.contactName} />
          <div className="actions">
            <button className="button" type="submit">
              Gegevens opslaan
            </button>
          </div>
        </form>

        <section className="panel">
          <div className="eyebrow">Contactpersonen</div>
          <h2>Alle contactpersonen</h2>
          <div className="list" style={{ marginBottom: "1rem" }}>
            {contacts.map((contact) => (
              <div className="panel" key={contact.id} style={{ padding: "1rem", marginBottom: "0.75rem" }}>
                <form action={updateCustomerContactAction}>
                  <input type="hidden" name="customerId" value={customer.id} />
                  <input type="hidden" name="contactId" value={contact.id} />
                  <div className="form-grid-wide">
                    <div className="field">
                      <label htmlFor={`contact-name-${contact.id}`}>Naam</label>
                      <input id={`contact-name-${contact.id}`} name="name" defaultValue={contact.name} />
                    </div>
                    <div className="field">
                      <label htmlFor={`contact-department-${contact.id}`}>Afdeling / functie</label>
                      <input
                        id={`contact-department-${contact.id}`}
                        name="department"
                        defaultValue={contact.department}
                        placeholder="Bijv. keuring, verhuur of planning"
                      />
                    </div>
                    <div className="field">
                      <label htmlFor={`contact-phone-${contact.id}`}>Telefoon</label>
                      <input id={`contact-phone-${contact.id}`} name="phone" defaultValue={contact.phone} />
                    </div>
                    <div className="field">
                      <label htmlFor={`contact-email-${contact.id}`}>E-mail</label>
                      <input id={`contact-email-${contact.id}`} name="email" type="email" defaultValue={contact.email} />
                    </div>
                    <div className="field">
                      <label className="status-chip" htmlFor={`contact-primary-${contact.id}`}>
                        <input
                          id={`contact-primary-${contact.id}`}
                          name="makePrimary"
                          type="checkbox"
                          defaultChecked={contact.isPrimary}
                        />
                        Maak dit de huidige contactpersoon
                      </label>
                    </div>
                  </div>
                  <div className="actions">
                    <button className="button-secondary" type="submit">
                      Contactpersoon opslaan
                    </button>
                  </div>
                </form>
                <form action={deleteCustomerContactAction}>
                  <input type="hidden" name="customerId" value={customer.id} />
                  <input type="hidden" name="contactId" value={contact.id} />
                  <div className="actions" style={{ marginTop: "0.75rem" }}>
                    <button className="button-secondary" type="submit">
                      Contactpersoon verwijderen
                    </button>
                  </div>
                </form>
              </div>
            ))}
          </div>
          <form action={addCustomerContactAction}>
            <input type="hidden" name="customerId" value={customer.id} />
            <div className="form-grid-wide">
              <div className="field">
                <label htmlFor="contact-name">Nieuwe contactpersoon</label>
                <input id="contact-name" name="name" />
              </div>
              <div className="field">
                <label htmlFor="contact-phone">Telefoon</label>
                <input id="contact-phone" name="phone" />
              </div>
              <div className="field">
                <label htmlFor="contact-department">Afdeling / functie</label>
                <input
                  id="contact-department"
                  name="department"
                  placeholder="Bijv. keuring, verhuur of planning"
                />
              </div>
              <div className="field">
                <label htmlFor="contact-email">E-mail</label>
                <input id="contact-email" name="email" type="email" />
              </div>
              <div className="field">
                <label className="status-chip" htmlFor="makePrimary">
                  <input id="makePrimary" name="makePrimary" type="checkbox" />
                  Maak dit de huidige contactpersoon
                </label>
              </div>
            </div>
            <div className="actions">
              <button className="button-secondary" type="submit">
                Contactpersoon toevoegen
              </button>
            </div>
          </form>
        </section>

        <section className="panel">
          <div className="eyebrow">Machines</div>
          <h2>Bij deze klant</h2>
          <div className="list">
            {machines.map((machine) => (
              <Link
                className="list-item"
                key={machine.id}
                href={`/machines/${machine.id}`}
                style={
                  getMachineArchivedAt(machine)
                    ? { background: "#fef3f2", borderColor: "#fecdca" }
                    : undefined
                }
              >
                <span>
                  <strong>{machine.internalNumber || machine.machineNumber}</strong>
                  <br />
                  {machine.brand} {machine.model}
                </span>
                <strong>{getMachineArchivedAt(machine) ? "Gearchiveerd" : "Open"}</strong>
              </Link>
            ))}
            {rentals
              .filter((rental) => rentalPhase(rental) === "active")
              .map((rental) => {
                const machine = allMachines.find((item) => item.id === rental.machineId);
                return (
                  <Link
                    className="list-item"
                    key={`rental-${rental.id}`}
                    href={`/machines/${rental.machineId}`}
                    style={{ background: "#ecfdf3", borderColor: "#abefc6" }}
                  >
                    <span>
                      <strong>
                        {machine
                          ? `${machine.internalNumber || machine.machineNumber} - ${machine.brand} ${machine.model}`.trim()
                          : "Verhuurde machine"}
                      </strong>
                      <br />
                      {rental.startDate} t/m {rental.endDate}
                    </span>
                    <strong>In verhuur</strong>
                  </Link>
                );
              })}
            {rentals
              .filter((rental) => rentalPhase(rental) === "upcoming")
              .map((rental) => {
                const machine = allMachines.find((item) => item.id === rental.machineId);
                return (
                  <Link
                    className="list-item"
                    key={`upcoming-rental-${rental.id}`}
                    href={`/machines/${rental.machineId}`}
                    style={{ background: "#eaf4fe", borderColor: "#b9d8f4" }}
                  >
                    <span>
                      <strong>
                        {machine
                          ? `${machine.internalNumber || machine.machineNumber} - ${machine.brand} ${machine.model}`.trim()
                          : "Aanstaande huur"}
                      </strong>
                      <br />
                      {rental.startDate} t/m {rental.endDate}
                    </span>
                    <strong>Aanstaande huur</strong>
                  </Link>
                );
              })}
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
                <span
                  className={`badge ${
                    inspection.status === "rejected"
                      ? "orange"
                      : inspection.status === "draft"
                        ? "orange"
                        : "green"
                  }`}
                >
                  {inspection.status === "rejected"
                    ? "Afgekeurd"
                    : inspection.status === "draft"
                      ? "In behandeling"
                      : "Goedgekeurd"}
                </span>
              )}
              <Link
                className="button-secondary"
                href={
                  (inspection.status === "draft"
                    ? `/keuringen/nieuw?inspectionId=${inspection.id}`
                    : `/keuringen/${inspection.id}`) as Route
                }
              >
                Keuring openen
              </Link>
            </span>
          </div>
        ))}
      </div>
      </section>
    </>
  );
}
