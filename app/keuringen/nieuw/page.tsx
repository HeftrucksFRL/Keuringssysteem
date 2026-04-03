import { InspectionForm } from "@/components/inspection-form";
import {
  getCustomerContacts,
  getCustomers,
  getInspectionById,
  getInspections,
  getMachines
} from "@/lib/inspection-service";

export default async function NewInspectionPage({
  searchParams
}: {
  searchParams?: Promise<{ customerId?: string; machineId?: string; inspectionId?: string; saved?: string }>;
}) {
  const params = await searchParams;
  const [customers, customerContacts, machines, inspections, existingInspection] = await Promise.all([
    getCustomers(),
    getCustomerContacts(),
    getMachines(),
    getInspections(),
    params?.inspectionId ? getInspectionById(params.inspectionId) : Promise.resolve(null)
  ]);

  return (
    <InspectionForm
      customers={customers}
      customerContacts={customerContacts}
      machines={machines}
      inspections={inspections}
      defaultCustomerId={params?.customerId}
      defaultMachineId={params?.machineId}
      existingInspection={existingInspection}
      savedState={params?.saved}
    />
  );
}
