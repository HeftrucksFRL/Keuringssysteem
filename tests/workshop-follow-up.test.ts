import {test} from 'node:test';
import assert from 'node:assert/strict';
import {followUpDue,followUpRole,pendingReplanning,updateFollowUp} from '../lib/workshop-follow-up';
import {prepareWorkshopSave,type WorkshopJob} from '../lib/workshop';
const job:WorkshopJob={id:'job',number:'WB-0001',createdAt:'2026-11-01T15:00:00Z',customer:'Klant',machine:'Truck',serial:'',task:'Reparatie',notes:'',employee:'',date:'',time:'08:00',duration:60,status:'Nieuw',checks:[false,false,false],transport:null};
test('three weeks uses Dutch calendar days and includes completed work awaiting invoicing',()=>{
 assert.equal(followUpDue(job,new Date('2026-11-21T22:59:59Z')),false);
 assert.equal(followUpDue(job,new Date('2026-11-21T23:00:00Z')),true);
 assert.equal(followUpDue({...job,status:'Afgerond'},new Date('2026-12-01')),true);
 for(const patch of [{deletedAt:'2026-11-25T00:00:00Z'},{status:'Geannuleerd' as const},{invoiceSentAt:'2026-11-25T00:00:00Z'}])assert.equal(followUpDue({...job,...patch},new Date('2026-12-01')),false);
 assert.equal(followUpDue({...job,createdAt:undefined,date:'2026-11-01'},new Date('2026-11-22T12:00:00Z')),true);
 assert.equal(followUpDue({...job,createdAt:undefined},new Date()),true);
});
test('shared postponement resurfaces at expiry and cannot accept invalid intervals',()=>{
 const now=new Date('2026-11-25T12:00:00Z'),snoozed=updateFollowUp(job,'snooze','Age',now,7);
 assert.equal(followUpDue(snoozed,new Date('2026-12-02T11:59:59Z')),false);
 assert.equal(followUpDue(snoozed,new Date('2026-12-02T12:00:00Z')),true);
 assert.equal(snoozed.followUp?.history[0].by,'Age');
 for(const days of [0,366,1.5,NaN])assert.throws(()=>updateFollowUp(job,'snooze','Age',now,days));
});
test('handoff keeps planning intact; confirmation requires changed, valid future planning',()=>{
 const now=new Date('2026-11-25T12:00:00Z'),requested=updateFollowUp(job,'request','Age',now,7,'Klant bellen');
 assert.equal(pendingReplanning(requested),true);assert.equal(requested.date,job.date);
 assert.throws(()=>updateFollowUp(requested,'request','Age',now),/al bij Renze/);
 assert.throws(()=>updateFollowUp(requested,'planned','Renze',now),/oorspronkelijke planning/);
 assert.throws(()=>updateFollowUp({...requested,date:'2026-11-24',employee:'monteur'},'planned','Renze',now),/opnieuw in/);
 const planned=updateFollowUp({...requested,date:'2026-11-26',employee:'monteur'},'planned','Renze',now);
 assert.equal(pendingReplanning(planned),false);assert.equal(planned.followUp?.history.length,2);
 const state={employees:[],jobs:[requested]};
 const saved=prepareWorkshopSave(state,{...state,jobs:[{...requested,followUp:undefined}]});
 assert.deepEqual(saved.jobs[0].followUp,requested.followUp);
});
test('account routing separates office reminders from Renze planning requests',()=>{
 assert.equal(followUpRole('INFO@TERPSTRATRADING.FRL'),'office');
 assert.equal(followUpRole('info@heftruckopleiding.frl'),'office');
 assert.equal(followUpRole('info@heftrucks.frl'),'planner');
 assert.equal(followUpRole('someone@example.com'),null);
});
