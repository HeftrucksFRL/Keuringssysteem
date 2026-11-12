import { hasSupabaseConfig } from "@/lib/env";
import { getCurrentUser } from "@/lib/auth";
import { canManageWorkshopTablet } from "@/lib/workshop-access";
import { WorkshopOrders } from "@/components/workshop-orders";

export const dynamic="force-dynamic";
export default async function OrdersPage({searchParams}:{searchParams:Promise<{tablet?:string}>}){
  const demo=!hasSupabaseConfig(),user=await getCurrentUser(),params=await searchParams;
  return <WorkshopOrders demo={demo} manager={demo?params.tablet!=="1":canManageWorkshopTablet(user)}/>;
}
