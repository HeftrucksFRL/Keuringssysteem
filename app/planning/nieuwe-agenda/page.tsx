import {redirect} from 'next/navigation';
export default async function LegacyPlanningPage({searchParams}:{searchParams?:Promise<Record<string,string|undefined>>}){
 const params=await searchParams;
 const query=new URLSearchParams(Object.entries(params||{}).filter((entry):entry is [string,string]=>typeof entry[1]==='string'));
 redirect(('/planning'+(query.size?'?'+query.toString():'')) as never);
}
