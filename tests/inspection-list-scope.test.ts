import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectionListScope} from '../lib/inspection-list-scope';
test('database scope keeps the same day, month, week and draft filters with real month ends',()=>{
  const now=new Date('2026-02-18T12:00:00Z');
  assert.deepEqual(inspectionListScope({},now),{});
  assert.deepEqual(inspectionListScope({period:'day',status:'draft'},now),{from:'2026-02-18',to:'2026-02-18',status:'draft'});
  assert.deepEqual(inspectionListScope({period:'month'},now),{from:'2026-02-01',to:'2026-02-28'});
  assert.deepEqual(inspectionListScope({period:'month'},new Date('2028-02-18T12:00:00Z')),{from:'2028-02-01',to:'2028-02-29'});
  assert.deepEqual(inspectionListScope({week:'current',period:'month'},new Date('2026-11-01T12:00:00Z')),{from:'2026-11-01',to:'2026-11-01'});
});
