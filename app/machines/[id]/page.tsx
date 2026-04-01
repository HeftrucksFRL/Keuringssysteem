import Link from "next/link";
import { notFound } from "next/navigation";
import type { Route } from "next";
import {
  archiveMachineAction,
  assignMachineToCustomerAction,
  deleteMachineAction,
  updateMachineAction
} from "@/app/machines/actions";
import { CustomerPicker } from "@/components/customer-picker";
import {
  getAttachmentsForInspection,
  getCustomers,
  getMachineById,
  getMachineHistory
} from "@/lib/inspection-service";
import { getFormDefinition } from "@/lib/form-definitions";
import { fileUrl } from "@/lib/file-urls";
import { titleCase } from "@/lib/utils";

export default async function MachineDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ saved?: string; created?: string; assigned?: string; error?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const machine = await getMachineById(id);

  if (!machine) {
    notFound();
  }

  const customers = await getCustomers();
  const customer = customers.find((item) => item.id === machine.customerId);
  const history = await getMachineHistory(machine.id);
  const form = getFormDefinition(machine.machineType);
  const extraFields = form.machineFields.filter(
    (field) =>
      !field.key.startsWith("customer_") &&
      !["brand", "model", "build_year", "internal_number", "serial_number", "inspection_date", "sticker_number", "machine_number"].includes(field.key)
  );
  const attachmentsByInspection = await Promise.all(
    history.map(async (inspection) => ({
      inspectionId: inspection.id,
      pdf: (await getAttachmentsForInspection(inspection.id)).find(
        (attachment) => attachment.kind === "pdf"
      )
    }))
  );

  return (
    <>
      <section className="hero">
        <div className="eyebrow">Machinedossier</div>
        <h1>{[machine.brand, machine.model].filter(Boolean).join(" ") || "Machine"}</h1>
        <p>
          Intern nummer {machine.internalNumber || "-"} bij {customer?.companyName ?? "onbekende klant"}.
          Vanuit dit dossier kun je eerdere keuringen openen en de volgende inspectie voorbereiden.
        </p>
        {query?.saved ? <p className="form-message success">Machine opgeslagen.</p> : null}
        {query?.created ? <p className="form-message success">Machine toegevoegd.</p> : null}
        {query?.assigned ? <p className="form-message success">Machine gekoppeld aan klant.</p> : null}
        {query?.error ? <p className="form-message error">{decodeURIComponent(query.error)}</p> : null}
        <div className="actions">
          <Link
            className="button"
            href={`/keuringen/nieuw?customerId=${machine.customerId}&machineId=${machine.id}` as Route}
          >
            Start nieuwe keuring
          </Link>
          <Link className="button-secondary" href={`/machines/nieuw?customerId=${machine.customerId}`}>
            Machine toevoegen
          </Link>
          <form action={archiveMachineAction}>
            <input type="hidden" name="machineId" value={machine.id} />
            <button className="button-secondary" type="submit">
              Archiveren
            </button>
          </form>
          <form action={deleteMachineAction}>
            <input type="hidden" name="machineId" value={machine.id} />
            <button className="button-secondary" type="submit">
              Definitief verwijderen
            </button>
          </form>
        </div>
      </section>

      <section className="grid-2" style={{ marginTop: "1rem" }}>
        <form action={updateMachineAction} className="panel">
          <div className="eyebrow">Machinekaart</div>
          <input type="hidden" name="id" value={machine.id} />
          <input type="hidden" name="machineType" value={machine.machineType} />
          <div className="list" style={{ marginBottom: "1rem" }}>
            <div className="list-item">
              <span>Soort</span>
              <strong>{titleCase(machine.machineType)}</strong>
            </div>
          </div>
          <div className="form-grid-wide">
            <div className="field">
              <label htmlFor="brand">Merk</label>
              <input id="brand" name="brand" defaultValue={machine.brand} />
            </div>
            <div className="field">
              <label htmlFor="model">Type</label>
              <input id="model" name="model" defaultValue={machine.model} />
            </div>
            <div className="field">
              <label htmlFor="serialNumber">Serienummer</label>
              <input id="serialNumber" name="serialNumber" defaultValue={machine.serialNumber} />
            </div>
            <div className="field">
              <label htmlFor="buildYear">Bouwjaar</label>
              <input id="buildYear" name="buildYear" defaultValue={machine.buildYear} />
            </div>
            <div className="field">
              <label htmlFor="internalNumber">Intern nummer</label>
              <input id="internalNumber" name="internalNumber" defaultValue={machine.internalNumber} />
            </div>
            {extraFields.map((field) => (
              <div className="field" key={field.key}>
                <label htmlFor={field.key}>{field.label}</label>
                <input
                  id={field.key}
                  name={field.key}
                  type={field.type ?? "text"}
                  defaultValue={machine.configuration[field.key] ?? ""}
                />
              </div>
            ))}
          </div>
          <div className="actions">
            <button className="button" type="submit">
              Machine opslaan
            </button>
          </div>
        </form>

        <article className="panel">
          <div className="eyebrow">Klant</div>
          <div className="list">
            <div className="list-item">
              <span>Bedrijf</span>
              <strong>{customer?.companyName ?? "-"}</strong>
            </div>
            <div className="list-item">
              <span>Contactpersoon</span>
              <strong>{customer?.contactName ?? "-"}</strong>
            </div>
            <div className="list-item">
              <span>E-mail</span>
              <strong>{customer?.email ?? "-"}</strong>
            </div>
            <div className="list-item">
              <span>Telefoon</span>
              <strong>{customer?.phone ?? "-"}</strong>
            </div>
          </div>
          <form action={assignMachineToCustomerAction} style={{ marginTop: "1rem" }}>
            <input type="hidden" name="machineId" value={machine.id} />
            <CustomerPicker
              customers={customers}
              defaultCustomerId={machine.customerId}
              label="Toevoegen aan klant"
              required
            />
            <div className="actions">
              <button className="button-secondary" type="submit">
                Machine koppelen
              </button>
            </div>
          </form>
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
