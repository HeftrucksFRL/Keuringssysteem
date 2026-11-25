import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import {rentalPeriodSchema,rentalPeriodsOverlap,rentalPhase,validateRentalCompletion} from '../lib/rental';
import {normalizeWorkshopTransports} from '../lib/workshop-transport';
import {prepareWorkshopSave,type WorkshopState} from '../lib/workshop';
const machine='10000000-0000-0000-0000-000000000001',owner='20000000-0000-0000-0000-000000000001',customer='20000000-0000-0000-0000-000000000002',id='30000000-0000-0000-0000-000000000001';
async function database(){const db=new PGlite();await db.exec(`
 create role anon;create role authenticated;create role service_role;
 create type machine_availability_status as enum('available','rented','maintenance');
 create table customers(id uuid primary key,company_name text,address_line_1 text,contact_name text,phone text,email text);
 create table machines(id uuid primary key,customer_id uuid references customers(id),brand text,model text,availability_status machine_availability_status default 'available',configuration jsonb default '{}',updated_at timestamptz);
 create table rentals(id uuid primary key default gen_random_uuid(),machine_id uuid references machines(id),customer_id uuid references customers(id),start_date date not null,end_date date not null,status text default 'active',price text,updated_at timestamptz default now());
 create table planning_items(id uuid primary key,machine_id uuid,customer_id uuid,state text,updated_at timestamptz);
 create table inspections(id uuid primary key,machine_id uuid,customer_id uuid,customer_snapshot jsonb,status text,pdf_path text,word_path text,updated_at timestamptz);
 create table inspection_attachments(id uuid primary key,inspection_id uuid,kind text);
 create table workshop_planning(id integer primary key,version bigint,state jsonb);
 insert into workshop_planning values(1,0,'{"employees":[],"jobs":[]}');`);
 await db.query('insert into customers(id,company_name) values($1,$2),($3,$4)',[owner,'Heftrucks.frl',customer,'Huurklant']);
 await db.query('insert into machines(id,customer_id,brand,model) values($1,$2,$3,$4)',[machine,owner,'Linde','E20']);
 await db.exec(await readFile('supabase/workshop-relational.sql','utf8'));
 await db.exec(await readFile('supabase/rental-open-transport.sql','utf8'));await db.exec(await readFile('supabase/workshop-archive-bin.sql','utf8'));await db.exec(await readFile('supabase/workshop-transport-without-payment.sql','utf8'));return db;
}
const input=(transport={})=>({machineId:machine,customerId:customer,startDate:'2026-11-01',endDate:'',price:'100',transport});
async function save(db:PGlite,action:string,data:unknown,version=0,rentalId=id){return (await db.query<{value:Record<string,unknown>}>('select save_rental($1,$2,$3,$4) value',[rentalId,action,JSON.stringify(data),version])).rows[0].value;}
test('known and open end dates validate; closing always requires a real date',()=>{
 assert.equal(rentalPeriodSchema.safeParse({startDate:'2026-11-01',endDate:''}).success,true);
 assert.equal(rentalPeriodSchema.safeParse({startDate:'2026-11-01',endDate:'2026-11-20'}).success,true);
 for(const endDate of ['2026-02-30','2026-10-31'])assert.equal(rentalPeriodSchema.safeParse({startDate:'2026-11-01',endDate}).success,false);
 assert.equal(rentalPeriodsOverlap({startDate:'2026-11-01',endDate:''},{startDate:'2030-01-01',endDate:'2030-02-01'}),true);
 assert.equal(rentalPeriodsOverlap({startDate:'2026-11-01',endDate:'2026-11-10'},{startDate:'2026-11-10',endDate:''}),false);
 assert.equal(rentalPhase({status:'active',startDate:'2026-11-01',endDate:''},'2026-11-25'),'active');
 assert.throws(()=>validateRentalCompletion('2026-11-01','','2026-11-25'),/einddatum/);
 assert.throws(()=>validateRentalCompletion('2026-11-01','2026-11-26','2026-11-25'),/toekomst/);
});
test('work orders create no transport until selected; existing tickets and disabled history are retained',()=>{
 const job={id:'job',number:'WB-0001',customer:'Klant',machine:'Machine',serial:'',task:'Werk',notes:'',employee:'',date:'',time:'08:00',duration:60,status:'Nieuw' as const,checks:[false,false,false] as [boolean,boolean,boolean],transport:null};
 const state:WorkshopState={employees:[],jobs:[job]};
 assert.equal(normalizeWorkshopTransports(state).transports?.length,0);
 const enabled=prepareWorkshopSave(state,{...state,jobs:[{...job,transportRequired:true}]});assert.equal(enabled.transports?.length,1);
 const disabled=prepareWorkshopSave(enabled,{...enabled,jobs:[{...enabled.jobs[0],transportRequired:false}]});assert.ok(disabled.transports?.[0].deletedAt);
 assert.equal(normalizeWorkshopTransports(disabled).transports?.length,1);
 const restored=prepareWorkshopSave(disabled,{...disabled,jobs:[{...disabled.jobs[0],transportRequired:true}]});assert.equal(restored.transports?.[0].deletedAt,undefined);
});
test('database keeps known dates, supports an open period, prevents overlaps and requires completion date',async()=>{
 const db=await database();try{
  const created=await save(db,'create',input());assert.equal(created.end_date,null);
  assert.equal((await db.query('select * from workshop_transports')).rows.length,0);
  assert.equal((await db.query<{availability_status:string}>('select availability_status from machines')).rows[0].availability_status,'rented');
  await assert.rejects(db.query('update machines set customer_id=$1 where id=$2',[customer,machine]),/verhuur/);
  const previous=(await db.query<{state:unknown}>('select state from workshop_state')).rows[0].state;
  await assert.rejects(db.query('select save_workshop_changes($1,$2,null)',[JSON.stringify(previous),JSON.stringify({employees:[],jobs:[{id:'test',number:'WB-0001',machineId:machine,status:'Nieuw',employee:'',date:'2030-01-01'}],transports:[]})]),/verhuurd/);
  await assert.rejects(save(db,'create',{...input(),startDate:'2030-01-01',endDate:'2030-02-01'},0,'30000000-0000-0000-0000-000000000002'),/verhuurd/);
  await assert.rejects(save(db,'complete',{endDate:''},1),/einddatum/);
  await save(db,'update',{...input(),endDate:'2026-11-20'},1);
  const row=await save(db,'complete',{endDate:'2026-11-19'},2);assert.equal(row.status,'completed');
  assert.equal(String(row.end_date),'2026-11-19');
  await db.exec(await readFile('supabase/rental-open-transport.sql','utf8'));
  assert.equal((await db.query('select * from rentals')).rows.length,1);
 }finally{await db.close();}
});
test('rental and two optional transport tickets commit together; stale edits cannot overwrite them',async()=>{
 const db=await database();try{
  const transport={delivery:true,collection:true,address:'Klantadres',contact:'Huurder',instructions:'Bel vooraf'};
  await save(db,'create',input(transport));
  let tickets=(await db.query<{data:Record<string,unknown>}>('select data from workshop_transports order by id')).rows;
  assert.equal(tickets.length,2);assert.deepEqual(new Set(tickets.map(t=>t.data.rentalLeg)),new Set(['delivery','collection']));
  assert.equal(tickets.find(t=>t.data.rentalLeg==='delivery')?.data.pickup,'Eigen werkplaats');
  assert.equal(tickets.find(t=>t.data.rentalLeg==='collection')?.data.address,'Eigen werkplaats');
  await assert.rejects(save(db,'update',input({...transport,delivery:false}),0),/intussen/);
  await assert.rejects(save(db,'complete',{endDate:'2026-11-20'},1),/ophaaltransport/);
  await save(db,'update',input({...transport,delivery:false}),1);
  assert.equal((await db.query("select * from workshop_transports where data->>'deletedAt' is null")).rows.length,1);
  await db.exec("update workshop_transports set data=data||'{\"state\":\"Afgeleverd\",\"confirmation\":\"Terug in werkplaats\"}' where data->>'rentalLeg'='collection'");
  await save(db,'complete',{endDate:'2026-11-20'},2);
  assert.equal((await db.query<{status:string}>("select status from rentals")).rows[0].status,'completed');
 }finally{await db.close();}
});

