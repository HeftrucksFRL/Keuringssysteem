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
  for(const status of ['Afgerond','Klaar voor transport'])assert.equal(collision([{...job,status}],{...job,id:'two'},'workshop'),false);
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

test('end times preserve existing durations and reject backwards ranges through negative duration',()=>{
  const {endTime,durationUntil}=require('../modules/werkplaats/assets/planning.js');
  for(const [start,duration,end] of [['08:00',120,'10:00'],['08:15',195,'11:30'],['23:00',60,'00:00']]){
    assert.equal(endTime(start,duration),end);assert.equal(durationUntil(start,end),duration);
  }
  assert.equal(durationUntil('10:00','09:00'),-60);
  assert.equal(durationUntil('08:00','08:00'),0);
});
test('dragging carries a work order into the next or previous week across year boundaries',()=>{
 const {weekCarryDestination}=require('../modules/werkplaats/assets/planning.js');
 assert.deepEqual(weekCarryDestination('2026-11-19','2026-11-16',1),{week:'2026-11-23',date:'2026-11-26'});
 assert.deepEqual(weekCarryDestination('2027-01-08','2027-01-04',-1),{week:'2026-12-28',date:'2027-01-01'});
 assert.deepEqual(weekCarryDestination('2026-11-19','2026-11-23',1,true),{week:'2026-11-23',date:'2026-11-26'});
});
