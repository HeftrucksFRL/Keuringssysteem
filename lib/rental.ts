import {z} from 'zod';
import {todayLocalIso} from './utils';

export const rentalDate=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value=>{
 const date=new Date(value+'T12:00:00Z');return !isNaN(date.getTime())&&date.toISOString().slice(0,10)===value;
},'Vul een geldige datum in.');
export const rentalPeriodSchema=z.object({startDate:rentalDate,endDate:z.union([rentalDate,z.literal('')])}).refine(v=>!v.endDate||v.endDate>=v.startDate,{message:'De einddatum mag niet vóór de startdatum liggen.',path:['endDate']});
export const rentalTransportSchema=z.object({delivery:z.boolean().default(false),collection:z.boolean().default(false),address:z.string().trim().max(6000).default(''),contact:z.string().trim().max(6000).default(''),instructions:z.string().trim().max(6000).default('')}).strict();
export type RentalTransport=z.infer<typeof rentalTransportSchema>;
export function rentalPhase(rental:{status:string;startDate:string;endDate:string},today=todayLocalIso()){
 if(rental.status==='completed')return 'completed' as const;
 return rental.startDate>today?'upcoming' as const:'active' as const;
}
export function rentalEndLabel(endDate:string){return endDate?endDate.split('-').reverse().join('-'):'Open huurperiode';}
export function validateRentalCompletion(startDate:string,endDate:string,today=todayLocalIso()){
 rentalPeriodSchema.parse({startDate,endDate});
 if(!endDate)throw new Error('Vul bij afsluiten de werkelijke einddatum in.');
 if(endDate>today)throw new Error('De werkelijke einddatum mag niet in de toekomst liggen.');
}
export function rentalPeriodsOverlap(a:{startDate:string;endDate:string},b:{startDate:string;endDate:string}){
 const aEnd=a.endDate||'9999-12-31',bEnd=b.endDate||'9999-12-31';
 if(a.startDate===aEnd)return a.startDate>=b.startDate&&(a.startDate<bEnd||b.startDate===bEnd&&a.startDate===b.startDate);
 if(b.startDate===bEnd)return b.startDate>=a.startDate&&b.startDate<aEnd;
 return a.startDate<bEnd&&b.startDate<aEnd;
}
