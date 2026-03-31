import { InspectionForm } from "@/components/inspection-form";
import {
  getCustomers,
  getInspections,
  getMachines
} from "@/lib/inspection-service";

export default async function NewInspectionPage({
  searchParams
}: {
  searchParams?: Promise<{ customerId?: string; machineId?: string }>;
}) {
  const [customers, machines, inspections] = await Promise.all([
    getCustomers(),
    getMachines(),
    getInspections()
  ]);
  const params = await searchParams;

  return (
    <InspectionForm
      customers={customers}
      machines={machines}
      inspections={inspections}
      defaultCustomerId={params?.customerId}
      defaultMachineId={params?.machineId}
    />
  );
}
