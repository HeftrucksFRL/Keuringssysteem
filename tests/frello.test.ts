import {test} from "node:test";
import assert from "node:assert/strict";
import {frelloStateSchema,frelloSaveSchema,frelloCreateSchema,frelloBoardOrderSchema,orderFrelloBoards,moveFrelloBoard,moveFrelloColumn,moveFrelloCard,frelloDropBefore,persistFrelloOptimistically,validateFrelloUpload,initialFrelloState,type FrelloCard} from "../lib/frello";
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
import { frelloStatus,frelloStatuses } from '../lib/frello';

test('six card statuses preserve old boards and survive moves',()=>{
  const legacy=frelloStateSchema.parse({...state,cards:[card]});
  assert.equal(frelloStatus(legacy.cards[0].status).name,'Nog doen');
  assert.equal(frelloStatuses.length,6);
  for(const status of frelloStatuses){
    const saved=frelloStateSchema.parse({...state,cards:[{...card,status:status.id}]});
    const moved=moveFrelloCard(saved,card.id,state.columns[1].id);
    assert.equal(moved.cards[0].status,status.id);
    assert.equal(frelloStatus(moved.cards[0].status).name,status.name);
  }
  assert.equal(frelloStateSchema.safeParse({...state,cards:[{...card,status:'unknown'}]}).success,false);
});

test('board order is personal, preserves new boards and cannot reveal unavailable private boards',()=>{
 const a={id:crypto.randomUUID(),title:'Gezamenlijk'},b={id:crypto.randomUUID(),title:'Renze privé'},c={id:crypto.randomUUID(),title:'Nieuw'};
 const renze=orderFrelloBoards([a,b,c],[b.id,a.id]);assert.deepEqual(renze.map(b=>b.id),[b.id,a.id,c.id]);
 const age=orderFrelloBoards([a,c],[b.id,a.id]);assert.deepEqual(age.map(b=>b.id),[a.id,c.id]);
 assert.deepEqual(orderFrelloBoards([a,c],null),[a,c]);
 assert.deepEqual(moveFrelloBoard(renze,b.id,c.id).map(b=>b.id),[a.id,c.id,b.id]);
 assert.deepEqual(moveFrelloBoard(renze,c.id,b.id).map(b=>b.id),[c.id,b.id,a.id]);
 assert.equal(moveFrelloBoard(renze,'missing',a.id),renze);
 assert.equal(frelloBoardOrderSchema.safeParse({boardIds:[a.id,a.id]}).success,false);
 assert.equal(frelloBoardOrderSchema.safeParse({boardIds:[a.id],userId:b.id}).success,false);
 assert.equal(frelloBoardOrderSchema.safeParse({boardIds:[a.id,c.id]}).success,true);
});

test('columns move in both directions while preserving all cards and their column links',()=>{
 const original={...state,cards:[card]};
 const moved=moveFrelloColumn(original,original.columns[0].id,original.columns[2].id);
 assert.deepEqual(moved.columns.map(c=>c.id),[original.columns[1].id,original.columns[2].id,original.columns[0].id,...original.columns.slice(3).map(c=>c.id)]);
 assert.equal(moved.cards,original.cards);assert.equal(moved.cards[0].columnId,card.columnId);
 assert.deepEqual(moveFrelloColumn(moved,original.columns[0].id,original.columns[1].id),original);
 assert.equal(moveFrelloColumn(original,'missing',original.columns[0].id),original);
 assert.equal(moveFrelloColumn(original,original.columns[0].id,original.columns[0].id),original);
});
