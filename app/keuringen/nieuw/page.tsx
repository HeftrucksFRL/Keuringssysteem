import { InspectionForm } from "@/components/inspection-form";
import {
  getCustomerContacts,
  getCustomerSummaries,
  getInspectionById,
  getInspectionNumberSeeds,
  getLatestInspectionForMachine,
  getMachineSummaries
} from "@/lib/inspection-service";
import { isRentalStockCustomer } from "@/lib/stock-customer";

export default async function NewInspectionPage({
  searchParams
}: {
  searchParams?: Promise<{ customerId?: string; machineId?: string; inspectionId?: string; saved?: string }>;
}) {
  const params = await searchParams;
  const [customers, machines, inspectionNumberSeeds, existingInspection] = await Promise.all([
    getCustomerSummaries(),
    getMachineSummaries(),
    getInspectionNumberSeeds([new Date().getFullYear()]),
    params?.inspectionId ? getInspectionById(params.inspectionId) : Promise.resolve(null)
  ]);
  const machineFromParams = params?.machineId
    ? machines.find((machine) => machine.id === params.machineId) ?? null
    : null;
  const machineOwner = machineFromParams
    ? customers.find((customer) => customer.id === machineFromParams.customerId) ?? null
    : null;
  const initialInspection =
    existingInspection ??
    (params?.machineId ? await getLatestInspectionForMachine(params.machineId) : null);
  const initialInspectionCustomer = initialInspection?.customerId
    ? customers.find((customer) => customer.id === initialInspection.customerId) ?? null
    : null;
  const initialCustomerId =
    (params?.customerId && !isRentalStockCustomer(customers.find((customer) => customer.id === params.customerId) ?? null)
      ? params.customerId
      : undefined) ??
    (initialInspection?.customerId && !isRentalStockCustomer(initialInspectionCustomer)
      ? initialInspection.customerId
      : undefined) ??
    (machineFromParams && !isRentalStockCustomer(machineOwner) ? machineFromParams.customerId : "");
  const customerContacts = initialCustomerId
    ? await getCustomerContacts(initialCustomerId)
    : [];

  return (
    <InspectionForm
      customers={customers}
      customerContacts={customerContacts}
      machines={machines}
      inspections={initialInspection ? [initialInspection] : []}
      inspectionNumberSeeds={inspectionNumberSeeds}
      defaultCustomerId={initialCustomerId}
      defaultMachineId={params?.machineId}
      existingInspection={existingInspection}
      savedState={params?.saved}
    />
  );
}
