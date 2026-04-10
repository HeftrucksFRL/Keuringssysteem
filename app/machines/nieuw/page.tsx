import Link from "next/link";
import type { MachineType } from "@/lib/types";
import { getCustomerById, getVisibleCustomers } from "@/lib/inspection-service";
import { createMachineAction } from "@/app/machines/actions";
import { CustomerPicker } from "@/components/customer-picker";
import { MachineCreateFields } from "@/components/machine-create-fields";

export default async function NewMachinePage({
  searchParams
}: {
  searchParams?: Promise<{ customerId?: string; stock?: string }>;
}) {
  const query = await searchParams;
  const customers = await getVisibleCustomers();
  const preselectedCustomer = query?.customerId
    ? await getCustomerById(query.customerId)
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
              defaultCustomerId={preselectedCustomer?.id}
              required
            />
          )}
        </div>
        <MachineCreateFields defaultType={"heftruck_reachtruck" as MachineType} />
        <div className="actions">
          <button className="button" type="submit">
            Machine toevoegen
          </button>
          <Link
            className="button-secondary"
            href={preselectedCustomer && !toStock ? `/klanten/${preselectedCustomer.id}` : "/machines"}
          >
            Terug
          </Link>
        </div>
      </form>
    </>
  );
}
