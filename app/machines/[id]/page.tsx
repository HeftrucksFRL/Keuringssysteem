import Link from "next/link";
import { notFound } from "next/navigation";
import type { Route } from "next";
import type { MachineRecord } from "@/lib/domain";
import { completeRentalAction, createRentalAction } from "@/app/verhuur/actions";
import {
  archiveMachineAction,
  assignMachineToCustomerAction,
  unarchiveMachineAction,
  updateMachineAction
} from "@/app/machines/actions";
import { CustomerPicker } from "@/components/customer-picker";
import {
  getAttachmentsForInspection,
  getMachineArchivedAt,
  getMachineArchiveLockDate,
  getCustomers,
  getMachineById,
  getMachineHistory,
  getRentalsForMachine,
  isMachineArchiveLocked,
  isRentalStockCustomer
} from "@/lib/inspection-service";
import { fileUrl } from "@/lib/file-urls";
import { titleCase } from "@/lib/utils";
import { MachineTypeFields } from "@/components/machine-type-fields";

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

function formatDate(value?: Date | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("nl-NL").format(value);
}

function machineTitle(machine: MachineRecord | null) {
  if (!machine) {
    return "Machine";
  }

  if (machine.machineType === "batterij_lader") {
    const vehicleBrand = machine.configuration.vehicle_brand || machine.brand;
    const vehicleType = machine.configuration.vehicle_type || machine.model;
    const internal = machine.configuration.vehicle_internal_number || machine.internalNumber || machine.machineNumber;
    return [vehicleBrand, vehicleType, internal].filter(Boolean).join(" - ") || "Batterij / lader";
  }

  return [machine.brand, machine.model].filter(Boolean).join(" ") || "Machine";
}

function machineFormValues(machine: MachineRecord) {
  return {
    brand: machine.brand,
    model: machine.model,
    serial_number: machine.serialNumber,
    build_year: machine.buildYear,
    internal_number: machine.internalNumber || machine.machineNumber || "",
    vehicle_brand: machine.configuration.vehicle_brand ?? machine.brand,
    vehicle_type: machine.configuration.vehicle_type ?? machine.model,
    vehicle_build_year: machine.configuration.vehicle_build_year ?? machine.buildYear,
    vehicle_internal_number:
      machine.configuration.vehicle_internal_number ?? machine.internalNumber ?? machine.machineNumber,
    vehicle_serial_number: machine.configuration.vehicle_serial_number ?? machine.serialNumber,
    ...machine.configuration
  };
}

