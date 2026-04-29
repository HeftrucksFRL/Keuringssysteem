import { InspectionForm } from "@/components/inspection-form";
import {
  getCustomerContacts,
  getInspectionById,
  getInspectionNumberSeeds,
  getLatestInspectionForMachine,
  getMachineSummaries,
  getVisibleCustomerSummaries
} from "@/lib/inspection-service";

export default async function NewInspectionPage({
  searchParams
}: {
  searchParams?: Promise<{ customerId?: string; machineId?: string; inspectionId?: string; saved?: string }>;
}) {
  const params = await searchParams;
  const [customers, machines, inspectionNumberSeeds, existingInspection] = await Promise.all([
    getVisibleCustomerSummaries(),
    getMachineSummaries(),
    getInspectionNumberSeeds([new Date().getFullYear()]),
    params?.inspectionId ? getInspectionById(params.inspectionId) : Promise.resolve(null)
  ]);
  const initialInspection =
    existingInspection ??
    (params?.machineId ? await getLatestInspectionForMachine(params.machineId) : null);
  const initialCustomerId =
    params?.customerId ??
    initialInspection?.customerId ??
    (params?.machineId
      ? machines.find((machine) => machine.id === params.machineId)?.customerId
      : "");
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
      defaultCustomerId={params?.customerId}
      defaultMachineId={params?.machineId}
      existingInspection={existingInspection}
      savedState={params?.saved}
    />
  );
}
