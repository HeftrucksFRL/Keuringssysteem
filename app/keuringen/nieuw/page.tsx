import { InspectionForm } from "@/components/inspection-form";
import {
  getCustomerContacts,
  getCustomers,
  getInspectionById,
  getInspectionNumberSeeds,
  getLatestInspectionForMachine,
  getMachines
} from "@/lib/inspection-service";

export default async function NewInspectionPage({
  searchParams
}: {
  searchParams?: Promise<{ customerId?: string; machineId?: string; inspectionId?: string; saved?: string }>;
}) {
  const params = await searchParams;
  const [customers, customerContacts, machines, inspectionNumberSeeds, existingInspection] = await Promise.all([
    getCustomers(),
    getCustomerContacts(),
    getMachines(),
    getInspectionNumberSeeds([new Date().getFullYear()]),
    params?.inspectionId ? getInspectionById(params.inspectionId) : Promise.resolve(null)
  ]);
  const initialInspection =
    existingInspection ??
    (params?.machineId ? await getLatestInspectionForMachine(params.machineId) : null);

  return (
    <InspectionForm
      customers={customers}
      customerContacts={customerContacts}
      machines={machines}
      inspections={initialInspection ? [initialInspection] : []}
      inspectionNumberSeeds={inspectionNumberSeeds}
      defaultCustomerId={params?.customerId}
      defaultMachineId={params?.machineId}
      existingInspection={existingInspection}
      savedState={params?.saved}
    />
  );
}
