import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import {mergeWorkshopChanges,WorkshopConflict} from '../lib/workshop-storage';
import {prepareWorkshopSave,type WorkshopState} from '../lib/workshop';

const machine='10000000-0000-0000-0000-000000000001',stock='20000000-0000-0000-0000-000000000001',buyer='20000000-0000-0000-0000-000000000002';
const employee={id:'mechanic',name:'Monteur',role:'mechanic' as const};
const job={id:'one',number:'WB-0001',customer:'Voorraad',customerId:stock,machineId:machine,machine:'Truck',serial:'123',task:'Onderhoud',notes:'',employee:'mechanic',date:'2026-12-01',time:'08:00',duration:60,status:'Ingepland' as const,checks:[false,false,false] as [boolean,boolean,boolean],transport:null};
const base:WorkshopState={employees:[employee],jobs:[job]};

test('different work orders merge while same-order changes conflict; new numbers remain unique',()=>{
 const two={...job,id:'two',number:'WB-0002',time:'10:00'};
 const original={...base,jobs:[job,two]};
 const next={...original,jobs:[{...job,notes:'A'},two]};
 const latest={...original,jobs:[job,{...two,notes:'B'}]};
 const merged=mergeWorkshopChanges(original,next,latest);
 assert.deepEqual(merged.jobs.map(j=>j.notes),['A','B']);
 assert.throws(()=>mergeWorkshopChanges(original,next,{...original,jobs:[{...job,notes:'C'},two]}),WorkshopConflict);
 const added={...job,id:'new',number:'WB-0002',time:'12:00'};
 const created=mergeWorkshopChanges(base,{...base,jobs:[job,added]},{...base,jobs:[job,two]});
 assert.equal(created.jobs[2].number,'WB-0003');assert.equal(created.jobs[2].id,'new');
 assert.equal(added.number,'WB-0002','merge must not mutate the submitted state');
});

test('reopening preserves payment, records the office event and withdraws undelivered transport',()=>{
 const paid={...job,status:'Afgerond' as const,completedAt:'2026-11-25T10:00:00.000Z',officeApprovedAt:'2026-11-25T10:00:00.000Z',invoiceReference:'F1',invoicePaidAt:'2026-11-25T11:00:00.000Z'};
 const state=prepareWorkshopSave({...base,jobs:[paid]},{...base,jobs:[{...paid,status:'Ingepland'}]});
 assert.equal(state.jobs[0].invoicePaidAt,paid.invoicePaidAt);assert.equal(state.jobs[0].officeApprovedAt,undefined);
 assert.equal(state.jobs[0].officeHistory?.[0].action,'reopened');
 assert.equal(state.transports?.[0].state,'Nieuw');
 assert.throws(()=>prepareWorkshopSave({...base,jobs:[paid]},{...base,jobs:[{...paid,status:'Ingepland'}]},undefined,{canApprove:false,approvedBy:'Monteur'}),/kantoor/);
});

