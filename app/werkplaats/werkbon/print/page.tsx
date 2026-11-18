import {requireUser} from "@/lib/auth";
import {BlankWorkshopForm} from "@/components/blank-workshop-form";
export default async function Page(){await requireUser();return <BlankWorkshopForm/>;}
