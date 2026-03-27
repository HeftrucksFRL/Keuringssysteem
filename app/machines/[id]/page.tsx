import Link from "next/link";
import { notFound } from "next/navigation";
import type { Route } from "next";
import {
  getCustomers,
  getMachineById,
  getMachineHistory
} from "@/lib/inspection-service";
import { titleCase } from "@/lib/utils";

export default async function MachineDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const machine = await getMachineById(id);

  if (!machine) {
    notFound();
  }

  const customers = await getCustomers();
  const customer = customers.find((item) => item.id === machine.customerId);
  const history = await getMachineHistory(machine.id);

  return (
    <>
      <section className="hero">
        <div className="eyebrow">Machinedossier</div>
        <h1>{machine.machineNumber}</h1>
        <p>
          {machine.brand} {machine.model} bij {customer?.companyName ?? "onbekende klant"}.
          Vanuit dit dossier kun je eerdere keuringen openen en de volgende inspectie voorbereiden.
        </p>
      </section>

      <section className="grid-2" style={{ marginTop: "1rem" }}>
        <article className="panel">
          <div className="eyebrow">Machinekaart</div>
          <div className="list">
            <div className="list-item">
              <span>Type</span>
              <strong>{titleCase(machine.machineType)}</strong>
            </div>
            <div className="list-item">
              <span>Serienummer</span>
              <strong>{machine.serialNumber || "-"}</strong>
            </div>
            <div className="list-item">
              <span>Bouwjaar</span>
              <strong>{machine.buildYear || "-"}</strong>
            </div>
            <div className="list-item">
              <span>Intern nummer</span>
              <strong>{machine.internalNumber || "-"}</strong>
            </div>
          </div>
        </article>

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
              <span className={`badge ${inspection.status === "rejected" ? "orange" : "green"}`}>
                {inspection.status === "rejected" ? "Afgekeurd" : "Goedgekeurd"}
              </span>
              <span>
                <Link href={`/keuringen/${inspection.id}` as Route}>Open keuring</Link>
              </span>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
