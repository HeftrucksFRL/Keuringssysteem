import { canManageCleanup, requireUser } from "@/lib/auth";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Route } from "next";
import {
  addCustomerContactAction,
  addCustomerLocationAction,
  cleanupMoveMachineAction,
  deleteCustomerAction,
  deleteCustomerContactAction,
  deleteCustomerLocationAction,
  updateCustomerAction,
  updateCustomerLocationAction,
  updateCustomerContactAction
} from "@/app/klanten/actions";
import {
  getCustomerById,
  getCustomerContacts,
  getInspectionAttachmentsForInspections,
  getInspectionsForCustomer,
  getMachineArchivedAt,
  getMachinesForCustomer,
  getMachineSummaries,
  getRentalsForCustomer,
  getVisibleCustomers
} from "@/lib/inspection-service";
import {
  formatMachineBrandTypeSerial,
  formatMachineKindBrandType,
  getMachineLocation
} from "@/lib/machine-presentation";
import { formatDisplayDate } from "@/lib/utils";
import { CustomerPicker } from "@/components/customer-picker";
import { CustomerInspectionHistory } from "@/components/customer-inspection-history";

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
  searchParams?: Promise<{
    saved?: string;
    created?: string;
    contactSaved?: string;
    cleanupMoved?: string;
    locationSaved?: string;
    error?: string;
  }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const currentUser = await requireUser();
  const showCleanupTools = canManageCleanup(currentUser);
  const customer = await getCustomerById(id);

  if (!customer) {
    notFound();
  }

  const machines = await getMachinesForCustomer(customer.id, { includeArchived: true });
  const locations = customer.locations ?? [];
  const contacts = await getCustomerContacts(customer.id);
  const assignableCustomers = (await getVisibleCustomers()).filter(
    (item) => item.id !== customer.id
  );
  const rentals = await getRentalsForCustomer(customer.id);
  const rentalMachineIds = Array.from(new Set(rentals.map((rental) => rental.machineId)));
  const allMachines =
    rentalMachineIds.length > 0
      ? await getMachineSummaries({ ids: rentalMachineIds, includeArchived: true })
      : machines;
  const inspections = await getInspectionsForCustomer(customer.id);
  const attachments = await getInspectionAttachmentsForInspections(
    inspections.map((inspection) => inspection.id)
  );
  const machinesByLocation = new Map<string, typeof machines>();
  for (const location of locations) {
    machinesByLocation.set(location.id, []);
  }
  const machinesWithoutLocation: typeof machines = [];
  for (const machine of machines) {
    const locationId = machine.configuration.customer_location_id;
    if (locationId && machinesByLocation.has(locationId)) {
      machinesByLocation.get(locationId)!.push(machine);
    } else {
      machinesWithoutLocation.push(machine);
    }
  }

  return (
    <>
      <section className="hero">
        <div className="eyebrow">Klantkaart</div>
        <h1>{customer.companyName}</h1>
        <p>Beheer hier de klantgegevens, machines en start direct een nieuwe keuring.</p>
        {query?.saved ? <p className="form-message success">Klant opgeslagen.</p> : null}
        {query?.created ? <p className="form-message success">Klant toegevoegd.</p> : null}
        {query?.contactSaved ? <p className="form-message success">Contactpersoon toegevoegd.</p> : null}
        {query?.locationSaved ? <p className="form-message success">Locatie opgeslagen.</p> : null}
        {query?.cleanupMoved ? (
          <p className="form-message success">Machine en gekoppelde historie zijn verplaatst.</p>
        ) : null}
        {query?.error ? <p className="form-message error">{decodeURIComponent(query.error)}</p> : null}
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
          <div className="compact-contact-list">
            {contacts.map((contact) => (
              <details className="compact-contact-item" key={contact.id}>
                <summary className="compact-contact-summary">
                  <div className="compact-contact-main">
                    <strong>{contact.name}</strong>
                    {contact.department ? <span>{contact.department}</span> : null}
                  </div>
                  <div className="compact-contact-meta">
                    {contact.phone ? <span>{contact.phone}</span> : null}
                    {contact.email ? <span>{contact.email}</span> : null}
                    {contact.isPrimary ? <span className="badge blue">Huidig</span> : null}
                    <span className="compact-contact-trigger">Bewerken</span>
                  </div>
                </summary>
                <div className="compact-contact-body">
                  <form action={updateCustomerContactAction}>
                    <input type="hidden" name="customerId" value={customer.id} />
                    <input type="hidden" name="contactId" value={contact.id} />
                    <div className="compact-contact-fields">
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
                    </div>
                    <div className="compact-contact-actions">
                      <label className="status-chip" htmlFor={`contact-primary-${contact.id}`}>
                        <input
                          id={`contact-primary-${contact.id}`}
                          name="makePrimary"
                          type="checkbox"
                          defaultChecked={contact.isPrimary}
                        />
                        Maak dit de huidige contactpersoon
                      </label>
                      <button className="button-secondary" type="submit">
                        Opslaan
                      </button>
                    </div>
                  </form>
                  <form action={deleteCustomerContactAction}>
                    <input type="hidden" name="customerId" value={customer.id} />
                    <input type="hidden" name="contactId" value={contact.id} />
                    <div className="compact-contact-actions">
                      <button className="button-secondary" type="submit">
                        Verwijderen
                      </button>
                    </div>
                  </form>
                </div>
              </details>
            ))}
            <details className="compact-contact-item compact-contact-add">
              <summary className="compact-contact-summary">
                <div className="compact-contact-main">
                  <strong>Contactpersoon toevoegen</strong>
                </div>
                <div className="compact-contact-meta">
                  <span className="compact-contact-trigger">Nieuw</span>
                </div>
              </summary>
              <div className="compact-contact-body">
                <form action={addCustomerContactAction}>
                  <input type="hidden" name="customerId" value={customer.id} />
                  <div className="compact-contact-fields">
                    <div className="field">
                      <label htmlFor="contact-name">Naam</label>
                      <input id="contact-name" name="name" />
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
                      <label htmlFor="contact-phone">Telefoon</label>
                      <input id="contact-phone" name="phone" />
                    </div>
                    <div className="field">
                      <label htmlFor="contact-email">E-mail</label>
                      <input id="contact-email" name="email" type="email" />
                    </div>
                  </div>
                  <div className="compact-contact-actions">
                    <label className="status-chip" htmlFor="makePrimary">
                      <input id="makePrimary" name="makePrimary" type="checkbox" />
                      Maak dit de huidige contactpersoon
                    </label>
                    <button className="button-secondary" type="submit">
                      Toevoegen
                    </button>
                  </div>
                </form>
              </div>
            </details>
          </div>
        </section>

        <section className="panel">
          <div className="eyebrow">Locaties</div>
          <h2>Werk- en afleverlocaties</h2>
          <div className="compact-contact-list">
            {locations.map((location) => (
              <details className="compact-contact-item" key={location.id}>
                <summary className="compact-contact-summary">
                  <div className="compact-contact-main">
                    <strong>{location.name}</strong>
                    <span>{[location.address, location.city].filter(Boolean).join(", ") || "-"}</span>
                  </div>
                  <div className="compact-contact-meta">
                    {location.isPrimary ? <span className="badge blue">Hoofdlocatie</span> : null}
                    <span>{machinesByLocation.get(location.id)?.length ?? 0} machines</span>
                    <span className="compact-contact-trigger">Bewerken</span>
                  </div>
                </summary>
                <div className="compact-contact-body">
                  <form action={updateCustomerLocationAction}>
                    <input type="hidden" name="customerId" value={customer.id} />
                    <input type="hidden" name="locationId" value={location.id} />
                    <div className="compact-contact-fields">
                      <div className="field">
                        <label htmlFor={`location-name-${location.id}`}>Locatienaam</label>
                        <input id={`location-name-${location.id}`} name="name" defaultValue={location.name} />
                      </div>
                      <div className="field">
                        <label htmlFor={`location-address-${location.id}`}>Adres</label>
                        <input id={`location-address-${location.id}`} name="address" defaultValue={location.address} />
                      </div>
                      <div className="field">
                        <label htmlFor={`location-city-${location.id}`}>Plaats</label>
                        <input id={`location-city-${location.id}`} name="city" defaultValue={location.city} />
                      </div>
                      <div className="field">
                        <label htmlFor={`location-notes-${location.id}`}>Notitie</label>
                        <input id={`location-notes-${location.id}`} name="notes" defaultValue={location.notes} />
                      </div>
                    </div>
                    <div className="compact-contact-actions">
                      <label className="status-chip" htmlFor={`location-primary-${location.id}`}>
                        <input
                          id={`location-primary-${location.id}`}
                          name="makePrimary"
                          type="checkbox"
                          defaultChecked={location.isPrimary}
                        />
                        Hoofdlocatie
                      </label>
                      <button className="button-secondary" type="submit">
                        Opslaan
                      </button>
                    </div>
                  </form>
                  <form action={deleteCustomerLocationAction}>
                    <input type="hidden" name="customerId" value={customer.id} />
                    <input type="hidden" name="locationId" value={location.id} />
                    <div className="compact-contact-actions">
                      <button className="button-secondary" type="submit">
                        Verwijderen
                      </button>
                    </div>
                  </form>
                </div>
              </details>
            ))}
            <details className="compact-contact-item compact-contact-add">
              <summary className="compact-contact-summary">
                <div className="compact-contact-main">
                  <strong>Locatie toevoegen</strong>
                </div>
                <div className="compact-contact-meta">
                  <span className="compact-contact-trigger">Nieuw</span>
                </div>
              </summary>
              <div className="compact-contact-body">
                <form action={addCustomerLocationAction}>
                  <input type="hidden" name="customerId" value={customer.id} />
                  <div className="compact-contact-fields">
                    <div className="field">
                      <label htmlFor="location-name">Locatienaam</label>
                      <input id="location-name" name="name" placeholder="Bijv. Werkplaats, loods 2" />
                    </div>
                    <div className="field">
                      <label htmlFor="location-address">Adres</label>
                      <input id="location-address" name="address" />
                    </div>
                    <div className="field">
                      <label htmlFor="location-city">Plaats</label>
                      <input id="location-city" name="city" />
                    </div>
                    <div className="field">
                      <label htmlFor="location-notes">Notitie</label>
                      <input id="location-notes" name="notes" />
                    </div>
                  </div>
                  <div className="compact-contact-actions">
                    <label className="status-chip" htmlFor="location-make-primary">
                      <input id="location-make-primary" name="makePrimary" type="checkbox" />
                      Hoofdlocatie
                    </label>
                    <button className="button-secondary" type="submit">
                      Toevoegen
                    </button>
                  </div>
                </form>
              </div>
            </details>
          </div>
        </section>

        <section className="panel">
          <div className="eyebrow">Machines</div>
          <h2>Bij deze klant per locatie</h2>
          <div className="list">
            {locations.map((location) => (
              <details className="compact-contact-item" key={`machines-${location.id}`} open>
                <summary className="compact-contact-summary">
                  <div className="compact-contact-main">
                    <strong>{location.name}</strong>
                    <span>{[location.address, location.city].filter(Boolean).join(", ") || "-"}</span>
                  </div>
                  <div className="compact-contact-meta">
                    <span>{machinesByLocation.get(location.id)?.length ?? 0} machines</span>
                    <Link
                      className="button-secondary"
                      href={`/machines/nieuw?customerId=${customer.id}&locationId=${location.id}` as Route}
                    >
                      Machine toevoegen
                    </Link>
                  </div>
                </summary>
                <div className="compact-contact-body">
                  <div className="list">
                    {(machinesByLocation.get(location.id) ?? []).map((machine) => (
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
                          <strong>
                            {machine.machineType === "batterij_lader" || machine.machineType === "stellingmateriaal"
                              ? formatMachineKindBrandType(machine)
                              : formatMachineBrandTypeSerial(machine)}
                          </strong>
                          <br />
                          {[
                            machine.machineType === "batterij_lader"
                              ? ""
                              : machine.internalNumber || machine.machineNumber,
                            machine.machineType === "batterij_lader" ? "" : machine.serialNumber
                          ]
                            .filter(Boolean)
                            .join(" | ")}
                        </span>
                        <strong>{getMachineArchivedAt(machine) ? "Gearchiveerd" : "Open"}</strong>
                      </Link>
                    ))}
                    {(machinesByLocation.get(location.id) ?? []).length === 0 ? (
                      <div className="list-item">
                        <span>Geen machines op deze locatie.</span>
                        <strong>-</strong>
                      </div>
                    ) : null}
                  </div>
                </div>
              </details>
            ))}
            <details className="compact-contact-item" open>
              <summary className="compact-contact-summary">
                <div className="compact-contact-main">
                  <strong>Zonder locatie</strong>
                  <span>Machines die nog niet aan een klantlocatie gekoppeld zijn.</span>
                </div>
                <div className="compact-contact-meta">
                  <span>{machinesWithoutLocation.length} machines</span>
                  <Link className="button-secondary" href={`/machines/nieuw?customerId=${customer.id}` as Route}>
                    Machine toevoegen
                  </Link>
                </div>
              </summary>
              <div className="compact-contact-body">
                <div className="list">
            {machinesWithoutLocation.map((machine) => (
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
                      <strong>
                        {machine.machineType === "batterij_lader" || machine.machineType === "stellingmateriaal"
                          ? formatMachineKindBrandType(machine)
                          : formatMachineBrandTypeSerial(machine)}
                      </strong>
                      <br />
                      {[
                        `Locatie: ${getMachineLocation(machine) || "-"}`,
                        machine.machineType === "batterij_lader" ? "" : machine.internalNumber || machine.machineNumber
                      ]
                        .filter(Boolean)
                        .join(" | ")}
                    </span>
                    <strong>
                  {getMachineArchivedAt(machine)
                    ? machine.machineType === "batterij_lader"
                      ? "Batterij en/of lader gearchiveerd"
                      : "Machine gearchiveerd"
                    : "Open"}
                </strong>
              </Link>
            ))}
            {machinesWithoutLocation.length === 0 ? (
              <div className="list-item">
                <span>Geen machines zonder locatie.</span>
                <strong>-</strong>
              </div>
            ) : null}
                </div>
              </div>
            </details>
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
                          ? machine.machineType === "batterij_lader" || machine.machineType === "stellingmateriaal"
                            ? formatMachineKindBrandType(machine)
                            : formatMachineBrandTypeSerial(machine)
                          : "Verhuurde machine"}
                      </strong>
                      <br />
                      {[`Locatie: ${machine ? getMachineLocation(machine) || "-" : "-"}`, `${formatDisplayDate(rental.startDate)} t/m ${formatDisplayDate(rental.endDate)}`]
                        .filter(Boolean)
                        .join(" | ")}
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
                          ? machine.machineType === "batterij_lader" || machine.machineType === "stellingmateriaal"
                            ? formatMachineKindBrandType(machine)
                            : formatMachineBrandTypeSerial(machine)
                          : "Aanstaande huur"}
                      </strong>
                      <br />
                      {[`Locatie: ${machine ? getMachineLocation(machine) || "-" : "-"}`, `${formatDisplayDate(rental.startDate)} t/m ${formatDisplayDate(rental.endDate)}`]
                        .filter(Boolean)
                        .join(" | ")}
                    </span>
                    <strong>Aanstaande huur</strong>
                  </Link>
                );
              })}
          </div>
        </section>
      </section>

      {showCleanupTools ? (
      <section className="panel" style={{ marginTop: "1rem" }}>
        <div className="eyebrow">Tijdelijk opschonen</div>
        <h2>Machines verplaatsen en dubbele klant opruimen</h2>
        <p className="muted">
          Gebruik dit alleen voor de import-opschoning. Deze actie verplaatst ook de
          gekoppelde keuringshistorie van deze machine mee van deze klant naar de nieuwe klant
          of naar voorraad.
        </p>
        <div className="list" style={{ marginTop: "1rem" }}>
          {machines.length === 0 ? (
            <div className="list-item">
              <span>Geen machines meer gekoppeld aan deze klant.</span>
              <strong>Klaar om op te ruimen</strong>
            </div>
          ) : (
            machines.map((machine) => (
              <div className="list-item" key={`cleanup-${machine.id}`} style={{ display: "block" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "1rem",
                    alignItems: "center",
                    flexWrap: "wrap"
                  }}
                >
                  <span>
                    <strong>
                      {machine.machineType === "batterij_lader" || machine.machineType === "stellingmateriaal"
                        ? formatMachineKindBrandType(machine)
                        : machine.internalNumber || machine.machineNumber}
                    </strong>
                    <br />
                    {machine.machineType === "batterij_lader" || machine.machineType === "stellingmateriaal"
                      ? ""
                      : `${machine.brand} ${machine.model}`}
                  </span>
                  <Link className="button-secondary" href={`/machines/${machine.id}`}>
                    Open machinekaart
                  </Link>
                </div>
                {!getMachineArchivedAt(machine) ? (
                  <div className="grid-2" style={{ marginTop: "0.85rem" }}>
                    <form action={cleanupMoveMachineAction}>
                      <input type="hidden" name="machineId" value={machine.id} />
                      <input type="hidden" name="returnTo" value={`/klanten/${customer.id}`} />
                      <CustomerPicker
                        customers={assignableCustomers}
                        defaultCustomerId=""
                        label="Verplaats naar klant"
                        required
                      />
                      <div className="actions">
                        <button className="button-secondary" type="submit">
                          Verplaatsen
                        </button>
                      </div>
                    </form>
                    <form action={cleanupMoveMachineAction}>
                      <input type="hidden" name="machineId" value={machine.id} />
                      <input type="hidden" name="moveToStock" value="1" />
                      <input type="hidden" name="returnTo" value={`/klanten/${customer.id}`} />
                      <div className="field">
                        <label>Voorraad</label>
                        <div className="selected-summary">
                          <strong>Eigen voorraad</strong>
                          <span>Zet deze machine terug op voorraad en neem de historie mee.</span>
                        </div>
                      </div>
                      <div className="actions">
                        <button className="button-secondary" type="submit">
                          Naar voorraad
                        </button>
                      </div>
                    </form>
                  </div>
                ) : (
                  <p className="muted" style={{ marginTop: "0.75rem" }}>
                    Deze machine is gearchiveerd en kan niet meer via de opschoonactie worden verplaatst.
                  </p>
                )}
              </div>
            ))
          )}
        </div>
        <div
          style={{
            marginTop: "1rem",
            paddingTop: "1rem",
            borderTop: "1px solid var(--line)",
            display: "flex",
            justifyContent: "space-between",
            gap: "1rem",
            alignItems: "center",
            flexWrap: "wrap"
          }}
        >
          <div>
            <strong>Dubbele klant verwijderen</strong>
            <p className="muted" style={{ marginTop: "0.35rem" }}>
              Dit lukt alleen als er geen machines, keuringen, planning of verhuur meer aan deze klant hangen.
            </p>
          </div>
          <form action={deleteCustomerAction}>
            <input type="hidden" name="customerId" value={customer.id} />
            <button className="button-secondary" type="submit">
              Klant verwijderen
            </button>
          </form>
        </div>
      </section>
      ) : null}

      <section className="panel" style={{ marginTop: "1rem" }}>
        <div className="eyebrow">Historie</div>
        <h2>Recente keuringen</h2>
        <CustomerInspectionHistory inspections={inspections} attachments={attachments} />
      </section>
    </>
  );
}
