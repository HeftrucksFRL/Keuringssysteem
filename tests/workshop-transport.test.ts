import {test} from "node:test";
import assert from "node:assert/strict";
import {prepareWorkshopSave,workshopSaveSchema,filterWorkshopDocuments,type WorkshopState} from "../lib/workshop";
import {normalizeWorkshopTransports,deleteTransportTicket,transportRelease,moveTransportTicket,returnWorkshopJob,validateTransportPlanning} from "../lib/workshop-transport";
const job={transportRequired:true,id:"one",number:"WB-0001",customer:"Klant",machine:"Machine",serial:"123",task:"Onderhoud",notes:"",employee:"mechanic",date:"2026-11-18",time:"08:00",duration:60,status:"Ingepland" as const,checks:[false,false,false] as [boolean,boolean,boolean],transport:null,requiredChecks:Array(10).fill(false) as boolean[],checkedPoints:Array(10).fill(false) as boolean[]};
const state:WorkshopState={employees:[{id:"mechanic",name:"Renze",role:"mechanic",canDrive:true},{id:"harm",name:"Harm",role:"driver"}],jobs:[job]};
const at="2026-11-18T14:00:00.000Z";
function approved(){const review={...state,jobs:[{...job,status:"Werkbon-controle" as const}]};return prepareWorkshopSave(review,{...review,jobs:[{...job,status:"Afgerond"}]},at,{canApprove:true,approvedBy:"Renze"});}
function paid(){const closed=approved();return prepareWorkshopSave(closed,{...closed,jobs:closed.jobs.map(j=>({...j,invoiceReference:"FACT-1",invoicePaidAt:at}))},at);}
test("an explicitly selected work order has exactly one independent preparation ticket",()=>{
 const next=prepareWorkshopSave({employees:state.employees,jobs:[]},state,at);assert.equal(next.transports?.length,1);assert.equal(next.transports?.[0].jobId,job.id);assert.equal(next.transports?.[0].driver,"");assert.equal(transportRelease(next.transports![0],next.jobs).allowed,false);assert.equal(normalizeWorkshopTransports(next).transports?.length,1);
});
test("only office can approve a checked work order, and checked transport can be scheduled without payment",()=>{
 assert.throws(()=>prepareWorkshopSave(state,{...state,jobs:[{...job,status:"Afgerond"}]},at),/eerst op Afronden/);
 const review={...state,jobs:[{...job,status:"Werkbon-controle" as const}]};assert.throws(()=>prepareWorkshopSave(review,{...review,jobs:[{...job,status:"Afgerond"}]},at,{canApprove:false,approvedBy:""}),/Alleen Renze/);
 const closed=approved();closed.transports![0].address="Klantadres";assert.equal(closed.jobs[0].officeApprovedBy,"Renze");assert.equal(transportRelease(closed.transports![0],closed.jobs).allowed,true);
 assert.equal(moveTransportTicket(closed,closed.transports![0].id,{driver:"harm",date:"2026-11-19",position:0}).transports![0].state,"Gepland");
 assert.throws(()=>prepareWorkshopSave(closed,{...closed,jobs:closed.jobs.map(j=>({...j,invoicePaidAt:at}))},at),/factuurnummer/);
 const forged={...closed,transports:closed.transports!.map(t=>({...t,legacyReleased:true}))};assert.throws(()=>prepareWorkshopSave(closed,forged,at),/vrijgave/);
});
test("paid transport moves between days and back to its tray, independent of appointment times",()=>{
 let next=paid();next.transports![0].address="Klantadres";const id=next.transports![0].id;
 next=moveTransportTicket(next,id,{driver:"harm",date:"2026-11-19",position:0});assert.equal(next.transports![0].appointmentTime,"");
 next=moveTransportTicket(next,id,{driver:"mechanic",date:"2026-11-20",position:2});assert.equal(next.transports![0].driver,"mechanic");assert.equal(next.transports![0].date,"2026-11-20");
 assert.equal(workshopSaveSchema.safeParse({version:0,state:next}).success,true);
 next=moveTransportTicket(next,id,{driver:"",date:"",position:2});assert.equal(next.transports![0].state,"Nieuw");assert.equal(next.transports![0].jobId,"one");assert.equal(next.jobs[0].invoicePaidAt,at);
});
test("standalone purchase pickups require no customer invoice and may share a time while retaining their sequence",()=>{
 const empty=normalizeWorkshopTransports({employees:state.employees,jobs:[]}),base={id:"pickup-one",kind:"Inkoop ophalen" as const,title:"Ingekochte truck ophalen",customer:"Leverancier",machine:"Linde",pickup:"Leveranciersadres",address:"Eigen werkplaats",contact:"",instructions:"Lader meenemen",driver:"harm",date:"2026-11-20",appointmentTime:"10:00",position:0,state:"Gepland" as const,confirmation:""};
 const next={...empty,transports:[base,{...base,id:"pickup-two",position:1}]};assert.doesNotThrow(()=>validateTransportPlanning(next));assert.equal(workshopSaveSchema.safeParse({version:0,state:next}).success,true);
});
test("general and stock work orders return only to their original workshop tray, preserving history",()=>{
 const stock={...job,kind:"Voorraadtruck" as const};assert.throws(()=>returnWorkshopJob({...state,jobs:[stock]},job.id,"general"),/Voorraadbonnen/);assert.throws(()=>returnWorkshopJob(state,job.id,"stock"),/Voorraadbonnen/);
 const returned=returnWorkshopJob({...state,jobs:[stock]},job.id,"stock");assert.equal(returned.jobs[0].employee,"");assert.equal(returned.jobs[0].date,"");assert.equal(returned.jobs[0].status,"Nieuw");assert.equal(returned.jobs[0].kind,"Voorraadtruck");
});
test("legacy scheduled transport migrates without losing dates, addresses or release",()=>{
 const legacy={...state,jobs:[{...job,status:"Klaar voor transport" as const,checks:[true,true,true] as [boolean,boolean,boolean],transport:{driver:"harm",date:"2026-11-19",time:"10:00",duration:60,pickup:"Werkplaats",address:"Klant",contact:"Jan",instructions:"Lader",state:"Gepland" as const,confirmation:""}}]};
 const next=normalizeWorkshopTransports(legacy);assert.equal(next.transports![0].date,"2026-11-19");assert.equal(next.transports![0].address,"Klant");assert.equal(next.jobs[0].transport,null);assert.equal(transportRelease(next.transports![0],next.jobs).allowed,true);assert.doesNotThrow(()=>prepareWorkshopSave(legacy,next,at));
});

