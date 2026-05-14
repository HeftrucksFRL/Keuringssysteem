import Link from "next/link";
import { notFound } from "next/navigation";
import type { Route } from "next";
import type { MachineRecord } from "@/lib/domain";
import { completeRentalAction, createRentalAction } from "@/app/verhuur/actions";
import { canManageCleanup, requireUser } from "@/lib/auth";
import {
  archiveMachineAction,
  assignMachineToStockAction,
  assignMachineToCustomerAction,
  saveBatteryChargerLinkAction,
  setMachineCustomerLocationAction,
  unarchiveMachineAction,
  updateMachineAction
} from "@/app/machines/actions";
import { CustomerPicker } from "@/components/customer-picker";
import { MachinePicker } from "@/components/machine-picker";
import { LinkedBatteryDialog } from "@/components/linked-battery-dialog";
import {
  getCustomerById,
  getCustomerSummaries,
  getInspectionAttachmentsForInspections,
  getMachineArchivedAt,
  getMachineArchiveLockDate,
  getLinkedBatteryChargerMachines,
  getLinkedMachineId,
  getMachineById,
  getMachineHistory,
  getMachineSummaries,
  getRentalsForMachine,
  getVisibleCustomers,
  isMachineArchiveLocked,
  isMachineHistoryCustomer,
  isRentalStockCustomer
} from "@/lib/inspection-service";
import { fileUrl } from "@/lib/file-urls";
import {
  getBatteryChargerDetailLabel,
  formatMachineKindBrandType,
  formatMachineBrandTypeSerial,
  getMachineLocation
} from "@/lib/machine-presentation";
import { formatDisplayDate, titleCase } from "@/lib/utils";
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
    return formatMachineKindBrandType(machine);
  }

  return [machine.brand, machine.model].filter(Boolean).join(" ") || "Machine";
}

function realInternalNumber(input: {
  internalNumber?: string;
  machineNumber?: string;
  serialNumber?: string;
}) {
  const internalNumber = String(input.internalNumber ?? "").trim();
  if (!internalNumber) {
    return "";
  }

  const machineNumber = String(input.machineNumber ?? "").trim();
  const serialNumber = String(input.serialNumber ?? "").trim();
  return internalNumber !== machineNumber && internalNumber !== serialNumber ? internalNumber : "";
}

function machineFormValues(machine: MachineRecord) {
  const internalNumber = realInternalNumber({
    internalNumber: machine.internalNumber,
    machineNumber: machine.machineNumber,
    serialNumber: machine.serialNumber
  });

  return {
    brand: machine.brand,
    model: machine.model,
    serial_number: machine.serialNumber,
    build_year: machine.buildYear,
    internal_number: internalNumber,
    vehicle_brand: machine.configuration.vehicle_brand ?? machine.brand,
    vehicle_type: machine.configuration.vehicle_type ?? machine.model,
    vehicle_build_year: machine.configuration.vehicle_build_year ?? machine.buildYear,
    vehicle_internal_number:
      machine.configuration.vehicle_internal_number ?? internalNumber,
    vehicle_serial_number: machine.configuration.vehicle_serial_number ?? machine.serialNumber,
    ...machine.configuration
  };
}

