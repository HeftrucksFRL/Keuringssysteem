import {test} from "node:test";
import assert from "node:assert/strict";
import {applyWorkshopActivity,prepareWorkshopSave,workshopSaveSchema,workshopActivitySchema,type WorkshopState} from "../lib/workshop";
const employees=[{id:"mechanic",name:"Jelle",role:"mechanic" as const},{id:"driver",name:"Age",role:"driver" as const}];
const job={id:"one",number:"WB-0001",customer:"Klant",machine:"Machine",customerId:"customer",machineId:"machine",serial:"123",task:"Mast controleren. Hefkettingen smeren.",notes:"",employee:"mechanic",date:"2026-11-18",time:"08:00",duration:60,status:"Ingepland" as const,checks:[false,false,false] as [boolean,boolean,boolean],transport:null,requiredChecks:Array.from({length:10},(_,i)=>i===3),checkedPoints:Array(10).fill(false) as boolean[]};
const state:WorkshopState={employees,jobs:[job]};
const activity={requestId:"d3e82ffa-f8c2-41e1-9c8c-c4f07cb92398",jobId:"one",employeeId:"mechanic",action:"review" as const,text:""};
test("review is blocked until every planner-selected check is complete, including direct API calls",()=>{
 assert.throws(()=>applyWorkshopActivity(state,activity),/controlepunten/);
 const checked=job.checkedPoints.map((_,i)=>i===3);
 const next=applyWorkshopActivity(state,{...activity,checkedPoints:checked});
 assert.equal(next.jobs[0].status,"Werkbon-controle");assert.deepEqual(next.jobs[0].requiredChecks,job.requiredChecks);
 assert.equal(workshopSaveSchema.safeParse({version:1,state:next}).success,true);
 assert.throws(()=>applyWorkshopActivity(next,{...activity,requestId:"d3e82ffa-f8c2-41e1-9c8c-c4f07cb92399",action:"check",checkedPoints:Array(10).fill(false)}),/onvolledige/);
 assert.equal(workshopActivitySchema.safeParse({...activity,checkedPoints:[true]}).success,false);
});
test("only selected checks are required; the planner cannot release or archive incomplete work",()=>{
 for(const status of ["Werkbon-controle","Klaar voor transport","Afgerond"]){assert.equal(workshopSaveSchema.safeParse({version:0,state:{...state,jobs:[{...job,status,checks:[true,true,true]}]}}).success,false);}
 const checkedPoints=Array.from({length:10},(_,i)=>i===3);
 assert.equal(workshopSaveSchema.safeParse({version:0,state:{...state,jobs:[{...job,status:"Afgerond",checkedPoints}]}}).success,true);
 assert.equal(workshopSaveSchema.safeParse({version:0,state:{...state,jobs:[{...job,machineId:undefined}]}}).success,false);
});
test("archived jobs retain IDs, timestamps, updates and learned sentences and free planning slots",()=>{
 const done={...job,status:"Afgerond" as const,checkedPoints:Array(10).fill(true),actualMinutes:75};
 const next=prepareWorkshopSave(state,{...state,jobs:[done]},"2026-11-18T14:00:00.000Z");
 assert.equal(next.jobs[0].completedAt,"2026-11-18T14:00:00.000Z");assert.equal(next.jobs[0].machineId,"machine");assert.equal(next.jobs[0].customerId,"customer");assert.equal(next.jobs[0].actualMinutes,75);
 assert.deepEqual(next.taskSuggestions,["Mast controleren","Hefkettingen smeren"]);
 assert.equal(prepareWorkshopSave(next,next,"2026-11-19T14:00:00.000Z").jobs[0].completedAt,next.jobs[0].completedAt);
 assert.throws(()=>prepareWorkshopSave(next,{...next,jobs:[]}),/bewaard/);
 assert.throws(()=>applyWorkshopActivity(next,{...activity,action:"start"}),/afgerond/);
 assert.equal(workshopSaveSchema.safeParse({version:0,state:{...next,jobs:[...next.jobs,{...job,id:"two",number:"WB-0002"}]}}).success,true);
 const reopened=prepareWorkshopSave(next,{...next,jobs:[job]});assert.equal(reopened.jobs[0].completedAt,undefined);
});
test("deleting a draft keeps learned sentences and never reuses its work order number",()=>{
 const learned=prepareWorkshopSave({employees,jobs:[]},state);
 const removed=prepareWorkshopSave(learned,{employees,jobs:[]});
 assert.equal(removed.nextJobNumber,2);assert.deepEqual(removed.taskSuggestions,learned.taskSuggestions);
});
test("mechanics can claim stock work once; scheduling skips occupied slots and rejects wrong job types or drivers",()=>{
 const stock={...job,id:"stock",number:"WB-0002",kind:"Voorraadtruck" as const,status:"Nieuw" as const,employee:"",date:"",estimatedMinutes:60};
 const original={employees,jobs:[job,stock]};
 const claim={...activity,jobId:"stock",action:"claim" as const};
 const next=applyWorkshopActivity(original,claim,"2026-11-18T07:00:00.000Z");
 assert.equal(next.jobs[1].employee,"mechanic");assert.equal(next.jobs[1].date,"2026-11-18");assert.equal(next.jobs[1].time,"09:00");assert.equal(next.jobs[1].status,"Mee bezig");assert.equal(workshopSaveSchema.safeParse({version:0,state:next}).success,true);
 assert.equal(applyWorkshopActivity(next,claim),next);
 assert.throws(()=>applyWorkshopActivity(next,{...claim,requestId:"d3e82ffa-f8c2-41e1-9c8c-c4f07cb92399"}),/niet meer/);
 assert.throws(()=>applyWorkshopActivity(original,{...claim,employeeId:"driver"}),/niet meer/);
 assert.throws(()=>applyWorkshopActivity({...original,jobs:[{...stock,kind:"Klantreparatie"}]},claim),/niet meer/);
});