async function database(){
 const db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create role service_role;
 create type machine_availability_status as enum('available','rented','maintenance');
 create table customers(id uuid primary key,company_name text,address_line_1 text,contact_name text,phone text,email text);
 create table machines(id uuid primary key,customer_id uuid references customers(id),availability_status machine_availability_status default 'available',configuration jsonb default '{}',updated_at timestamptz);
 create table rentals(id uuid primary key default gen_random_uuid(),machine_id uuid references machines(id),customer_id uuid,start_date date,end_date date,status text default 'active');
 create table planning_items(id uuid primary key,machine_id uuid,customer_id uuid,state text,updated_at timestamptz);
 create table inspections(id uuid primary key,machine_id uuid,customer_id uuid,customer_snapshot jsonb,status text,pdf_path text,word_path text,updated_at timestamptz);
 create table inspection_attachments(id uuid primary key,inspection_id uuid,kind text);
 create table workshop_planning(id integer primary key,version bigint,state jsonb);`);
 await db.query('insert into customers(id,company_name) values($1,$2),($3,$4)',[stock,'Heftrucks.frl',buyer,'Koper']);
 await db.query("insert into machines(id,customer_id,configuration) values($1,$2,'{\"hour_reading\":\"100\",\"other\":\"keep\"}')",[machine,stock]);
 await db.query('insert into workshop_planning values(1,4,$1)',[JSON.stringify(base)]);
 await db.exec(await readFile('supabase/workshop-relational.sql','utf8'));
 return db;
}
async function state(db:PGlite){return (await db.query<{state:WorkshopState}>('select state from workshop_state')).rows[0].state;}
async function save(db:PGlite,previous:WorkshopState,next:WorkshopState,changes:unknown[]=[]){
 return db.query('select save_workshop_changes($1,$2,null,$3)',[JSON.stringify(previous),JSON.stringify(next),JSON.stringify(changes)]);
}

test('PostgreSQL migration preserves records and is repeatable; independent stale writes both succeed',async()=>{
 const db=await database();try{
  const original=await state(db);assert.equal(original.jobs[0].id,'one');assert.equal(original.transports?.length,1);
  await db.exec(await readFile('supabase/workshop-relational.sql','utf8'));
  const second={...job,id:'two',number:'WB-0002',time:'10:00'};
  await save(db,original,{...original,jobs:[...original.jobs,second]});
  // A stale form changing only bon one must preserve newly created bon two.
  await save(db,original,{...original,jobs:[{...original.jobs[0],notes:'first'}]});
  assert.equal((await state(db)).jobs.length,2);
  await assert.rejects(save(db,original,{...original,jobs:[{...original.jobs[0],notes:'stale'}]}),/intussen/);
  assert.equal((await state(db)).jobs[0].notes,'first');
 }finally{await db.close();}
});

test('PostgreSQL rollback keeps machine, work order and inspection together on every failed save',async()=>{
 const db=await database();try{
  const original=await state(db),next={...original,jobs:[{...original.jobs[0],notes:'changed'}]};
  await assert.rejects(save(db,original,next,[{machineId:machine,expectedCustomerId:stock,customerId:buyer,hourReading:'101',expectedHourReading:'wrong'}]),/urenstand/);
  assert.equal((await state(db)).jobs[0].notes,'');
  const row=(await db.query<{customer_id:string;configuration:Record<string,string>}>('select * from machines')).rows[0];
  assert.equal(row.customer_id,stock);assert.equal(row.configuration.hour_reading,'100');
  // Failure after the actual machine update must roll that update back as well.
  const conflict={...job,id:'overlap',number:'WB-0002',time:'08:30'};
  await assert.rejects(save(db,original,{...next,jobs:[...next.jobs,conflict]},[{machineId:machine,expectedCustomerId:stock,customerId:buyer,hourReading:'101',expectedHourReading:'100'}]),/overlappende/);
  assert.equal((await db.query<{customer_id:string}>('select customer_id from machines')).rows[0].customer_id,stock);
  assert.equal((await state(db)).jobs.length,1);
  await save(db,original,next,[{machineId:machine,expectedCustomerId:stock,customerId:buyer,hourReading:'101',expectedHourReading:'100'}]);
  const changed=(await db.query<{customer_id:string;configuration:Record<string,string>}>('select * from machines')).rows[0];
  assert.equal(changed.customer_id,buyer);assert.equal(changed.configuration.hour_reading,'101');assert.equal(changed.configuration.other,'keep');
 }finally{await db.close();}
});

test('database blocks rental/workshop conflicts in either order, double rentals and stock transfer during rental',async()=>{
 const db=await database();try{
  const rental=(start:string,end:string)=>db.query('insert into rentals(machine_id,customer_id,start_date,end_date) values($1,$2,$3,$4)',[machine,buyer,start,end]);
  await assert.rejects(rental('2026-12-01','2026-12-03'),/werkplaatswerk/);
  await rental('2026-12-02','2026-12-05');
  await assert.rejects(rental('2026-12-03','2026-12-06'),/al verhuurd/);
  await rental('2026-12-05','2026-12-06'); // switch day remains valid
  const original=await state(db);
  await assert.rejects(save(db,original,{...original,jobs:[{...original.jobs[0],date:'2026-12-03'}]}),/verhuurd/);
  await assert.rejects(save(db,original,{...original,jobs:[{...original.jobs[0],notes:'sale'}]},[{machineId:machine,expectedCustomerId:stock,customerId:buyer}]),/verhuur/);
  assert.equal((await state(db)).jobs[0].date,'2026-12-01');
  await assert.rejects(db.query("update machines set availability_status='maintenance' where id=$1",[machine]),/verhuur/);
 }finally{await db.close();}
});

test('database grants no tablet or anonymous access to raw records or the save function',async()=>{
 const db=await database();try{
  for(const role of ['anon','authenticated']){
   const result=await db.query<{can_read:boolean;can_write:boolean;can_execute:boolean}>(`select
     has_table_privilege($1,'public.workshop_jobs','SELECT') can_read,
     has_table_privilege($1,'public.workshop_jobs','UPDATE') can_write,
     has_function_privilege($1,'public.save_workshop_changes(jsonb,jsonb,uuid,jsonb)','EXECUTE') can_execute`,[role]);
   assert.deepEqual(result.rows[0],{can_read:false,can_write:false,can_execute:false});
  }
 }finally{await db.close();}
});
