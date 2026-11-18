import { requireUser } from "@/lib/auth";
import { BlankOrderForm } from "@/components/blank-order-form";
export default async function Page(){await requireUser();return <BlankOrderForm/>;}
