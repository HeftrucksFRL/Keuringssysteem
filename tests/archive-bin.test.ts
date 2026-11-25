import {test} from 'node:test';
import assert from 'node:assert/strict';
import {prepareWorkshopSave,filterWorkshopDocuments,isWorkshopJobClosed,applyWorkshopActivity,workshopSaveSchema,type WorkshopState} from '../lib/workshop';
import {transportRelease,moveTransportTicket} from '../lib/workshop-transport';
import {initialFrelloState,deleteFrelloCard,restoreFrelloCard,prepareFrelloSave} from '../lib/frello';
const at='2026-11-25T12:00:00.000Z';
const job={id:'one',number:'WB-0001',customer:'Klant',machine:'Truck',serial:'123',task:'Onderhoud',notes:'Bewaren',employee:'mechanic',date:'2026-11-25',time:'08:00',duration:60,status:'Mee bezig' as const,checks:[false,false,false] as [boolean,boolean,boolean],transport:null,transportRequired:true,actualMinutes:65};
const state:WorkshopState={employees:[{id:'mechanic',name:'Monteur',role:'mechanic'}],jobs:[job]};
test('deleting a work order retains its complete record, server audit and transport history, and frees its slot',()=>{
 const original=prepareWorkshopSave({employees:state.employees,jobs:[]},state,at);
 const deleted=prepareWorkshopSave(original,{...original,jobs:[{...original.jobs[0],notes:'forged',deletedAt:at,deletedBy:'forged'}]},at,{canApprove:true,approvedBy:'Age'});
 assert.equal(deleted.jobs[0].notes,'Bewaren');assert.equal(deleted.jobs[0].status,'Mee bezig');assert.equal(deleted.jobs[0].actualMinutes,65);assert.equal(deleted.jobs[0].deletedBy,'Age');
 assert.equal(isWorkshopJobClosed(deleted.jobs[0]),true);assert.ok(deleted.transports?.[0].deletedAt);
 assert.equal(transportRelease({...deleted.transports![0],deletedAt:undefined},deleted.jobs).allowed,false);
 assert.throws(()=>moveTransportTicket(deleted,deleted.transports![0].id,{driver:'mechanic',date:'2026-11-25',position:0}),/verwijderd/);
 assert.equal(filterWorkshopDocuments(deleted.jobs,{status:'all'}).length,0);assert.equal(filterWorkshopDocuments(deleted.jobs,{status:'deleted'}).length,1);
 assert.equal(workshopSaveSchema.safeParse({version:1,state:{...deleted,jobs:[...deleted.jobs,{...job,id:'two',number:'WB-0002'}]}}).success,true);
 assert.throws(()=>applyWorkshopActivity(deleted,{requestId:crypto.randomUUID(),jobId:job.id,employeeId:'mechanic',action:'note',text:'No'}),/afgerond/);
 assert.throws(()=>prepareWorkshopSave(deleted,{...deleted,jobs:[]}),/bewaard/);
});
test('restoring open work orders is unplanned and keeps route withdrawal and the original scheduling history',()=>{
 const deleted=prepareWorkshopSave(state,{...state,jobs:[{...job,deletedAt:at}]},at);
 const restored=prepareWorkshopSave(deleted,{...deleted,jobs:[{...deleted.jobs[0],deletedAt:undefined,task:'forged'}]},at);
 assert.equal(restored.jobs[0].task,job.task);assert.equal(restored.jobs[0].deletedAt,undefined);assert.equal(restored.jobs[0].status,'Nieuw');assert.equal(restored.jobs[0].employee,'');assert.equal(restored.jobs[0].date,'');
 assert.equal(restored.jobs[0].archiveHistory?.[0].date,job.date);assert.equal(restored.jobs[0].archiveHistory?.[0].employee,job.employee);assert.equal(restored.jobs[0].archiveHistory?.[1].action,'restored');assert.ok(restored.transports?.[0].deletedAt);
 assert.equal(workshopSaveSchema.safeParse({version:1,state:restored}).success,true);
});
test('archiving and restoring a completed paid order preserves approval, payment and closing date',()=>{
 const done={...job,status:'Afgerond' as const,invoiceReference:'F1',invoicePaidAt:at,officeApprovedAt:at,officeApprovedBy:'Age',completedAt:at};
 const original={...state,jobs:[done]};const deleted=prepareWorkshopSave(original,{...original,jobs:[{...done,deletedAt:at}]},at);
 const restored=prepareWorkshopSave(deleted,{...deleted,jobs:[{...deleted.jobs[0],deletedAt:undefined}]},at);
 assert.equal(restored.jobs[0].status,'Afgerond');assert.equal(restored.jobs[0].invoicePaidAt,at);assert.equal(restored.jobs[0].completedAt,at);assert.equal(restored.jobs[0].officeApprovedAt,at);
});
test('Frello deletion and legacy array removal preserve comments, checklists, columns and restoration',()=>{
 const base=initialFrelloState(),card={id:crypto.randomUUID(),columnId:base.columns[0].id,title:'Bewaren',description:'Notitie',company:'Klant',contact:'',email:'',phone:'',assignee:'' as const,dueDate:'',labels:['Spoed'],archived:false,checklist:[{id:crypto.randomUUID(),text:'Controle',done:true}],comments:[{id:crypto.randomUUID(),text:'Historie',author:'Age',createdAt:at}]};
 const original={...base,cards:[card]};
 for(const proposed of [deleteFrelloCard(original,card.id),{...original,cards:[]}]){
  const archived=prepareFrelloSave(original,proposed,at,'Renze');assert.equal(archived.cards.length,1);assert.equal(archived.cards[0].archived,true);assert.equal(archived.cards[0].archivedBy,'Renze');assert.deepEqual(archived.cards[0].comments,card.comments);assert.deepEqual(archived.cards[0].checklist,card.checklist);
  const restored=prepareFrelloSave(archived,restoreFrelloCard(archived,card.id),at,'Age');assert.equal(restored.cards[0].archived,false);assert.equal(restored.cards[0].columnId,card.columnId);assert.equal(restored.cards[0].archiveHistory?.length,2);
 }
});