function batteryAccessoryLine(machine: MachineRecord) {
  return (
    getBatteryChargerDetailLabel(machine) ||
    formatMachineKindBrandType(machine)
  );
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
    detached?: string;
    detachedArchived?: string;
    rented?: string;
    returned?: string;
    unarchived?: string;
    batteryLinked?: string;
    batteryUnlinked?: string;
    error?: string;
  }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const currentUser = await requireUser();
  const canManageCustomerAssignments = canManageCleanup(currentUser);
  const machine = await getMachineById(id, { includeArchived: true });

  if (!machine) {
    notFound();
  }

  const [customer, history, rentals, linkedBatteryMachines] = await Promise.all([
    getCustomerById(machine.customerId),
    getMachineHistory(machine.id),
    getRentalsForMachine(machine.id),
    machine.machineType === "batterij_lader"
      ? Promise.resolve([])
      : getLinkedBatteryChargerMachines(machine.id, { includeArchived: true })
  ]);
  const customerLocations = customer?.locations ?? [];
  const linkedMachineId = getLinkedMachineId(machine);
  const linkedMachine =
    machine.machineType === "batterij_lader" && linkedMachineId
      ? await getMachineById(linkedMachineId, { includeArchived: true })
      : null;
  const hiddenBatteryVehicleFields =
    machine.machineType === "batterij_lader"
      ? [
          "vehicle_brand",
          "vehicle_type",
          "vehicle_build_year",
          "vehicle_internal_number",
          "vehicle_serial_number",
          "battery_serial_number",
          "battery_internal_number",
          "charger_serial_number",
          "charger_internal_number",
          "double_insulated"
        ]
      : [];
  const linkableMachines =
    machine.machineType === "batterij_lader" && !linkedMachine
      ? (await getMachineSummaries({ includeArchived: true })).filter(
          (item) =>
            item.id !== machine.id &&
            item.machineType !== "batterij_lader" &&
            !("__archivedAt" in item.configuration)
        )
      : [];
  const historyAttachments = await getInspectionAttachmentsForInspections(
    history.map((inspection) => inspection.id)
  );
  const attachmentsByInspection = history.map((inspection) => ({
    inspectionId: inspection.id,
    pdf: historyAttachments.find(
      (attachment) => attachment.inspectionId === inspection.id && attachment.kind === "pdf"
    )
  })
  );
  const activeRental = rentals.find((rental) => rentalPhase(rental) === "active") ?? null;
  const upcomingRentals = rentals.filter((rental) => rentalPhase(rental) === "upcoming");
  const rentalCustomerIds = Array.from(
    new Set(
      [activeRental?.customerId, ...upcomingRentals.map((rental) => rental.customerId)].filter(
        Boolean
      ) as string[]
    )
  );
  const rentalCustomers = await getCustomerSummaries({ ids: rentalCustomerIds });
  const rentalCustomer = activeRental
    ? rentalCustomers.find((item) => item.id === activeRental.customerId) ?? null
    : null;
  const isRentalStockMachine = isRentalStockCustomer(customer);
  const isHistoryMachine = isMachineHistoryCustomer(customer);
  const archivedAt = getMachineArchivedAt(machine);
  const archiveLockedAt = getMachineArchiveLockDate(machine);
  const archiveLocked = isMachineArchiveLocked(machine);
  const isArchived = Boolean(archivedAt);
  const assignableCustomers = canManageCustomerAssignments || isRentalStockMachine
    ? (await getVisibleCustomers()).filter((item) => item.id !== machine.customerId)
    : [];
  const statusBadge =
    isArchived
      ? {
          label:
            machine.machineType === "batterij_lader"
              ? "Batterij en/of lader gearchiveerd"
              : "Machine gearchiveerd",
          style: { background: "#fee4e2", color: "#b42318" }
        }
      : machine.availabilityStatus === "rented"
      ? { label: "In verhuur", style: { background: "#dff6ec", color: "#0d8d59" } }
      : machine.availabilityStatus === "maintenance"
        ? { label: "Onderhoud", style: { background: "#fff0d8", color: "#d97706" } }
        : isHistoryMachine
          ? { label: "Historiebak", style: { background: "#fce7f3", color: "#be185d" } }
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
            : isHistoryMachine
            ? machine.machineType === "batterij_lader"
              ? `${machineTitle(machine)} staat in de Historiebak. Koppel deze batterij/lader aan een klant zodra hij weer in de werkgang terugkomt.`
              : `Intern nummer ${machine.internalNumber || "-"} staat in de Historiebak. Koppel deze machine aan een klant zodra hij weer in de werkgang terugkomt.`
            : isRentalStockMachine
            ? machine.machineType === "batterij_lader"
              ? `${machineTitle(machine)} uit de eigen voorraad. Vanuit dit dossier kun je keuringen voorbereiden.`
              : `Intern nummer ${machine.internalNumber || "-"} uit de eigen voorraad. Vanuit dit dossier kun je keuringen en verhuur voorbereiden.`
            : machine.machineType === "batterij_lader"
              ? `${machineTitle(machine)} bij ${customer?.companyName ?? "onbekende klant"}. Vanuit dit dossier kun je eerdere keuringen openen.`
              : `Intern nummer ${machine.internalNumber || "-"} bij ${customer?.companyName ?? "onbekende klant"}. Vanuit dit dossier kun je eerdere keuringen openen en de volgende inspectie voorbereiden.`}
        </p>
        <p>
          {machine.machineType === "batterij_lader"
            ? formatMachineKindBrandType(machine)
            : formatMachineBrandTypeSerial(machine)}{" "}
          | Locatie: {getMachineLocation(machine) || "-"}
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
        {query?.assigned ? (
          <p className="form-message success">
            {machine.machineType === "batterij_lader"
              ? "Batterij / lader gekoppeld aan klant."
              : "Machine gekoppeld aan klant."}
          </p>
        ) : null}
        {query?.detached ? (
          <p className="form-message success">
            {machine.machineType === "batterij_lader"
              ? "Batterij / lader teruggezet naar voorraad."
              : "Machine teruggezet naar voorraad."}
          </p>
        ) : null}
        {query?.detachedArchived ? (
          <p className="form-message success">
            {machine.machineType === "batterij_lader"
              ? "Batterij / lader losgekoppeld en gearchiveerd."
              : "Machine losgekoppeld en gearchiveerd."}
          </p>
        ) : null}
        {query?.rented ? <p className="form-message success">Verhuur gestart.</p> : null}
        {query?.returned ? <p className="form-message success">Verhuur afgerond.</p> : null}
        {query?.unarchived ? <p className="form-message success">Archiveren is ongedaan gemaakt.</p> : null}
        {query?.batteryLinked ? <p className="form-message success">Batterij / lader gekoppeld.</p> : null}
        {query?.batteryUnlinked ? <p className="form-message success">Koppeling met batterij / lader verwijderd.</p> : null}
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
              {machine.machineType !== "batterij_lader" ? (
                <Link
                  className="button-secondary"
                  href={`/machines/nieuw?type=batterij_lader&customerId=${machine.customerId}&linkedMachineId=${machine.id}` as Route}
                >
                  Batterij / lader toevoegen
                </Link>
              ) : null}
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
            hiddenKeys={hiddenBatteryVehicleFields}
          />
          {(() => {
            const formValues = machineFormValues(machine) as Record<string, string>;
            return (
              <>
                <input
                  type="hidden"
                  name="customer_location_id"
                  value={machine.configuration.customer_location_id ?? ""}
                />
                {machine.machineType === "batterij_lader"
                  ? hiddenBatteryVehicleFields.map((key) => (
                      <input key={key} type="hidden" name={key} value={formValues[key] ?? ""} />
                    ))
                  : null}
              </>
            );
          })()}
          {machine.machineType === "batterij_lader" && linkedMachine ? (
            <div className="selected-summary" style={{ marginTop: "1rem" }}>
              <strong>Voertuig volgt uit gekoppelde machine</strong>
              <span>
                {[linkedMachine.brand, linkedMachine.model].filter(Boolean).join(" ") || "Machine"} -{" "}
                {linkedMachine.internalNumber || linkedMachine.machineNumber || "-"}
              </span>
            </div>
          ) : null}
          <div className="actions">
            {isArchived ? (
              <span className="muted">
                {archiveLocked
                  ? "Deze machine is langer dan 7 dagen gearchiveerd en kan niet meer worden aangepast."
                  : "Deze machine is gearchiveerd. Maak archiveren eerst ongedaan als je weer iets wilt wijzigen."}
              </span>
            ) : (
              <button className="button" type="submit">
                {machine.machineType === "batterij_lader" ? "Batterij / lader opslaan" : "Machine opslaan"}
              </button>
            )}
          </div>
        </form>

        <article className="panel">
          <div className="eyebrow">
            {isHistoryMachine ? "Historiebak" : isRentalStockMachine ? "Voorraad" : "Klant"}
          </div>
          <div className="list">
            {isHistoryMachine ? (
              <div className="list-item">
                <span>Status</span>
                <strong>Machine in Historiebak</strong>
              </div>
            ) : isRentalStockMachine ? (
              <div className="list-item">
                <span>Status</span>
                <strong>
                  {machine.machineType === "batterij_lader"
                    ? "Batterij / lader in voorraad"
                    : "Machine in voorraad"}
                </strong>
              </div>
            ) : (
              <>
                <div className="list-item">
                  <span>Locatie</span>
                  <strong>{getMachineLocation(machine) || "-"}</strong>
                </div>
                {customerLocations.length > 0 ? (
                  <form action={setMachineCustomerLocationAction} className="list-item" style={{ display: "block" }}>
                    <input type="hidden" name="machineId" value={machine.id} />
                    <div className="field">
                      <label htmlFor="customerLocationId">Locatie bij deze klant</label>
                      <select
                        id="customerLocationId"
                        name="customerLocationId"
                        defaultValue={machine.configuration.customer_location_id ?? ""}
                        disabled={isArchived}
                      >
                        <option value="">Geen locatie gekozen</option>
                        {customerLocations.map((location) => (
                          <option key={location.id} value={location.id}>
                            {[location.name, location.city].filter(Boolean).join(" - ")}
                          </option>
                        ))}
                      </select>
                    </div>
                    {!isArchived ? (
                      <div className="actions" style={{ marginTop: "0.75rem" }}>
                        <button className="button-secondary" type="submit">
                          Locatie opslaan
                        </button>
                      </div>
                    ) : null}
                  </form>
                ) : null}
                <div className="list-item">
                  <span>Bedrijf</span>
                  <strong>
                    {customer ? (
                      <Link href={`/klanten/${customer.id}` as Route}>
                        {customer.companyName}
                      </Link>
                    ) : (
                      "-"
                    )}
                  </strong>
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
            {isRentalStockMachine || isHistoryMachine ? (
              <div className="list-item">
                <span>Locatie</span>
                <strong>{getMachineLocation(machine) || "-"}</strong>
              </div>
            ) : null}
            {machine.machineType === "batterij_lader" ? (
              <div
                className="list-item"
                style={{
                  background: "#eff8ff",
                  borderRadius: "0.9rem",
                  padding: "0.9rem 1rem",
                  border: "1px solid #b2ddff"
                }}
              >
                <span>Gekoppelde machine</span>
                <strong>
                  {linkedMachine ? (
                    <Link href={`/machines/${linkedMachine.id}` as Route}>
                      {[linkedMachine.brand, linkedMachine.model].filter(Boolean).join(" ") || "Machine"} -{" "}
                      {linkedMachine.internalNumber || linkedMachine.machineNumber || "-"}
                    </Link>
                  ) : (
                    "Nog niet gekoppeld"
                  )}
                </strong>
              </div>
            ) : null}
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
                  {rentalCustomer?.companyName ?? "-"} - {formatDisplayDate(activeRental.startDate)} t/m {formatDisplayDate(activeRental.endDate)}
                </strong>
              </div>
            ) : null}
            {upcomingRentals.map((rental) => {
              const upcomingCustomer = rentalCustomers.find((item) => item.id === rental.customerId) ?? null;
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
                    {upcomingCustomer?.companyName ?? "-"} - {formatDisplayDate(rental.startDate)} t/m {formatDisplayDate(rental.endDate)}
                  </strong>
                </div>
              );
            })}
          </div>
          {machine.machineType === "batterij_lader" && !isArchived && linkedMachine ? (
            <form action={saveBatteryChargerLinkAction} style={{ marginTop: "1rem" }}>
              <input type="hidden" name="batteryMachineId" value={machine.id} />
              <input type="hidden" name="redirectTo" value={`/machines/${machine.id}`} />
              <input type="hidden" name="remove_link" value="1" />
              <div className="actions">
                <button className="button-secondary" type="submit">
                  Terug naar voorraad
                </button>
                <button
                  className="button-secondary"
                  type="submit"
                  name="archive_after"
                  value="1"
                >
                  Ontkoppelen en archiveren
                </button>
              </div>
            </form>
          ) : null}
          {machine.machineType === "batterij_lader" && !isArchived && !linkedMachine ? (
            <p className="muted" style={{ marginTop: "1rem" }}>
              Deze batterij / lader is nog niet aan een machine gekoppeld.
            </p>
          ) : null}
          {machine.machineType !== "batterij_lader" ? (
            <div className="battery-accessory-section" style={{ marginTop: "1rem" }}>
              <div className="eyebrow">Batterijen en laders</div>
              {linkedBatteryMachines.length > 0 ? (
                <>
                  <div className="list compact-list" style={{ marginTop: "0.65rem" }}>
                    {linkedBatteryMachines.map((item) => (
                      <Link
                        className="list-item battery-accessory-row"
                        href={`/machines/${item.id}`}
                        key={item.id}
                      >
                        <span>
                          <strong>{formatMachineKindBrandType(item)}</strong>
                          <br />
                          {batteryAccessoryLine(item)}
                        </span>
                        <strong>Open</strong>
                      </Link>
                    ))}
                  </div>
                  <div className="actions" style={{ marginTop: "0.75rem", flexWrap: "wrap" }}>
                    <LinkedBatteryDialog
                      machineId={machine.internalNumber || machine.machineNumber || machine.id}
                      items={linkedBatteryMachines.map((item) => ({
                        id: item.id,
                        customerId: item.customerId,
                        title: formatMachineKindBrandType(item),
                        batteryLabel:
                          [item.configuration.battery_brand, item.configuration.battery_type]
                            .filter(Boolean)
                            .join(" ") || "Batterij: -",
                        chargerLabel:
                          [item.configuration.charger_brand, item.configuration.charger_type]
                            .filter(Boolean)
                            .join(" ") || "Lader: -"
                      }))}
                    />
                  </div>
                </>
              ) : (
                <span className="muted">Nog geen batterij / lader gekoppeld.</span>
              )}
            </div>
          ) : null}
          {!isArchived &&
          (isRentalStockMachine || isHistoryMachine) &&
          canManageCustomerAssignments ? (
            <form action={assignMachineToCustomerAction} style={{ marginTop: "1rem" }}>
              <input type="hidden" name="machineId" value={machine.id} />
              <CustomerPicker
                customers={assignableCustomers}
                defaultCustomerId=""
                label="Verplaatsen naar klant"
                required
              />
              <div className="actions">
                <button className="button-secondary" type="submit">
                  {machine.machineType === "batterij_lader"
                    ? "Batterij / lader koppelen"
                    : "Machine koppelen"}
                </button>
              </div>
            </form>
          ) : null}
          {!isArchived &&
          machine.machineType !== "batterij_lader" &&
          !isRentalStockMachine &&
          !isHistoryMachine &&
          canManageCustomerAssignments ? (
            <form action={assignMachineToStockAction} style={{ marginTop: "1rem" }}>
              <input type="hidden" name="machineId" value={machine.id} />
              <div className="actions">
                <button className="button-secondary" type="submit">
                  Terug naar voorraad
                </button>
                <button
                  className="button-secondary"
                  type="submit"
                  name="archive_after"
                  value="1"
                >
                  Ontkoppelen en archiveren
                </button>
              </div>
            </form>
          ) : null}
          {!isArchived && machine.machineType === "batterij_lader" && !linkedMachine ? (
            <form action={saveBatteryChargerLinkAction} style={{ marginTop: "1rem" }}>
              <input type="hidden" name="batteryMachineId" value={machine.id} />
              <input type="hidden" name="redirectTo" value={`/machines/${machine.id}`} />
              <MachinePicker
                machines={linkableMachines}
                defaultMachineId=""
                label="Koppelen aan machine"
                placeholder="Zoek op intern nummer of serienummer"
              />
              <div className="actions">
                <button className="button-secondary" type="submit">
                  Koppelen aan machine
                </button>
              </div>
            </form>
          ) : null}
          {isRentalStockMachine && !isArchived && machine.machineType !== "batterij_lader" ? (
            <div className="actions" style={{ marginTop: "0.75rem" }}>
              <a className="button-secondary" href="#verhuur">
                Start verhuur
              </a>
            </div>
          ) : null}
        </article>
      </section>

      {machine.machineType !== "batterij_lader" && isRentalStockMachine ? (
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
                    {formatDisplayDate(activeRental.startDate)} t/m {formatDisplayDate(activeRental.endDate)}
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
                const upcomingCustomer = rentalCustomers.find((item) => item.id === rental.customerId) ?? null;
                return (
                  <div className="list-item" key={rental.id}>
                    <span>Aanstaande huur</span>
                    <strong>
                      {upcomingCustomer?.companyName ?? "-"} - {formatDisplayDate(rental.startDate)} t/m {formatDisplayDate(rental.endDate)}
                    </strong>
                  </div>
                );
              })}
            </div>
          ) : null}
        </article>
      </section>
      ) : null}

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
              <span>{formatDisplayDate(inspection.inspectionDate)}</span>
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
