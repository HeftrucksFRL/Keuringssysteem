import { z } from "zod";

export const orderStatuses=["Nieuw","In behandeling","Besteld","Ontvangen","Afgewezen"] as const;
export const orderCategories=["Onderdeel","Gereedschap","Verbruiksmateriaal","Overig"] as const;
const date=z.string().refine(v=>v===""||(/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v+"T12:00:00Z"))&&new Date(v+"T12:00:00Z").toISOString().slice(0,10)===v),"Ongeldige datum");
export const orderRequestSchema=z.object({
  id:z.string().uuid(),item:z.string().trim().min(1).max(180),category:z.enum(orderCategories),
  quantity:z.number().finite().positive().max(100000),unit:z.string().trim().min(1).max(40),
  employeeId:z.string().min(1).max(80),jobId:z.string().max(80),
  needBy:date,urgency:z.enum(["Normaal","Spoed"]),partNumber:z.string().trim().max(180),notes:z.string().trim().max(3000)
}).strict();
export const orderUpdateSchema=z.object({id:z.string().uuid(),version:z.number().int().min(0),status:z.enum(orderStatuses),managerNote:z.string().trim().max(3000),supplier:z.string().trim().max(180),reference:z.string().trim().max(180)}).strict();
export type OrderRequest=z.infer<typeof orderRequestSchema>;
export type OrderDetails=OrderRequest & {employeeName:string;jobNumber:string;machine:string};
export interface WorkshopOrder {
  id:string;details:OrderDetails;status:typeof orderStatuses[number];version:number;
  manager_note:string;supplier:string;reference:string;created_at:string;updated_at:string;
}
export const orderIsOpen=(status:string)=>!["Ontvangen","Afgewezen"].includes(status);
export const orderNeedsPurchase=(status:string)=>["Nieuw","In behandeling"].includes(status);
