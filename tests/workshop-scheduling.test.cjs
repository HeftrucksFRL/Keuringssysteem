const {test}=require('node:test');
const assert=require('node:assert/strict');
const {collision,weekStart,addDays}=require('../modules/werkplaats/assets/planning.js');
const job={id:'one',employee:'a',date:'2026-11-12',time:'08:00',duration:120,status:'Ingepland'};
test('a monteur cannot be double-booked, adjacent appointments are allowed',()=>{
  assert.equal(collision([job],{...job,id:'two',time:'09:00'},'workshop'),true);
  assert.equal(collision([job],{...job,id:'two',time:'10:00'},'workshop'),false);
  assert.equal(collision([job],{...job,id:'two',employee:'b'},'workshop'),false);
  assert.equal(collision([job],{...job,id:'two',date:'2026-11-13'},'workshop'),false);
  assert.equal(collision([job],job,'workshop'),false);
});
test('chauffeur conflicts only include active, transport-ready work orders',()=>{
  const ready={...job,status:'Klaar voor transport',transport:{driver:'d',date:'2026-11-13',time:'09:00',duration:60,state:'Gepland'}};
  const candidate={...ready,id:'two'};
  assert.equal(collision([ready],candidate,'driver'),true);
  assert.equal(collision([{...ready,status:'Pauze'}],candidate,'driver'),false);
  assert.equal(collision([{...ready,transport:{...ready.transport,state:'Afgeleverd'}}],candidate,'driver'),false);
  assert.equal(collision([ready],{...candidate,transport:{...ready.transport,time:'10:00'}},'driver'),false);
});
test('week navigation crosses year boundaries and starts on Monday',()=>{
  assert.equal(weekStart('2027-01-03'),'2026-12-28');
  assert.equal(weekStart('2026-11-12'),'2026-11-09');
  assert.equal(addDays('2026-12-28',7),'2027-01-04');
});
