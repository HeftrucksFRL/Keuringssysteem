import { z } from "zod";

const id=z.string().uuid();
const text=z.string().trim().max(10000);
const date=z.string().refine(v=>v===""||(/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v+"T12:00:00Z"))&&new Date(v+"T12:00:00Z").toISOString().slice(0,10)===v),"Ongeldige opvolgdatum");
export const frelloStateSchema=z.object({
  columns:z.array(z.object({id,name:z.string().trim().min(1).max(80)}).strict()).min(1).max(30),
  cards:z.array(z.object({
    id,columnId:id,title:z.string().trim().min(1).max(180),description:text,
    company:z.string().trim().max(180),contact:z.string().trim().max(180),
    email:z.union([z.string().trim().email().max(254),z.literal("")]),phone:z.string().trim().max(80),
    assignee:z.enum(["","Age","Renze"]),dueDate:date,labels:z.array(z.string().trim().min(1).max(40)).max(12),archived:z.boolean(),
    checklist:z.array(z.object({id,text:z.string().trim().min(1).max(500),done:z.boolean()}).strict()).max(100),
    comments:z.array(z.object({id,text:text.min(1),author:z.string().max(180),createdAt:z.string().datetime()}).strict()).max(100)
  }).strict()).max(1000)
}).strict().superRefine((state,ctx)=>{
  const fail=(message:string)=>ctx.addIssue({code:z.ZodIssueCode.custom,message});
  const columns=new Set(state.columns.map(c=>c.id));
  if(columns.size!==state.columns.length)fail("Kolommen moeten uniek zijn.");
  if(new Set(state.cards.map(c=>c.id)).size!==state.cards.length)fail("Kaarten moeten uniek zijn.");
  for(const card of state.cards){if(!columns.has(card.columnId))fail("Een kaart verwijst naar een ontbrekende kolom.");for(const list of [card.checklist,card.comments])if(new Set(list.map(i=>i.id)).size!==list.length)fail("Checklist- en reactie-ID’s moeten uniek zijn.");}
});
export type FrelloState=z.infer<typeof frelloStateSchema>;
export type FrelloCard=FrelloState["cards"][number];
export interface FrelloBoard {id:string;title:string;visibility:"shared"|"private";owner_id:string|null;version:number;updated_at:string;state?:FrelloState}
export interface FrelloFile {id:string;board_id:string;card_id:string;name:string;size:number;created_at:string}
export const frelloCreateSchema=z.object({title:z.string().trim().min(1).max(100),visibility:z.enum(["shared","private"])}).strict();
export const frelloSaveSchema=z.object({id,version:z.number().int().nonnegative(),title:z.string().trim().min(1).max(100),state:frelloStateSchema}).strict();
export function initialFrelloState():FrelloState{return {columns:["Nieuwe leads","Contact gelegd","Offerte verstuurd","Opvolgen","Gewonnen","Verloren"].map(name=>({id:crypto.randomUUID(),name})),cards:[]};}
export function moveFrelloCard(state:FrelloState,cardId:string,columnId:string,beforeId?:string):FrelloState{
  if(!state.columns.some(c=>c.id===columnId))return state;
  const card=state.cards.find(c=>c.id===cardId);if(!card||card.archived||cardId===beforeId)return state;
  const cards=state.cards.filter(c=>c.id!==cardId),moved={...card,columnId};
  const before=cards.findIndex(c=>c.id===beforeId&&c.columnId===columnId);
  if(before<0)cards.push(moved);else cards.splice(before,0,moved);
  if(card.columnId===columnId&&cards.every((c,i)=>c.id===state.cards[i].id))return state;
  return {...state,cards};
}
// Pick the insertion boundary, rather than always dropping before the hovered card.
export function frelloDropBefore(cards:{id:string;top:number;height:number}[],pointerY:number){
  return cards.find(c=>pointerY<c.top+c.height/2)?.id;
}
export async function persistFrelloOptimistically<T>(previous:T,next:T,persist:()=>Promise<T>,display:(value:T)=>void):Promise<T>{
  display(next);
  try{const confirmed=await persist();display(confirmed);return confirmed;}
  catch(error){display(previous);throw error;}
}
export const frelloFileExtensions=new Set(["pdf","png","jpg","jpeg","webp","gif","doc","docx","xls","xlsx","ppt","pptx","txt","csv","zip"]);
export function validateFrelloUpload(name:string,size:number){const ext=name.split(".").pop()?.toLowerCase()||"";return size>0&&size<=4*1024*1024&&frelloFileExtensions.has(ext);}
