import { test } from "node:test";
import assert from "node:assert/strict";
import { workshopSaveSchema } from "../lib/workshop";

const employees=[{id:"mechanic",name:"Jelle",role:"mechanic"},{id:"driver",name:"Age",role:"driver"}];
const job={id:"one",number:"WB-0001",customer:"Klant",machine:"Machine",serial:"123",task:"Onderhoud",notes:"",employee:"mechanic",date:"2026-11-12",time:"08:00",duration:120,status:"Ingepland",checks:[false,false,false],transport:null};
const parse=(jobs: unknown[])=>workshopSaveSchema.safeParse({version:0,state:{employees,jobs}});
test("workshop enforces employee references, real dates, and complete ready checks",()=>{
  assert.equal(parse([job]).success,true);
  assert.equal(parse([{...job,employee:"driver"}]).success,false);
  assert.equal(parse([{...job,date:"2026-02-30"}]).success,false);
  assert.equal(parse([{...job,status:"Klaar voor transport"}]).success,false);
  assert.equal(parse([{...job,date:"",employee:"",status:"Nieuw"}]).success,true);
});
test("workshop rejects overlaps, permits back-to-back jobs, and rejects duplicate numbers",()=>{
  assert.equal(parse([job,{...job,id:"two",number:"WB-0002",time:"09:00"}]).success,false);
  assert.equal(parse([job,{...job,id:"two",number:"WB-0002",time:"10:00"}]).success,true);
  assert.equal(parse([job,{...job,id:"two",time:"10:00"}]).success,false);
});
test("transport requires a ready machine, assigned chauffeur, full addresses and delivery confirmation",()=>{
  const transport={driver:"driver",date:"2026-11-13",time:"08:00",duration:60,pickup:"Werkplaats",address:"Klantadres",contact:"Klant 0612345678",instructions:"Lader mee",state:"Gepland",confirmation:""};
  assert.equal(parse([{...job,transport}]).success,false);
  const ready={...job,status:"Klaar voor transport",checks:[true,true,true],transport};
  assert.equal(parse([ready]).success,true);
  assert.equal(parse([{...ready,transport:{...transport,address:""}}]).success,false);
  assert.equal(parse([{...ready,transport:{...transport,state:"Afgeleverd"}}]).success,false);
  assert.equal(parse([{...ready,transport:{...transport,state:"Afgeleverd",confirmation:"Ontvangen door Jan"}}]).success,true);
});
