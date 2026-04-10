import Link from "next/link";
import type { MachineType } from "@/lib/types";
import { getCustomerById, getMachineById, getMachines, getVisibleCustomers } from "@/lib/inspection-service";
import { createMachineAction } from "@/app/machines/actions";
import { CustomerPicker } from "@/components/customer-picker";
import { MachineCreateFields } from "@/components/machine-create-fields";

export default async function NewMachinePage({
  searchParams
}: {
  searchParams?: Promise<{ customerId?: string; stock?: string; type?: string; linkedMachineId?: string }>;
}) {
  const query = await searchParams;
  const customers = await getVisibleCustomers();
  const linkableMachines = (await getMachines()).filter((machine) => machine.machineType !== "batterij_lader");
  const linkedMachine = query?.linkedMachineId
    ? await getMachineById(query.linkedMachineId)
    : null;
  const defaultType = (query?.type as MachineType | undefined) ?? "heftruck_reachtruck";
  const resolvedCustomerId = query?.customerId || linkedMachine?.customerId;
  const preselectedCustomer = query?.customerId
    ? await getCustomerById(query.customerId)
    : null;
  const linkedMachineCustomer =
    !preselectedCustomer && linkedMachine?.customerId
      ? await getCustomerById(linkedMachine.customerId)
      : null;
  const toStock = query?.stock === "1";

  return (
    <>
      <section className="hero">
        <div className="eyebrow">Machinebestand</div>
        <h1>{toStock ? "Machine aan voorraad toevoegen" : "Machine toevoegen"}</h1>
        <p>
          {toStock
            ? "Voeg een machine direct toe aan de eigen voorraad van Heftrucks Friesland."
            : "Voeg een machine los toe aan een klant, ook als de keuring later pas volgt."}
        </p>
      </section>

      <form action={createMachineAction} className="panel" style={{ marginTop: "1rem" }}>
        <input type="hidden" name="toStock" value={toStock ? "1" : ""} />
        <div className="form-grid-wide">
          {toStock ? (
            <div className="field">
              <label>Bestemming</label>
              <div className="selected-summary">
                <strong>Eigen voorraad</strong>
                <span>Deze machine blijft beschikbaar voor verhuur of verkoop.</span>
              </div>
            </div>
          ) : (
            <CustomerPicker
              customers={customers}
              defaultCustomerId={preselectedCustomer?.id ?? linkedMachineCustomer?.id}
              required
            />
          )}
        </div>
        {linkedMachine ? (
          <div className="compact-card" style={{ marginTop: "1rem" }}>
            <div className="eyebrow">Gekoppelde machine</div>
            <div className="info-card">
              <strong>
                {[linkedMachine.brand, linkedMachine.model].filter(Boolean).join(" ") || "Machine"}
              </strong>
              <span>
                {linkedMachine.internalNumber || linkedMachine.machineNumber || "-"} ·{" "}
                {linkedMachine.serialNumber || "-"}
              </span>
            </div>
          </div>
        ) : null}
        <MachineCreateFields
          defaultType={defaultType}
          machines={linkableMachines}
          defaultLinkedMachineId={query?.linkedMachineId ?? ""}
        />
        <div className="actions">
          <button className="button" type="submit">
            Machine toevoegen
          </button>
          <Link
            className="button-secondary"
            href={
              resolvedCustomerId && !toStock ? `/klanten/${resolvedCustomerId}` : "/machines"
            }
          >
            Terug
          </Link>
        </div>
      </form>
    </>
  );
}
