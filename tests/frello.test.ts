import {test} from "node:test";
import assert from "node:assert/strict";
import {frelloStateSchema,frelloSaveSchema,frelloCreateSchema,moveFrelloCard,frelloDropBefore,persistFrelloOptimistically,validateFrelloUpload,initialFrelloState,type FrelloCard} from "../lib/frello";
import {workshopViewerRequestAllowed} from "../lib/workshop-access";
const state=initialFrelloState();
const card:FrelloCard={id:crypto.randomUUID(),columnId:state.columns[0].id,title:"Lead",description:"",company:"",contact:"",email:"",phone:"",assignee:"Age",dueDate:"",labels:[],archived:false,checklist:[],comments:[]};
test("cards can move between columns and reorder without losing data",()=>{
  const second={...card,id:crypto.randomUUID(),title:"Tweede"};
  const current={...state,cards:[card,second]};
  const moved=moveFrelloCard(current,card.id,state.columns[1].id);
  assert.equal(moved.cards.find(c=>c.id===card.id)?.columnId,state.columns[1].id);
  assert.equal(moved.cards.find(c=>c.id===card.id)?.title,"Lead");
  assert.equal(current.cards[0].columnId,state.columns[0].id);
  assert.deepEqual(moveFrelloCard(current,second.id,state.columns[0].id,card.id).cards.map(c=>c.id),[second.id,card.id]);
  assert.equal(moveFrelloCard(current,card.id,"missing"),current);
});
test("board schemas reject dangling cards, duplicate IDs, invalid dates and privacy changes",()=>{
  assert.equal(frelloStateSchema.safeParse({...state,cards:[card]}).success,true);
  assert.equal(frelloStateSchema.safeParse({...state,cards:[card,card]}).success,false);
  assert.equal(frelloStateSchema.safeParse({...state,cards:[{...card,columnId:crypto.randomUUID()}]}).success,false);
  assert.equal(frelloStateSchema.safeParse({...state,cards:[{...card,dueDate:"2026-02-30"}]}).success,false);
  const payload={id:crypto.randomUUID(),title:"Privé",version:0,state};
  assert.equal(frelloSaveSchema.safeParse(payload).success,true);
  assert.equal(frelloSaveSchema.safeParse({...payload,visibility:"shared"}).success,false);
  assert.equal(frelloSaveSchema.safeParse({...payload,owner_id:crypto.randomUUID()}).success,false);
  assert.equal(frelloCreateSchema.safeParse({title:"Privé",visibility:"private"}).success,true);
});
test("tablets cannot reach lead data or upload files",()=>{
  for(const path of ["/frello","/api/frello","/api/frello/bijlagen"])for(const method of ["GET","POST","PUT"])assert.equal(workshopViewerRequestAllowed(path,method),false);
});
test("attachments have a bounded size and reject executable or active web files",()=>{
  assert.equal(validateFrelloUpload("offerte.pdf",100),true);
  assert.equal(validateFrelloUpload("gegevens.xlsx",500),true);
  for(const file of ["x.exe","x.html","x.svg","x.js","x.pdf.exe"])assert.equal(validateFrelloUpload(file,100),false);
  assert.equal(validateFrelloUpload("x.pdf",0),false);
  assert.equal(validateFrelloUpload("x.pdf",11*1024*1024),false);
});
test("drop position follows card midpoints and unchanged drops do not trigger a save",()=>{
  const bounds=[{id:'first',top:100,height:80},{id:'second',top:200,height:80}];
  assert.equal(frelloDropBefore(bounds,110),'first');
  assert.equal(frelloDropBefore(bounds,150),'second');
  assert.equal(frelloDropBefore(bounds,250),undefined);
  assert.equal(frelloDropBefore([],250),undefined);
  const single={...state,cards:[card]};
  assert.equal(moveFrelloCard(single,card.id,card.columnId),single);
});
test("a slow save displays the move immediately and adopts the server version later",async()=>{
  let confirm!:(v:string)=>void;const displayed:string[]=[];
  const pending=new Promise<string>(resolve=>{confirm=resolve;});
  const saving=persistFrelloOptimistically('original','moved',()=>pending,v=>displayed.push(v));
  assert.deepEqual(displayed,['moved']);
  confirm('confirmed');await saving;
  assert.deepEqual(displayed,['moved','confirmed']);
});
test("a rejected or offline save rolls back the optimistic movement",async()=>{
  const displayed:string[]=[];
  await assert.rejects(persistFrelloOptimistically('original','moved',async()=>{throw new Error('conflict');},v=>displayed.push(v)),/conflict/);
  assert.deepEqual(displayed,['moved','original']);
});