test('archived work orders release machines and tolerate removed employees',async()=>{
 const db=await database();try{
 await db.query("insert into workshop_jobs(id,data) values('archived',$1)",[JSON.stringify({id:'archived',number:'WB-0001',machineId:machine,status:'Nieuw',employee:'removed',date:'2026-11-10',deletedAt:'2026-11-09T10:00:00Z'})]);
 await save(db,'create',input());
 const previous=(await db.query<{state:any}>('select state from workshop_state')).rows[0].state;
 await db.query('select save_workshop_changes($1,$2,null)',[JSON.stringify(previous),JSON.stringify({...previous,employees:[{id:'new',name:'Monteur'}]})]);
 assert.equal((await db.query('select * from workshop_jobs')).rows.length,1);
 }finally{await db.close();}
});

test('database schedules approved transport without invoice or payment and retains technical release guard',async()=>{
 const db=await database();try{
 await db.exec(await readFile('supabase/workshop-transport-without-payment.sql','utf8'));
 const previous=(await db.query<{state:any}>('select state from workshop_state')).rows[0].state;
 const state={...previous,employees:[{id:'driver',name:'Chauffeur',role:'driver'}],jobs:[{id:'unpaid',number:'WB-0001',status:'Afgerond',employee:'',date:''}],transports:[{id:'transport-unpaid',jobId:'unpaid',kind:'Werkbon',driver:'driver',date:'2026-12-01',state:'Gepland'}]};
 await db.query('select save_workshop_changes($1,$2,null)',[JSON.stringify(previous),JSON.stringify(state)]);
 assert.equal((await db.query<{data:any}>("select data from workshop_transports where id='transport-unpaid'")).rows[0].data.state,'Gepland');
 await assert.rejects(db.query('select save_workshop_changes($1,$2,null)',[JSON.stringify(state),JSON.stringify({...state,jobs:[{...state.jobs[0],status:'Nieuw'}]})]),/kantoorcontrole/);
 }finally{await db.close();}
});
