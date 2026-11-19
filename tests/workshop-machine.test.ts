import test from 'node:test';
import assert from 'node:assert/strict';
import {workshopMachineSnapshot,workshopHourReadingChange} from '../lib/workshop-machine';
import type {WorkshopJob} from '../lib/workshop';
test('machine snapshot keeps brand/type, internal number, serial and meter separate',()=>{
  const snapshot=workshopMachineSnapshot({brand:'Linde',model:'E20',internalNumber:'254',serialNumber:'SN-123',configuration:{hour_reading:'4580'}});
  assert.deepEqual(snapshot,{machine:'Linde · E20',internalNumber:'254',serial:'SN-123',hourReading:'4580'});
  assert.equal(workshopMachineSnapshot({brand:'BT',model:'SPE160L',internalNumber:'',serialNumber:'SN-9',configuration:{}}).internalNumber,'');
});
test('only a changed or newly linked meter reading updates a machine; planning older jobs cannot roll back its meter',()=>{
  const job={machineId:'m',hourReading:'1234'} as WorkshopJob;
  assert.equal(workshopHourReadingChange(job,{...job,date:'2026-11-20'}),null);
  assert.deepEqual(workshopHourReadingChange(job,{...job,hourReading:'1240.5'}),{machineId:'m',hourReading:'1240.5'});
  assert.deepEqual(workshopHourReadingChange(undefined,job),{machineId:'m',hourReading:'1234'});
  assert.equal(workshopHourReadingChange(job,{...job,hourReading:''}),null);
  assert.throws(()=>workshopHourReadingChange(job,{...job,hourReading:'-1'}),/urenstand/);
});
