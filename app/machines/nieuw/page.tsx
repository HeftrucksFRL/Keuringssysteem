import Link from "next/link";
import type { MachineType } from "@/lib/types";
import { getCustomerById, getCustomers } from "@/lib/inspection-service";
import { createMachineAction } from "@/app/machines/actions";
import { CustomerPicker } from "@/components/customer-picker";

const machineTypeOptions: { value: MachineType; label: string }[] = [
  { value: "heftruck_reachtruck", label: "Heftruck / reachtruck" },
  { value: "batterij_lader", label: "Batterij en laders" },
  { value: "graafmachine", label: "Graafmachine" },
  { value: "hoogwerker", label: "Hoogwerker" },
  { value: "palletwagen_stapelaar", label: "Palletwagen / stapelaar" },
  { value: "shovel", label: "Shovel" },
  { value: "verreiker", label: "Verreiker" },
  { value: "stellingmateriaal", label: "Stellingmateriaal" }
];

export default async function NewMachinePage({
  searchParams
}: {
  searchParams?: Promise<{ customerId?: string }>;
}) {
  const query = await searchParams;
  const customers = await getCustomers();
  const preselectedCustomer = query?.customerId
    ? await getCustomerById(query.customerId)
    : null;

  return (
    <>
      <section className="hero">
        <div className="eyebrow">Machinebestand</div>
        <h1>Machine toevoegen</h1>
        <p>Voeg een machine los toe aan een klant, ook als de keuring later pas volgt.</p>
      </section>

      <form action={createMachineAction} className="panel" style={{ marginTop: "1rem" }}>
        <div className="form-grid-wide">
          <CustomerPicker
            customers={customers}
            defaultCustomerId={preselectedCustomer?.id}
            required
          />
          <div className="field">
            <label htmlFor="machineType">Soort</label>
            <select id="machineType" name="machineType" defaultValue="heftruck_reachtruck">
              {machineTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="brand">Merk</label>
            <input id="brand" name="brand" />
          </div>
          <div className="field">
            <label htmlFor="model">Type</label>
            <input id="model" name="model" />
          </div>
          <div className="field">
            <label htmlFor="serialNumber">Serienummer</label>
            <input id="serialNumber" name="serialNumber" />
          </div>
          <div className="field">
            <label htmlFor="buildYear">Bouwjaar</label>
            <input id="buildYear" name="buildYear" inputMode="numeric" />
          </div>
          <div className="field">
            <label htmlFor="internalNumber">Intern nummer</label>
            <input id="internalNumber" name="internalNumber" />
          </div>
        </div>
        <div className="actions">
          <button className="button" type="submit">
            Machine toevoegen
          </button>
          <Link
            className="button-secondary"
            href={preselectedCustomer ? `/klanten/${preselectedCustomer.id}` : "/machines"}
          >
            Terug
          </Link>
        </div>
      </form>
    </>
  );
}