test('transport deletion survives normalization and saves, retaining work order history and invoice state',()=>{
 const original=paid(),ticket=original.transports![0];ticket.pickup='Werkplaats';ticket.address='Klantadres';const planned=moveTransportTicket(original,ticket.id,{driver:'harm',date:'2026-11-19',position:0});
 const deleted=deleteTransportTicket(planned,ticket.id,at),saved=prepareWorkshopSave(planned,deleted,at);
 assert.deepEqual(saved.jobs,planned.jobs);assert.equal(saved.transports![0].deletedAt,at);
 assert.equal(normalizeWorkshopTransports(saved).transports!.length,1);assert.equal(normalizeWorkshopTransports(saved).transports![0].deletedAt,at);
 assert.equal(transportRelease(saved.transports![0],saved.jobs).allowed,false);
 assert.throws(()=>moveTransportTicket(saved,ticket.id,{driver:'harm',date:'2026-11-20',position:0}),/verwijderd/);
 const restored=prepareWorkshopSave(saved,{...saved,transports:saved.transports!.map(t=>({...t,deletedAt:undefined,driver:'',date:'',state:'Nieuw'}))},at);
 assert.equal(transportRelease(restored.transports![0],restored.jobs).allowed,true);
 const loose={...ticket,id:'loose',jobId:undefined,kind:'Inkoop ophalen' as const};const looseState={...original,transports:[...original.transports!,loose]};
 assert.equal(prepareWorkshopSave(looseState,deleteTransportTicket(looseState,'loose',at),at).transports!.find(t=>t.id==='loose')!.deletedAt,at);
});

test('legacy ready work orders become closed without inventing approvals, dates or payments',()=>{
 const legacy={...state,jobs:[{...job,status:'Klaar voor transport' as const,checks:[true,true,true] as [boolean,boolean,boolean],notes:'Historie bewaren',actualMinutes:125}]};
 const next=normalizeWorkshopTransports(legacy),closed=next.jobs[0];
 assert.equal(closed.status,'Afgerond');assert.equal(closed.notes,'Historie bewaren');assert.equal(closed.actualMinutes,125);
 assert.equal(closed.completedAt,undefined);assert.equal(closed.officeApprovedAt,undefined);assert.equal(closed.invoicePaidAt,undefined);
 assert.equal(filterWorkshopDocuments(legacy.jobs,{status:'completed'}).length,1);assert.equal(filterWorkshopDocuments(legacy.jobs,{status:'open'}).length,0);
 assert.equal(transportRelease(next.transports![0],next.jobs).allowed,true);
 const saved=prepareWorkshopSave(legacy,next,at);assert.equal(saved.jobs[0].completedAt,undefined);
 assert.throws(()=>prepareWorkshopSave(legacy,{...legacy,jobs:[]},at),/bewaard/);
 const active={...job,id:'active',number:'WB-0002'};assert.equal(workshopSaveSchema.safeParse({version:1,state:{...legacy,jobs:[...legacy.jobs,active]}}).success,true);
 const dated=normalizeWorkshopTransports({...legacy,jobs:[{...legacy.jobs[0],officeApprovedAt:at}]});assert.equal(dated.jobs[0].completedAt,at);
});
