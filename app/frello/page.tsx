import { redirect } from "next/navigation";
import { hasSupabaseConfig } from "@/lib/env";
import { getCurrentUser,getUserFirstName } from "@/lib/auth";
import { canManageWorkshopTablet } from "@/lib/workshop-access";
import { FrelloBoardView } from "@/components/frello-board";
export const dynamic="force-dynamic";
export default async function FrelloPage({searchParams}:{searchParams:Promise<{as?:string}>}){
 const demo=!hasSupabaseConfig(),user=await getCurrentUser(),params=await searchParams;
 if(!demo&&!canManageWorkshopTablet(user))redirect('/');
 return <FrelloBoardView demo={demo} userId={user?.id||''} author={demo?(params.as==='renze'?'Renze':'Age'):getUserFirstName(user)}/>;
}