export default async function MachineDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{
    saved?: string;
    created?: string;
    assigned?: string;
    rented?: string;
    returned?: string;
    unarchived?: string;
    error?: string;
  }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const machine = await getMachineById(id, { includeArchived: true });

  if (!machine) {
    notFound();
  }

  const customers = await getCustomers();
  const customer = customers.find((item) => item.id === machine.customerId) ?? null;
  const history = await getMachineHistory(machine.id);
  const rentals = await getRentalsForMachine(machine.id);
  const attachmentsByInspection = await Promise.all(
    history.map(async (inspection) => ({
      inspectionId: inspection.id,
      pdf: (await getAttachmentsForInspection(inspection.id)).find(
        (attachment) => attachment.kind === "pdf"
      )
    }))
  );
  const activeRental = rentals.find((rental) => rentalPhase(rental) === "active") ?? null;
  const upcomingRentals = rentals.filter((rental) => rentalPhase(rental) === "upcoming");
  const rentalCustomer = activeRental
    ? customers.find((item) => item.id === activeRental.customerId) ?? null
    : null;
  const isRentalStockMachine = isRentalStockCustomer(customer);
  const archivedAt = getMachineArchivedAt(machine);
  const archiveLockedAt = getMachineArchiveLockDate(machine);
  const archiveLocked = isMachineArchiveLocked(machine);
  const isArchived = Boolean(archivedAt);
  const assignableCustomers = customers.filter(
    (item) =>
      item.id !== machine.customerId &&
      (!isRentalStockMachine || !isRentalStockCustomer(item))
  );
  const statusBadge =
    isArchived
      ? { label: "Machine gearchiveerd", style: { background: "#fee4e2", color: "#b42318" } }
      : machine.availabilityStatus === "rented"
      ? { label: "In verhuur", style: { background: "#dff6ec", color: "#0d8d59" } }
      : machine.availabilityStatus === "maintenance"
        ? { label: "Onderhoud", style: { background: "#fff0d8", color: "#d97706" } }
        : isRentalStockMachine
          ? { label: "Beschikbaar", style: { background: "#e6f0ff", color: "#175cd3" } }
          : { label: "Bij klant", style: { background: "#eff3f8", color: "#526273" } };

  return (
    <>
      <section className="hero">
        <div className="eyebrow">
          {machine.machineType === "batterij_lader" ? "Batterij / lader kaart" : "Machinedossier"}
        </div>
        <h1>{machineTitle(machine)}</h1>
        <p>
          {isArchived
            ? `Deze machine is gearchiveerd. Controleer hieronder de archiefstatus en open alleen nog het dossier als naslag.`
            : isRentalStockMachine
            ? `Intern nummer ${machine.internalNumber || "-"} uit de eigen voorraad. Vanuit dit dossier kun je keuringen en verhuur voorbereiden.`
            : `Intern nummer ${machine.internalNumber || "-"} bij ${customer?.companyName ?? "onbekende klant"}. Vanuit dit dossier kun je eerdere keuringen openen en de volgende inspectie voorbereiden.`}
        </p>
        <p>
          <span className="badge" style={statusBadge.style}>
            {statusBadge.label}
          </span>
        </p>
        {isArchived ? (
          <p className="form-message error">
            Gearchiveerd op {formatDate(archivedAt)}.{" "}
            {archiveLockedAt
              ? `Vanaf ${formatDate(archiveLockedAt)} worden bewerkingen definitief geblokkeerd.`
              : ""}
          </p>
        ) : null}
        {query?.saved ? <p className="form-message success">Machine opgeslagen.</p> : null}
        {query?.created ? <p className="form-message success">Machine toegevoegd.</p> : null}
        {query?.assigned ? <p className="form-message success">Machine gekoppeld aan klant.</p> : null}
        {query?.rented ? <p className="form-message success">Verhuur gestart.</p> : null}
        {query?.returned ? <p className="form-message success">Verhuur afgerond.</p> : null}
        {query?.unarchived ? <p className="form-message success">Archiveren is ongedaan gemaakt.</p> : null}
        {query?.error ? <p className="form-message error">{decodeURIComponent(query.error)}</p> : null}
        <div className="actions">
          {!isArchived ? (
            <>
              <Link
                className="button"
                href={`/keuringen/nieuw?customerId=${machine.customerId}&machineId=${machine.id}` as Route}
              >
                Start nieuwe keuring
              </Link>
              <form action={archiveMachineAction}>
                <input type="hidden" name="machineId" value={machine.id} />
                <button className="button-secondary" type="submit">
                  Archiveren
                </button>
              </form>
            </>
          ) : (
            <>
              {!archiveLocked ? (
                <form action={unarchiveMachineAction}>
                  <input type="hidden" name="machineId" value={machine.id} />
                  <button className="button" type="submit">
                    Archiveren ongedaan maken
                  </button>
                </form>
              ) : null}
              <Link className="button-secondary" href="/machines">
                Terug naar machines
              </Link>
            </>
          )}
        </div>
      </section>

      <section className="grid-2" style={{ marginTop: "1rem" }}>
        <form action={updateMachineAction} className="panel">
          <div className="eyebrow">
            {machine.machineType === "batterij_lader" ? "Batterij / lader kaart" : "Machinekaart"}
          </div>
          <input type="hidden" name="id" value={machine.id} />
          <input type="hidden" name="machineType" value={machine.machineType} />
          <div className="list" style={{ marginBottom: "1rem" }}>
            <div className="list-item">
              <span>Soort</span>
              <strong>{titleCase(machine.machineType)}</strong>
            </div>
          </div>
          <MachineTypeFields
            machineType={machine.machineType}
            values={machineFormValues(machine)}
            disabled={isArchived}
          />
          <div className="actions">
            {isArchived ? (
              <span className="muted">
                {archiveLocked
                  ? "Deze machine is langer dan 7 dagen gearchiveerd en kan niet meer worden aangepast."
                  : "Deze machine is gearchiveerd. Maak archiveren eerst ongedaan als je weer iets wilt wijzigen."}
              </span>
            ) : (
              <button className="button" type="submit">
                Machine opslaan
              </button>
            )}
          </div>
        </form>

        <article className="panel">
          <div className="eyebrow">{isRentalStockMachine ? "Voorraad" : "Klant"}</div>
          <div className="list">
            {isRentalStockMachine ? (
              <div className="list-item">
                <span>Status</span>
                <strong>Machine in voorraad</strong>
              </div>
            ) : (
              <>
                <div className="list-item">
                  <span>Bedrijf</span>
                  <strong>{customer?.companyName ?? "-"}</strong>
                </div>
                <div className="list-item">
                  <span>Contactpersoon</span>
                  <strong>{customer?.contactName ?? "-"}</strong>
                </div>
                <div className="list-item">
                  <span>Algemeen e-mailadres</span>
                  <strong>{customer?.email ?? "-"}</strong>
                </div>
                <div className="list-item">
                  <span>Algemeen telefoonnummer</span>
                  <strong>{customer?.phone ?? "-"}</strong>
                </div>
              </>
            )}
            {activeRental ? (
              <div
                className="list-item"
                style={{
                  background: "#ecfdf3",
                  borderRadius: "0.9rem",
                  padding: "0.9rem 1rem",
                  border: "1px solid #abefc6"
                }}
              >
                <span>Verhuurd aan</span>
                <strong>
                  {rentalCustomer?.companyName ?? "-"} - {activeRental.startDate} t/m {activeRental.endDate}
                </strong>
              </div>
            ) : null}
            {upcomingRentals.map((rental) => {
              const upcomingCustomer = customers.find((item) => item.id === rental.customerId) ?? null;
              return (
                <div
                  className="list-item"
                  key={rental.id}
                  style={{
                    background: "#eaf4fe",
                    borderRadius: "0.9rem",
                    padding: "0.9rem 1rem",
                    border: "1px solid #b9d8f4"
                  }}
                >
                  <span>Aanstaande huur</span>
                  <strong>
                    {upcomingCustomer?.companyName ?? "-"} - {rental.startDate} t/m {rental.endDate}
                  </strong>
                </div>
              );
            })}
          </div>
          {!isArchived ? (
            <form action={assignMachineToCustomerAction} style={{ marginTop: "1rem" }}>
              <input type="hidden" name="machineId" value={machine.id} />
              <CustomerPicker
                customers={assignableCustomers}
                defaultCustomerId=""
                label={isRentalStockMachine ? "Verplaatsen naar klant" : "Toevoegen aan klant"}
                required
              />
              <div className="actions">
                <button className="button-secondary" type="submit">
                  {isRentalStockMachine ? "Machine verplaatsen" : "Machine koppelen"}
                </button>
              </div>
            </form>
          ) : null}
          {isRentalStockMachine && !isArchived ? (
            <div className="actions" style={{ marginTop: "0.75rem" }}>
              <a className="button-secondary" href="#verhuur">
                Start verhuur
              </a>
            </div>
          ) : null}
        </article>
      </section>

      <section className="grid-2" id="verhuur" style={{ marginTop: "1rem" }}>
        <article className="panel">
          <div className="eyebrow">Verhuur</div>
          <h2>Start verhuur</h2>
          {isArchived ? (
            <p className="muted">Deze machine is gearchiveerd en kan niet meer in verhuur worden gezet.</p>
          ) : isRentalStockMachine ? (
            <form action={createRentalAction}>
              <input type="hidden" name="machineId" value={machine.id} />
              <CustomerPicker
                customers={assignableCustomers}
                label="Verhuren aan klant"
                required
              />
              <div className="form-grid-wide" style={{ marginTop: "1rem" }}>
                <div className="field">
                  <label htmlFor="startDate">Startdatum</label>
                  <input
                    id="startDate"
                    name="startDate"
                    type="date"
                    defaultValue={activeRental?.endDate || new Date().toISOString().slice(0, 10)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="endDate">Einddatum</label>
                  <input
                    id="endDate"
                    name="endDate"
                    type="date"
                    defaultValue={new Date().toISOString().slice(0, 10)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="price">Prijs</label>
                  <input id="price" name="price" placeholder="Bijv. EUR 350 totaal" />
                </div>
              </div>
              <div className="actions">
                <button className="button" type="submit">
                  Start verhuur
                </button>
              </div>
            </form>
          ) : (
            <p className="muted">
              Alleen voorraadmachines van Heftrucks Friesland kunnen vanuit dit scherm verhuurd worden.
            </p>
          )}
        </article>

        <article className="panel">
          <div className="eyebrow">Verhuur</div>
          <h2>Huidige stand</h2>
          {activeRental ? (
            <>
              <div className="list">
                <div className="list-item">
                  <span>Klant</span>
                  <strong>{rentalCustomer?.companyName ?? "-"}</strong>
                </div>
                <div className="list-item">
                  <span>Periode</span>
                  <strong>
                    {activeRental.startDate} t/m {activeRental.endDate}
                  </strong>
                </div>
                <div className="list-item">
                  <span>Prijs</span>
                  <strong>{activeRental.price || "-"}</strong>
                </div>
              </div>
              {!isArchived ? (
                <form action={completeRentalAction} style={{ marginTop: "1rem" }}>
                  <input type="hidden" name="rentalId" value={activeRental.id} />
                  <input type="hidden" name="machineId" value={machine.id} />
                  <button className="button-secondary" type="submit">
                    Verhuur afronden
                  </button>
                </form>
              ) : null}
            </>
          ) : (
            <p className="muted">Deze machine is nu niet verhuurd.</p>
          )}
          {upcomingRentals.length > 0 ? (
            <div className="list" style={{ marginTop: "1rem" }}>
              {upcomingRentals.map((rental) => {
                const upcomingCustomer = customers.find((item) => item.id === rental.customerId) ?? null;
                return (
                  <div className="list-item" key={rental.id}>
                    <span>Aanstaande huur</span>
                    <strong>
                      {upcomingCustomer?.companyName ?? "-"} - {rental.startDate} t/m {rental.endDate}
                    </strong>
                  </div>
                );
              })}
            </div>
          ) : null}
        </article>
      </section>

      <section className="panel" style={{ marginTop: "1rem" }}>
        <div className="eyebrow">Historie</div>
        <h2>Eerdere keuringen</h2>
        <div className="table-like">
          <div className="table-row table-head">
            <span>Keurnummer</span>
            <span>Datum</span>
            <span>Status</span>
            <span>Dossier</span>
          </div>
          {history.map((inspection) => (
            <div className="table-row" key={inspection.id}>
              <span>{inspection.inspectionNumber}</span>
              <span>{inspection.inspectionDate}</span>
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
              <span>
                <div className="inline-meta">
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
                  {attachmentsByInspection.find((item) => item.inspectionId === inspection.id)?.pdf ? (
                    <a
                      className="button-secondary"
                      href={fileUrl(
                        attachmentsByInspection.find((item) => item.inspectionId === inspection.id)!.pdf!.storagePath
                      )}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Rapport openen
                    </a>
                  ) : null}
                </div>
              </span>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
